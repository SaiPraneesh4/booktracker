import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";
import styles from "./PriceHistoryModal.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{label}</div>
      <div className={styles.tooltipPrice}>₹{payload[0].value}</div>
    </div>
  );
}

export default function PriceHistoryModal({ book, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/books/${book.id}/history`).then(r => {
      const data = r.data.history.map(h => ({
        date:  new Date(h.checked_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        price: parseFloat(h.price),
        full:  new Date(h.checked_at).toLocaleString("en-IN"),
      }));
      setHistory(data);
    }).finally(() => setLoading(false));
  }, [book.id]);

  const prices     = history.map(h => h.price);
  const minPrice   = prices.length ? Math.min(...prices) : 0;
  const maxPrice   = prices.length ? Math.max(...prices) : 0;
  const latestPrice= prices.length ? prices[prices.length - 1] : null;
  const lowestTarget = book.lowest_target ? parseFloat(book.lowest_target) : null;

  // Y-axis domain with padding
  const yMin = Math.max(0, Math.floor((Math.min(minPrice, lowestTarget || minPrice) - 50) / 50) * 50);
  const yMax = Math.ceil((maxPrice + 50) / 50) * 50;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{book.title}</h3>
            <p className={styles.sub}>
              {history.length} data point{history.length !== 1 ? "s" : ""}
              {lowestTarget && ` · Lowest target: ₹${lowestTarget}`}
            </p>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {/* Price summary cards */}
        <div className={styles.summaryRow}>
          {[
            { label: "Current",  val: latestPrice ? `₹${latestPrice}` : "—",  color: "" },
            { label: "Lowest",   val: prices.length ? `₹${minPrice}` : "—",   color: styles.green },
            { label: "Highest",  val: prices.length ? `₹${maxPrice}` : "—",   color: styles.red },
          ].map(s => (
            <div key={s.label} className={styles.summaryCard}>
              <span className={`${styles.summaryVal} ${s.color}`}>{s.val}</span>
              <span className={styles.summaryLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        {loading ? (
          <div className={styles.loading}>Loading history…</div>
        ) : history.length < 2 ? (
          <div className={styles.empty}>
            Not enough data yet for a chart. Prices are checked daily at 6 PM.
          </div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(26,26,24,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9A9890" }} tickLine={false} axisLine={false} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: "#9A9890" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip content={<CustomTooltip />} />
                {lowestTarget && (
                  <ReferenceLine
                    y={lowestTarget} stroke="#E24B4A" strokeDasharray="5 3"
                    label={{ value: `Target ₹${lowestTarget}`, fill: "#E24B4A", fontSize: 11, position: "insideTopRight" }}
                  />
                )}
                <Area type="monotone" dataKey="price" stroke="#1D9E75" strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 3, fill: "#1D9E75", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History table */}
        {history.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Date & Time</th><th>Price</th><th>vs. Target</th></tr></thead>
              <tbody>
                {[...history].reverse().map((h, i) => {
                  const diff = lowestTarget ? ((h.price - lowestTarget) / lowestTarget * 100).toFixed(1) : null;
                  return (
                    <tr key={i}>
                      <td>{h.full}</td>
                      <td><strong>₹{h.price}</strong></td>
                      <td>
                        {diff !== null && (
                          <span className={parseFloat(diff) <= 2 ? styles.green : styles.muted}>
                            {parseFloat(diff) <= 0 ? "✓ Hit" : `+${diff}%`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}