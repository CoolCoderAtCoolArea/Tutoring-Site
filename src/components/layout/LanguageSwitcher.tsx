"use client";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { locales, localeNames } from "@/i18n/config";

/** Shows every other language as a link to the same page in that language. */
export function LanguageSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      <span aria-hidden="true">🌐</span>
      <ul className="flex flex-wrap items-center gap-1">
        {locales.map((l) => (
          <li key={l}>
            {l === locale ? (
              <span aria-current="true" className="inline-flex min-h-11 items-center px-2 font-bold">
                {localeNames[l]}
              </span>
            ) : (
              <Link
                href={pathname}
                locale={l}
                lang={l}
                hrefLang={l}
                className="inline-flex min-h-11 items-center px-2 font-semibold text-ink underline"
              >
                {localeNames[l]}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
