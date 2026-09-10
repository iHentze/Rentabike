/**
 * The tours desk: the departures ahead, who is on them, who guides them, and
 * the two things the weather makes staff do — close a departure to new
 * bookings, or cancel it and give everyone their money back (rule F3, which
 * is rule D2 applied to a whole departure). Every write is a conditional
 * UPDATE plus an audit row; cancellations go booking by booking through the
 * same staff action the booking page uses, so refunds and emails match.
 */
import type { TourCategory } from "~/db/schema";
import { getBookingById } from "~/lib/booking/lookup";
import { findGuideConflicts, type GuideConflict } from "~/lib/tours/validate";
import { WEEKDAY_BITS } from "~/lib/tours/departures";
import { staffAction, type StaffActionEnv } from "./actions";

export interface DepartureRow {
  id: string;
  tourId: string;
  tourTitle: string;
  tourSlug: string;
  category: TourCategory;
  difficulty: string;
  requiresBike: boolean;
  startsAt: number;
  endsAt: number;
  capacity: number;
  seatsTaken: number;
  minParticipants: number;
  priceMinor: number;
  status: string;
  isPrivate: boolean;
  guideId: string | null;
  guideName: string | null;
  /** Live bookings (held, confirmed, picked up) on this departure. */
  bookings: number;
  /** Bikes those bookings take out of the fleet. */
  bikes: number;
}

export async function listDepartures(d1: D1Database, fromMs: number, toMs: number): Promise<DepartureRow[]> {
  const rows = await d1
    .prepare(
      `SELECT d.id, d.tour_id, t.title, t.slug, t.category, t.difficulty, t.requires_bike,
              d.starts_at, d.ends_at, d.capacity, d.seats_taken, d.min_participants, d.price_minor, d.status, d.is_private,
              d.guide_id, g.name AS guide_name,
              (SELECT COUNT(DISTINCT bl.booking_id) FROM booking_lines bl JOIN bookings b ON b.id = bl.booking_id
                WHERE bl.kind = 'tour_seat' AND bl.tour_departure_id = d.id AND b.status IN ('held','confirmed','picked_up')) AS bookings,
              (SELECT COALESCE(SUM(bl2.qty), 0) FROM booking_lines bl2 JOIN bookings b2 ON b2.id = bl2.booking_id
                WHERE bl2.kind = 'bike' AND b2.status IN ('held','confirmed','picked_up')
                  AND b2.id IN (SELECT bl3.booking_id FROM booking_lines bl3 WHERE bl3.kind = 'tour_seat' AND bl3.tour_departure_id = d.id)) AS bikes
         FROM tour_departures d
         JOIN tours t ON t.id = d.tour_id
    LEFT JOIN guides g ON g.id = d.guide_id
        WHERE d.starts_at >= ?1 AND d.starts_at < ?2
     ORDER BY d.starts_at, t.title`,
    )
    .bind(fromMs, toMs)
    .all<Record<string, unknown>>();
  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    tourId: r.tour_id as string,
    tourTitle: r.title as string,
    tourSlug: r.slug as string,
    category: r.category as TourCategory,
    difficulty: r.difficulty as string,
    requiresBike: Boolean(r.requires_bike),
    startsAt: r.starts_at as number,
    endsAt: r.ends_at as number,
    capacity: r.capacity as number,
    seatsTaken: r.seats_taken as number,
    minParticipants: r.min_participants as number,
    priceMinor: r.price_minor as number,
    status: r.status as string,
    isPrivate: Boolean(r.is_private),
    guideId: (r.guide_id as string | null) ?? null,
    guideName: (r.guide_name as string | null) ?? null,
    bookings: (r.bookings as number) ?? 0,
    bikes: (r.bikes as number) ?? 0,
  }));
}

export interface GuideRow {
  id: string;
  name: string;
  mtbCertified: boolean;
  active: boolean;
}

export async function listGuides(d1: D1Database): Promise<GuideRow[]> {
  const rows = await d1.prepare(`SELECT id, name, mtb_certified, active FROM guides ORDER BY active DESC, name`).all<{ id: string; name: string; mtb_certified: number; active: number }>();
  return (rows.results ?? []).map((g) => ({ id: g.id, name: g.name, mtbCertified: Boolean(g.mtb_certified), active: Boolean(g.active) }));
}

/** Conflicts keyed by departure id, for the row that has one. */
export async function conflictsByDeparture(d1: D1Database, fromMs: number, toMs: number): Promise<Record<string, GuideConflict[]>> {
  const out: Record<string, GuideConflict[]> = {};
  for (const c of await findGuideConflicts(d1, fromMs, toMs)) for (const id of c.departureIds) (out[id] ??= []).push(c);
  return out;
}

