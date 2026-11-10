/**
 * LANGUAGES
 * To add a language (for example Arabic):
 *   1. Copy messages/en.json to messages/ar.json and translate the values (not the keys).
 *   2. Add "ar" to `locales` below and its name to `localeNames`.
 * Right-to-left layout is turned on automatically for languages in `rtlLocales`.
 */
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// Each language's name written in that language (shown in the language switcher).
export const localeNames: Record<string, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
  bn: "বাংলা",
};

export const rtlLocales = ["ar", "he", "fa", "ur"];

export function dirFor(locale: string): "rtl" | "ltr" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

/** Map a locale to the BCP-47 tag used for dates and text-to-speech. */
export const localeTags: Record<string, string> = {
  en: "en-US",
  es: "es-US",
  ar: "ar",
  bn: "bn-BD",
};
