/**
 * Keep departures rolling forward. Runs from the cron alongside the hold
 * sweeper: every active schedule is expanded for the next `horizonDays` and
 * inserted with INSERT OR IGNORE, so this is safe to run every five minutes
 * and the customer always sees the next few weeks on a tour page.
 */
import { generateDepartures, planDepartures, type PlannedDeparture, type ScheduleSpec } from "./departures";
import { faroeParts } from "~/lib/format";
import { shiftDate } from "~/lib/trip";

interface ScheduleRow {
  id: string;
  tour_id: string;
  season_start: string;
  season_end: string;
  weekday_mask: number;
  start_time: string;
  capacity: number;
  price_minor: number;
  duration_min: number;
}

export async function ensureDepartures(d1: D1Database, now: number = Date.now(), horizonDays = 90): Promise<number> {
  const rows = await d1
    .prepare(
      `SELECT s.id, s.tour_id, s.season_start, s.season_end, s.weekday_mask, s.start_time, s.capacity, s.price_minor, t.duration_min
         FROM tour_schedules s JOIN tours t ON t.id = s.tour_id
        WHERE s.active = 1 AND t.published = 1`,
    )
    .all<ScheduleRow>();
  const today = faroeParts(now).date;
  const horizon = shiftDate(today, horizonDays);
  const planned: PlannedDeparture[] = [];
  for (const s of rows.results ?? []) {
    const spec: ScheduleSpec = {
      id: s.id,
      tourId: s.tour_id,
      // Clip the season to the window we maintain; the unique slot index dedupes the rest.
      seasonStart: s.season_start > today ? s.season_start : today,
      seasonEnd: s.season_end < horizon ? s.season_end : horizon,
      weekdayMask: s.weekday_mask,
      startTime: s.start_time,
      capacity: s.capacity,
      priceMinor: s.price_minor,
      durationMin: s.duration_min,
    };
    if (spec.seasonStart > spec.seasonEnd) continue;
    planned.push(...planDepartures(spec).filter((p) => p.startsAt.getTime() > now));
  }
  return generateDepartures(d1, planned);
}
