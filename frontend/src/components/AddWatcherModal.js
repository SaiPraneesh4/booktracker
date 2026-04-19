import React, { useState } from "react";
import axios from "axios";
import styles from "./AddWatcherModal.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function AddWatcherModal({ book, onClose, onSuccess, showToast }) {
  const [form, setForm] = useState({ email: "", targetPrice: "" });
  const [loading, setLoading] = useState(false);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.includes("@"))    return showToast("Enter a valid email.", "error");
    if (parseFloat(form.targetPrice) <= 0) return showToast("Enter a valid target price.", "error");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/books`, {
        url: book.url,
        targetPrice: parseFloat(form.targetPrice),
        email: form.email,
      });
      const msg = data.isNew
        ? `You're now watching "${book.title}"! We'll email you at ${form.email} when the price drops.`
        : `Updated your target for "${book.title}" to ₹${form.targetPrice}.`;
      showToast(msg, "success");
      await onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add watch.", "error");
    }
    setLoading(false);
  };

  const current = book.current_price ? parseFloat(book.current_price) : null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>✕</button>

        <div className={styles.bookPreview}>
          {book.image_url && <img src={book.image_url} alt={book.title} className={styles.thumb} />}
          <div>
            <p className={styles.bookTitle}>{book.title}</p>
            {current && <p className={styles.currentPrice}>Currently ₹{current}</p>}
          </div>
        </div>

        <h2 className={styles.heading}>Set your price alert</h2>
        <p className={styles.sub}>Enter your email and the price you'd like to be notified at. You'll receive one email — no spam.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Your email</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={f("email")} required autoFocus />
          </div>
          <div className={styles.field}>
            <label>Alert me when price drops to (₹)</label>
            <input type="number" placeholder={current ? `e.g. ${Math.round(current * 0.85)}` : "e.g. 299"} min="1" step="1" value={form.targetPrice} onChange={f("targetPrice")} required />
          </div>
          {current && form.targetPrice && (
            <div className={styles.hint}>
              {parseFloat(form.targetPrice) >= current
                ? `⚠ That's ≥ current price (₹${current}). You'll be notified immediately.`
                : `Price needs to drop ${(((current - parseFloat(form.targetPrice)) / current) * 100).toFixed(1)}% from current.`
              }
            </div>
          )}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? "Saving…" : "🔔 Notify me"}
          </button>
        </form>
      </div>
    </div>
  );
}