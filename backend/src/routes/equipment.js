const express = require('express');
const { pool, getSubtreeIds } = require('../db/index');
const { requireAuth, requireRole, requireLogistics, ROLE_LEVEL, LOGISTICS_ROLES } = require('../middleware/auth');

// KVM sits in Kompanistab — scope up to the parent Kompani so they see all unit members
const email = require('../services/email');

async function getLogisticsScope(user) {
  if (user.role === 'kvm') {
    const r = await pool.query('SELECT parent_id FROM org_units WHERE id=$1', [user.org_unit_id]);
    const parentId = r.rows[0]?.parent_id ?? user.org_unit_id;
    return getSubtreeIds(parentId);
  }
  return getSubtreeIds(user.org_unit_id);
}

const router = express.Router();
router.use(requireAuth);

// GET /api/equipment/my-kit — all templates + personal status (ej_tilldelad if no row)
router.get('/my-kit', async (req, res) => {
  const standard = await pool.query(`
    SELECT
      t.id            AS template_id,
      t.article_number,
      t.name,
      t.category,
      t.quantity      AS std_quantity,
      t.unit,
      t.image_path,
      t.description,
      e.id            AS equipment_id,
      COALESCE(e.status, 'ej_tilldelad') AS status,
      ec.id           AS active_case_id,
      ec.type         AS active_case_type
    FROM equipment_templates t
    LEFT JOIN equipment e
      ON e.user_id = $1 AND e.article_number = t.article_number
    LEFT JOIN LATERAL (
      SELECT id, type, status AS case_status FROM equipment_cases
      WHERE equipment_id = e.id AND status IN ('pending','pc_review','approved')
      ORDER BY created_at DESC LIMIT 1
    ) ec ON e.id IS NOT NULL
    ORDER BY t.category, t.name
  `, [req.user.id]);

  // Extra items: in equipment but not matching any template article number
  const extra = await pool.query(`
    SELECT e.*,
           ec.id   AS active_case_id,
           ec.type AS active_case_type
    FROM equipment e
    LEFT JOIN LATERAL (
      SELECT id, type FROM equipment_cases
      WHERE equipment_id = e.id AND status IN ('pending','pc_review')
      ORDER BY created_at DESC LIMIT 1
    ) ec ON true
    WHERE e.user_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM equipment_templates t WHERE t.article_number = e.article_number
      )
    ORDER BY e.category, e.name
  `, [req.user.id]);

  res.json({ standard: standard.rows, extra: extra.rows });
});

// GET /api/equipment/mine
router.get('/mine', async (req, res) => {
  const result = await pool.query(`
    SELECT e.*,
           ec.id AS active_case_id,
           ec.type AS active_case_type
    FROM equipment e
    LEFT JOIN LATERAL (
      SELECT id, type, status AS case_status FROM equipment_cases
      WHERE equipment_id = e.id AND status IN ('pending','pc_review','approved')
      ORDER BY created_at DESC LIMIT 1
    ) ec ON true
    WHERE e.user_id = $1
    ORDER BY e.category, e.name
  `, [req.user.id]);
  res.json(result.rows);
});

// GET /api/equipment/unit — shortfall summary for my unit (grpc+)
router.get('/unit', requireRole('grpc'), async (req, res) => {
  const ids = await getSubtreeIds(req.user.org_unit_id);
  const result = await pool.query(`
    SELECT e.*, u.name AS user_name, u.org_unit_id,
           o.name AS unit_name
    FROM equipment e
    JOIN users u ON u.id = e.user_id
    JOIN org_units o ON o.id = u.org_unit_id
    WHERE u.org_unit_id = ANY($1)
    AND e.status != 'ok'
    ORDER BY u.name, e.category, e.name
  `, [ids]);
  res.json(result.rows);
});

