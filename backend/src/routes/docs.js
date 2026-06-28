const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { pool }  = require('../db/index');
const { requireAuth, LOGISTICS_ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const DOCS_DIR = path.join(__dirname, '../../uploads/docs');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: DOCS_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-åäöÅÄÖ ]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/docs
router.get('/', async (req, res) => {
  const r = await pool.query(
    `SELECT d.*, u.name AS uploaded_by_name
     FROM documents d
     JOIN users u ON u.id = d.uploaded_by
     ORDER BY d.created_at DESC`
  );
  res.json(r.rows);
});

// POST /api/docs — upload (logistics+)
router.post('/', (req, res, next) => {
  if (!LOGISTICS_ROLES.has(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
}, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ingen fil' });
  const { title, description } = req.body;
  const r = await pool.query(
    `INSERT INTO documents (title, description, filename, original_name, mime_type, size, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      title || req.file.originalname,
      description || null,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.user.id,
    ]
  );
  res.status(201).json(r.rows[0]);
});

// DELETE /api/docs/:id (logistics+)
router.delete('/:id', async (req, res) => {
  if (!LOGISTICS_ROLES.has(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const r = await pool.query('DELETE FROM documents WHERE id=$1 RETURNING filename', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  const file = path.join(DOCS_DIR, r.rows[0].filename);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// GET /api/docs/:id/download
router.get('/:id/download', async (req, res) => {
  const r = await pool.query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  const doc = r.rows[0];
  const file = path.join(DOCS_DIR, doc.filename);
  res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.sendFile(file);
});

module.exports = router;
