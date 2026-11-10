import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ReadableToggle } from "./ReadableToggle";
import { MobileMenu } from "./MobileMenu";

const navItems = [
  { href: "/about", key: "about" },
  { href: "/subjects", key: "subjects" },
  { href: "/availability", key: "availability" },
  { href: "/how-it-works", key: "how" },
  { href: "/resources", key: "resources" },
  { href: "/contact", key: "contact" },
] as const;

export async function Header() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");

  const links = (className: string) =>
    navItems.map((item) => (
      <li key={item.href}>
        <Link href={item.href} className={className}>
          {t(item.key)}
        </Link>
      </li>
    ));

  return (
    <header className="relative border-b border-line bg-white">
      {/* Top utility bar: language + easier reading */}
      <div className="bg-sun-soft text-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 sm:px-6">
          <LanguageSwitcher label={tc("language")} />
          <ReadableToggle on={tc("readableOn")} off={tc("readableOff")} hint={tc("readableHint")} />
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-extrabold text-ink no-underline">
          <Logo />
          <span>{site.name}</span>
        </Link>

        <nav aria-label={t("mainNav")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links("inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-ink no-underline hover:bg-sun-soft")}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="inline-flex min-h-11 items-center px-2 font-semibold">
            {t("login")}
          </Link>
          <ButtonLink href="/book">{tc("bookSession")}</ButtonLink>
        </div>

        <MobileMenu label={tc("menu")} closeLabel={tc("close")}>
          <nav aria-label={t("mainNav")} className="px-4 py-3">
            <ul className="flex flex-col">
              {links("flex min-h-12 items-center border-b border-line px-2 text-lg font-semibold text-ink no-underline")}
              <li>
                <Link href="/login" className="flex min-h-12 items-center px-2 text-lg font-semibold">
                  {t("login")}
                </Link>
              </li>
            </ul>
            <ButtonLink href="/book" size="lg" className="mt-3 w-full">
              {tc("bookSession")}
            </ButtonLink>
          </nav>
        </MobileMenu>
      </div>
    </header>
  );
}

/** Simple logo: a sun rising over a book. Replace with your own SVG if you like. */
export function Logo() {
  return (
    <svg aria-hidden="true" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="15" r="9" fill="#fcd34d" />
      <path d="M4 22c5-3 9-3 14 0 5-3 9-3 14 0v9c-5-3-9-3-14 0-5-3-9-3-14 0z" fill="#1d4ed8" />
      <path d="M18 22v9" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
