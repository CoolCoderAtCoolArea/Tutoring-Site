"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/** Menu button for small screens. Closes on Escape and when the page changes. */
export function MobileMenu({ label, closeLabel, children }: { label: string; closeLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border-2 border-ink px-3 font-semibold"
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
        {open ? closeLabel : label}
      </button>
      <div id="mobile-menu" hidden={!open} className="absolute inset-x-0 top-full z-40 border-b-4 border-sun bg-white shadow-lg">
        {children}
      </div>
    </div>
  );
}
