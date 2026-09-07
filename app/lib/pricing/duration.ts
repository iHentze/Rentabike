/**
 * Rule A1 — the single source of truth for how long a rental is billed.
 *
 * Billable days round UP to the nearest half day, with a minimum of one:
 *
 *     days = max(1, ceil(hours / 12) / 2)
 *
 *   pick up 10:00 Mon, return 14:00 Tue  →  28 h  →  1.5 days
 *   exactly 24 h                          →  1.0 day
 *   25 h                                  →  1.5 days
 *   10 h                                  →  1.0 day  (minimum, not a half)
 *
 * This replaces two functions that disagreed with each other in the old app:
 * the public site rounded to half days while the admin flyout used
 * Math.ceil, so staff and customer quoted different prices for identical
 * dates (defect 7). Both paths now import this one function, and a parity
 * test asserts they return identical line arrays.
 *
 * The window is half-open [startAt, endAt) — rule B3 — so a bike returned at
 * 14:00 is available again at 14:00 exactly.
 */

export const HOURS_PER_HALF_DAY = 12;
export const MIN_BILLABLE_DAYS = 1;

/** Half-day granularity: 1, 1.5, 2, 2.5 … */
export type BillableDays = number;

export function billableDays(startAt: Date | number, endAt: Date | number): BillableDays {
  const start = toMs(startAt);
  const end = toMs(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new RangeError("billableDays: start and end must be valid dates");
  }
  if (end <= start) {
    throw new RangeError("billableDays: end must be after start");
  }
  const hours = (end - start) / 3_600_000;
  const halfDays = Math.ceil(hours / HOURS_PER_HALF_DAY);
  return Math.max(MIN_BILLABLE_DAYS, halfDays / 2);
}

/**
 * Rule A2 — the rate tier is chosen by the whole-day ceiling of the billable
 * duration, so 1.5 days prices at the 2–6 day band. This keeps the curve
 * monotonic: 1 d = 450, 1.5 d = 600, 2 d = 800 on a 450/400 ladder.
 */
export function tierDays(days: BillableDays): number {
  return Math.ceil(days);
}

function toMs(v: Date | number): number {
  return v instanceof Date ? v.getTime() : v;
}
