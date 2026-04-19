import React, { useState, useEffect, useContext, useCallback } from "react";
import axios from "axios";
import { ToastContext } from "../components/Layout";
import BookCard from "../components/BookCard";
import AddWatcherModal from "../components/AddWatcherModal";
import styles from "./HomePage.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function HomePage() {
  const showToast = useContext(ToastContext);

  const [books,      setBooks]      = useState([]);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [addModal,   setAddModal]   = useState(false);   // "add new book" flow
  const [newUrl,     setNewUrl]     = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [previewBook,setPreviewBook]= useState(null);    // after URL resolved

  const fetchBooks = useCallback(async () => {
    try {
      const q = search.trim();
      const url = q
        ? `${API}/api/books/search?q=${encodeURIComponent(q)}`
        : `${API}/api/books`;
      const { data } = await axios.get(url);
      setBooks(data.books);
    } catch { showToast("Cannot reach backend. Is it running?", "error"); }
    finally { setLoading(false); }
  }, [search, showToast]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);
  // Poll every 60s
  useEffect(() => {
    const t = setInterval(fetchBooks, 60_000);
    return () => clearInterval(t);
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