import React, { useState, useEffect, useContext, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { ToastContext } from "../components/Layout";
import styles from "./MyBooksPage.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function MyBooksPage() {
  const showToast = useContext(ToastContext);
  const [params] = useSearchParams();
  const token = params.get("token");

  const [state,   setState]   = useState("loading"); // loading | valid | error
  const [email,   setEmail]   = useState("");
  const [books,   setBooks]   = useState([]);
  const [removing,setRemoving]= useState(null);
  const didVerify = useRef(false); // guard against React StrictMode double-invoke

  useEffect(() => {
    if (!token) { setState("error"); return; }
    if (didVerify.current) return;  // skip duplicate call in StrictMode
    didVerify.current = true;

    axios.get(`${API}/api/auth/verify?token=${token}`)
      .then(r => { setEmail(r.data.email); setBooks(r.data.books); setState("valid"); })
      .catch(err => {
        console.error("Token verify failed:", err.response?.data || err.message);
        setState("error");
      });
  }, [token]);

  const handleRemove = async (bookId) => {
    if (!window.confirm("Stop tracking this book?")) return;
    setRemoving(bookId);
    try {
      await axios.delete(`${API}/api/my-books/${bookId}`, { data: { email } });
      setBooks(prev => prev.filter(b => b.id !== bookId));
      showToast("Removed from your list.", "info");
    } catch { showToast("Failed to remove.", "error"); }
    setRemoving(null);
  };

  if (state === "loading") return (
    <div className={styles.center}><div className={styles.spinner} /><p>Verifying your link…</p></div>
  );

  if (state === "error") return (
    <div className={styles.center}>
      <div className={styles.errorIcon}>⚠️</div>
      <h2>Invalid or expired link</h2>
      <p>This magic link has already been used or has expired (links are valid for 24 hours).</p>
      <p>Click <strong>My Books</strong> in the nav to request a new link.</p>
      <Link to="/" className={styles.homeLink}>← Back to home</Link>
    </div>
  );

  const notified = books.filter(b => b.notified);
  const watching = books.filter(b => !b.notified);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>My tracked books</h1>
          <p className={styles.sub}>Signed in as <strong>{email}</strong></p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}><span>{books.length}</span>total</div>
          <div className={styles.stat}><span className={styles.green}>{notified.length}</span>notified</div>
          <div className={styles.stat}><span className={styles.amber}>{watching.length}</span>watching</div>
        </div>
      </div>

      {books.length === 0 ? (
        <div className={styles.empty}>
          <p>You're not tracking any books yet.</p>
          <Link to="/" className={styles.homeLink}>Browse books to track →</Link>
        </div>
      ) : (
        <>
          {watching.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>⏳ Waiting for price drop</h2>
              <div className={styles.list}>
                {watching.map(b => <MyBookRow key={b.id} book={b} onRemove={handleRemove} removing={removing} />)}
              </div>
            </section>
          )}
          {notified.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>✅ Price reached — email sent</h2>
              <div className={styles.list}>
                {notified.map(b => <MyBookRow key={b.id} book={b} onRemove={handleRemove} removing={removing} notified />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MyBookRow({ book, onRemove, removing, notified }) {
  const [imgError, setImgError] = useState(false);
  const current = book.current_price ? parseFloat(book.current_price) : null;
  const target  = parseFloat(book.target_price);
  const dropPct = current ? (((current - target) / current) * 100).toFixed(1) : null;

  return (
    <div className={`${styles.row} ${notified ? styles.rowNotified : ""}`}>
      {book.image_url && !imgError
        ? <img src={book.image_url} alt={book.title} className={styles.thumb} crossOrigin="anonymous" onError={() => setImgError(true)} />
        : <div className={styles.thumbPlaceholder}>📖</div>
      }
      <div className={styles.rowBody}>
        <a href={book.url} target="_blank" rel="noopener noreferrer" className={styles.rowTitle}>
          {book.title}
        </a>
        <div className={styles.rowMeta}>
          <span>Current: <strong>{current ? `₹${current}` : "—"}</strong></span>
          <span>My target: <strong>₹{target}</strong></span>
          {dropPct && !notified && parseFloat(dropPct) > 0 && (
            <span className={styles.amber}>↓ {dropPct}% to go</span>
          )}
          {notified && (
            <span className={styles.green}>🎯 Notified {timeAgo(book.notified_at)}</span>
          )}
          <span className={styles.light}>Added {timeAgo(book.joined_at)}</span>
        </div>
      </div>
      <button
        className={styles.removeBtn}
        onClick={() => onRemove(book.id)}
        disabled={removing === book.id}
      >
        {removing === book.id ? "…" : "Remove"}
      </button>
    </div>
  );
}