"use client";
import { useState } from "react";
import { TextField } from "@/components/ui/Field";

/** Password box with a "Show password" checkbox (easier on phones). */
export function PasswordField({ label, name = "password", hint, showLabel, autoComplete, inputMode, minLength }: {
  label: string; name?: string; hint?: string; showLabel: string; autoComplete: string; inputMode?: "numeric"; minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <TextField label={label} name={name} type={show ? "text" : "password"} required hint={hint} autoComplete={autoComplete} inputMode={inputMode} minLength={minLength} className="mb-1" />
      <label className="mb-4 inline-flex min-h-11 cursor-pointer items-center gap-2">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-5" />
        {showLabel}
      </label>
    </div>
  );
}
