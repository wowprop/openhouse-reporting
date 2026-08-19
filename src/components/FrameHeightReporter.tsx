"use client";

import { useEffect } from "react";

/**
 * Reports the page's content height to the parent window so an embedding iframe
 * can size itself, instead of relying on a hardcoded height that leaves either
 * an inner scrollbar or dead whitespace.
 *
 * Both propertygiant.com embeds are covered:
 *   /check-in         -> this app's /check-in
 *   /openhouse-report -> this app's / (and /report, /leads via the internal Nav)
 *
 * The message is posted to each allowed parent origin explicitly rather than to
 * "*", so height data is never delivered to an unexpected embedder. A
 * targetOrigin that doesn't match the real parent is silently dropped.
 */

const PARENT_ORIGINS = [
  "https://www.propertygiant.com",
  "https://propertygiant.com",
];

export default function FrameHeightReporter() {
  useEffect(() => {
    // Not embedded (opened directly on the Railway URL) — nothing to report.
    if (window.parent === window) return;

    // Every page uses `min-h-screen`, which inside an iframe resolves to the
    // iframe's current height. Without this the frame can grow but never
    // shrink — see the `.is-embedded` rule in globals.css.
    document.documentElement.classList.add("is-embedded");

    const send = () => {
      const height = document.documentElement.scrollHeight;
      for (const origin of PARENT_ORIGINS) {
        window.parent.postMessage({ type: "openhouse:height", height }, origin);
      }
    };

    send();

    // Catches form validation messages, the success state, and the /leads table
    // growing as it re-polls every 15s.
    const observer = new ResizeObserver(send);
    observer.observe(document.documentElement);

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("is-embedded");
    };
  }, []);

  return null;
}
