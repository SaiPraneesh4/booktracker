import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import axios from "axios";
import { ToastContext } from "../components/Layout";
import BookCard from "../components/BookCard";
import AddWatcherModal from "../components/AddWatcherModal";
import styles from "./HomePage.module.css";

const API          = process.env.REACT_APP_API_URL || "http://localhost:5000";
const POLL_MS      = 60_000;  // poll every 60s when healthy
const RETRY_MS     = 15_000;  // retry after 15s on error
const MAX_RETRIES  = 3;       // stop toasting after 3 consecutive failures

export default function HomePage() {
  const showToast = useContext(ToastContext);

  const [books,       setBooks]       = useState([]);
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState(false);   // true = backend unreachable
  const [addModal,    setAddModal]    = useState(false);
  const [newUrl,      setNewUrl]      = useState("");
  const [urlLoading,  setUrlLoading]  = useState(false);
  const [previewBook, setPreviewBook] = useState(null);

  const retryCount   = useRef(0);
  const timerRef     = useRef(null);

  const scheduleNext = useCallback((delayMs) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchBooks(), delayMs);
  }, []); // eslint-disable-line

  const fetchBooks = useCallback(async () => {
    try {
      const q   = search.trim();
      const url = q
        ? `${API}/api/books/search?q=${encodeURIComponent(q)}`
        : `${API}/api/books`;
      const { data } = await axios.get(url, { timeout: 10000 });
      setBooks(data.books);
      setApiError(false);
      retryCount.current = 0;
      scheduleNext(POLL_MS); // healthy — poll normally
    } catch (err) {
      retryCount.current += 1;
      setApiError(true);

      // Only show toast on first failure — not on every retry
      if (retryCount.current === 1) {
        showToast("Backend unreachable. Retrying in 15s…", "error");
      }

      // Stop retrying after MAX_RETRIES — user can manually refresh
      if (retryCount.current < MAX_RETRIES) {
        console.warn(`[API] Fetch failed (attempt ${retryCount.current}), retrying in ${RETRY_MS/1000}s`);
        scheduleNext(RETRY_MS);
      } else {
        console.warn("[API] Max retries reached — stopping auto-retry. Refresh page to try again.");
        showToast("Backend still unreachable. Please refresh the page.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [search, showToast, scheduleNext]);

  // Initial fetch on mount / search change
  useEffect(() => {
    retryCount.current = 0;
    fetchBooks();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fetchBooks]);

  // When user submits a URL — resolve the book (create or find) then open watcher modal
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!newUrl.includes("bookswagon.com"))
      return showToast("Please enter a BooksWagon URL.", "error");

    setUrlLoading(true);
    try {
      // Check if already in DB
      const { data } = await axios.get(`${API}/api/books/search?q=${encodeURIComponent(newUrl)}`);
      const existing = data.books.find(b => b.url === newUrl);
      if (existing) {
        setPreviewBook(existing);
      } else {
        // Will be created when watcher is added
        setPreviewBook({ url: newUrl, title: "New book", image_url: null, current_price: null });
      }
      setAddModal(true);
    } catch { showToast("Failed to look up book.", "error"); }
    setUrlLoading(false);
  };

  const totalWatchers = books.reduce((a, b) => a + parseInt(b.total_watchers || 0), 0);
  const totalBooks    = books.length;

  return (
    <div>
      {addModal && previewBook && (
        <AddWatcherModal
          book={previewBook}
          onClose={() => { setAddModal(false); setPreviewBook(null); setNewUrl(""); }}
          onSuccess={fetchBooks}
          showToast={showToast}
        />
      )}

      {/* ── Backend error banner ───────────────────────────────────────────── */}
      {apiError && (
        <div className={styles.errorBanner}>
          <span>⚠ Cannot reach the server. Retrying automatically…</span>
          <button
            className={styles.retryBtn}
            onClick={() => { retryCount.current = 0; setApiError(false); fetchBooks(); }}
          >
            Retry now
          </button>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Track any BooksWagon price.<br/>Get notified when it drops.</h1>
        <p className={styles.heroSub}>Paste a book URL, set your target price, and we'll email you once — when the price hits.</p>

        <form className={styles.heroForm} onSubmit={handleUrlSubmit}>
          <input
            type="url"
            className={styles.heroInput}
            placeholder="https://www.bookswagon.com/book/..."
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
          />
          <button type="submit" className={styles.heroBtn} disabled={urlLoading}>
            {urlLoading ? "Looking up…" : "Track this book →"}
          </button>
        </form>

        <div className={styles.heroStats}>
          <span><strong>{totalBooks}</strong> books tracked</span>
          <span className={styles.dot}>·</span>
          <span><strong>{totalWatchers}</strong> price alerts set</span>
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className={styles.searchRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search tracked books by title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.clearBtn} onClick={() => setSearch("")}>✕ Clear</button>
        )}
      </div>

      {/* ── Book list ─────────────────────────────────────────────────────── */}
      <section>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            {search ? `Results for "${search}"` : "All tracked books"}
            {books.length > 0 && <span className={styles.count}>{books.length}</span>}
          </h2>
        </div>

        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : books.length === 0 ? (
          <div className={styles.empty}>
            {search ? "No books match your search." : "No books tracked yet. Add one above!"}
          </div>
        ) : (
          <div className={styles.grid}>
            {books.map(book => (
              <BookCard
                key={book.id}
                book={book}
                onRefresh={fetchBooks}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}