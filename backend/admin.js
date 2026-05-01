// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { authenticateToken, authorizeRole, generateToken } = require('../middleware/auth');

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const result = await query(
      'SELECT * FROM admins WHERE username = $1 AND is_active = true',
      [username]
    );
    const admin = result.rows[0];

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    await query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    const token = generateToken({ id: admin.id, username: admin.username, role: admin.role });

    res.json({
      success: true,
      token,
      user: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

// ── POST /api/admin/setup — First-time admin creation ────────────────────────
router.post('/setup', async (req, res) => {
  try {
    const existing = await query('SELECT id FROM admins LIMIT 1');
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Setup already completed.' });
    }

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    const hash = await bcrypt.hash(password, 12);
    await query(
      'INSERT INTO admins (username, email, password, role) VALUES ($1,$2,$3,$4)',
      [username, email, hash, 'admin']
    );

    res.status(201).json({ success: true, message: 'Admin account created successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Setup failed.' });
  }
});

// ── GET /api/admin/me — Verify token & get current admin ─────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, email, role, last_login, created_at FROM admins WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Admin not found.' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user.' });
  }
});

// ── GET /api/admin/analytics/dashboard — Full dashboard stats ────────────────
router.get('/analytics/dashboard', authenticateToken, authorizeRole('admin','viewer'), async (req, res) => {
  try {
    const [
      totalContacts,
      totalSubscribers,
      totalInquiries,
      totalPortfolio,
      recentContacts,
      contactsByStatus,
      inquiriesByService,
      monthlyContacts,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM contacts'),
      query('SELECT COUNT(*) AS c FROM newsletter WHERE is_active = true'),
      query('SELECT COUNT(*) AS c FROM service_inquiries'),
      query('SELECT COUNT(*) AS c FROM portfolio'),
      query('SELECT id, name, email, service, status, created_at FROM contacts ORDER BY created_at DESC LIMIT 5'),
      query('SELECT status, COUNT(*) AS count FROM contacts GROUP BY status'),
      query('SELECT service, COUNT(*) AS count FROM service_inquiries GROUP BY service ORDER BY count DESC'),
      query(`
        SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count
        FROM contacts
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month ASC
      `),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalContacts:    parseInt(totalContacts.rows[0].c),
          totalSubscribers: parseInt(totalSubscribers.rows[0].c),
          totalInquiries:   parseInt(totalInquiries.rows[0].c),
          totalPortfolio:   parseInt(totalPortfolio.rows[0].c),
        },
        recentContacts:    recentContacts.rows,
        contactsByStatus:  contactsByStatus.rows,
        inquiriesByService: inquiriesByService.rows,
        monthlyContacts:   monthlyContacts.rows,
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics.' });
  }
});

// ── GET /api/admin/analytics/events — Raw analytics events ───────────────────
router.get('/analytics/events', authenticateToken, authorizeRole('admin','viewer'), async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(200, parseInt(req.query.limit) || 100);
    const offset = (page - 1) * limit;
    const event  = req.query.event;

    const params = event ? [event, limit, offset] : [limit, offset];
    const where  = event ? 'WHERE event = $1' : '';
    const lp = event ? '$2' : '$1';
    const op = event ? '$3' : '$2';

    const [rows, count, summary] = await Promise.all([
      query(
        `SELECT id, event, page, user_id, session_id, metadata, ip_address, timestamp
         FROM analytics ${where} ORDER BY timestamp DESC LIMIT ${lp} OFFSET ${op}`,
        params
      ),
      query(`SELECT COUNT(*) AS total FROM analytics ${where}`, event ? [event] : []),
      query('SELECT event, COUNT(*) AS count FROM analytics GROUP BY event ORDER BY count DESC'),
    ]);

    const total = parseInt(count.rows[0].total);
    res.json({
      success: true,
      data: rows.rows,
      summary: summary.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics events.' });
  }
});

module.exports = router;
