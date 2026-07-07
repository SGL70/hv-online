const express  = require('express');
const multer   = require('multer');
const XLSX     = require('xlsx');
const { pool } = require('../db/index');
const { requireAuth, requireLogistics } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

const COMPANY = '112. HvKomp';

// ── Role mapping ─────────────────────────────────────────────────────────────

function mapRole(bef) {
  const b = (bef || '').toUpperCase();
  if (b.includes('KOMPANICHEF') && !b.includes('STF')) return 'kompc';
  if (b.includes('STF KOMPANICHEF'))                   return 'stab';
  if (b.includes('KVARTERMÄSTARE'))                    return 'kvm';
  if (b.includes('UNDERHÅLLSBEFÄL') || b.includes('UNERHÅLLSBEFÄL')) return 'kvm';
  if (b.includes('PLUTONCHEF'))                        return 'pc';
  if (b.includes('TROSSTROPPCHEF') || b.includes('TROSSPLUTONCHEF')) return 'toc';
  if (b.includes('GRUPPCHEF') || b.includes('GRPPCHEF')) return 'grpc';
  if (b.includes('STRILBEFÄL') || b.includes('FANJUNKARE')) return 'stab';
  return 'soldat';
}

// ── Org path mapping ─────────────────────────────────────────────────────────
// Returns { label, path, types } where path = [company, …, unit]
// Hierarchy from impress: Kompani → Chefsgrupp / Stab/TrossPluton / 1–3. Pluton
// [Kompani][Pluton][Grupp] display order per user spec

function mapUnit(stabPluton) {
  const s = (stabPluton || '').trim();

  // KL = Kompanichef, KS = övrig kompanistab (båda tillhör Chefsgrupp)
  if (s === 'KL' || s === '' || s === 'KS')
    return { label: 'Chefsgrupp',
             path:  [COMPANY, 'Chefsgrupp'],
             types: ['kompani', 'grupp'] };

  // Stabs- & Trosspluton-undergrupper
  if (s === 'KS/Kok')
    return { label: 'Kokgrupp',
             path:  [COMPANY, 'Stab/TrossPluton', 'Kokgrupp'],
             types: ['kompani', 'pluton', 'grupp'] };
  if (s === 'KS/Packgrupp')
    return { label: 'Packgrupp',
             path:  [COMPANY, 'Stab/TrossPluton', 'Packgrupp'],
             types: ['kompani', 'pluton', 'grupp'] };

  // Plutoner
  if (s === '1') return { label: '1. Pluton', path: [COMPANY, '1. Pluton'], types: ['kompani', 'pluton'] };
  if (s === '2') return { label: '2. Pluton', path: [COMPANY, '2. Pluton'], types: ['kompani', 'pluton'] };
  if (s === '3') return { label: '3. Pluton', path: [COMPANY, '3. Pluton'], types: ['kompani', 'pluton'] };
  if (s === '4') return { label: '4. Pluton', path: [COMPANY, '4. Pluton'], types: ['kompani', 'pluton'] };

  // Fallback
  return { label: 'Chefsgrupp',
           path:  [COMPANY, 'Chefsgrupp'],
           types: ['kompani', 'grupp'] };
}

// ── Parse ODS/XLSX ───────────────────────────────────────────────────────────

function parseOds(buffer) {
  const wb   = XLSX.read(buffer, { type: 'buffer', cellText: true, raw: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

  const persons = [];
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i];
    const lastName  = (c[0] || '').trim();
    const firstName = (c[1] || '').trim();
    if (!lastName || lastName === 'Vakant') continue;

    const birth      = (c[2] || '').toString().trim();
    const phone      = (c[6] || '').toString().trim();
    const email      = (c[7] || '').toString().trim() || null;
    const befNr      = (c[9] || '').toString().trim();
    const befattning = (c[10] || '').toString().trim();
    const stabPluton = (c[11] || '').toString().trim();
    const unit       = mapUnit(stabPluton);

    persons.push({
      personal_number: birth || befNr || `${lastName}-${firstName}`.toLowerCase(),
      name:       `${firstName} ${lastName}`,
      birth,
      phone:      phone || null,
      email,
      befattning,
      role:       mapRole(befattning),
      unit_label: unit.label,
      unit_path:  unit.path,
      unit_types: unit.types,
    });
  }
  return persons;
}

// ── Resolve org unit — walks full path, creating missing nodes ───────────────

