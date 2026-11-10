"use client";
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand underline">
      <span aria-hidden="true">🖨️</span> {label}
    </button>
  );
}
