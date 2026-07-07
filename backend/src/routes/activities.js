const express = require('express');
const { pool, getSubtreeIds } = require('../db/index');
const { requireAuth, requireRole } = require('../middleware/auth');
const email = require('../services/email');

const router = express.Router();
router.use(requireAuth);

// GET /api/activities — activities visible to current user
router.get('/', async (req, res) => {
  if (!req.user.org_unit_id) return res.json([]);
  const ids = await getSubtreeIds(req.user.org_unit_id);
  // Walk up to also get parent unit activities
  const ancestorResult = await pool.query(`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM org_units WHERE id = $1
      UNION ALL
      SELECT o.id, o.parent_id FROM org_units o JOIN ancestors a ON o.id = a.parent_id
    )
    SELECT id FROM ancestors
  `, [req.user.org_unit_id]);
  const ancestorIds = ancestorResult.rows.map(r => r.id);
  const allIds = [...new Set([...ids, ...ancestorIds])];

  const result = await pool.query(`
    SELECT a.*, u.name AS created_by_name, o.name AS unit_name,
           ru.id AS responsible_id, ru.name AS responsible_name, ru.rank AS responsible_rank,
           ar.status AS my_response,
           (SELECT COUNT(*) FROM activity_responses WHERE activity_id=a.id AND status='ja')     AS count_ja,
           (SELECT COUNT(*) FROM activity_responses WHERE activity_id=a.id AND status='nej')    AS count_nej,
           (SELECT COUNT(*) FROM activity_responses WHERE activity_id=a.id AND status='kanske') AS count_kanske,
           (SELECT COUNT(*) FROM activity_responses WHERE activity_id=a.id AND (status IS NULL OR status NOT IN ('ja','nej','kanske'))) AS count_pending
    FROM activities a
    JOIN users u ON u.id = a.created_by
    JOIN org_units o ON o.id = a.org_unit_id
    LEFT JOIN users ru ON ru.id = a.responsible_id
    LEFT JOIN activity_responses ar ON ar.activity_id = a.id AND ar.user_id = $1
    WHERE a.org_unit_id = ANY($2)
    ORDER BY a.start_time ASC
  `, [req.user.id, allIds]);
  res.json(result.rows);
});

