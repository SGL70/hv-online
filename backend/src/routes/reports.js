const express = require('express');
const XLSX = require('xlsx');
const { pool, getSubtreeIds } = require('../db/index');
const { requireAuth, requireRole, ROLE_LEVEL } = require('../middleware/auth');
const email = require('../services/email');

const TYPE_LABEL = { km_ers:'Km-ersättning', utlagg:'Utlägg', traktamente:'Traktamente', sava:'SÄVA' };

async function reportInfo(r, activityTitle) {
  return {
    typ:      TYPE_LABEL[r.report_type] || r.report_type,
    aktivitet: activityTitle || r.description || '–',
    datum:    (r.report_date || '').toString().slice(0, 10),
    comment:  r.reviewer_comment || '',
  };
}

const router = express.Router();
router.use(requireAuth);

// GET /api/reports — my reports + reports pending my action
router.get('/', async (req, res) => {
  const { filter } = req.query; // 'mine' | 'review' | 'approve'
  let query, params;

  if (filter === 'approve') {
    // PC (eller högre): submitted + reviewed rapporter från min enhet, redo att attesteras
    const TOP_ROLES = ['batCh', 's4', 'stab'];
    let ids;
    if (TOP_ROLES.includes(req.user.role)) {
      const all = await pool.query('SELECT id FROM org_units');
      ids = all.rows.map(r => r.id);
    } else {
      ids = await getSubtreeIds(req.user.org_unit_id);
    }
    query = `SELECT r.*, u.name AS user_name, a.title AS activity_title FROM reports r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN activities a ON a.id = r.activity_id
             WHERE r.status IN ('submitted','reviewed') AND u.org_unit_id = ANY($1) AND r.user_id != $2
             ORDER BY r.report_date DESC`;
    params = [ids, req.user.id];
  } else if (filter === 'approved') {
    // KompCh: recent attested reports for lookup/history
    const ids = await getSubtreeIds(req.user.org_unit_id);
    query = `SELECT r.*, u.name AS user_name, a.title AS activity_title,
                    approver.name AS approver_name
             FROM reports r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN activities a ON a.id = r.activity_id
             LEFT JOIN users approver ON approver.id = r.approved_by
             WHERE r.status='approved' AND u.org_unit_id = ANY($1)
             ORDER BY r.approved_at DESC LIMIT 50`;
    params = [ids];
  } else {
    // My own reports
    query = `SELECT r.*, a.title AS activity_title FROM reports r
             LEFT JOIN activities a ON a.id = r.activity_id
             WHERE r.user_id=$1 ORDER BY r.report_date DESC`;
    params = [req.user.id];
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// GET /api/reports/pending-count — badge counts for nav (must be before /:id)
router.get('/pending-count', async (req, res) => {
  if (!req.user.org_unit_id) return res.json({ approve: 0 });
  const ids = await getSubtreeIds(req.user.org_unit_id);
  const r = req.user.role;
  const canApprove = (ROLE_LEVEL[r] ?? -1) >= ROLE_LEVEL.pc;
  const canCases   = ['kompc','kvm','s4','batCh','stab'].includes(r);

  const [appr, ret, cas] = await Promise.all([
    canApprove
      ? pool.query(`SELECT COUNT(*) FROM reports r JOIN users u ON u.id=r.user_id WHERE r.status IN ('submitted','reviewed') AND u.org_unit_id=ANY($1)`, [ids])
      : { rows:[{count:0}] },
    pool.query(`SELECT COUNT(*) FROM reports WHERE user_id=$1 AND status='returned'`, [req.user.id]),
    canCases
      ? pool.query(`SELECT COUNT(*) FROM equipment_cases ec JOIN users u ON u.id=ec.user_id WHERE u.org_unit_id=ANY($1) AND ec.status IN ('pending','pc_review')`, [ids])
      : { rows:[{count:0}] },
  ]);
  res.json({
    approve:  Number(appr.rows[0].count),
    returned: Number(ret.rows[0].count),
    cases:    Number(cas.rows[0].count),
  });
});

// GET /api/reports/export — Excel-export av attesterade rapporter (pc+)
// ?from=YYYY-MM-DD &to=YYYY-MM-DD &mark=1 (markera som skickade till MR)
// Skriver medvetet u.personal_number (inte hv_id) — redovisningen går vidare
// till MR-gruppen HR som identifierar soldater på riktigt personnummer.
router.get('/export', requireRole('pc'), async (req, res) => {
  const { from, to, mark } = req.query;
  const ids = await getSubtreeIds(req.user.org_unit_id);

  let dateFilter = '';
  const params = [ids];
  if (from) { params.push(from); dateFilter += ` AND r.report_date >= $${params.length}`; }
  if (to)   { params.push(to);   dateFilter += ` AND r.report_date <= $${params.length}`; }

  const result = await pool.query(
    `SELECT r.id, u.name AS namn, u.personal_number AS personnummer,
            r.report_type AS typ, a.title AS aktivitet, r.description AS beskrivning,
            r.report_date AS datum, r.km, r.hours AS timmar,
            r.expenses AS belopp, r.expense_description AS kvitto,
            r.approved_at AS attesterad, approver.name AS attesterad_av,
            r.mr_submitted_at
     FROM reports r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN activities a ON a.id = r.activity_id
     LEFT JOIN users approver ON approver.id = r.approved_by
     WHERE r.status = 'approved' AND u.org_unit_id = ANY($1)${dateFilter}
     ORDER BY r.report_date DESC, u.name`,
    params
  );

  // Markera som skickade till MR om mark=1
  if (mark === '1' && result.rows.length > 0) {
    const reportIds = result.rows.filter(r => !r.mr_submitted_at).map(r => r.id);
    if (reportIds.length > 0) {
      await pool.query(
        `UPDATE reports SET mr_submitted_at = NOW() WHERE id = ANY($1)`,
        [reportIds]
      );
    }
  }

  const TYPE = { km_ers:'Km-ersättning', utlagg:'Utlägg', traktamente:'Traktamente', sava:'SÄVA' };
  const rows = result.rows.map(r => ({
    Namn:                    r.namn,
    Personnummer:            r.personnummer,
    Typ:                     TYPE[r.typ] || r.typ,
    'Aktivitet/Beskrivning': r.aktivitet || r.beskrivning || '',
    Datum:                   (r.datum || '').toString().slice(0, 10),
    Km:                      r.km > 0 ? Number(r.km) : '',
    Timmar:                  r.timmar > 0 ? Number(r.timmar) : '',
    'Belopp (kr)':           r.belopp > 0 ? Number(r.belopp) : '',
    'Attesterad av':         r.attesterad_av || '',
    Attesterad:              r.attesterad ? new Date(r.attesterad).toLocaleDateString('sv-SE') : '',
    'Skickat till MR':       r.mr_submitted_at ? new Date(r.mr_submitted_at).toLocaleDateString('sv-SE') : '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [20,15,16,30,12,6,8,12,16,12,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Ersättningar');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `ersattningar${from ? `-${from}` : ''}${to ? `-${to}` : ''}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/reports/mark-mr — markera enskilda rapporter som skickade till MR
router.post('/mark-mr', requireRole('pc'), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
  await pool.query(`UPDATE reports SET mr_submitted_at = NOW() WHERE id = ANY($1)`, [ids]);
  res.json({ ok: true, marked: ids.length });
});

// POST /api/reports — create
router.post('/', async (req, res) => {
  const { activity_id, report_date, report_type, hours, km, expenses, expense_description, description, sava_days } = req.body;
  const result = await pool.query(
    `INSERT INTO reports (user_id,activity_id,report_date,report_type,hours,km,expenses,expense_description,description,sava_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.id, activity_id || null, report_date, report_type || 'km_ers',
     hours || 0, km || 0, expenses || 0, expense_description || null, description || null,
     sava_days ? JSON.stringify(sava_days) : null]
  );
  res.status(201).json(result.rows[0]);
});

// DELETE /api/reports/:id — ta bort eget ärende (draft, submitted eller returned)
router.delete('/:id', async (req, res) => {
  const result = await pool.query(
    `DELETE FROM reports WHERE id=$1 AND user_id=$2 AND status IN ('draft','submitted','returned') RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Inte tillåtet' });
  res.json({ ok: true });
});

// PUT /api/reports/:id — update (own draft or returned)
router.put('/:id', async (req, res) => {
  const { report_type, hours, km, expenses, expense_description, description, report_date, sava_days } = req.body;
  const result = await pool.query(
    `UPDATE reports SET report_type=$1,hours=$2,km=$3,expenses=$4,expense_description=$5,
     description=$6,report_date=$7,sava_days=$8,updated_at=NOW()
     WHERE id=$9 AND user_id=$10 AND status IN ('draft','returned') RETURNING *`,
    [report_type || 'km_ers', hours, km, expenses, expense_description, description,
     report_date, sava_days ? JSON.stringify(sava_days) : null, req.params.id, req.user.id]
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

  // Notifiera PC i föräldraenheten (pluton)
  pool.query(
    `SELECT u.email FROM users u
     WHERE u.role IN ('pc','toc')
     AND u.org_unit_id = (SELECT parent_id FROM org_units WHERE id = $1)
     LIMIT 1`,
    [req.user.org_unit_id]
  ).then(async pc => {
    if (!pc.rows.length) return;
    const r = result.rows[0];
    const act = r.activity_id
      ? await pool.query('SELECT title FROM activities WHERE id=$1', [r.activity_id])
      : null;
    email.notifyReportSubmitted(req.user, pc.rows[0].email,
      await reportInfo(r, act?.rows[0]?.title));
  }).catch(e => console.error('[notify submit]', e.message));
});

// POST /api/reports/batch-approve — attestera flera rapporter samtidigt (pc+)
router.post('/batch-approve', requireRole('pc'), async (req, res) => {
  const { ids } = req.body; // [reportId, ...]
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  const result = await pool.query(
    `UPDATE reports SET status='approved', reviewer_comment=NULL,
       reviewed_by=COALESCE(reviewed_by,$1), reviewed_at=COALESCE(reviewed_at,NOW()),
       approved_by=$1, approved_at=NOW(), updated_at=NOW()
     WHERE id = ANY($2) AND status IN ('submitted','reviewed') RETURNING id`,
    [req.user.id, ids]
  );
  res.json({ approved: result.rows.length });
});

// POST /api/reports/:id/approve — PC (eller högre) attesterar eller returnerar en rapport.
// reviewed_by/reviewed_at bevaras om redan satta (t.ex. via /report-attendance),
// annars stämplas den attesterande som granskare också.
router.post('/:id/approve', requireRole('pc'), async (req, res) => {
  const { action, comment } = req.body;
  const result = await pool.query(
    action === 'approve'
      ? `UPDATE reports SET status='approved', reviewer_comment=NULL,
           reviewed_by=COALESCE(reviewed_by,$1), reviewed_at=COALESCE(reviewed_at,NOW()),
           approved_by=$1, approved_at=NOW(), updated_at=NOW()
         WHERE id=$2 AND status IN ('submitted','reviewed') RETURNING *`
      : `UPDATE reports SET status='returned', reviewer_comment=$1,
           reviewed_by=COALESCE(reviewed_by,$2), reviewed_at=COALESCE(reviewed_at,NOW()), updated_at=NOW()
         WHERE id=$3 AND status IN ('submitted','reviewed') RETURNING *`,
    action === 'approve' ? [req.user.id, req.params.id] : [comment || null, req.user.id, req.params.id]
  );
  if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
  res.json(result.rows[0]);

  pool.query('SELECT email FROM users WHERE id=$1', [result.rows[0].user_id])
    .then(async u => {
      if (!u.rows.length) return;
      const r = result.rows[0];
      const act = r.activity_id
        ? await pool.query('SELECT title FROM activities WHERE id=$1', [r.activity_id])
        : null;
      const info = await reportInfo(r, act?.rows[0]?.title);
      if (action === 'approve') await email.notifyReportApproved(u.rows[0].email, info);
      else await email.notifyReportReturned(u.rows[0].email, info);
    }).catch(e => console.error('[notify approve]', e.message));
});

module.exports = router;
