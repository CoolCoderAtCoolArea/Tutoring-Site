/**
 * Date and time helpers. EVERYTHING is shown in Detroit time
 * (America/Detroit), no matter where the visitor's phone thinks it is.
 */
import { localeTags } from "@/i18n/config";

export const TZ = "America/Detroit";

function tag(locale: string) {
  return localeTags[locale] ?? locale;
}

/** "Tuesday, Nov 12" */
export function formatDay(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, weekday: "long", month: "short", day: "numeric" }).format(new Date(date));
}

/** "4:30 PM" */
export function formatTime(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

/** "Tuesday, Nov 12, 4:30 PM" */
export function formatDateTime(date: Date | string, locale: string) {
  return `${formatDay(date, locale)}, ${formatTime(date, locale)}`;
}

/** "Nov 12" */
export function formatShortDate(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(date));
}

/** The calendar date in Detroit as "YYYY-MM-DD" (used to group sessions by day). */
export function detroitDateKey(date: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(date));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Offset in minutes between UTC and Detroit at a given moment (e.g. -300 in winter, -240 in summer). */
function detroitOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Turn a Detroit wall-clock date + time ("2026-11-12", "16:30") into a real
 * moment in time. Handles daylight saving time correctly.
 */
export function detroitToDate(dateKey: string, time: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = detroitOffsetMinutes(guess);
  const result = new Date(guess.getTime() - offset * 60000);
  // Re-check in case the guess crossed a daylight-saving switch.
  const offset2 = detroitOffsetMinutes(result);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** "HH:MM" in Detroit for a date (for <input type="time"> values). */
export function detroitTimeValue(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(date));
}

export function hoursUntil(date: Date | string, now = new Date()) {
  return (new Date(date).getTime() - now.getTime()) / 3_600_000;
}
