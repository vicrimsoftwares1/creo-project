// utils/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Email Templates ───────────────────────────────────────────────────────────

const templates = {

  contactConfirmation: (name) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#8B4513,#D4A017);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:26px;">Thank You, ${name}! 🎯</h1>
      </div>
      <div style="background:#1a1a1a;padding:30px;color:#fff;border-radius:0 0 12px 12px;">
        <p style="color:#ddd;font-size:16px;line-height:1.7;">
          We've received your message and our team is already reviewing it.<br>
          Expect a response within <strong style="color:#D4A017;">24 hours</strong>.
        </p>
        <div style="margin:25px 0;padding:20px;background:#2a2a2a;border-left:4px solid #D4A017;border-radius:6px;">
          <p style="color:#aaa;margin:0;font-size:14px;">In the meantime, explore our work:</p>
          <a href="${process.env.FRONTEND_URL}" style="color:#D4A017;font-weight:bold;text-decoration:none;">
            Visit C REO Agency →
          </a>
        </div>
        <p style="color:#888;font-size:14px;margin-top:30px;">
          Warm regards,<br>
          <strong style="color:#D4A017;">The C REO Team</strong>
        </p>
      </div>
    </div>`,

  adminNotification: (contact) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#8B4513,#D4A017);padding:25px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;">🔔 New Contact Submission</h2>
      </div>
      <div style="background:#1a1a1a;padding:30px;color:#fff;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Name',    contact.name],
            ['Email',   contact.email],
            ['Phone',   contact.phone    || 'N/A'],
            ['Company', contact.company  || 'N/A'],
            ['Service', contact.service  || 'N/A'],
            ['Budget',  contact.budget   || 'N/A'],
            ['Status',  contact.status   || 'new'],
          ].map(([label, value]) => `
            <tr>
              <td style="padding:10px 0;color:#D4A017;font-weight:bold;width:110px;">${label}</td>
              <td style="padding:10px 0;color:#ddd;">${value}</td>
            </tr>`).join('')}
        </table>
        <div style="margin-top:20px;padding:20px;background:#2a2a2a;border-left:4px solid #D4A017;border-radius:6px;">
          <p style="color:#aaa;margin:0 0 8px;font-size:13px;">MESSAGE</p>
          <p style="color:#ddd;margin:0;">${contact.message}</p>
        </div>
      </div>
    </div>`,

  newsletterWelcome: (name) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#8B4513,#D4A017);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;">Welcome to C REO! 🎉</h1>
      </div>
      <div style="background:#1a1a1a;padding:30px;color:#fff;border-radius:0 0 12px 12px;">
        <p style="color:#ddd;font-size:16px;line-height:1.7;">Hi <strong>${name || 'there'}</strong>,</p>
        <p style="color:#ddd;line-height:1.7;">
          You're now part of the C REO community! You'll receive our latest insights,
          case studies, and exclusive marketing tips — all designed to help your brand grow.
        </p>
        <p style="color:#888;font-size:14px;margin-top:30px;">
          Best,<br><strong style="color:#D4A017;">The C REO Team</strong>
        </p>
      </div>
    </div>`,

  newsletterBroadcast: (subject, htmlContent) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#8B4513,#D4A017);padding:25px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;">${subject}</h2>
        <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;font-size:13px;">C REO Agency Newsletter</p>
      </div>
      <div style="background:#1a1a1a;padding:30px;border-radius:0 0 12px 12px;">
        ${htmlContent}
      </div>
      <p style="text-align:center;color:#666;font-size:12px;margin-top:15px;">
        <a href="${process.env.FRONTEND_URL}/unsubscribe" style="color:#888;">Unsubscribe</a>
      </p>
    </div>`,
};

// ── Send helpers ──────────────────────────────────────────────────────────────

const FROM = process.env.SMTP_FROM || '"C REO Agency" <noreply@creoagency.com>';
const ADMIN_TO = process.env.ADMIN_EMAIL_NOTIFY || 'admin@creoagency.com';

async function sendContactConfirmation(name, email) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: 'We received your message — C REO Agency',
    html: templates.contactConfirmation(name),
  });
}

async function sendAdminNotification(contact) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: FROM, to: ADMIN_TO,
    subject: `New Contact: ${contact.name} — C REO`,
    html: templates.adminNotification(contact),
  });
}

async function sendNewsletterWelcome(name, email) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: 'Welcome to C REO Agency Newsletter!',
    html: templates.newsletterWelcome(name),
  });
}

async function sendBulkNewsletter(subscribers, subject, htmlContent) {
  if (!process.env.SMTP_USER) throw new Error('SMTP not configured');
  const BATCH = 50;
  let sent = 0, failed = 0;

  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(sub =>
        transporter.sendMail({
          from: FROM, to: sub.email,
          subject,
          html: templates.newsletterBroadcast(subject, htmlContent),
        })
        .then(() => sent++)
        .catch(() => failed++)
      )
    );
    // Throttle between batches
    if (i + BATCH < subscribers.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return { sent, failed, total: subscribers.length };
}

module.exports = {
  sendContactConfirmation,
  sendAdminNotification,
  sendNewsletterWelcome,
  sendBulkNewsletter,
};
