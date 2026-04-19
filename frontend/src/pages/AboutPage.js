import React, { useState, useContext } from "react";
import axios from "axios";
import { ToastContext } from "../components/Layout";
import styles from "./AboutPage.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function AboutPage() {
  const showToast = useContext(ToastContext);
  const [form,    setForm]    = useState({ email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.includes("@")) return showToast("Enter a valid email.", "error");
    if (form.message.trim().length < 10) return showToast("Write a bit more — you can do it! 📝", "error");
    setLoading(true);
    try {
      await axios.post(`${API}/api/feedback`, form);
      setSent(true);
      showToast("Message received! You're awesome 🙌", "success");
    } catch { showToast("Failed to send. Try again!", "error"); }
    setLoading(false);
  };

  return (
    <div className={styles.page}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroEmoji}>📚</div>
        <h1 className={styles.heroTitle}>Hi, I love books.<br/>But I hate paying full price for them.</h1>
        <p className={styles.heroQuote}>"So I built a website to watch prices for me while I read."</p>
      </div>

      {/* ── Story ─────────────────────────────────────────────────────────── */}
      <section className={styles.story}>
        <div className={styles.storyBlock}>
          <span className={styles.storyIcon}>😩</span>
          <div>
            <h3>The problem</h3>
            <p>I'd add a book to my BooksWagon cart, tell myself "I'll buy it when it drops to ₹300", and then completely forget about it. Three months later I'd check — it had dropped to ₹280, gone back up to ₹450, and I'd missed the window. Twice.</p>
          </div>
        </div>
        <div className={styles.storyBlock}>
          <span className={styles.storyIcon}>💡</span>
          <div>
            <h3>The idea</h3>
            <p>What if I just... told the internet my target price and had it email me exactly once when the price drops? No app to check, no reminders, no noise. Just one email. Bought. Done. Back to reading.</p>
          </div>
        </div>
        <div className={styles.storyBlock}>
          <span className={styles.storyIcon}>🛠️</span>
          <div>
            <h3>The build</h3>
            <p>This whole thing was built as a learning project — scraping, cron jobs, magic links, multi-user systems without any login. It started as a weekend experiment and kind of took on a life of its own.</p>
          </div>
        </div>
      </section>

      {/* ── Fun facts ─────────────────────────────────────────────────────── */}
      <section className={styles.funFacts}>
        <h2 className={styles.sectionTitle}>A few things about me 👋</h2>
        <div className={styles.factsGrid}>
          {[
            { emoji: "📖", fact: "Currently reading whatever is in my \"to-read\" pile (it's tall)" },
            { emoji: "☕", fact: "No coffee = no code. This entire app was built on filter coffee" },
            { emoji: "🕕", fact: "Checks prices every day at 6 PM — because that's when I usually scroll BooksWagon anyway" },
            { emoji: "💸", fact: "Has definitely used this app to buy books I didn't need but absolutely wanted" },
            { emoji: "🐛", fact: "The scraper has opinions about HTML structure. BooksWagon and I have an understanding now" },
            { emoji: "🔗", fact: "Magic links — because passwords are the worst and everyone forgets them (including me)" },
          ].map((f, i) => (
            <div key={i} className={styles.factCard}>
              <span className={styles.factEmoji}>{f.emoji}</span>
              <p>{f.fact}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech stack ────────────────────────────────────────────────────── */}
      <section className={styles.techSection}>
        <h2 className={styles.sectionTitle}>What's under the hood 🔧</h2>
        <div className={styles.techGrid}>
          {[
            { icon: "⚙️", name: "Backend",  desc: "Node.js + Express" },
            { icon: "⚛️", name: "Frontend", desc: "React + CSS Modules" },
            { icon: "🗄️", name: "Database", desc: "PostgreSQL (Supabase)" },
            { icon: "📧", name: "Email",    desc: "EmailJS REST API" },
            { icon: "🔗", name: "Auth",     desc: "Magic link tokens" },
            { icon: "🕷️", name: "Scraping", desc: "Cheerio + node-cron" },
            { icon: "🚀", name: "Hosting",  desc: "Render + Vercel" },
            { icon: "🆓", name: "Cost",     desc: "Runs entirely free" },
          ].map(t => (
            <div key={t.name} className={styles.techCard}>
              <span className={styles.techIcon}>{t.icon}</span>
              <span className={styles.techName}>{t.name}</span>
              <span className={styles.techDesc}>{t.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>How it works 🤔</h2>
        <div className={styles.steps}>
          {[
            ["📋", "Paste a BooksWagon book URL and tell us your target price + email."],
            ["👥", "Others can watch the same book with their own target price. Everyone gets their own alert."],
            ["🕕", "Every day at 6 PM IST, the scraper checks the current price."],
            ["🎯", "When your target is hit, you get exactly one email. We won't spam you. Ever."],
            ["🔗", "Click \"My Books\" to get a magic link and see everything you're tracking — no password needed."],
          ].map(([icon, text], i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNum}>{icon}</div>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feedback ──────────────────────────────────────────────────────── */}
      <section className={styles.feedbackSection}>
        <div className={styles.feedbackHeader}>
          <h2>Got something to say? 💬</h2>
          <p>Found a bug? Want a feature? Want to tell me what book I should read next? I'm all ears. Drop a message below and it lands straight in my inbox.</p>
        </div>

        {!sent ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label>Your email</label>
              <input type="email" placeholder="so I can write back 🙂" value={form.email} onChange={f("email")} required />
            </div>
            <div className={styles.field}>
              <label>Your message</label>
              <textarea
                placeholder="Bug reports, feature ideas, book recommendations — anything goes..."
                value={form.message} onChange={f("message")}
                rows={5} required
              />
            </div>
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? "Sending... 📨" : "Send it →"}
            </button>
          </form>
        ) : (
          <div className={styles.sentMsg}>
            <div className={styles.sentIcon}>🎉</div>
            <h3>Got it, thanks!</h3>
            <p>Your message landed safely. I'll get back to you soon — probably after finishing this chapter.</p>
            <button className={styles.btnGhost} onClick={() => { setSent(false); setForm({ email: "", message: "" }); }}>
              Send another
            </button>
          </div>
        )}
      </section>

    </div>
  );
}