export interface TourScheduleRow {
  tourId: string;
  title: string;
  category: TourCategory;
  published: boolean;
  requiresBike: boolean;
  /** "Tuesday", "Saturday & Sunday" — from the active schedule's weekday mask. */
  weekdays: string;
  startTime: string | null;
  capacity: number | null;
  priceMinor: number | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  /** Departures still ahead. */
  ahead: number;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdaysOf(mask: number): string {
  return WEEKDAY_BITS.map((bit, i) => ((mask & bit) !== 0 ? WEEKDAY_NAMES[i] : null))
    .filter((x): x is string => x !== null)
    .join(", ");
}

/** Every tour with its weekly slot: what the season looks like on paper. */
export async function listTourSchedules(d1: D1Database, now: number): Promise<TourScheduleRow[]> {
  const rows = await d1
    .prepare(
      `SELECT t.id, t.title, t.category, t.published, t.requires_bike,
              s.weekday_mask, s.start_time, s.capacity, s.price_minor, s.season_start, s.season_end,
              (SELECT COUNT(*) FROM tour_departures d WHERE d.tour_id = t.id AND d.starts_at >= ?1 AND d.status <> 'cancelled') AS ahead
         FROM tours t
    LEFT JOIN tour_schedules s ON s.tour_id = t.id AND s.active = 1
     ORDER BY t.published DESC, t.category, t.title`,
    )
    .bind(now)
    .all<Record<string, unknown>>();
  return (rows.results ?? []).map((r) => ({
    tourId: r.id as string,
    title: r.title as string,
    category: r.category as TourCategory,
    published: Boolean(r.published),
    requiresBike: Boolean(r.requires_bike),
    weekdays: typeof r.weekday_mask === "number" ? weekdaysOf(r.weekday_mask) : "—",
    startTime: (r.start_time as string | null) ?? null,
    capacity: (r.capacity as number | null) ?? null,
    priceMinor: (r.price_minor as number | null) ?? null,
    seasonStart: (r.season_start as string | null) ?? null,
    seasonEnd: (r.season_end as string | null) ?? null,
    ahead: (r.ahead as number) ?? 0,
  }));
}

function audit(d1: D1Database, entityId: string, from: string | null, to: string | null, staff: string, note: string, now: number) {
  return d1
    .prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'tour_departure',?2,?3,?4,?5,?6,?7)`)
    .bind(crypto.randomUUID(), entityId, from, to, staff, note, now);
}

export async function setDepartureGuide(d1: D1Database, departureId: string, guideId: string | null, staff: string, now = Date.now()): Promise<boolean> {
  const before = await d1.prepare(`SELECT guide_id FROM tour_departures WHERE id = ?1`).bind(departureId).first<{ guide_id: string | null }>();
  if (!before) return false;
  if ((before.guide_id ?? null) === guideId) return true;
  await d1.batch([
    d1.prepare(`UPDATE tour_departures SET guide_id = ?2 WHERE id = ?1`).bind(departureId, guideId),
    audit(d1, departureId, before.guide_id, guideId, staff, guideId ? "guide assigned" : "guide removed", now),
  ]);
  return true;
}

/** Stop selling seats, or start again. Cancelled departures never reopen — that is a new departure. */
export async function setDepartureOpen(d1: D1Database, departureId: string, open: boolean, staff: string, now = Date.now()): Promise<boolean> {
  const from = open ? "closed" : "open";
  const to = open ? "open" : "closed";
  const res = await d1.batch([
    d1.prepare(`UPDATE tour_departures SET status = ?3 WHERE id = ?1 AND status = ?2`).bind(departureId, from, to),
    audit(d1, departureId, from, to, staff, open ? "reopened for booking" : "closed to new bookings", now),
  ]);
  return (res[0]?.meta.changes ?? 0) === 1;
}

export async function setDepartureCapacity(d1: D1Database, departureId: string, capacity: number, staff: string, now = Date.now()): Promise<boolean> {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 99) return false;
  const before = await d1.prepare(`SELECT capacity, seats_taken FROM tour_departures WHERE id = ?1`).bind(departureId).first<{ capacity: number; seats_taken: number }>();
  if (!before || capacity < before.seats_taken) return false;
  if (before.capacity === capacity) return true;
  await d1.batch([
    d1.prepare(`UPDATE tour_departures SET capacity = ?2 WHERE id = ?1`).bind(departureId, capacity),
    audit(d1, departureId, String(before.capacity), String(capacity), staff, "capacity changed", now),
  ]);
  return true;
}

export interface CancelDepartureResult {
  cancelled: number;
  failed: string[];
}

/**
 * Weather, a guide off sick, too few people: the departure is cancelled and
 * every live booking on it goes through the shop-cancellation path — full
 * refund whatever the timing, seats handed back, an email with the reason.
 */
export async function cancelDeparture(env: StaffActionEnv, ctx: ExecutionContext, departureId: string, staff: string, reason: string, origin: string, now = Date.now()): Promise<CancelDepartureResult | null> {
  const dep = await env.DB.prepare(`SELECT status FROM tour_departures WHERE id = ?1`).bind(departureId).first<{ status: string }>();
  if (!dep || dep.status === "cancelled") return null;
  const live = await env.DB
    .prepare(
      `SELECT DISTINCT b.id FROM bookings b JOIN booking_lines bl ON bl.booking_id = b.id
        WHERE bl.kind = 'tour_seat' AND bl.tour_departure_id = ?1 AND b.status IN ('held','confirmed','picked_up')`,
    )
    .bind(departureId)
    .all<{ id: string }>();
  const out: CancelDepartureResult = { cancelled: 0, failed: [] };
  for (const { id } of live.results ?? []) {
    const booking = await getBookingById(env.DB, id);
    if (!booking) continue;
    const r = await staffAction(env, ctx, booking, "cancel", staff, { reason, origin }, now);
    if (r.ok) out.cancelled += 1;
    else out.failed.push(booking.code);
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE tour_departures SET status = 'cancelled' WHERE id = ?1`).bind(departureId),
    audit(env.DB, departureId, dep.status, "cancelled", staff, `cancelled by the shop: ${reason}`, now),
  ]);
  return out;
}
