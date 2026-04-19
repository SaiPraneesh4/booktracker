const { Pool } = require("pg");
require("dotenv").config();

// ── Supabase + Render connection notes ────────────────────────────────────────
// Use the "Transaction pooler" URL from Supabase (port 6543, IPv4).
// Direct connection (port 5432) uses IPv6 which Render free tier doesn't support.
//
// Supabase free tier drops idle connections after ~5 minutes.
// The settings below handle reconnection automatically.

function buildConfig() {
  const dbUrl = process.env.DATABASE_URL;

  const poolSettings = {
    max:                10,    // max connections in pool
    idleTimeoutMillis:  30000, // close idle connections after 30s (before Supabase drops them at ~5min)
    connectionTimeoutMillis: 10000, // fail fast if can't connect in 10s — triggers retry
    allowExitOnIdle:    false,
  };

  if (dbUrl) {
    return {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      ...poolSettings,
    };
  }

  // Local dev fallback
  return {
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME     || "booktracker",
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD,
    ssl:      false,
    ...poolSettings,
  };
}

const pool = new Pool(buildConfig());

pool.on("connect", () => console.log("[DB] ✓ Client connected"));
pool.on("remove",  () => console.log("[DB] Client removed from pool"));
pool.on("error",   (err) => console.error("[DB] Pool error:", err.message));

// ── Query wrapper with automatic retry ───────────────────────────────────────
// Wraps pool.query with one automatic retry on connection errors.
// This handles Supabase dropping idle connections mid-request.

const RETRYABLE_ERRORS = [
  "Connection terminated unexpectedly",
  "Connection terminated",
  "Connection refused",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "the database system is starting up",
];

function isRetryable(err) {
  return RETRYABLE_ERRORS.some(msg => err.message?.includes(msg));
}

async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (isRetryable(err)) {
      console.warn("[DB] Retryable error — waiting 2s then retrying:", err.message);
      await new Promise(r => setTimeout(r, 2000));
      return await pool.query(text, params); // one retry
    }
    throw err;
  }
}

// ── Connect wrapper with retry ─────────────────────────────────────────────
async function connect() {
  try {
    return await pool.connect();
  } catch (err) {
    if (isRetryable(err)) {
      console.warn("[DB] Connect retryable error — waiting 2s:", err.message);
      await new Promise(r => setTimeout(r, 2000));
      return await pool.connect();
    }
    throw err;
  }
}

module.exports = { query, connect, pool };