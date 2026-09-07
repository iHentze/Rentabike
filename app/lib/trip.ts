/**
 * The trip — when, and for how many riders — lives in the URL so every page
 * of the funnel can be reloaded, shared, or reached from a link, and the
 * server always knows the dates it is pricing for.
 *
 *   /bikes?from=2026-06-12&fromTime=09:00&to=2026-06-14&toTime=17:00&riders=2
 */
import { faroeseWallClockToUtc } from "~/lib/tours/departures";
import { faroeParts } from "~/lib/format";
import { billableDays } from "~/lib/pricing/duration";

export interface Trip {
  startAt: Date;
  endAt: Date;
  riders: number;
  /** True when the URL carried dates; false when we fell back to defaults. */
  explicit: boolean;
}

export const OPEN_FROM = "08:00";
export const OPEN_UNTIL = "18:00";
export const MAX_RIDERS = 12;

/** Every half hour the shop is open, for the time selects. */
export const OPENING_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 18; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 18) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Read the trip from search params, filling gaps with sensible defaults:
 * tomorrow 09:00 until the day after at 17:00, one rider. Garbage is ignored
 * rather than thrown — a bad link should still land on a working page.
 */
export function readTrip(params: URLSearchParams, now: Date | number = Date.now()): Trip {
  const today = faroeParts(now).date;
  const from = DATE_RE.test(params.get("from") ?? "") ? params.get("from")! : shiftDate(today, 1);
  const fromTime = TIME_RE.test(params.get("fromTime") ?? "") ? params.get("fromTime")! : "09:00";
  const to = DATE_RE.test(params.get("to") ?? "") ? params.get("to")! : shiftDate(from, 2);
  const toTime = TIME_RE.test(params.get("toTime") ?? "") ? params.get("toTime")! : "17:00";
  const ridersRaw = Number.parseInt(params.get("riders") ?? "", 10);
  const riders = Number.isFinite(ridersRaw) ? Math.min(MAX_RIDERS, Math.max(1, ridersRaw)) : 1;

  let startAt = wallClock(from, fromTime);
  let endAt = wallClock(to, toTime);
  // An end before the start is a typo, not a request: push it to the same day at closing.
  if (endAt.getTime() <= startAt.getTime()) endAt = wallClock(from, OPEN_UNTIL);
  if (endAt.getTime() <= startAt.getTime()) {
    startAt = wallClock(from, "09:00");
    endAt = wallClock(shiftDate(from, 1), "17:00");
  }

  return { startAt, endAt, riders, explicit: params.has("from") };
}

/** The trip back into a query string, to carry it from page to page. */
export function tripParams(trip: Trip, extra: Record<string, string | number | undefined> = {}): URLSearchParams {
  const s = faroeParts(trip.startAt);
  const e = faroeParts(trip.endAt);
  const p = new URLSearchParams({ from: s.date, fromTime: s.time, to: e.date, toTime: e.time, riders: String(trip.riders) });
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") p.set(k, String(v));
  return p;
}

export function tripHref(path: string, trip: Trip, extra?: Record<string, string | number | undefined>): string {
  return `${path}?${tripParams(trip, extra)}`;
}

export function tripDays(trip: Trip): number {
  return billableDays(trip.startAt, trip.endAt);
}

/** "2026-06-12" + "09:00" on the Faroese clock → the UTC instant. */
export function wallClock(date: string, time: string): Date {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return faroeseWallClockToUtc(y, m - 1, d, hh, mm);
}

/** "2026-06-12" + 2 → "2026-06-14". Calendar arithmetic on the date string, no timezone involved. */
export function shiftDate(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + days);
  return new Date(t).toISOString().slice(0, 10);
}
