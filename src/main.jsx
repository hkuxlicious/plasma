import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function dismissBootLoader() {
  const loader = document.getElementById("plasma-boot-loader");
  if (!loader) return;

  let hasSeenBootLoader = false;
  try {
    hasSeenBootLoader = window.localStorage.getItem("plasma:boot-loader-seen") === "1";
    window.localStorage.setItem("plasma:boot-loader-seen", "1");
  } catch {
    hasSeenBootLoader = false;
  }

  const startedAt = Number(window.__PLASMA_BOOT_STARTED_AT__) || Date.now();
  const minimumVisibleMs = hasSeenBootLoader ? 160 : 950;
  const remainingMs = Math.max(0, minimumVisibleMs - (Date.now() - startedAt));

  window.setTimeout(() => {
    loader.classList.add("is-hiding");
    window.setTimeout(() => loader.remove(), 260);
  }, remainingMs);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

requestAnimationFrame(dismissBootLoader);
