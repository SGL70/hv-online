const { pool } = require('../db/index');

// Kontaktdata: aktiv + 1 år efter avslutad tjänstgöring
function findContactCandidates() {
  return pool.query(
    `SELECT id, hv_id, name, service_ended_at FROM users
     WHERE service_ended_at < NOW() - INTERVAL '1 year' AND anonymized_at IS NULL
     ORDER BY service_ended_at`
  );
}

// Aktivitetssvar: 2 år, räknat på aktivitetens datum
function findStaleActivityResponses() {
  return pool.query(
    `SELECT ar.id, ar.user_id, u.hv_id, u.name AS user_name, a.title AS activity_title, a.start_time
     FROM activity_responses ar
     JOIN activities a ON a.id = ar.activity_id
     JOIN users u ON u.id = ar.user_id
     WHERE a.start_time < NOW() - INTERVAL '2 years'
     ORDER BY a.start_time`
  );
}

// SÄVA/km-ersättning (7-årsgolv) och utrustningshistorik (hela tjänstgöringstiden)
// har ingen kandidat-logik här — det finns ingen befintlig raderingsväg som kan
// bryta mot dem (reports.js DELETE tillåter bara draft/submitted/returned, aldrig
// approved). Se plan/README för resonemang.

module.exports = { findContactCandidates, findStaleActivityResponses };
