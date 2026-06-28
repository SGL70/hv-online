const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('./index');

const files = [
  'schema.sql',
  'migrate_org_stab.sql',
  'migrate_catalog.sql',
  'migrate_inventory.sql',
  'migrate_loss.sql',
  'migrate_prio.sql',
  'migrate_mr.sql',
  'migrate_sava.sql',
  'migrate_kvm_settings.sql',
  'migrate_afse_tracking.sql',
  'seed.sql',
  'seed_catalog.sql',
];

async function setup() {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`✓ ${file}`);
    } catch (e) {
      console.error(`✗ ${file}: ${e.message}`);
      process.exit(1);
    }
  }
  await pool.end();
  console.log('\nDatabas klar.');
}

setup();
