"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid caching during local dev
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability degrades gracefully — the app still works without it.
    });
  }, []);
  return null;
}
