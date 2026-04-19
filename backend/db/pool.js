const { Pool } = require("pg");
require("dotenv").config();

// Supabase gives two connection strings — we need the
// "Transaction pooler" (port 6543) which is IPv4-only.
// The direct connection (port 5432) uses IPv6 on Render and fails.
//
// How to get the correct URL from Supabase:
//   Project → Settings → Database → Connection string
//   → Switch mode to "Transaction pooler" (shows port 6543)
//   Copy that string and paste it as DATABASE_URL in Render.
//
// It looks like:
//   postgresql://postgres.xxxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

function buildConfig() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    return {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    };
  }

  // Local dev fallback — uses individual env vars
  return {
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME     || "booktracker",
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD,
    ssl:      false,
  };
}

const pool = new Pool(buildConfig());

pool.on("connect", () => console.log("[DB] Connected to PostgreSQL"));
pool.on("error",   (err) => console.error("[DB] Pool error:", err.message));

module.exports = pool;