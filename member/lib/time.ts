import { TZDate } from "@date-fns/tz";

/**
 * Time helpers. Event programme times are stored as local wall-clock values
 * ("YYYY-MM-DD" + "HH:mm") in the event's IANA timezone, so an admin edits exactly
 * what members see on site. Conversions to instants happen only here.
 */

/** A Prisma @db.Date value (UTC midnight) → "YYYY-MM-DD". */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export function parseDateOnly(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid date: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

/** The calendar date at `instant` in `timeZone`, as "YYYY-MM-DD". */
export function localDateString(instant: Date, timeZone: string): string {
  const z = new TZDate(instant.getTime(), timeZone);
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${z.getFullYear()}-${mm}-${dd}`;
}

/** Local wall-clock time in `timeZone` → UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mi] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mi, 0, timeZone).getTime());
}

export function formatInZone(
  instant: Date,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions,
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(instant);
}

/** "2026-12-04" → "Friday" / "Fri 4 Dec" (date-only values are zone-independent). */
export function weekdayName(date: string, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: style, timeZone: "UTC" }).format(parseDateOnly(date));
}

export function formatDateOnly(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(parseDateOnly(date));
}

/** Inclusive list of "YYYY-MM-DD" days between two date-only values. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parseDateOnly(start); dateOnly(d) <= end; d = new Date(d.getTime() + 86_400_000)) {
    out.push(dateOnly(d));
  }
  return out;
}

export type DayPart = "morning" | "afternoon" | "evening";

export function dayPart(instant: Date, timeZone: string): DayPart {
  const hour = Number(formatInZone(instant, timeZone, { hour: "2-digit", hourCycle: "h23" }));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
