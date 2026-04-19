require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const cron     = require("node-cron");
const crypto   = require("crypto");
const pool     = require("./db/pool");
const { scrapeBook }     = require("./scraper");
const { sendPriceAlert, sendMagicLink, sendFeedback } = require("./emailService");

const app  = express();
const PORT = process.env.PORT || 5000;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || "0 18 * * *"; // daily 6 PM

const FRONTEND_URL   = process.env.FRONTEND_URL || "http://localhost:3000";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

function priceHitsTarget(currentPrice, targetPrice) {
  // Notify if current price is at or below target (or within 2% above)
  return currentPrice <= targetPrice * 1.02;
}

// ── ① PUBLIC BOOK LISTING ─────────────────────────────────────────────────────

// GET /api/books — all books with aggregated watcher stats (no emails exposed)
app.get("/api/books", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        b.id, b.url, b.title, b.image_url, b.current_price, b.last_checked, b.created_at,
        COUNT(w.id)                              AS total_watchers,
        COUNT(w.id) FILTER (WHERE w.notified)    AS notified_count,
        COUNT(w.id) FILTER (WHERE NOT w.notified) AS pending_count,
        MIN(w.target_price)                      AS lowest_target,
        MAX(w.target_price)                      AS highest_target
      FROM books b
      LEFT JOIN watchers w ON w.book_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json({ books: rows });
  } catch (err) {
    console.error("GET /api/books:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/books/search?q=title — search books by title
app.get("/api/books/search", async (req, res) => {
  const q = `%${req.query.q || ""}%`;
  try {
    const { rows } = await pool.query(`
      SELECT b.id, b.url, b.title, b.image_url, b.current_price, b.last_checked,
             COUNT(w.id) AS total_watchers
      FROM books b
      LEFT JOIN watchers w ON w.book_id = b.id
      WHERE LOWER(b.title) LIKE LOWER($1) OR b.url LIKE $1
      GROUP BY b.id ORDER BY b.created_at DESC LIMIT 20
    `, [q]);
    res.json({ books: rows });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// ── ② ADD / JOIN A BOOK ───────────────────────────────────────────────────────

// POST /api/books — add or join an existing book
// Body: { url, targetPrice, email }
app.post("/api/books", async (req, res) => {
  const { url, targetPrice, email } = req.body;
  if (!url || !targetPrice || !email)
    return res.status(400).json({ error: "url, targetPrice and email are required" });
  if (!url.includes("bookswagon.com"))
    return res.status(400).json({ error: "URL must be from bookswagon.com" });
  if (parseFloat(targetPrice) <= 0)
    return res.status(400).json({ error: "Invalid target price" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Upsert the book (by URL) — scrape only if new
    let book = (await client.query("SELECT * FROM books WHERE url=$1", [url])).rows[0];

    if (!book) {
      // New book — scrape now
      let title = null, imageUrl = null, currentPrice = null;
      try {
        const info = await scrapeBook(url);
        title = info.title; imageUrl = info.imageUrl; currentPrice = info.price;
      } catch (e) { console.warn("Initial scrape failed:", e.message); }

      const ins = await client.query(
        `INSERT INTO books (url, title, image_url, current_price, last_checked)
         VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
        [url, title, imageUrl, currentPrice]
      );
      book = ins.rows[0];

      if (currentPrice) {
        await client.query("INSERT INTO price_history (book_id,price) VALUES ($1,$2)", [book.id, currentPrice]);
      }
    }

    // 2. Upsert the watcher
    const existingWatcher = (await client.query(
      "SELECT * FROM watchers WHERE book_id=$1 AND email=$2", [book.id, email]
    )).rows[0];

    if (existingWatcher) {
      // Update target price only — don't reset notified
      await client.query(
        "UPDATE watchers SET target_price=$1 WHERE id=$2",
        [parseFloat(targetPrice), existingWatcher.id]
      );
    } else {
      await client.query(
        "INSERT INTO watchers (book_id, email, target_price) VALUES ($1,$2,$3)",
        [book.id, email, parseFloat(targetPrice)]
      );
    }

    // 3. If current price already hits target, alert immediately
    if (book.current_price && priceHitsTarget(parseFloat(book.current_price), parseFloat(targetPrice))) {
      if (!existingWatcher || !existingWatcher.notified) {
        try {
          await sendPriceAlert({ toEmail: email, bookTitle: book.title, bookUrl: book.url, currentPrice: book.current_price, targetPrice });
          await client.query(
            "UPDATE watchers SET notified=TRUE, notified_at=NOW() WHERE book_id=$1 AND email=$2",
            [book.id, email]
          );
        } catch (e) { console.error("Immediate alert failed:", e.message); }
      }
    }

    await client.query("COMMIT");

    // Return book with stats (no email data)
    const result = (await pool.query(`
      SELECT b.*, COUNT(w.id) AS total_watchers,
             COUNT(w.id) FILTER (WHERE w.notified) AS notified_count,
             COUNT(w.id) FILTER (WHERE NOT w.notified) AS pending_count,
             MIN(w.target_price) AS lowest_target, MAX(w.target_price) AS highest_target
      FROM books b LEFT JOIN watchers w ON w.book_id = b.id
      WHERE b.id=$1 GROUP BY b.id
    `, [book.id])).rows[0];

    res.status(201).json({ book: result, isNew: !existingWatcher });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/books:", err.message);
    res.status(500).json({ error: "Failed to add book" });
  } finally {
    client.release();
  }
});

// ── ③ PRICE CHECK ─────────────────────────────────────────────────────────────

// POST /api/books/:id/check — manual refresh
app.post("/api/books/:id/check", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM books WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Book not found" });
    const book = await checkAndUpdateBook(rows[0]);
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: "Check failed" });
  }
});

// POST /api/check-all — manual trigger for all
app.post("/api/check-all", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM books");
    const results = await Promise.allSettled(rows.map(checkAndUpdateBook));
    res.json({ checked: rows.length, ok: results.filter(r => r.status === "fulfilled").length });
  } catch (err) {
    res.status(500).json({ error: "Check-all failed" });
  }
});

// ── ④ PRICE HISTORY ───────────────────────────────────────────────────────────

app.get("/api/books/:id/history", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT price, checked_at FROM price_history WHERE book_id=$1 ORDER BY checked_at ASC",
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// ── ⑤ MAGIC LINK ─────────────────────────────────────────────────────────────

// POST /api/auth/magic — send magic link to email
app.post("/api/auth/magic", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@"))
    return res.status(400).json({ error: "Valid email required" });

  // Check if this email has any watchers
  const { rows } = await pool.query("SELECT id FROM watchers WHERE email=$1 LIMIT 1", [email]);
  if (!rows.length)
    return res.status(404).json({ error: "No tracking found for this email" });

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await pool.query(
    "INSERT INTO magic_tokens (email, token, expires_at) VALUES ($1,$2,$3)",
    [email, token, expiresAt]
  );

  const magicUrl = `${FRONTEND_URL}/my-books?token=${token}`;
  try {
    await sendMagicLink({ toEmail: email, magicUrl });
    res.json({ success: true, message: "Magic link sent! Check your inbox." });
  } catch (e) {
    console.error("[MAGIC LINK] Email failed:", e.message);
    res.status(500).json({ error: e.message || "Failed to send email. Check EmailJS config." });
  }
});

// GET /api/auth/verify?token=xxx — verify token and return user's books
// Token is valid for 24h and can be used multiple times within that window.
// Single-use was causing React StrictMode double-invocation to burn the token.
app.get("/api/auth/verify", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token required" });

  const { rows } = await pool.query(
    "SELECT * FROM magic_tokens WHERE token=$1 AND expires_at > NOW()",
    [token]
  );
  if (!rows.length) return res.status(401).json({ error: "Invalid or expired link. Please request a new one." });

  const { email } = rows[0];

  // Get this user's books with their personal target + status
  const { rows: books } = await pool.query(`
    SELECT
      b.id, b.url, b.title, b.image_url, b.current_price, b.last_checked,
      w.target_price, w.notified, w.notified_at, w.created_at AS joined_at,
      COUNT(w2.id) AS total_watchers
    FROM watchers w
    JOIN books b ON b.id = w.book_id
    LEFT JOIN watchers w2 ON w2.book_id = b.id
    WHERE w.email = $1
    GROUP BY b.id, w.target_price, w.notified, w.notified_at, w.created_at
    ORDER BY w.created_at DESC
  `, [email]);

  res.json({ email, books });
});

// DELETE /api/my-books/:bookId — remove self from watchers
app.delete("/api/my-books/:bookId", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  await pool.query("DELETE FROM watchers WHERE book_id=$1 AND email=$2", [req.params.bookId, email]);
  res.json({ success: true });
});

// ── ⑥ FEEDBACK ───────────────────────────────────────────────────────────────

app.post("/api/feedback", async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) return res.status(400).json({ error: "Email and message required" });

  await pool.query("INSERT INTO feedback (email,message) VALUES ($1,$2)", [email, message]);
  try {
    await sendFeedback({ fromEmail: email, message, adminEmail: ADMIN_EMAIL });
  } catch (e) {
    console.error("Feedback email failed:", e.message);
  }
  res.json({ success: true });
});

// ── ⑦ PRICE CHECK ENGINE ─────────────────────────────────────────────────────

async function checkAndUpdateBook(book) {
  let newPrice = null, newTitle = book.title, newImage = book.image_url;
  try {
    const info = await scrapeBook(book.url);
    newPrice  = info.price;
    if (info.title && info.title !== "Unknown Title") newTitle = info.title;
    if (info.imageUrl) newImage = info.imageUrl;
  } catch (err) {
    console.error(`[CHECK] Scrape failed book#${book.id}: ${err.message}`);
    return book;
  }

  if (newPrice) {
    await pool.query("INSERT INTO price_history (book_id,price) VALUES ($1,$2)", [book.id, newPrice]);
  }

  await pool.query(
    "UPDATE books SET current_price=$1,title=$2,image_url=$3,last_checked=NOW() WHERE id=$4",
    [newPrice, newTitle, newImage, book.id]
  );

  console.log(`[CHECK] Book#${book.id} "${newTitle?.substring(0,50)}": ₹${newPrice}`);

  if (!newPrice) return book;

  // Alert all un-notified watchers whose target is reached
  const { rows: watchers } = await pool.query(
    "SELECT * FROM watchers WHERE book_id=$1 AND notified=FALSE",
    [book.id]
  );

  for (const w of watchers) {
    if (priceHitsTarget(newPrice, parseFloat(w.target_price))) {
      try {
        await sendPriceAlert({
          toEmail: w.email,
          bookTitle: newTitle,
          bookUrl: book.url,
          currentPrice: newPrice,
          targetPrice: w.target_price,
        });
        await pool.query(
          "UPDATE watchers SET notified=TRUE, notified_at=NOW() WHERE id=$1",
          [w.id]
        );
        console.log(`[ALERT] ✓ Notified ${w.email} — ₹${newPrice} ≤ target ₹${w.target_price}`);
      } catch (e) {
        console.error(`[ALERT] ✗ Failed for ${w.email}:`, e.message);
      }
    }
  }

  return { ...book, current_price: newPrice, title: newTitle, image_url: newImage };
}

// ── ⑧ SCHEDULER ──────────────────────────────────────────────────────────────

cron.schedule(CHECK_INTERVAL, async () => {
  console.log(`\n[CRON ${new Date().toISOString()}] ── Daily price check ──`);
  try {
    const { rows } = await pool.query("SELECT * FROM books");
    console.log(`[CRON] Checking ${rows.length} book(s)...`);
    await Promise.allSettled(rows.map(checkAndUpdateBook));
    console.log("[CRON] Done.\n");
  } catch (err) {
    console.error("[CRON] Error:", err.message);
  }
}, { timezone: "Asia/Kolkata" });

// ── START ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  📚 BookTracker API`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Cron: ${CHECK_INTERVAL} (IST)`);
  console.log(`  Frontend: ${FRONTEND_URL}\n`);
});