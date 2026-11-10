/**
 * BUSINESS DETAILS — edit this file to change the basics shown across the site.
 * Anything marked [PLACEHOLDER] still needs a real value (see README checklist).
 *
 * Words that families read (headlines, FAQ text, etc.) live in /messages/*.json
 * so they can be translated. This file is only for facts that are the same in
 * every language.
 */
export const site = {
  // [PLACEHOLDER] Your business name.
  name: "Detroit Learning Club",
  // [PLACEHOLDER] Shared business email. Never a personal email or phone number.
  email: "hello@example.org",
  city: "Detroit",
  region: "MI",
  country: "US",
  timeZone: "America/Detroit",
  // [PLACEHOLDER] Public meeting place (e.g. a library branch). Never a home address.
  inPersonLocation: "[LOCATION — e.g., a Detroit Public Library branch]",
  // [PLACEHOLDER] Optional Google Maps embed URL for the in-person location.
  // Get it from Google Maps -> Share -> Embed a map -> copy the src="..." value.
  mapEmbedUrl: "",
  // Grades we serve, in order.
  grades: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const,
  // Subject ids. The names shown to families are in messages/*.json under "subjects.names".
  subjects: ["math", "reading", "writing", "science", "homework", "testprep"] as const,
  // Families may cancel or reschedule up to this many hours before a session.
  // (Also stored in the database table site_settings so the database can enforce it.)
  cancelWindowHours: 12,
  // How long one tutoring session lasts (minutes).
  sessionMinutes: 60,
  // Max size of uploaded files (assignment attachments and photos of work).
  maxUploadBytes: 10 * 1024 * 1024,
  allowedUploadTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"],
  social: {} as Record<string, string>,
} as const;

export type Subject = (typeof site.subjects)[number];
export type Grade = (typeof site.grades)[number];

export function siteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
