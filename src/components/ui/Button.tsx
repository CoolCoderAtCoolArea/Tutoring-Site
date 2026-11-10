import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "danger" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold no-underline " +
  "min-h-11 min-w-11 px-5 py-2.5 text-center transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark hover:text-white",
  secondary: "bg-white text-brand border-2 border-brand hover:bg-brand-soft",
  accent: "bg-coral text-white hover:bg-[#9a3412] hover:text-white",
  danger: "bg-danger text-white hover:bg-[#991b1b] hover:text-white",
  ghost: "bg-transparent text-ink underline hover:bg-black/5",
};

const sizes: Record<Size, string> = {
  md: "text-base",
  lg: "text-lg px-7 py-3.5 min-h-14",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

/** A link that looks like a button (keeps the current language). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
