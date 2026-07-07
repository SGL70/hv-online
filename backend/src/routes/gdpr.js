const express = require('express');
const { pool } = require('../db/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const { findContactCandidates, findStaleActivityResponses } = require('../services/retention');

const router = express.Router();
router.use(requireAuth);

// GET /api/gdpr/retention-candidates — flaggning för manuell granskning, ingen
// automatisk åtgärd. S4+ agerar på dessa via befintlig anonymize-knapp respektive
// DELETE /activity-responses/:id nedan.
router.get('/retention-candidates', requireRole('s4'), async (req, res) => {
  const [contacts, responses] = await Promise.all([
    findContactCandidates(),
    findStaleActivityResponses(),
  ]);
  res.json({ contacts: contacts.rows, stale_activity_responses: responses.rows });
});

// DELETE /api/gdpr/activity-responses/:id — radera ett enskilt, gammalt OSA-svar
// (ja/nej/kanske utan attesteringskedja, ofarligt att radera rakt av).
router.delete('/activity-responses/:id', requireRole('s4'), async (req, res) => {
  const result = await pool.query(
    'DELETE FROM activity_responses WHERE id=$1 RETURNING id',
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Hittades inte' });
  res.json({ ok: true });
});

// POST /api/gdpr/:userId/anonymize — rätt att bli glömd (Art. 17).
// Anonymiserar i stället för att radera raden, eftersom rapporter/ärenden/
// aktivitetssvar refererar users.id (bl.a. med ON DELETE CASCADE på flera
// tabeller) — en hård radering skulle förstöra historik som ska sparas enligt
// retention-kraven. Kontroll av retention (t.ex. 7 år för SÄVA/km-ersättning)
// är inte automatiserad än — den som utför anonymiseringen ansvarar för det.
// GET /api/gdpr/:userId/export — registerutdrag (Art. 15). Egna uppgifter,
// eller s4+ som slår upp någon annan.
router.get('/:userId/export', async (req, res) => {
  const userId = Number(req.params.userId);
  const isSelf = req.user.id === userId;
  const S4_LEVEL_ROLES = ['s4', 'batCh', 'stab'];
  if (!isSelf && !S4_LEVEL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const profile = await pool.query(
    `SELECT id, hv_id, name, role, personal_number, email, mobile,
            street, postal_code, city, rank, created_at, last_login,
            service_ended_at, anonymized_at
     FROM users WHERE id=$1`,
    [userId]
  );
  if (!profile.rows.length) return res.status(404).json({ error: 'Användaren finns inte' });

  const [reports, equipment, cases, responses, inventories] = await Promise.all([
    pool.query(
      `SELECT r.*, a.title AS activity_title FROM reports r
       LEFT JOIN activities a ON a.id = r.activity_id
       WHERE r.user_id=$1 ORDER BY r.report_date DESC`,
      [userId]
    ),
    pool.query(
      `SELECT e.* FROM equipment e WHERE e.user_id=$1 ORDER BY e.category, e.name`,
      [userId]
    ),
    pool.query(
      `SELECT ec.*, e.name AS equipment_name FROM equipment_cases ec
       JOIN equipment e ON e.id = ec.equipment_id
       WHERE ec.user_id=$1 ORDER BY ec.created_at DESC`,
      [userId]
    ),
    pool.query(
      `SELECT ar.*, a.title AS activity_title, a.start_time FROM activity_responses ar
       JOIN activities a ON a.id = ar.activity_id
       WHERE ar.user_id=$1 ORDER BY a.start_time DESC`,
      [userId]
    ),
    // Endast sessionsnivå — vad som faktiskt räknades in per artikel sparas inte
    // separat, utan appliceras direkt på equipment/equipment_cases (se migrate_inventory.sql).
    pool.query(
      `SELECT * FROM inventories WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    ),
  ]);

  res.json({
    profil: profile.rows[0],
    rapporter: reports.rows,
    utrustning: equipment.rows,
    utrustningsarenden: cases.rows,
    aktivitetssvar: responses.rows,
    inventeringstillfallen: inventories.rows,
  });
});

router.post('/:userId/anonymize', requireRole('s4'), async (req, res) => {
  const existing = await pool.query('SELECT anonymized_at FROM users WHERE id=$1', [req.params.userId]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Användaren finns inte' });
  if (existing.rows[0].anonymized_at) return res.status(400).json({ error: 'Redan anonymiserad' });

  const result = await pool.query(
    `UPDATE users SET
       name = 'Anonymiserad soldat',
       personal_number = NULL,
       email = NULL, mobile = NULL,
       street = NULL, postal_code = NULL, city = NULL,
       rank = NULL,
       anonymized_at = NOW()
     WHERE id = $1
     RETURNING id, hv_id, name, role, org_unit_id, anonymized_at`,
    [req.params.userId]
  );
  res.json(result.rows[0]);
});

module.exports = router;
