const express = require('express');
const path = require('path');
const fs = require('fs');
const { PDFDocument, PDFName } = require('pdf-lib');
const { pool } = require('../db/index');
const { requireAuth, requireLogistics } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const PDF_PATH = path.join(__dirname, '../../uploads/docs/forlustforteckning-decrypted.pdf');

// GET /api/kvm/settings
router.get('/settings', requireLogistics, async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM kvm_settings WHERE org_unit_id=$1', [req.user.org_unit_id]
  );
  res.json(r.rows[0] || { org_unit_id: req.user.org_unit_id });
});

// PUT /api/kvm/settings
router.put('/settings', requireLogistics, async (req, res) => {
  const { myndighet, materielutlamnare, kvm_initialer, foradsplats, natv_order, kostbadsstalle, transkod, vernr, konto, kloss } = req.body;
  const r = await pool.query(
    `INSERT INTO kvm_settings (org_unit_id, myndighet, materielutlamnare, kvm_initialer, foradsplats, natv_order, kostbadsstalle, transkod, vernr, konto, kloss, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (org_unit_id) DO UPDATE SET
       myndighet=$2, materielutlamnare=$3, kvm_initialer=$4, foradsplats=$5,
       natv_order=$6, kostbadsstalle=$7, transkod=$8, vernr=$9, konto=$10, kloss=$11, updated_at=NOW()
     RETURNING *`,
    [req.user.org_unit_id, myndighet, materielutlamnare, kvm_initialer, foradsplats, natv_order, kostbadsstalle, transkod, vernr, konto, kloss]
  );
  res.json(r.rows[0]);
});

// GET /api/kvm/cases/:id/afse — generera fylld förlustförteckning
router.get('/cases/:id/afse', requireLogistics, async (req, res) => {
  const caseResult = await pool.query(
    `SELECT ec.*, e.name AS equipment_name, e.article_number, e.quantity, e.unit, e.category,
            u.name AS user_name, u.personal_number,
            o.name AS unit_name
     FROM equipment_cases ec
     JOIN equipment e ON e.id = ec.equipment_id
     JOIN users u ON u.id = ec.user_id
     JOIN org_units o ON o.id = u.org_unit_id
     WHERE ec.id=$1`,
    [req.params.id]
  );
  if (!caseResult.rows.length) return res.status(404).json({ error: 'Not found' });
  const ec = caseResult.rows[0];

  const settingsResult = await pool.query(
    'SELECT * FROM kvm_settings WHERE org_unit_id=$1', [req.user.org_unit_id]
  );
  const s = settingsResult.rows[0] || {};

  const incidentDate = ec.incident_time ? new Date(ec.incident_time) : new Date();
  const yyyy = String(incidentDate.getFullYear());
  const mm   = String(incidentDate.getMonth() + 1).padStart(2, '0');
  const dd   = String(incidentDate.getDate()).padStart(2, '0');

  const pdfBuf = fs.readFileSync(PDF_PATH);
  const pdf = await PDFDocument.load(pdfBuf);
  const form = pdf.getForm();

  // Rensa AP-streams och widget-nivå DA så pdf-lib regenererar med rätt font på alla sidor
  for (const field of form.getFields()) {
    for (const widget of field.acroField.getWidgets()) {
      widget.dict.delete(PDFName.of('AP'));
      widget.dict.delete(PDFName.of('DA'));
    }
  }

  const set = (name, val, fontSize = 8) => {
    try {
      const f = form.getTextField(name);
      f.setFontSize(fontSize);
      f.setText(val || '');
    } catch {}
  };
  const check = (name, on) => {
    try {
      const btn = form.getCheckBox(name);
      on ? btn.check() : btn.uncheck();
    } catch {}
  };

  // KVM-inställningar
  set('myndighet',         s.myndighet || '');
  set('materielutlamnare', s.materielutlamnare || '');
  set('301',               s.kvm_initialer || '');
  set('foradsplats',       s.foradsplats || '');
  set('natv order',        s.natv_order || '');
  set('kostbadsstalle',    s.kostbadsstalle || '');
  set('transkod',          s.transkod || '');
  set('vernr',             s.vernr || '');
  set('konto',             s.konto || '');
  set('kloss',             s.kloss || '');

  // Datum
  set('ar',  yyyy);
  set('man', mm);
  set('dag', dd);

  // Soldat
  set('persnr namn', [ec.personal_number, ec.user_name].filter(Boolean).join(' '));

  // Artikel (rad 1): övre rad = förrådsbeteckning (kod), undre rad = förrådsbenämning (namn)
  set('foradsbenammning1', ec.article_number || '');   // övre rad, kol 1 = artikelkod
  set('foradsbenamning2',  ec.equipment_name || '');   // undre rad, kol 1 = artikelnamn
  set('antal',             String(ec.quantity || 1));
  set('enhet',             ec.unit || 'ST');

  // Förlustbeskrivning
  set('tidplats',          ec.incident_location || '');
  set('redogorelseforlust', ec.incident_description || ec.description || '');

  // Beställs ej (standard)
  check('bestallas ej', true);
  check('bestallas', false);

  // Tyg-checkbox om kategori är kläder/tyg, annars avmarkera alla materialslag
  const isTyp = /tyg|kläder|uniform|bälte|strumpa|vantar?|mössa/i.test(ec.category || '');
  check('tyg',      isTyp);
  check('flyg',     false);
  check('int',      false);
  check('sjukvard', false);

  // Beslutsfält — lämnas tomma (fylls manuellt)
  check('overlammnas mynd', false);
  check('ersatt',           false);
  check('arende slut',      false);

  form.flatten();
  const outBuf = await pdf.save();

  // Markera att AFSE genererats
  await pool.query(
    'UPDATE equipment_cases SET afse_generated_at=NOW() WHERE id=$1',
    [req.params.id]
  );

  const filename = `afse-${ec.user_name?.replace(/\s+/g, '-') || ec.id}-${yyyy}${mm}${dd}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(outBuf));
});

// GET /api/kvm/afse-history — förlustärenden med AFSE-status
router.get('/afse-history', requireLogistics, async (req, res) => {
  const { getSubtreeIds } = require('../db/index');
  const ids = await getSubtreeIds(req.user.org_unit_id);
  const r = await pool.query(
    `SELECT ec.id, ec.status, ec.created_at, ec.afse_generated_at, ec.material_received_at,
            u.name AS user_name, u.personal_number,
            e.name AS equipment_name, e.article_number,
            o.name AS unit_name
     FROM equipment_cases ec
     JOIN equipment e ON e.id = ec.equipment_id
     JOIN users u ON u.id = ec.user_id
     JOIN org_units o ON o.id = u.org_unit_id
     WHERE ec.type = 'förlust' AND u.org_unit_id = ANY($1)
     ORDER BY ec.created_at DESC`,
    [ids]
  );
  res.json(r.rows);
});

// POST /api/kvm/cases/:id/material-received — KVM bekräftar mottaget ersättningsmateriel
router.post('/cases/:id/material-received', requireLogistics, async (req, res) => {
  await pool.query(
    'UPDATE equipment_cases SET material_received_at=NOW(), material_received_by=$1 WHERE id=$2',
    [req.user.id, req.params.id]
  );
  await pool.query(
    "UPDATE equipment SET status='ok', updated_at=NOW() WHERE id=(SELECT equipment_id FROM equipment_cases WHERE id=$1)",
    [req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
