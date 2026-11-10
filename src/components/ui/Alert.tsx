import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

// Each tone has an icon AND a word, so meaning never depends on color alone.
const tones: Record<Tone, { box: string; icon: string }> = {
  info: { box: "bg-brand-soft border-brand", icon: "ℹ️" },
  success: { box: "bg-leaf-soft border-leaf", icon: "✅" },
  warning: { box: "bg-sun-soft border-[#b45309]", icon: "⚠️" },
  error: { box: "bg-danger-soft border-danger", icon: "❌" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  live,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Announce to screen readers when it appears (use for form results). */
  live?: boolean;
}) {
  const t = tones[tone];
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn("my-4 flex gap-3 rounded-xl border-l-8 p-4 text-ink", t.box, className)}
    >
      <span aria-hidden="true" className="text-xl leading-6">
        {t.icon}
      </span>
      <div>
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