// GET /api/equipment/cases/:id — single case with full data (owner or kvm+)
router.get('/cases/:id', async (req, res) => {
  const result = await pool.query(`
    SELECT ec.*,
           e.name AS equipment_name, e.article_number, e.quantity,
           u.name AS user_name, u.personal_number, u.email, u.mobile,
           o.name AS unit_name,
           r.name AS reviewer_name
    FROM equipment_cases ec
    JOIN equipment e ON e.id = ec.equipment_id
    JOIN users u ON u.id = ec.user_id
    JOIN org_units o ON o.id = u.org_unit_id
    LEFT JOIN users r ON r.id = ec.reviewer_id
    WHERE ec.id = $1
  `, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  const c = result.rows[0];
  if (c.user_id !== req.user.id && !LOGISTICS_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(c);
});

// POST /api/equipment/cases — create case
// Accepts either equipment_id (existing row) or template_id (auto-creates equipment row)
router.post('/cases', async (req, res) => {
  const {
    equipment_id, template_id, type, description,
    incident_time, incident_location, incident_description,
    witnesses, agrees_to_compensate,
  } = req.body;

  let eq_id = equipment_id;

  // Article not yet in user's equipment — auto-create from template
  if (!eq_id && template_id) {
    const tmpl = await pool.query(
      'SELECT * FROM equipment_templates WHERE id=$1', [template_id]
    );
    if (!tmpl.rows.length) return res.status(404).json({ error: 'Mall hittades inte' });
    const t = tmpl.rows[0];
    const eq = await pool.query(
      `INSERT INTO equipment (user_id, article_number, name, category, quantity, unit, source)
       VALUES ($1,$2,$3,$4,$5,$6,'standard')
       ON CONFLICT (user_id, article_number) DO UPDATE SET updated_at=NOW()
       RETURNING id`,
      [req.user.id, t.article_number, t.name, t.category, t.quantity, t.unit || 'ST']
    );
    eq_id = eq.rows[0].id;
  }

  if (!eq_id) return res.status(400).json({ error: 'equipment_id eller template_id krävs' });

  const statusMap = {
    ej_mottagen: 'ej_mottagen',
    beställning:  'byte_pågår',
    förlust:      'förlustanmäld',
  };

  await pool.query(
    'UPDATE equipment SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3',
    [statusMap[type], eq_id, req.user.id]
  );
  const result = await pool.query(
    `INSERT INTO equipment_cases
       (user_id, equipment_id, type, description,
        incident_time, incident_location, incident_description,
        witnesses, agrees_to_compensate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, eq_id, type, description,
     incident_time || null, incident_location || null, incident_description || null,
     witnesses || null, agrees_to_compensate ?? null]
  );
  res.status(201).json(result.rows[0]);
});

// POST /api/equipment/cases/:id/received — soldat kvitterar mottaget ersättningsmateriel
router.post('/cases/:id/received', async (req, res) => {
  const c = await pool.query(
    'SELECT * FROM equipment_cases WHERE id=$1', [req.params.id]
  );
  if (!c.rows.length) return res.status(404).json({ error: 'Not found' });
  const ec = c.rows[0];
  if (ec.user_id !== req.user.id && !LOGISTICS_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query(
    `UPDATE equipment_cases SET status='material_received',
     material_received_at=NOW(), material_received_by=$1 WHERE id=$2`,
    [req.user.id, req.params.id]
  );
  await pool.query(
    "UPDATE equipment SET status='ok', updated_at=NOW() WHERE id=$1",
    [ec.equipment_id]
  );
  res.json({ ok: true });
});

// GET /api/equipment/cases — pending cases for my unit (logistics)
router.get('/cases', requireLogistics, async (req, res) => {
  const ids = await getLogisticsScope(req.user);
  const result = await pool.query(`
    SELECT ec.*, e.name AS equipment_name, e.article_number,
           u.name AS user_name
    FROM equipment_cases ec
    JOIN equipment e ON e.id = ec.equipment_id
    JOIN users u ON u.id = ec.user_id
    WHERE u.org_unit_id = ANY($1) AND ec.status IN ('pending','pc_review')
    ORDER BY ec.created_at ASC
  `, [ids]);
  res.json(result.rows);
});

// POST /api/equipment/cases/:id/decide — logistics approves/rejects
router.post('/cases/:id/decide', requireLogistics, async (req, res) => {
  const { action, pc_comment } = req.body; // action: 'approve'|'reject'
  const caseResult = await pool.query(
    'SELECT * FROM equipment_cases WHERE id=$1', [req.params.id]
  );
  if (!caseResult.rows.length) return res.status(404).json({ error: 'Not found' });
  const ec = caseResult.rows[0];

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const newEquipStatus = action === 'approve' ? 'ej_tilldelad' : 'ok';

  await pool.query(
    `UPDATE equipment_cases SET status=$1, pc_comment=$2,
     reviewer_id=$3, reviewed_at=NOW(), updated_at=NOW() WHERE id=$4`,
    [newStatus, pc_comment || null, req.user.id, req.params.id]
  );

  if (ec.type === 'ej_mottagen') {
    await pool.query(
      'UPDATE equipment SET status=$1, updated_at=NOW() WHERE id=$2',
      [newEquipStatus, ec.equipment_id]
    );
  }

  res.json({ ok: true, status: newStatus });

  // Notifiera soldaten
  pool.query(
    'SELECT u.email, t.name FROM equipment_cases ec JOIN users u ON u.id=ec.user_id LEFT JOIN equipment_templates t ON t.article_number=ec.article_number WHERE ec.id=$1',
    [req.params.id]
  ).then(r => {
    if (!r.rows.length) return;
    email.notifyEquipmentDecided(r.rows[0].email, action, r.rows[0].name || 'Artikel', pc_comment);
  }).catch(e => console.error('[notify equipment]', e.message));
});

// POST /api/equipment/templates/assign — assign standard list to unit (logistics)
router.post('/templates/assign', requireLogistics, async (req, res) => {
  const { org_unit_id } = req.body;
  const templates = await pool.query(
    'SELECT * FROM equipment_templates WHERE org_unit_id=$1', [org_unit_id]
  );
  const members = await pool.query(
    'SELECT id FROM users WHERE org_unit_id=$1', [org_unit_id]
  );
  let created = 0;
  for (const user of members.rows) {
    for (const t of templates.rows) {
      await pool.query(
        `INSERT INTO equipment (user_id,article_number,name,category,quantity)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [user.id, t.article_number, t.name, t.category, t.quantity]
      );
      created++;
    }
  }
  res.json({ created });
});

module.exports = router;
