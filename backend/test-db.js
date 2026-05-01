require('dotenv').config();
const { Pool } = require('pg');

console.log("Checking DATABASE_URL:", process.env.DATABASE_URL ? "URL is set" : "URL IS MISSING!");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log("❌ CONNECTION ERROR:", err.message);
    console.log("Full Error Code:", err.code);
  } else {
    console.log("✅ SUCCESS! Database time is:", res.rows[0].now);
  }
  pool.end();
});