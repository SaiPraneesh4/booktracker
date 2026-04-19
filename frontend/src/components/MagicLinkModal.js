import React, { useState } from "react";
import axios from "axios";
import styles from "./MagicLinkModal.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function MagicLinkModal({ onClose, showToast }) {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return showToast("Enter a valid email.", "error");
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/magic`, { email });
      setSent(true);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to send link.";
      showToast(msg, "error");
    }
    setLoading(false);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>✕</button>

        {!sent ? (
          <>
            <div className={styles.icon}>🔗</div>
            <h2>View my tracked books</h2>
            <p>Enter your email and we'll send you a magic link to view your personal tracking list. No password needed.</p>
            <form onSubmit={handleSend}>
              <input
                type="email" value={email} placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)}
                className={styles.input} required autoFocus
              />
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className={styles.icon}>✉️</div>
            <h2>Check your inbox!</h2>
            <p>A magic link has been sent to <strong>{email}</strong>. Click it to view your books. The link expires in 24 hours.</p>
            <button className={styles.btn} onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}