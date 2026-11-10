import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";

export async function Footer() {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const year = new Date().getFullYear();
  const links = [
    ["/how-it-works", "how"],
    ["/help", "help"],
    ["/volunteer", "volunteer"],
    ["/donate", "donate"],
    ["/privacy", "privacy"],
    ["/child-safety", "safety"],
    ["/accessibility", "accessibility"],
    ["/contact", "contact"],
  ] as const;
  return (
    <footer className="on-dark mt-12 bg-brand-dark text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-lg font-bold">{site.name}</p>
        <p className="mt-1">{tf("tagline")}</p>
        <p className="mt-2">
          <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center font-semibold text-white">
            {site.email}
          </a>
        </p>
        <nav aria-label={t("footerNav")} className="mt-4">
          <ul className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            {links.map(([href, key]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center text-white">
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6 text-sm text-blue-100">{tf("draftNote")}</p>
        <p className="mt-2 text-sm text-blue-100">{tf("rights", { year, name: site.name })}</p>
      </div>
    </footer>
  );
}
