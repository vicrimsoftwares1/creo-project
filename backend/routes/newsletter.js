// routes/newsletter.js
const express = require('express');
const router = express.Router();
const validator = require('validator');
const { query } = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sendNewsletterWelcome, sendBulkNewsletter } = require('../utils/mailer');

// ── PUBLIC: Subscribe ─────────────────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const { email, name } = req.body;
    const ip = req.ip;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email is required.' });
    }

    // Check existing
    const existing = await query('SELECT * FROM newsletter WHERE email = $1', [email.trim().toLowerCase()]);

    if (existing.rows.length > 0) {
      const sub = existing.rows[0];
      if (sub.is_active) {
        return res.status(409).json({ success: false, error: 'This email is already subscribed.' });
      }
      // Re-subscribe
      await query(
        'UPDATE newsletter SET is_active = true, name = COALESCE($1, name) WHERE email = $2',
        [name || null, email.trim().toLowerCase()]
      );
      return res.json({ success: true, message: 'Welcome back! You have been re-subscribed.' });
    }

    await query(
      'INSERT INTO newsletter (email, name, ip_address) VALUES ($1, $2, $3)',
      [email.trim().toLowerCase(), name ? name.trim() : null, ip]
    );

    // Non-blocking welcome email
    sendNewsletterWelcome(name, email.trim()).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to the C REO newsletter!',
    });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    res.status(500).json({ success: false, error: 'Failed to subscribe.' });
  }
});

// ── PUBLIC: Unsubscribe ───────────────────────────────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Valid email required.' });
    }

    const result = await query(
      "UPDATE newsletter SET is_active = false WHERE email = $1 AND is_active = true RETURNING id",
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email not found or already unsubscribed.' });
    }
    res.json({ success: true, message: 'You have been unsubscribed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to unsubscribe.' });
  }
});

// ── ADMIN: Get All Subscribers ────────────────────────────────────────────────
router.get('/admin', authenticateToken, authorizeRole('admin','editor','viewer'), async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const limit   = Math.min(100, parseInt(req.query.limit) || 50);
    const offset  = (page - 1) * limit;
    const active  = req.query.active !== 'false'; // default: active only

    const [rows, count] = await Promise.all([
      query(
        'SELECT * FROM newsletter WHERE is_active = $1 ORDER BY subscribed_at DESC LIMIT $2 OFFSET $3',
        [active, limit, offset]
      ),
      query('SELECT COUNT(*) AS total FROM newsletter WHERE is_active = $1', [active]),
    ]);

    const total = parseInt(count.rows[0].total);
    res.json({
      success: true,
      data: rows.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscribers.' });
  }
});

// ── ADMIN: Send Newsletter to All Subscribers ─────────────────────────────────
router.post('/admin/send', authenticateToken, authorizeRole('admin','editor'), async (req, res) => {
  try {
    const { subject, htmlContent } = req.body;
    if (!subject || !htmlContent) {
      return res.status(400).json({ success: false, error: 'Subject and content are required.' });
    }

    const result = await query('SELECT email FROM newsletter WHERE is_active = true');
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active subscribers found.' });
    }

    const stats = await sendBulkNewsletter(result.rows, subject, htmlContent);
    res.json({ success: true, message: 'Newsletter sent.', stats });
  } catch (err) {
    console.error('Newsletter send error:', err);
    res.status(500).json({ success: false, error: 'Failed to send newsletter.' });
  }
});

// ── ADMIN: Delete Subscriber ──────────────────────────────────────────────────
router.delete('/admin/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM newsletter WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, message: 'Subscriber removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove subscriber.' });
  }
});

module.exports = router;
