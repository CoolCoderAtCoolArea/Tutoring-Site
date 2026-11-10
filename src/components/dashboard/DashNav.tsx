"use client";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Dashboard menu. Highlights the current section. */
export function DashNav({ label, items }: { label: string; items: { href: string; label: string; icon: string }[] }) {
  const pathname = usePathname();
  const active = (href: string) =>
    items.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href === href;
  return (
    <nav aria-label={label} className="no-print border-b border-line bg-white">
      <ul className="mx-auto flex max-w-5xl flex-wrap gap-1 px-2 py-2 sm:px-4">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded-lg px-3 font-semibold no-underline",
                active(i.href) ? "bg-brand text-white hover:text-white" : "text-ink hover:bg-sun-soft",
              )}
            >
              <span aria-hidden="true">{i.icon}</span> {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
