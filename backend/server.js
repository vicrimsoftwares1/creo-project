// ============================================================
//  C REO AGENCY — BACKEND SERVER
//  Stack: Node.js + Express + Supabase (PostgreSQL)
//  Deploy: Render (backend) + Vercel (frontend)
// ============================================================

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Trust proxy (required on Render) ─────────────────────────────────────────
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS — allow Vercel frontend ──────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
}));

// Strict limiter for form submission endpoints
const strictLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 15,
  message: { success: false, error: 'Too many submissions. Try again later.' },
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    service: 'C REO Agency API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/contact',          strictLimit, require('./routes/contacts'));
app.use('/api/newsletter',       strictLimit, require('./routes/newsletter'));
app.use('/api/portfolio',                     require('./routes/portfolio'));
app.use('/api/testimonials',                  require('./routes/testimonials'));
app.use('/api/service-inquiry',  strictLimit, require('./routes/inquiries'));
app.use('/api/analytics',                     require('./routes/analytics'));
app.use('/api/admin',                         require('./routes/admin'));

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ success: false, error: err.message });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════╗
║   C REO AGENCY — BACKEND API SERVER        ║
║   Status:  Running ✅                        ║
║   Port:    ${PORT}                              ║
║   Env:     ${(process.env.NODE_ENV || 'development').padEnd(14)}            ║
╚═════════════════════════════════════════════╝

  Endpoints:
  → GET  /api/health
  → POST /api/contact
  → POST /api/newsletter/subscribe
  → GET  /api/portfolio
  → GET  /api/testimonials
  → POST /api/service-inquiry
  → POST /api/analytics/track
  → POST /api/admin/login
  → GET  /api/admin/analytics/dashboard
  `);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  const { pool } = require('./config/db');
  await pool.end();
  console.log('Database pool closed.');
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
