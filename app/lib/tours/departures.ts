/**
 * Turns a season into departures — rules F1 and F2.
 *
 * `TourDatesManager` in the old app entered one date at a time, so a season
 * meant roughly 130 hand-typed dates. Here a season is one row: a window, a
 * weekday mask, a start time.
 *
 * THE MINIMUM IS SEASONAL, which the first draft of the plan did not
 * anticipate. From the 2026 catalogue, in Faroese:
 *
 *   "Onki min. juni, juli og august. Min. 2 persónar frá september til mai."
 *
 * No minimum in June, July and August; a minimum of two people from September
 * to May. So `minParticipants` is decided per departure date, not per tour.
 *
 * Times are local Faroese time. The Faroes observe DST (UTC+0 in winter,
 * UTC+1 in summer), so 10:15 in June and 10:15 in November are different UTC
 * instants — computed here rather than assumed, because a departure stored an
 * hour out is a customer standing outside a locked shop.
 */

export const MONDAY = 1 << 0;
export const TUESDAY = 1 << 1;
export const WEDNESDAY = 1 << 2;
export const THURSDAY = 1 << 3;
export const FRIDAY = 1 << 4;
export const SATURDAY = 1 << 5;
export const SUNDAY = 1 << 6;

export const WEEKDAY_BITS = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY] as const;

/** Months with no minimum — the high season. 0-indexed: 5,6,7 = June, July, August. */
const NO_MINIMUM_MONTHS = new Set([5, 6, 7]);
export const OFF_SEASON_MINIMUM = 2;

export interface ScheduleSpec {
  id: string;
  tourId: string;
  /** ISO dates, inclusive. */
  seasonStart: string;
  seasonEnd: string;
  weekdayMask: number;
  /** "HH:MM" local Faroese time. */
  startTime: string;
  capacity: number;
  priceMinor: number;
  durationMin: number;
}

export interface PlannedDeparture {
  scheduleId: string;
  tourId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  priceMinor: number;
  minParticipants: number;
}

export class ScheduleError extends Error {}

/**
 * Expand a season into the departures it implies. Pure — no database, so the
 * DST and minimum rules are unit-testable.
 */
export function planDepartures(spec: ScheduleSpec): PlannedDeparture[] {
  const start = parseIsoDate(spec.seasonStart, "seasonStart");
  const end = parseIsoDate(spec.seasonEnd, "seasonEnd");
  if (end < start) throw new ScheduleError("seasonEnd is before seasonStart");
  if (spec.weekdayMask <= 0 || spec.weekdayMask > 0b1111111) {
    throw new ScheduleError(`weekdayMask must select at least one weekday, got ${spec.weekdayMask}`);
  }
  if (!Number.isInteger(spec.capacity) || spec.capacity < 1) throw new ScheduleError("capacity must be >= 1");
  const { hour, minute } = parseTime(spec.startTime);

  const out: PlannedDeparture[] = [];
  // Iterate calendar days in UTC; the wall-clock time is applied per day so a
  // DST change inside the season shifts later departures correctly.
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const isoWeekday = ((d.getUTCDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday
    if ((spec.weekdayMask & WEEKDAY_BITS[isoWeekday]!) === 0) continue;

    const startsAt = faroeseWallClockToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute);
    out.push({
      scheduleId: spec.id,
      tourId: spec.tourId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + spec.durationMin * 60_000),
      capacity: spec.capacity,
      priceMinor: spec.priceMinor,
      minParticipants: minimumFor(startsAt),
    });
  }
  return out;
}

/** Rule F2: no minimum in June–August, two people September–May. */
export function minimumFor(departure: Date): number {
  return NO_MINIMUM_MONTHS.has(departure.getUTCMonth()) ? 0 : OFF_SEASON_MINIMUM;
}

/**
 * Faroese local time → UTC.
 *
 * Atlantic/Faroe is UTC+0 in winter and UTC+1 in summer, changing on the EU
 * schedule: forward on the last Sunday of March at 01:00 UTC, back on the last
 * Sunday of October at 01:00 UTC. Computed rather than table-driven so it keeps
 * working past whatever year this was written in.
 */
export function faroeseWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const asUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
  return new Date(asUtc - (isFaroeseSummerTime(asUtc) ? 3_600_000 : 0));
}

export function isFaroeseSummerTime(utcMs: number): boolean {
  const year = new Date(utcMs).getUTCFullYear();
  const springForward = lastSundayOfMonthUtc(year, 2, 1); // March, 01:00 UTC
  const fallBack = lastSundayOfMonthUtc(year, 9, 1); // October, 01:00 UTC
  return utcMs >= springForward && utcMs < fallBack;
}

function lastSundayOfMonthUtc(year: number, month: number, hourUtc: number): number {
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month + 1, 0));
  last.setUTCDate(last.getUTCDate() - last.getUTCDay());
  return Date.UTC(year, month, last.getUTCDate(), hourUtc);
}

/** Rule F1 — booking closes this many hours before departure. */
export function bookingIsOpen(departure: Date, now: Date | number, cutoffHours: number): boolean {
  const at = now instanceof Date ? now.getTime() : now;
  return departure.getTime() - at >= cutoffHours * 3_600_000;
}

function parseIsoDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ScheduleError(`${field} must be YYYY-MM-DD, got "${value}"`);
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) throw new ScheduleError(`${field} is not a real date: "${value}"`);
  return date;
}

function parseTime(value: string): { hour: number; minute: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new ScheduleError(`startTime must be HH:MM, got "${value}"`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new ScheduleError(`startTime is not a real time: "${value}"`);
  return { hour, minute };
}

/**
 * Write planned departures to D1, skipping any that already exist.
 *
 * The unique index on (schedule_id, starts_at) makes regeneration safe: run it
 * twice and the second run inserts nothing rather than duplicating a season.
 */
export async function generateDepartures(d1: D1Database, planned: readonly PlannedDeparture[]): Promise<number> {
  if (planned.length === 0) return 0;
  const statements = planned.map((p) =>
    d1
      .prepare(
        `INSERT OR IGNORE INTO tour_departures
           (id, tour_id, schedule_id, starts_at, ends_at, capacity, seats_taken,
            price_minor, min_participants, status, is_private, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,0,?7,?8,'open',0,?9)`,
      )
      .bind(
        crypto.randomUUID(),
        p.tourId,
        p.scheduleId,
        p.startsAt.getTime(),
        p.endsAt.getTime(),
        p.capacity,
        p.priceMinor,
        p.minParticipants,
        p.startsAt.getTime(),
      ),
  );
  const results = await d1.batch(statements);
  return results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
}
