const express = require('express');
const jwt = require('jsonwebtoken');
const { CriiptoVerifyExpressRedirect } = require('@criipto/verify-express');
const { pool } = require('../db/index');

const router = express.Router();

const DOMAIN      = process.env.CRIIPTO_DOMAIN;
const CLIENT_ID   = process.env.CRIIPTO_CLIENT_ID;
const CLIENT_SECRET = process.env.CRIIPTO_CLIENT_SECRET;
const CALLBACK_URL  = process.env.CRIIPTO_CALLBACK_URL || 'http://localhost:3000/api/auth/bankid/callback';
const FRONTEND_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';

const criipto = new CriiptoVerifyExpressRedirect({
  domain:              DOMAIN,
  clientID:            CLIENT_ID,
  clientSecret:        CLIENT_SECRET,
  redirectUri:         CALLBACK_URL,
  postLogoutRedirectUri: FRONTEND_URL,

  beforeAuthorize(req, options) {
    const sameDevice = req.query.acr === 'same-device';
    return {
      ...options,
      acr_values: sameDevice
        ? 'urn:grn:authn:se:bankid:same-device'
        : 'urn:grn:authn:se:bankid:another-device',
    };
  },
});

// GET /api/auth/bankid/login — redirect to BankID
router.get('/login', criipto.middleware({ successReturnToOrRedirect: '/api/auth/bankid/callback' }), (_req, res) => {
  res.redirect(FRONTEND_URL);
});

// GET /api/auth/bankid/callback — Idura redirects here after BankID
router.get('/callback',
  criipto.middleware({ failureRedirect: `${FRONTEND_URL}/login?error=bankid_failed` }),
  async (req, res) => {
    try {
      const claims = req.claims;

      // Swedish BankID returns personnummer in 'ssn' or 'sub'
      // Format varies: "199001010001" or "19900101-0001"
      const rawSsn = claims.ssn || claims.sub || '';
      const personnummer = rawSsn.replace('-', '').replace(/^(\d{6})(\d{4})$/, '19$1$2').replace(/\D/g, '');

      const result = await pool.query(
        `SELECT u.*, o.name AS unit_name
         FROM users u
         LEFT JOIN org_units o ON o.id = u.org_unit_id
         WHERE u.personal_number = $1`,
        [personnummer]
      );

      let user = result.rows[0];

      if (!user) {
        // Inte inloggad förut — men kan vara förhandsregistrerad av en grpc+ via
        // POST /api/orgs/:id/members innan personens första BankID-inloggning
        // (se organizations.js). Slå upp och, om så, skapa det riktiga kontot nu.
        const pending = await pool.query(
          'SELECT * FROM pending_members WHERE personal_number = $1',
          [personnummer]
        );
        if (!pending.rows.length) {
          return res.redirect(`${FRONTEND_URL}/login?error=user_not_found`);
        }

        const pm = pending.rows[0];
        const name = claims.name
          || [claims.given_name, claims.family_name].filter(Boolean).join(' ')
          || 'Ny användare';

        const created = await pool.query(
          `INSERT INTO users (personal_number, name, role, org_unit_id, profile_complete)
           VALUES ($1, $2, $3, $4, false)
           RETURNING *`,
          [personnummer, name, pm.role, pm.org_unit_id]
        );
        await pool.query('DELETE FROM pending_members WHERE personal_number = $1', [personnummer]);
        user = created.rows[0];
      }

      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      const token = jwt.sign(
        { id: user.id, role: user.role, org_unit_id: user.org_unit_id },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Pass token to frontend via URL fragment (never hits server logs)
      res.redirect(`${FRONTEND_URL}/login?token=${token}`);
    } catch (err) {
      console.error('BankID callback error:', err);
      res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

module.exports = router;
