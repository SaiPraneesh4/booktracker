import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Layout.module.css";
import MagicLinkModal from "./MagicLinkModal";
import Toast from "./Toast";

export const ToastContext = React.createContext(null);

export default function Layout({ children }) {
  const [toast,      setToast]      = useState(null);
  const [magicOpen,  setMagicOpen]  = useState(false);
  const loc = useLocation();

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {magicOpen && <MagicLinkModal onClose={() => setMagicOpen(false)} showToast={showToast} />}

      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo}>
            <span>📚</span>
            <div>
              <div className={styles.logoTitle}>BookTracker</div>
              <div className={styles.logoSub}>BooksWagon price alerts</div>
            </div>
          </Link>
          <nav className={styles.nav}>
            <Link to="/"       className={`${styles.navLink} ${loc.pathname==="/"       ? styles.active : ""}`}>Explore</Link>
            <Link to="/about"  className={`${styles.navLink} ${loc.pathname==="/about"  ? styles.active : ""}`}>About</Link>
            <button className={styles.myBooksBtn} onClick={() => setMagicOpen(true)}>
              My Books
            </button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <p>Built for learning · Open to suggestions · <Link to="/about">About</Link></p>
      </footer>
    </ToastContext.Provider>
  );
}