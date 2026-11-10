"use client";
import { useEffect, useState } from "react";

/**
 * "Easier reading" switch: bigger text and extra spacing (helps with dyslexia
 * and low vision). The choice is remembered on this device.
 */
export function ReadableToggle({ on, off, hint }: { on: string; off: string; hint: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(document.documentElement.dataset.readable === "true");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    document.documentElement.dataset.readable = String(next);
    try {
      localStorage.setItem("readable", next ? "1" : "0");
    } catch {
      /* private browsing: ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={hint}
      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold underline"
    >
      <span aria-hidden="true">Aa</span> {enabled ? on : off}
    </button>
  );
}

/** Tiny script placed in <head> so the setting applies before the page paints (no flicker). */
export const readableInitScript = `try{if(localStorage.getItem("readable")==="1")document.documentElement.dataset.readable="true"}catch(e){}`;
