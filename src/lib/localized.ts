/**
 * Text saved in the database for more than one language is stored like
 *   { "en": "Hello", "es": "Hola" }
 * This picks the right language, falling back to English.
 */
export type LocalizedText = Record<string, string | undefined> | null | undefined;

export function loc(value: LocalizedText, locale: string): string {
  if (!value) return "";
  return value[locale] || value.en || Object.values(value).find(Boolean) || "";
}