// POST /api/activities — create (grpc+)
router.post('/', requireRole('grpc'), async (req, res) => {
  const { title, description, type, start_time, end_time, org_unit_id, responsible_id, location, equipment } = req.body;
  const result = await pool.query(
    `INSERT INTO activities (title,description,type,start_time,end_time,created_by,org_unit_id,responsible_id,location,equipment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [title, description, type, start_time, end_time, req.user.id, org_unit_id, responsible_id || null, location || null, equipment || null]
  );
  const activity = result.rows[0];

  // Create placeholder responses for all members in the target unit
  const memberIds = await pool.query(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM org_units WHERE id=$1
       UNION ALL SELECT o.id FROM org_units o JOIN subtree s ON o.parent_id=s.id
     )
     SELECT id FROM users WHERE org_unit_id = ANY(SELECT id FROM subtree)`,
    [org_unit_id]
  );
  for (const m of memberIds.rows) {
    await pool.query(
      `INSERT INTO activity_responses (activity_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [activity.id, m.id]
    );
  }
  res.status(201).json(activity);

  // Notifiera berörda användare
  pool.query('SELECT email FROM users WHERE id = ANY($1)', [memberIds.rows.map(m => m.id)])
    .then(u => {
      const emails = u.rows.map(r => r.email).filter(Boolean);
      return email.notifyNewActivity(emails, activity);
    }).catch(e => console.error('[notify activity]', e.message));
});

// Roller som bara ska se antal per kompani i aktivitetssammanställningar, inte namn
const BATTALION_LEVEL_ROLES = ['batCh', 's4', 'stab'];

// GET /api/activities/:id
router.get('/:id', async (req, res) => {
  const result = await pool.query(`
    SELECT a.*, u.name AS created_by_name, o.name AS unit_name
    FROM activities a
    JOIN users u ON u.id = a.created_by
    JOIN org_units o ON o.id = a.org_unit_id
    WHERE a.id = $1
  `, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

  // Slår upp respondentens närmaste kompani- och pluton-anfader (kan vara samma
  // nod som u.org_unit_id, t.ex. för kompaniledning som saknar pluton).
  const responses = await pool.query(`
    SELECT ar.*, u.name AS user_name, u.role,
           anc.kompani_id, anc.kompani_name, anc.pluton_id, anc.pluton_name
    FROM activity_responses ar
    JOIN users u ON u.id = ar.user_id
    LEFT JOIN LATERAL (
      WITH RECURSIVE chain AS (
        SELECT id, parent_id, type, name FROM org_units WHERE id = u.org_unit_id
        UNION ALL
        SELECT o.id, o.parent_id, o.type, o.name FROM org_units o JOIN chain c ON o.id = c.parent_id
      )
      SELECT
        (SELECT id   FROM chain WHERE type = 'kompani' LIMIT 1) AS kompani_id,
        (SELECT name FROM chain WHERE type = 'kompani' LIMIT 1) AS kompani_name,
        (SELECT id   FROM chain WHERE type = 'pluton'  LIMIT 1) AS pluton_id,
        (SELECT name FROM chain WHERE type = 'pluton'  LIMIT 1) AS pluton_name
    ) anc ON true
    WHERE ar.activity_id = $1
    ORDER BY anc.kompani_name NULLS LAST, anc.pluton_name NULLS FIRST, u.name
  `, [req.params.id]);

  const payload = { ...result.rows[0], responses: responses.rows };

  if (BATTALION_LEVEL_ROLES.includes(req.user.role)) {
    const byKompani = new Map();
    for (const r of responses.rows) {
      const key = r.kompani_id ?? 'okänd';
      if (!byKompani.has(key)) {
        byKompani.set(key, {
          kompani_id: r.kompani_id, kompani_name: r.kompani_name || 'Okänt kompani',
          ja: 0, nej: 0, kanske: 0, pending: 0,
        });
      }
      const bucket = byKompani.get(key);
      if (r.status === 'ja') bucket.ja++;
      else if (r.status === 'nej') bucket.nej++;
      else if (r.status === 'kanske') bucket.kanske++;
      else bucket.pending++;
    }
    payload.summary_by_kompani = [...byKompani.values()];
  }

  res.json(payload);
});

// PUT /api/activities/:id — redigera aktivitet (grpc+)
router.put('/:id', requireRole('grpc'), async (req, res) => {
  const { title, description, type, start_time, end_time, org_unit_id, responsible_id, location, equipment } = req.body;
  const r = await pool.query(
    `UPDATE activities SET title=$1,description=$2,type=$3,start_time=$4,end_time=$5,
                           org_unit_id=$6,responsible_id=$7,location=$8,equipment=$9
     WHERE id=$10 RETURNING *`,
    [title, description, type, start_time, end_time, org_unit_id, responsible_id || null, location || null, equipment || null, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

// DELETE /api/activities/:id (grpc+)
router.delete('/:id', requireRole('grpc'), async (req, res) => {
  await pool.query('DELETE FROM activity_responses WHERE activity_id=$1', [req.params.id]);
  await pool.query('DELETE FROM activities WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// PUT /api/activities/:id/response — ja/nej/kanske
router.put('/:id/response', async (req, res) => {
  const { status } = req.body;
  await pool.query(`
    INSERT INTO activity_responses (activity_id, user_id, status, updated_at)
    VALUES ($1,$2,$3,NOW())
    ON CONFLICT (activity_id, user_id)
    DO UPDATE SET status=$3, updated_at=NOW()
  `, [req.params.id, req.user.id, status]);
  res.json({ ok: true });
});

// PUT /api/activities/:id/attendance — mark actual attendance (grpc+)
router.put('/:id/attendance', requireRole('grpc'), async (req, res) => {
  const { attendance } = req.body; // [{ userId, present }]
  for (const { userId, present } of attendance) {
    await pool.query(`
      INSERT INTO activity_responses (activity_id, user_id, actual_attendance, updated_at)
      VALUES ($1,$2,$3,NOW())
      ON CONFLICT (activity_id, user_id)
      DO UPDATE SET actual_attendance=$3, updated_at=NOW()
    `, [req.params.id, userId, present]);
  }
  res.json({ ok: true });
});

// POST /api/activities/:id/report-attendance — ansvarig rapporterar närvaro + km (grpc+)
router.post('/:id/report-attendance', requireRole('grpc'), async (req, res) => {
  const actId = parseInt(req.params.id);
  const { present, absent, walk_ins } = req.body;
  // present:   [{user_id, km}]
  // absent:    [{user_id}]
  // walk_ins:  [{user_id, km}]

  const actRes = await pool.query('SELECT start_time FROM activities WHERE id=$1', [actId]);
  if (!actRes.rows.length) return res.status(404).json({ error: 'Not found' });
  const reportDate = new Date(actRes.rows[0].start_time).toISOString().split('T')[0];

  const upsertResponse = (userId, attended) =>
    pool.query(`
      INSERT INTO activity_responses (activity_id, user_id, actual_attendance, updated_at)
      VALUES ($1,$2,$3,NOW())
      ON CONFLICT (activity_id, user_id) DO UPDATE SET actual_attendance=$3, updated_at=NOW()
    `, [actId, userId, attended]);

  const createKm = async (userId, km) => {
    if (!km || km <= 0) return;
    const exists = await pool.query(
      'SELECT id FROM reports WHERE user_id=$1 AND activity_id=$2 AND report_type=$3',
      [userId, actId, 'km_ers']
    );
    if (exists.rows.length) return; // already reported
    await pool.query(`
      INSERT INTO reports (user_id, activity_id, report_date, km, status, report_type, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'reviewed','km_ers',$5,NOW())
    `, [userId, actId, reportDate, km, req.user.id]);
  };

  for (const { user_id, km } of present)    { await upsertResponse(user_id, true);  await createKm(user_id, km); }
  for (const { user_id }     of absent)     { await upsertResponse(user_id, false); }
  for (const { user_id, km } of walk_ins)   { await upsertResponse(user_id, true);  await createKm(user_id, km); }

  res.json({ ok: true });
});

module.exports = router;
