// routes/testimonials.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { uploadAvatar, deleteFile } = require('../config/cloudinary');

// ── PUBLIC: Get Approved Testimonials ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const featured = req.query.featured === 'true';
    const where = featured ? 'WHERE is_approved = true AND featured = true' : 'WHERE is_approved = true';
    const result = await query(`SELECT * FROM testimonials ${where} ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch testimonials.' });
  }
});

// ── ADMIN: Get ALL Testimonials ───────────────────────────────────────────────
router.get('/admin', authenticateToken, authorizeRole('admin','editor','viewer'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM testimonials ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch.' });
  }
});

// ── ADMIN: Create Testimonial ─────────────────────────────────────────────────
router.post('/admin',
  authenticateToken, authorizeRole('admin','editor'),
  (req, res, next) => uploadAvatar.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    next();
  }),
  async (req, res) => {
    try {
      const { name, role, company, content, rating, featured, is_approved } = req.body;
      if (!name || !role || !content) {
        return res.status(400).json({ success: false, error: 'Name, role, and content are required.' });
      }
      const image = req.file ? req.file.path : null;
      const result = await query(
        `INSERT INTO testimonials (name, role, company, content, rating, image, featured, is_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, role, company || null, content, parseInt(rating) || 5,
         image, featured === 'true', is_approved === 'true']
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to create testimonial.' });
    }
  }
);

// ── ADMIN: Update Testimonial ─────────────────────────────────────────────────
router.put('/admin/:id',
  authenticateToken, authorizeRole('admin','editor'),
  (req, res, next) => uploadAvatar.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    next();
  }),
  async (req, res) => {
    try {
      const existing = await query('SELECT * FROM testimonials WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });

      const cur = existing.rows[0];
      const { name, role, company, content, rating, featured, is_approved } = req.body;
      const image = req.file ? req.file.path : cur.image;
      if (req.file && cur.image) deleteFile(cur.image);

      const result = await query(
        `UPDATE testimonials SET name=$1,role=$2,company=$3,content=$4,rating=$5,
         image=$6,featured=$7,is_approved=$8 WHERE id=$9 RETURNING *`,
        [name||cur.name, role||cur.role, company??cur.company, content||cur.content,
         parseInt(rating)||cur.rating, image,
         featured !== undefined ? featured==='true' : cur.featured,
         is_approved !== undefined ? is_approved==='true' : cur.is_approved,
         req.params.id]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update.' });
    }
  }
);

// ── ADMIN: Delete Testimonial ─────────────────────────────────────────────────
router.delete('/admin/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const existing = await query('SELECT image FROM testimonials WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    if (existing.rows[0].image) deleteFile(existing.rows[0].image);
    await query('DELETE FROM testimonials WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Testimonial deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete.' });
  }
});

module.exports = router;