async function resolveUnitPath(path, types, client) {
  let parentId = null;
  let lastId   = null;

  for (let i = 0; i < path.length; i++) {
    const name = path[i];
    const type = types[i] || 'stab';

    // First element: name-only (company may have its own parent in the hierarchy)
    // Subsequent elements: strict parent match to avoid landing in the wrong company
    const r = i === 0
      ? await client.query('SELECT id FROM org_units WHERE name=$1', [name])
      : await client.query('SELECT id FROM org_units WHERE name=$1 AND parent_id=$2', [name, parentId]);

    if (r.rows.length) {
      lastId = r.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO org_units (name, type, parent_id) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING id`,
        [name, type, parentId]
      );
      if (ins.rows.length) {
        lastId = ins.rows[0].id;
      } else {
        const r2 = i === 0
          ? await client.query('SELECT id FROM org_units WHERE name=$1', [name])
          : await client.query('SELECT id FROM org_units WHERE name=$1 AND parent_id=$2', [name, parentId]);
        lastId = r2.rows[0]?.id || null;
      }
    }
    parentId = lastId;
  }

  return lastId;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/personal — list all users with org unit path
router.get('/', requireLogistics, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.role, u.mobile, u.email, u.personal_number,
            u.org_unit_id, u.hv_id, u.anonymized_at,
            o.name AS unit_name,
            p.name AS parent_unit_name
     FROM users u
     LEFT JOIN org_units o ON o.id = u.org_unit_id
     LEFT JOIN org_units p ON p.id = o.parent_id
     ORDER BY p.name NULLS LAST, o.name, u.name`
  );
  res.json(rows);
});

// PUT /api/personal/:id — update a user
router.put('/:id', requireLogistics, async (req, res) => {
  const { name, role, org_unit_id, mobile, email, rank, service_ended_at } = req.body;
  const { rows } = await pool.query(
    `UPDATE users SET name=$1, role=$2, org_unit_id=$3, mobile=$4, email=$5, rank=$6, service_ended_at=$7
     WHERE id=$8 RETURNING id, name, role, org_unit_id, mobile, email, rank, service_ended_at`,
    [name, role, org_unit_id || null, mobile || null, email || null, rank || null, service_ended_at || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Användaren finns inte' });
  res.json(rows[0]);
});

// POST /api/personal/preview — parse file, return full editable list
router.post('/preview', requireLogistics, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ingen fil' });
  try {
    const persons = parseOds(req.file.buffer);
    const summary = {};
    persons.forEach(p => { summary[p.unit_label] = (summary[p.unit_label] || 0) + 1; });
    res.json({ count: persons.length, persons, summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/personal/import — upsert edited persons list (JSON body)
//
// personal_number är inte alltid ett riktigt personnummer — parseOds() faller
// tillbaka på befattningsnummer eller ett namn-baserat nyckel när källfilen
// saknar det. En svag nyckel som råkar kollidera mellan två olika personer
// skulle annars tyst slås ihop via ON CONFLICT. Två spärrar mot det:
//  1. Nycklar som förekommer mer än en gång i samma fil kan inte särskiljas
//     säkert — de hoppas över helt och flaggas.
//  2. En svag nyckel (inte 12 siffror) som redan pekar på en annan persons
//     namn i databasen skrivs inte över — flaggas som konflikt istället.
// Riktiga personnummer (12 siffror) är i praktiken garanterat unika och
// hanteras som tidigare, utan extra kontroll.
router.post('/import', requireLogistics, async (req, res) => {
  const { persons } = req.body;
  if (!Array.isArray(persons) || persons.length === 0)
    return res.status(400).json({ error: 'Ingen personal att importera' });

  const keyCounts = new Map();
  for (const p of persons) keyCounts.set(p.personal_number, (keyCounts.get(p.personal_number) || 0) + 1);
  const duplicateKeysInFile = [...keyCounts.entries()].filter(([, c]) => c > 1).map(([k]) => k);
  const isFullPersonnummer = key => /^\d{12}$/.test(key || '');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let created = 0, updated = 0;
    const conflicts = [];

    for (const p of persons) {
      if (duplicateKeysInFile.includes(p.personal_number)) continue;

      if (!isFullPersonnummer(p.personal_number)) {
        const existing = await client.query(
          'SELECT name FROM users WHERE personal_number=$1', [p.personal_number]
        );
        if (existing.rows.length &&
            existing.rows[0].name.trim().toLowerCase() !== (p.name || '').trim().toLowerCase()) {
          conflicts.push({
            personal_number: p.personal_number,
            existing_name: existing.rows[0].name,
            incoming_name: p.name,
          });
          continue;
        }
      }

      // Use full path if available (unedited preview data), else name-only fallback
      const path  = Array.isArray(p.unit_path) && p.unit_path.length > 0
                    ? p.unit_path : [p.unit_label];
      const types = Array.isArray(p.unit_types) && p.unit_types.length === path.length
                    ? p.unit_types : path.map(() => 'stab');

      const orgId = await resolveUnitPath(path, types, client);

      const r = await client.query(
        `INSERT INTO users (personal_number, name, role, org_unit_id, mobile, email, profile_complete)
         VALUES ($1,$2,$3,$4,$5,$6,false)
         ON CONFLICT (personal_number) DO UPDATE
           SET name=$2, role=$3, org_unit_id=$4,
               mobile=COALESCE($5, users.mobile),
               email=COALESCE($6, users.email)
         RETURNING (xmax = 0) AS inserted`,
        [p.personal_number, p.name, p.role, orgId, p.phone || null, p.email || null]
      );
      if (r.rows[0]?.inserted) created++; else updated++;
    }

    await client.query('COMMIT');
    res.json({
      created, updated, total: persons.length,
      conflicts,
      duplicate_keys_in_file: duplicateKeysInFile,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
