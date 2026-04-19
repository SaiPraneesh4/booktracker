import React, { useState } from "react";
import axios from "axios";
import styles from "./BookCard.module.css";
import PriceHistoryModal from "./PriceHistoryModal";
import AddWatcherModal from "./AddWatcherModal";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function BookCard({ book, onRefresh, showToast }) {
  const [showHistory, setShowHistory] = useState(false);
  const [showWatcher, setShowWatcher] = useState(false);
  const [checking,    setChecking]    = useState(false);
  const [imgError,    setImgError]    = useState(false);

  const total     = parseInt(book.total_watchers)  || 0;
  const notified  = parseInt(book.notified_count)  || 0;
  const pending   = parseInt(book.pending_count)   || 0;
  const watchPct  = total > 0 ? Math.round((notified / total) * 100) : 0;

  const lowestTarget  = book.lowest_target  ? parseFloat(book.lowest_target).toFixed(0)  : null;
  const highestTarget = book.highest_target ? parseFloat(book.highest_target).toFixed(0) : null;
  const currentPrice  = book.current_price  ? parseFloat(book.current_price) : null;

  // How far is current price from the lowest target?
  const dropNeeded = lowestTarget && currentPrice
    ? (((currentPrice - parseFloat(lowestTarget)) / currentPrice) * 100).toFixed(1)
    : null;

  const handleCheck = async () => {
    setChecking(true);
    try {
      await axios.post(`${API}/api/books/${book.id}/check`);
      await onRefresh();
      showToast("Price refreshed!", "success");
    } catch { showToast("Check failed.", "error"); }
    setChecking(false);
  };

  return (
    <>
      {showHistory && <PriceHistoryModal book={book} onClose={() => setShowHistory(false)} />}
      {showWatcher && <AddWatcherModal book={book} onClose={() => setShowWatcher(false)} onSuccess={onRefresh} showToast={showToast} />}

      <div className={styles.card}>
        {/* Left: cover */}
        {book.image_url && !imgError
          ? <img
              src={book.image_url}
              alt={book.title}
              className={styles.cover}
              crossOrigin="anonymous"
              onError={() => setImgError(true)}
            />
          : <div className={styles.coverPlaceholder}>📖</div>
        }

        {/* Right: info */}
        <div className={styles.body}>
          {/* Top row */}
          <div className={styles.topRow}>
            <a href={book.url} target="_blank" rel="noopener noreferrer" className={styles.titleLink}>
              {book.title || "Untitled"}
            </a>
            <span className={styles.lastChecked}>checked {timeAgo(book.last_checked)}</span>
          </div>

          {/* Price row */}
          <div className={styles.priceRow}>
            <span className={styles.price}>
              {currentPrice ? `₹${currentPrice}` : "—"}
            </span>
            {lowestTarget && (
              <span className={styles.targetRange}>
                Targets: ₹{lowestTarget}
                {highestTarget !== lowestTarget ? ` – ₹${highestTarget}` : ""}
              </span>
            )}
            {dropNeeded && parseFloat(dropNeeded) > 0 && (
              <span className={styles.dropBadge}>↓ {dropNeeded}% to go</span>
            )}
            {dropNeeded && parseFloat(dropNeeded) <= 0 && (
              <span className={styles.hitBadge}>🎯 Target reached</span>
            )}
          </div>

          {/* Watcher stats */}
          <div className={styles.watcherStats}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{total}</span>
              <span className={styles.statLabel}>watching</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={`${styles.statNum} ${styles.green}`}>{notified}</span>
              <span className={styles.statLabel}>notified</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={`${styles.statNum} ${styles.amber}`}>{pending}</span>
              <span className={styles.statLabel}>waiting</span>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${watchPct}%` }} />
                </div>
                <span className={styles.progressLabel}>{watchPct}% reached target</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={() => setShowWatcher(true)}>
              + Watch this book
            </button>
            <button className={styles.btnGhost} onClick={() => setShowHistory(true)}>
              📈 Price history
            </button>
            <button className={styles.btnGhost} onClick={handleCheck} disabled={checking}>
              {checking ? "…" : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}