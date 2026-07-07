const express = require('express');
const { pool } = require('../db/index');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/gdpr/:userId/anonymize — rätt att bli glömd (Art. 17).
// Anonymiserar i stället för att radera raden, eftersom rapporter/ärenden/
// aktivitetssvar refererar users.id (bl.a. med ON DELETE CASCADE på flera
// tabeller) — en hård radering skulle förstöra historik som ska sparas enligt
// retention-kraven. Kontroll av retention (t.ex. 7 år för SÄVA/km-ersättning)
// är inte automatiserad än — den som utför anonymiseringen ansvarar för det.
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
