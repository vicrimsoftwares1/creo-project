// utils/seedAdmin.js — Run with: node utils/seedAdmin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

async function seedAdmin() {
  try {
    const username = process.env.ADMIN_USERNAME || 'creo_admin';
    const email    = process.env.ADMIN_EMAIL    || 'admin@creoagency.com';
    const password = process.env.ADMIN_PASSWORD || 'CreoAdmin2025!';

    const existing = await query('SELECT id FROM admins WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      console.log('⚠️  Admin already exists. Skipping seed.');
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 12);
    await query(
      'INSERT INTO admins (username, email, password, role) VALUES ($1, $2, $3, $4)',
      [username, email, hash, 'admin']
    );

    console.log('✅ Admin seeded successfully!');
    console.log(`   Username: ${username}`);
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n⚠️  Change your password after first login!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedAdmin();
