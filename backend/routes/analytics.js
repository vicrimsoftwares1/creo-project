// routes/analytics.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// ── PUBLIC: Track Event ───────────────────────────────────────────────────────
router.post('/track', async (req, res) => {
  try {
    const { event, page, userId, sessionId, metadata } = req.body;
    if (!event) return res.status(400).json({ success: false, error: 'Event name is required.' });

    await query(
      `INSERT INTO analytics (event, page, user_id, session_id, metadata, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [event, page || null, userId || null, sessionId || null,
       metadata ? JSON.stringify(metadata) : '{}',
       req.ip, req.headers['user-agent'] || null]
    );

    res.json({ success: true });
  } catch (err) {
    // Fail silently — don't break user experience for analytics
    console.error('Analytics track error:', err.message);
    res.json({ success: false });
  }
});

module.exports = router;
