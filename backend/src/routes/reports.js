const express = require('express');
const XLSX = require('xlsx');
const { pool, getSubtreeIds } = require('../db/index');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/reports — my reports + reports pending my action
router.get('/', async (req, res) => {
  const { filter } = req.query; // 'mine' | 'review' | 'approve'
  let query, params;

  if (filter === 'review') {
    // PC: submitted reports from my unit
    const ids = await getSubtreeIds(req.user.org_unit_id);
    query = `SELECT r.*, u.name AS user_name FROM reports r
             JOIN users u ON u.id = r.user_id
             WHERE r.status='submitted' AND u.org_unit_id = ANY($1) ORDER BY r.report_date DESC`;
    params = [ids];
  } else if (filter === 'approve') {
    // KompCh: reviewed reports from my unit
    const ids = await getSubtreeIds(req.user.org_unit_id);
    query = `SELECT r.*, u.name AS user_name FROM reports r
             JOIN users u ON u.id = r.user_id
             WHERE r.status='reviewed' AND u.org_unit_id = ANY($1) ORDER BY r.report_date DESC`;
    params = [ids];
  } else if (filter === 'approved') {
    // KompCh: recent attested reports for lookup/history
    const ids = await getSubtreeIds(req.user.org_unit_id);
    query = `SELECT r.*, u.name AS user_name, a.title AS activity_title FROM reports r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN activities a ON a.id = r.activity_id
             WHERE r.status='approved' AND u.org_unit_id = ANY($1)
             ORDER BY r.approved_at DESC LIMIT 30`;
    params = [ids];
  } else {
    // My own reports
    query = `SELECT r.*, a.title AS activity_title FROM reports r
             LEFT JOIN activities a ON a.id = r.activity_id
             WHERE r.user_id=$1 ORDER BY r.report_date DESC`;
    params = [req.user.id];
  }

  // Always include activity_title for review/approve queries too
  if (filter === 'review' || filter === 'approve') {
    query = query.replace(
      'SELECT r.*, u.name AS user_name FROM reports r',
      'SELECT r.*, u.name AS user_name, a.title AS activity_title FROM reports r LEFT JOIN activities a ON a.id = r.activity_id'
    );
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// GET /api/reports/pending-count — badge counts for nav (must be before /:id)
router.get('/pending-count', async (req, res) => {
  if (!req.user.org_unit_id) return res.json({ review: 0, approve: 0 });
  const ids = await getSubtreeIds(req.user.org_unit_id);
  const r = req.user.role;
  const canReview  = ['pc','kompc','kvm','s4','batCh','stab'].includes(r);
  const canApprove = ['kompc','kvm','s4','batCh','stab'].includes(r);
  const canCases   = ['kompc','kvm','s4','batCh','stab'].includes(r);

  const [rev, appr, ret, cas] = await Promise.all([
    canReview
      ? pool.query(`SELECT COUNT(*) FROM reports r JOIN users u ON u.id=r.user_id WHERE r.status='submitted' AND u.org_unit_id=ANY($1)`, [ids])
      : { rows:[{count:0}] },
    canApprove
      ? pool.query(`SELECT COUNT(*) FROM reports r JOIN users u ON u.id=r.user_id WHERE r.status='reviewed' AND u.org_unit_id=ANY($1)`, [ids])
      : { rows:[{count:0}] },
    pool.query(`SELECT COUNT(*) FROM reports WHERE user_id=$1 AND status='returned'`, [req.user.id]),
    canCases
      ? pool.query(`SELECT COUNT(*) FROM equipment_cases ec JOIN users u ON u.id=ec.user_id WHERE u.org_unit_id=ANY($1) AND ec.status IN ('pending','pc_review')`, [ids])
      : { rows:[{count:0}] },
  ]);
  res.json({
    review:   Number(rev.rows[0].count),
    approve:  Number(appr.rows[0].count),
    returned: Number(ret.rows[0].count),
    cases:    Number(cas.rows[0].count),
  });
});

// GET /api/reports/export — Excel-export av attesterade rapporter (kompc+)
router.get('/export', requireRole('kompc'), async (req, res) => {
  const { from, to } = req.query;
  const ids = await getSubtreeIds(req.user.org_unit_id);

  let dateFilter = '';
  const params = [ids];
  if (from) { params.push(from); dateFilter += ` AND r.report_date >= $${params.length}`; }
  if (to)   { params.push(to);   dateFilter += ` AND r.report_date <= $${params.length}`; }

  const result = await pool.query(
    `SELECT u.name AS namn, u.personal_number AS personnummer,
            r.report_type AS typ, a.title AS aktivitet, r.description AS beskrivning,
            r.report_date AS datum, r.km, r.hours AS timmar,
            r.expenses AS belopp, r.expense_description AS kvitto,
            r.approved_at AS attesterad
     FROM reports r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN activities a ON a.id = r.activity_id
     WHERE r.status = 'approved' AND u.org_unit_id = ANY($1)${dateFilter}
     ORDER BY r.report_date DESC, u.name`,
    params
  );

  const TYPE = { km_ers:'Km-ersättning', utlagg:'Utlägg', traktamente:'Traktamente', sava:'SÄVA' };
  const rows = result.rows.map(r => ({
    Namn:          r.namn,
    Personnummer:  r.personnummer,
    Typ:           TYPE[r.typ] || r.typ,
    'Aktivitet/Beskrivning': r.aktivitet || r.beskrivning || '',
    Datum:         (r.datum || '').toString().slice(0, 10),
    'Km':          r.km > 0 ? Number(r.km) : '',
    'Timmar':      r.timmar > 0 ? Number(r.timmar) : '',
    'Belopp (kr)': r.belopp > 0 ? Number(r.belopp) : '',
    Attesterad:    r.attesterad ? new Date(r.attesterad).toLocaleDateString('sv-SE') : '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [20,15,16,30,12,6,8,12,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Ersättningar');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `ersattningar${from ? `-${from}` : ''}${to ? `-${to}` : ''}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/reports — create
router.post('/', async (req, res) => {
  const { activity_id, report_date, report_type, hours, km, expenses, expense_description, description } = req.body;
  const result = await pool.query(
    `INSERT INTO reports (user_id,activity_id,report_date,report_type,hours,km,expenses,expense_description,description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, activity_id || null, report_date, report_type || 'km_ers',
     hours || 0, km || 0, expenses || 0, expense_description || null, description || null]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/reports/:id — update (own draft or returned)
router.put('/:id', async (req, res) => {
  const { report_type, hours, km, expenses, expense_description, description, report_date } = req.body;
  const result = await pool.query(
    `UPDATE reports SET report_type=$1,hours=$2,km=$3,expenses=$4,expense_description=$5,
     description=$6,report_date=$7,updated_at=NOW()
     WHERE id=$8 AND user_id=$9 AND status IN ('draft','returned') RETURNING *`,
    [report_type || 'km_ers', hours, km, expenses, expense_description, description,
     report_date, req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
  res.json(result.rows[0]);
});

// POST /api/reports/:id/submit
router.post('/:id/submit', async (req, res) => {
  const result = await pool.query(
    `UPDATE reports SET status='submitted', reviewer_comment=NULL, updated_at=NOW()
     WHERE id=$1 AND user_id=$2 AND status IN ('draft','returned') RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
  res.json(result.rows[0]);
});

// POST /api/reports/:id/review — PC reviews (approve/return)
router.post('/:id/review', requireRole('pc'), async (req, res) => {
  const { action, comment } = req.body;
  const newStatus = action === 'approve' ? 'reviewed' : 'returned';
  const result = await pool.query(
    `UPDATE reports SET status=$1, reviewer_comment=$2, reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
     WHERE id=$4 AND status='submitted' RETURNING *`,
    [newStatus, comment || null, req.user.id, req.params.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
  res.json(result.rows[0]);
});

// POST /api/reports/:id/approve — KompCh attests
router.post('/:id/approve', requireRole('kompc'), async (req, res) => {
  const { action } = req.body; // 'approve' | 'return'
  const newStatus = action === 'approve' ? 'approved' : 'submitted';
  const result = await pool.query(
    `UPDATE reports SET status=$1, approved_by=$2, approved_at=NOW(), updated_at=NOW()
     WHERE id=$3 AND status='reviewed' RETURNING *`,
    [newStatus, req.user.id, req.params.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
  res.json(result.rows[0]);
});

module.exports = router;
