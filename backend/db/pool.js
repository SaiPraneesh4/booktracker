const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,   // Supabase / Render use this
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // Fallback to individual vars for local dev
  host:     process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || "localhost"),
  port:     process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || "booktracker"),
  user:     process.env.DATABASE_URL ? undefined : (process.env.DB_USER || "postgres"),
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
});

pool.on("error", (err) => console.error("PG pool error:", err.message));
module.exports = pool;