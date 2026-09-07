/**
 * Dates and times as the shop reads them — Faroese wall clock, English text.
 * Every instant in the database is UTC milliseconds; this is the only place
 * they turn into words. workerd ships full ICU, so Intl does the timezone.
 */

export const FAROE_TZ = "Atlantic/Faroe";

const parts = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: FAROE_TZ, ...opts });
const dayFmt = parts({ weekday: "short", day: "numeric", month: "short" });
const longDayFmt = parts({ weekday: "long", day: "numeric", month: "long" });
const timeFmt = parts({ hour: "2-digit", minute: "2-digit", hour12: false });
const isoParts = new Intl.DateTimeFormat("en-CA", { timeZone: FAROE_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayFmt = parts({ weekday: "long" });

/**
 * Assemble "Fri 12 Jun" from the parts ourselves: ICU versions differ on the
 * comma after the weekday, and the server and the browser must agree to the
 * byte or React refuses to hydrate.
 */
function dayString(fmt: Intl.DateTimeFormat, at: Date | number): string {
  const p = fmt.formatToParts(at);
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/** "Fri 12 Jun" */
export function fmtDay(at: Date | number): string {
  return dayString(dayFmt, at);
}

/** "Friday 12 June" */
export function fmtLongDay(at: Date | number): string {
  return dayString(longDayFmt, at);
}

/** "09:00" */
export function fmtTime(at: Date | number): string {
  const p = timeFmt.formatToParts(at);
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "00";
  const h = get("hour") === "24" ? "00" : get("hour");
  return `${h}:${get("minute")}`;
}

/** "Fri 12 Jun · 09:00" */
export function fmtDayTime(at: Date | number): string {
  return `${fmtDay(at)} · ${fmtTime(at)}`;
}

/** "Fri 12 Jun 09:00 → Sun 14 Jun 17:00" */
export function fmtRange(start: Date | number, end: Date | number): string {
  return `${fmtDay(start)} ${fmtTime(start)} → ${fmtDay(end)} ${fmtTime(end)}`;
}

/** "Tuesday" */
export function fmtWeekday(at: Date | number): string {
  return weekdayFmt.formatToParts(at).find((x) => x.type === "weekday")?.value ?? "";
}

/** Faroese wall-clock parts of an instant: { date: "2026-06-12", time: "09:00" }. */
export function faroeParts(at: Date | number): { date: string; time: string } {
  // en-CA gives ISO-ordered parts: "2026-06-12, 09:00"
  const [date = "", time = "00:00"] = isoParts.format(at).split(", ");
  return { date, time: time === "24:00" ? "00:00" : time };
}

/** "3 days", "1.5 days", "1 day" */
export function fmtDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "2 riders" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "4 hrs", "2.5 hrs", "45 min" */
export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hrs`;
}
