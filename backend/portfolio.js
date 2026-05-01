// routes/portfolio.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { uploadImages, uploadPdf, deleteFile } = require('../config/cloudinary');

// ── PUBLIC: Get All Portfolio (paginated, filterable) ─────────────────────────
router.get('/', async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const limit    = Math.min(50, parseInt(req.query.limit) || 12);
    const offset   = (page - 1) * limit;
    const category = req.query.category;

    const params = category ? [category, limit, offset] : [limit, offset];
    const where  = category ? 'WHERE category = $1' : '';
    const lp     = category ? '$2' : '$1';
    const op     = category ? '$3' : '$2';

    const [rows, count] = await Promise.all([
      query(
        `SELECT * FROM portfolio ${where} ORDER BY published_at DESC LIMIT ${lp} OFFSET ${op}`,
        params
      ),
      query(`SELECT COUNT(*) AS total FROM portfolio ${where}`, category ? [category] : []),
    ]);

    const total = parseInt(count.rows[0].total);
    res.json({
      success: true,
      data: rows.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Portfolio fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch portfolio.' });
  }
});

// ── PUBLIC: Get Featured Portfolio ───────────────────────────────────────────
router.get('/featured', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM portfolio WHERE featured = true ORDER BY published_at DESC LIMIT 6'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch featured portfolio.' });
  }
});

// ── PUBLIC: Get Single Portfolio Item ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM portfolio WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portfolio item not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch item.' });
  }
});

// ── ADMIN: Create Portfolio Item (images + PDF) ───────────────────────────────
router.post('/admin',
  authenticateToken, authorizeRole('admin','editor'),
  (req, res, next) => {
    uploadImages.array('images', 5)(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const { title, description, category, client, industry, results, link, featured } = req.body;
      if (!title || !description) {
        return res.status(400).json({ success: false, error: 'Title and description are required.' });
      }

      const images   = req.files ? req.files.map(f => f.path) : [];
      const resultsJ = results   ? (typeof results === 'string' ? JSON.parse(results) : results) : [];

      const result = await query(
        `INSERT INTO portfolio (title, description, category, client, industry, results, images, link, featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [title, description, category || null, client || null, industry || null,
         JSON.stringify(resultsJ), JSON.stringify(images), link || null, featured === 'true']
      );

      res.status(201).json({ success: true, message: 'Portfolio item created.', data: result.rows[0] });
    } catch (err) {
      console.error('Portfolio create error:', err);
      res.status(500).json({ success: false, error: 'Failed to create portfolio item.' });
    }
  }
);

// ── ADMIN: Upload PDF for a portfolio item ────────────────────────────────────
router.post('/admin/:id/pdf',
  authenticateToken, authorizeRole('admin','editor'),
  (req, res, next) => {
    uploadPdf.single('pdf')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'PDF file required.' });
      const existing = await query('SELECT pdf_file FROM portfolio WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
      if (existing.rows[0].pdf_file) deleteFile(existing.rows[0].pdf_file);

      const result = await query(
        'UPDATE portfolio SET pdf_file = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.file.path, req.params.id]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to upload PDF.' });
    }
  }
);

// ── ADMIN: Update Portfolio Item ──────────────────────────────────────────────
router.put('/admin/:id',
  authenticateToken, authorizeRole('admin','editor'),
  (req, res, next) => {
    uploadImages.array('images', 5)(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const existing = await query('SELECT * FROM portfolio WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });

      const cur = existing.rows[0];
      const { title, description, category, client, industry, results, link, featured } = req.body;
      const images = req.files && req.files.length > 0
        ? req.files.map(f => f.path)
        : cur.images;
      const resultsJ = results
        ? (typeof results === 'string' ? JSON.parse(results) : results)
        : cur.results;

      const result = await query(
        `UPDATE portfolio
         SET title=$1, description=$2, category=$3, client=$4, industry=$5,
             results=$6, images=$7, link=$8, featured=$9, updated_at=NOW()
         WHERE id=$10 RETURNING *`,
        [title || cur.title, description || cur.description,
         category ?? cur.category, client ?? cur.client, industry ?? cur.industry,
         JSON.stringify(resultsJ), JSON.stringify(images), link ?? cur.link,
         featured !== undefined ? featured === 'true' : cur.featured,
         req.params.id]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('Portfolio update error:', err);
      res.status(500).json({ success: false, error: 'Failed to update portfolio item.' });
    }
  }
);

// ── ADMIN: Delete Portfolio Item ──────────────────────────────────────────────
router.delete('/admin/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const existing = await query('SELECT * FROM portfolio WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });

    const item = existing.rows[0];
    // Delete Cloudinary files
    const images = Array.isArray(item.images) ? item.images : JSON.parse(item.images || '[]');
    images.forEach(url => deleteFile(url));
    if (item.pdf_file) deleteFile(item.pdf_file);

    await query('DELETE FROM portfolio WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Portfolio item deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete item.' });
  }
});

module.exports = router;
