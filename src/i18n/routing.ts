import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // English lives at "/", Spanish at "/es", etc.
  localePrefix: "as-needed",
});
