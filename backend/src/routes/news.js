const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/index');
const { requireAuth, requireLogistics } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_DIR = path.join(__dirname, '../../../frontend/public/img/news');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `news-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// GET /api/news — published posts (publish_at <= now), latest 20
router.get('/', async (req, res) => {
  const result = await pool.query(`
    SELECT n.*, u.name AS author_name, o.name AS unit_name
    FROM news_posts n
    LEFT JOIN users u ON u.id = n.created_by
    LEFT JOIN org_units o ON o.id = n.org_unit_id
    WHERE n.publish_at <= NOW()
    ORDER BY n.publish_at DESC
    LIMIT 20
  `);
  res.json(result.rows);
});

// POST /api/news — create post (logistics roles only)
router.post('/', requireLogistics, async (req, res) => {
  const { title, body, publish_at } = req.body;
  if (!title) return res.status(400).json({ error: 'Rubrik krävs' });
  const result = await pool.query(
    `INSERT INTO news_posts (title, body, publish_at, created_by, org_unit_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, body || null, publish_at || new Date().toISOString(), req.user.id, req.user.org_unit_id]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/news/:id — update post
router.put('/:id', requireLogistics, async (req, res) => {
  const { title, body, publish_at } = req.body;
  if (!title) return res.status(400).json({ error: 'Rubrik krävs' });
  const result = await pool.query(
    `UPDATE news_posts SET title=$1, body=$2, publish_at=$3
     WHERE id=$4 AND created_by=$5 RETURNING *`,
    [title, body || null, publish_at || new Date().toISOString(), req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// POST /api/news/:id/image — upload image for post
router.post('/:id/image', requireLogistics, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ingen fil' });
  const old = await pool.query('SELECT image_path FROM news_posts WHERE id=$1', [req.params.id]);
  if (old.rows[0]?.image_path) {
    fs.unlink(path.join(UPLOAD_DIR, old.rows[0].image_path), () => {});
  }
  const result = await pool.query(
    'UPDATE news_posts SET image_path=$1 WHERE id=$2 AND created_by=$3 RETURNING *',
    [req.file.filename, req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// DELETE /api/news/:id — delete own post (or kompc+ can delete any)
router.delete('/:id', requireLogistics, async (req, res) => {
  const row = await pool.query('SELECT * FROM news_posts WHERE id=$1', [req.params.id]);
  if (!row.rows.length) return res.status(404).json({ error: 'Not found' });
  const post = row.rows[0];
  const canDelete = post.created_by === req.user.id ||
    ['kompc','batCh','stab'].includes(req.user.role);
  if (!canDelete) return res.status(403).json({ error: 'Ej behörig' });
  if (post.image_path) fs.unlink(path.join(UPLOAD_DIR, post.image_path), () => {});
  await pool.query('DELETE FROM news_posts WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
