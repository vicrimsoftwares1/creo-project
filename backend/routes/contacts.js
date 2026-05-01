// routes/contacts.js
const express = require('express');
const router = express.Router();
const validator = require('validator');
const { query } = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sendContactConfirmation, sendAdminNotification } = require('../utils/mailer');

// ── PUBLIC: Submit Contact Form ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company, service, message, budget } = req.body;
    const ip = req.ip;

    // Validation
    const errors = [];
    if (!name    || name.trim().length < 2)      errors.push('Name must be at least 2 characters.');
    if (!email   || !validator.isEmail(email))   errors.push('A valid email address is required.');
    if (!message || message.trim().length < 10)  errors.push('Message must be at least 10 characters.');
    if (name     && name.length    > 100)         errors.push('Name is too long.');
    if (message  && message.length > 5000)        errors.push('Message is too long (max 5000 chars).');
    if (errors.length) return res.status(400).json({ success: false, errors });

    // Spam: max 3 submissions per IP per hour
    const spamCheck = await query(
      `SELECT COUNT(*) AS c FROM contacts
       WHERE ip_address = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [ip]
    );
    if (parseInt(spamCheck.rows[0].c) >= 3) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Try again later.' });
    }

    const result = await query(
      `INSERT INTO contacts (name, email, phone, company, service, message, budget, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name.trim(), email.trim().toLowerCase(), phone || null, company || null,
       service || null, message.trim(), budget || null, ip]
    );

    // Non-blocking emails
    const contactData = { name: name.trim(), email, phone, company, service, message: message.trim(), budget, status: 'new' };
    Promise.allSettled([
      sendContactConfirmation(name.trim(), email.trim()),
      sendAdminNotification(contactData),
    ]).catch(console.error);

    res.status(201).json({
      success: true,
      message: "Thank you! We'll get back to you within 24 hours.",
      contactId: result.rows[0].id,
    });
  } catch (err) {
    console.error('Contact submit error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit contact form.' });
  }
});

// ── ADMIN: Get All Contacts (paginated, filterable) ───────────────────────────
router.get('/admin', authenticateToken, authorizeRole('admin','editor','viewer'), async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params = status ? [status, limit, offset] : [limit, offset];
    const whereClause = status ? 'WHERE status = $1' : '';
    const limitParam  = status ? '$2' : '$1';
    const offsetParam = status ? '$3' : '$2';

    const [contactsResult, countResult] = await Promise.all([
      query(
        `SELECT * FROM contacts ${whereClause} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total FROM contacts ${whereClause}`,
        status ? [status] : []
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);
    res.json({
      success: true,
      data: contactsResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Contacts admin fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch contacts.' });
  }
});

// ── ADMIN: Update Contact Status ──────────────────────────────────────────────
router.patch('/admin/:id', authenticateToken, authorizeRole('admin','editor'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['new','contacted','qualified','converted','closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const result = await query(
      'UPDATE contacts SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update contact.' });
  }
});

// ── ADMIN: Delete Contact ─────────────────────────────────────────────────────
router.delete('/admin/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM contacts WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, message: 'Contact deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete.' });
  }
});

// ── ADMIN: Export Contacts to CSV ─────────────────────────────────────────────
router.get('/admin/export/csv', authenticateToken, authorizeRole('admin','editor'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM contacts ORDER BY created_at DESC');
    const header = 'Name,Email,Phone,Company,Service,Budget,Status,Message,Date\n';
    const rows = result.rows.map(c =>
      `"${c.name}","${c.email}","${c.phone||''}","${c.company||''}","${c.service||''}","${c.budget||''}","${c.status}","${(c.message||'').replace(/"/g,'""')}","${c.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=creo-contacts.csv');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Export failed.' });
  }
});

module.exports = router;
