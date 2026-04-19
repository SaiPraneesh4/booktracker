-- Run this to migrate to the new multi-user schema
-- psql -U postgres -d booktracker -f db/setup.sql

-- Drop old tables cleanly (comment these out if you want to keep old data)
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS magic_tokens CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;

-- ── books: one row per unique URL ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id            SERIAL PRIMARY KEY,
  url           TEXT NOT NULL UNIQUE,
  title         TEXT,
  image_url     TEXT,
  current_price NUMERIC(10,2),
  last_checked  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── watchers: one row per user per book ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchers (
  id           SERIAL PRIMARY KEY,
  book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  target_price NUMERIC(10,2) NOT NULL,
  notified     BOOLEAN NOT NULL DEFAULT FALSE,   -- sent once, never again
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, email)                        -- one watcher entry per email per book
);

-- ── price_history: per book ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id         SERIAL PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  price      NUMERIC(10,2),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── magic_tokens: for passwordless "my books" access ─────────────────────────
CREATE TABLE IF NOT EXISTS magic_tokens (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── feedback: about page contact ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watchers_book    ON watchers(book_id);
CREATE INDEX IF NOT EXISTS idx_watchers_email   ON watchers(email);
CREATE INDEX IF NOT EXISTS idx_watchers_notify  ON watchers(notified, target_price);
CREATE INDEX IF NOT EXISTS idx_price_history_bk ON price_history(book_id);
CREATE INDEX IF NOT EXISTS idx_magic_token      ON magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_email      ON magic_tokens(email);