const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/index');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Mock users for prototype bypass — matches seed.sql
const MOCK_USERS = [
  { id: 1, label: 'Soldat',         name: 'Erik Andersson',  role: 'soldat' },
  { id: 2, label: 'Gruppchef',      name: 'Sara Nilsson',    role: 'grpc'   },
  { id: 3, label: 'Plutonchef',     name: 'Johan Lindqvist', role: 'pc'     },
  { id: 4, label: 'Kompanichef',    name: 'Anna Bergström',  role: 'kompc'  },
  { id: 5, label: 'Kvartermästare', name: 'Lars Eriksson',   role: 'kvm'    },
  { id: 6, label: 'S4',             name: 'Maria Karlsson',  role: 's4'     },
  { id: 7, label: 'Bataljonschef',  name: 'Peter Svensson',  role: 'batCh'  },
];

// TODO: Dessa endpoints är öppna i alla miljöer. Inför produktionsdeploy måste de
// antingen tas bort eller skyddas med t.ex. process.env.NODE_ENV === 'development'.

// GET /api/auth/mock-users — list of prototype users for the role picker
router.get('/mock-users', (_req, res) => {
  res.json(MOCK_USERS);
});

// POST /api/auth/mock-login — prototype bypass: log in as a specific user
router.post('/mock-login', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const result = await pool.query(
    'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *',
    [userId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, org_unit_id: user.org_unit_id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user });
});

// GET /api/auth/me — current user from token
router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT u.*, o.name AS unit_name, o.type AS unit_type
     FROM users u
     LEFT JOIN org_units o ON o.id = u.org_unit_id
     WHERE u.id = $1`,
    [req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// PUT /api/auth/profile — self-service contact details
router.put('/profile', requireAuth, async (req, res) => {
  const { email, mobile, street, postal_code, city, rank, org_unit_id } = req.body;

  let orgUnitId = null;
  if (org_unit_id) {
    const unit = await pool.query('SELECT id FROM org_units WHERE id=$1', [org_unit_id]);
    if (!unit.rows.length) return res.status(400).json({ error: 'Okänd organisationsenhet' });
    orgUnitId = unit.rows[0].id;
  }

  const result = await pool.query(
    `UPDATE users SET email=$1, mobile=$2, street=$3, postal_code=$4, city=$5,
                      rank=$6, org_unit_id=$7, profile_complete=TRUE
     WHERE id=$8 RETURNING *`,
    [email, mobile, street || null, postal_code || null, city || null, rank || null, orgUnitId, req.user.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;
