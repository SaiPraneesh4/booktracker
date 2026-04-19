import React from "react";
import styles from "./Toast.module.css";

export default function Toast({ message, type, onClose }) {
  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span>{message}</span>
      <button onClick={onClose}>✕</button>
    </div>
  );
}