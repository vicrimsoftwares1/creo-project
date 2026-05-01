// utils/migrate.js — Run with: node utils/migrate.js
require('dotenv').config();
const { query } = require('../config/db');

async function migrate() {
  console.log('🔄 Running database migrations...\n');

  try {
    // ── Admins ─────────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username    TEXT NOT NULL UNIQUE,
        email       TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
        is_active   BOOLEAN NOT NULL DEFAULT true,
        last_login  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ admins table ready');

    // ── Contacts ───────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        email       TEXT NOT NULL,
        phone       TEXT,
        company     TEXT,
        service     TEXT CHECK (service IN (
                      'Social Media Marketing','Photography','SEO & Analytics',
                      'Content Strategy','PPC Advertising','Email Marketing',
                      'Brand Development','Other'
                    )),
        message     TEXT NOT NULL,
        budget      TEXT CHECK (budget IN (
                      '<$5000','$5000-$10000','$10000-$25000','$25000-$50000','$50000+'
                    )),
        status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                      'new','contacted','qualified','converted','closed'
                    )),
        source      TEXT NOT NULL DEFAULT 'website',
        ip_address  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_status     ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
    `);
    console.log('✅ contacts table ready');

    // ── Newsletter ─────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT NOT NULL UNIQUE,
        name          TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address    TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_newsletter_email     ON newsletter(email);
      CREATE INDEX IF NOT EXISTS idx_newsletter_is_active ON newsletter(is_active);
    `);
    console.log('✅ newsletter table ready');

    // ── Portfolio ──────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title        TEXT NOT NULL,
        description  TEXT NOT NULL,
        category     TEXT CHECK (category IN (
                       'Branding','Social Media','SEO','Photography',
                       'Content','PPC','Web Development'
                     )),
        client       TEXT,
        industry     TEXT,
        results      JSONB DEFAULT '[]',
        images       JSONB DEFAULT '[]',
        pdf_file     TEXT,
        link         TEXT,
        featured     BOOLEAN NOT NULL DEFAULT false,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_portfolio_featured ON portfolio(featured);
      CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio(category);
    `);
    console.log('✅ portfolio table ready');

    // ── Testimonials ───────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        role        TEXT NOT NULL,
        company     TEXT,
        content     TEXT NOT NULL,
        rating      INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
        image       TEXT,
        featured    BOOLEAN NOT NULL DEFAULT false,
        is_approved BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(is_approved);
    `);
    console.log('✅ testimonials table ready');

    // ── Service Inquiries ──────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS service_inquiries (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            TEXT NOT NULL,
        email           TEXT NOT NULL,
        phone           TEXT,
        service         TEXT NOT NULL,
        project_details TEXT,
        timeline        TEXT CHECK (timeline IN (
                          'Urgent (< 1 month)','1-3 months','3-6 months','6+ months','Flexible'
                        )),
        budget          TEXT,
        referral_source TEXT,
        status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                          'pending','reviewing','quoted','accepted','rejected'
                        )),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_inquiries_status ON service_inquiries(status);
    `);
    console.log('✅ service_inquiries table ready');

    // ── Analytics ──────────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS analytics (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event       TEXT NOT NULL,
        page        TEXT,
        user_id     TEXT,
        session_id  TEXT,
        metadata    JSONB DEFAULT '{}',
        ip_address  TEXT,
        user_agent  TEXT,
        timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_event     ON analytics(event);
      CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp DESC);
    `);
    console.log('✅ analytics table ready');

    console.log('\n🎉 All migrations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
