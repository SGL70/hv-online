const express = require('express');
const { pool, getSubtreeIds } = require('../db/index');
const { requireAuth, requireLogistics } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function getLogisticsScope(user) {
  if (user.role === 'kvm') {
    const r = await pool.query('SELECT parent_id FROM org_units WHERE id=$1', [user.org_unit_id]);
    return r.rows[0]?.parent_id ?? user.org_unit_id;
  }
  return user.org_unit_id;
}

// GET /api/inventory/mine — open inventory for current user (null if none)
router.get('/mine', async (req, res) => {
  const r = await pool.query(
    `SELECT i.*, u.name AS initiated_by_name
     FROM inventories i
     LEFT JOIN users u ON u.id = i.initiated_by
     WHERE i.user_id = $1 AND i.status = 'open'
     ORDER BY i.created_at DESC LIMIT 1`,
    [req.user.id]
  );
  res.json(r.rows[0] || null);
});

// GET /api/inventory/last — last submitted inventory date for current user
router.get('/last', async (req, res) => {
  const r = await pool.query(
    `SELECT submitted_at FROM inventories
     WHERE user_id = $1 AND status = 'submitted'
     ORDER BY submitted_at DESC LIMIT 1`,
    [req.user.id]
  );
  res.json(r.rows[0] || null);
});

// POST /api/inventory/start — KVM initiates for their kompani
router.post('/start', requireLogistics, async (req, res) => {
  const { deadline } = req.body;
  const scopeId = await getLogisticsScope(req.user);
  const subtree = await getSubtreeIds(scopeId);

  const members = await pool.query(
    'SELECT id FROM users WHERE org_unit_id = ANY($1)', [subtree]
  );

  for (const m of members.rows) {
    // Close any open inventory first
    await pool.query(
      `UPDATE inventories SET status='submitted', submitted_at=NOW()
       WHERE user_id=$1 AND status='open'`,
      [m.id]
    );

    // Positive assumption: upsert all 73 templates as 'ok'
    // Don't overwrite active (ongoing) statuses
    await pool.query(
      `INSERT INTO equipment (user_id, article_number, name, category, quantity, unit, source)
       SELECT $1, article_number, name, category, quantity, COALESCE(unit,'ST'), 'standard'
       FROM equipment_templates
       ON CONFLICT (user_id, article_number) DO UPDATE
         SET status = CASE
               WHEN equipment.status IN ('förlustanmäld','byte_pågår') THEN equipment.status
               ELSE 'ok'
             END,
             updated_at = NOW()`,
      [m.id]
    );

    await pool.query(
      `INSERT INTO inventories (user_id, org_unit_id, initiated_by, deadline)
       VALUES ($1, $2, $3, $4)`,
      [m.id, scopeId, req.user.id, deadline || null]
    );
  }

  res.json({ started: members.rows.length });
});

// POST /api/inventory/:id/submit — soldier submits counts; actual_qty=0 → förlust
router.post('/:id/submit', async (req, res) => {
  const { items = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let losses = 0;
    for (const { article_number, actual_qty } of items) {
      const qty = Number(actual_qty);
      if (qty === 0) {
        losses++;
        await client.query(
          `UPDATE equipment SET status='förlustanmäld', updated_at=NOW()
           WHERE user_id=$1 AND article_number=$2`,
          [req.user.id, article_number]
        );
        // Create förlust case if no active case exists
        await client.query(
          `INSERT INTO equipment_cases (equipment_id, type, status, description)
           SELECT e.id,'förlust','pending','Rapporterat saknat vid inventering'
           FROM equipment e
           WHERE e.user_id=$1 AND e.article_number=$2
           AND NOT EXISTS (
             SELECT 1 FROM equipment_cases ec
             WHERE ec.equipment_id=e.id AND ec.status IN ('pending','pc_review')
           )`,
          [req.user.id, article_number]
        );
      } else {
        await client.query(
          `UPDATE equipment
           SET status = CASE WHEN status IN ('förlustanmäld','byte_pågår') THEN status ELSE 'ok' END,
               updated_at = NOW()
           WHERE user_id=$1 AND article_number=$2`,
          [req.user.id, article_number]
        );
      }
    }

    const r = await client.query(
      `UPDATE inventories SET status='submitted', submitted_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='open'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Inventering hittades inte' }); }

    await client.query('COMMIT');
    res.json({ ...r.rows[0], losses });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// GET /api/inventory/unit — KVM: per-member status for scope
router.get('/unit', requireLogistics, async (req, res) => {
  const scopeId = await getLogisticsScope(req.user);
  const subtree = await getSubtreeIds(scopeId);

  const r = await pool.query(
    `SELECT u.id, u.name, u.role, o.name AS unit_name,
            inv.id AS inv_id,
            inv.status AS inv_status,
            inv.created_at AS inv_created,
            inv.submitted_at
     FROM users u
     JOIN org_units o ON o.id = u.org_unit_id
     LEFT JOIN LATERAL (
       SELECT id, status, created_at, submitted_at
       FROM inventories
       WHERE user_id = u.id
       ORDER BY created_at DESC LIMIT 1
     ) inv ON true
     WHERE u.org_unit_id = ANY($1)
     ORDER BY o.name, u.name`,
    [subtree]
  );
  res.json(r.rows);
});

module.exports = router;
