// routes/inquiries.js
const express = require('express');
const router = express.Router();
const validator = require('validator');
const { query } = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// ── PUBLIC: Submit Service Inquiry ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, service, projectDetails, timeline, budget, referralSource } = req.body;

    if (!name || !email || !service) {
      return res.status(400).json({ success: false, error: 'Name, email, and service are required.' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    const result = await query(
      `INSERT INTO service_inquiries
         (name, email, phone, service, project_details, timeline, budget, referral_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name.trim(), email.trim().toLowerCase(), phone||null, service,
       projectDetails||null, timeline||null, budget||null, referralSource||null]
    );

    res.status(201).json({
      success: true,
      message: 'Service inquiry submitted successfully!',
      inquiryId: result.rows[0].id,
    });
  } catch (err) {
    console.error('Inquiry submit error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit inquiry.' });
  }
});

// ── ADMIN: Get All Inquiries ──────────────────────────────────────────────────
router.get('/admin', authenticateToken, authorizeRole('admin','editor','viewer'), async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params    = status ? [status, limit, offset] : [limit, offset];
    const where     = status ? 'WHERE status = $1' : '';
    const lp        = status ? '$2' : '$1';
    const op        = status ? '$3' : '$2';

    const [rows, count] = await Promise.all([
      query(`SELECT * FROM service_inquiries ${where} ORDER BY created_at DESC LIMIT ${lp} OFFSET ${op}`, params),
      query(`SELECT COUNT(*) AS total FROM service_inquiries ${where}`, status ? [status] : []),
    ]);

    const total = parseInt(count.rows[0].total);
    res.json({
      success: true,
      data: rows.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch inquiries.' });
  }
});

// ── ADMIN: Update Inquiry Status ──────────────────────────────────────────────
router.patch('/admin/:id', authenticateToken, authorizeRole('admin','editor'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending','reviewing','quoted','accepted','rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }
    const result = await query(
      'UPDATE service_inquiries SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update.' });
  }
});

// ── ADMIN: Delete Inquiry ─────────────────────────────────────────────────────
router.delete('/admin/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM service_inquiries WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, message: 'Inquiry deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete.' });
  }
});

module.exports = router;
