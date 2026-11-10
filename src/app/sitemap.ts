import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { siteUrl } from "@/config/site";

const pages = ["", "/about", "/subjects", "/availability", "/how-it-works", "/resources", "/volunteer", "/contact", "/help", "/donate", "/privacy", "/child-safety", "/accessibility"];

/** sitemap.xml — every public page in every language. */
export default function sitemap(): MetadataRoute.Sitemap {
  const href = (l: string, p: string) => siteUrl(l === "en" ? p || "/" : `/${l}${p}`);
  return pages.map((p) => ({
    url: href("en", p),
    changeFrequency: p === "/availability" ? "daily" : "monthly",
    priority: p === "" ? 1 : 0.7,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, href(l, p)])) },
  }));
}
