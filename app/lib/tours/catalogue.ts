/**
 * Tours as the customer sees them: the published catalogue, each with its
 * weekly slot and the next departures that still have seats. Seat counts come
 * from tour_departures, which the reservation guard decrements with a
 * conditional UPDATE — so "4 spots left" is the number the booking will get.
 */
import type { TourCategory, TOUR_DIFFICULTIES } from "~/db/schema";

export type TourDifficulty = (typeof TOUR_DIFFICULTIES)[number];
import { WEEKDAY_BITS, bookingIsOpen, minimumFor } from "./departures";

export interface TourSummary {
  id: string;
  slug: string;
  title: string;
  category: TourCategory;
  difficulty: TourDifficulty;
  summary: string;
  durationMin: number;
  distanceKm: number | null;
  ascentM: number | null;
  summitM: number | null;
  requiresBike: boolean;
  image: string | null;
  /** Weekly slot, if the tour has one: "Tuesday", "10:15". */
  weekday: string | null;
  startTime: string | null;
  priceMinor: number;
  privatePriceMinor: number | null;
  /** Seats free on the next open departure, or null when nothing is scheduled. */
  nextSeatsLeft: number | null;
  nextStartsAt: number | null;
  /** Free-text facts for the card: "225 m pass", "Paved throughout". */
  facts: string[];
}

export interface TourDeparture {
  id: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  priceMinor: number;
  minParticipants: number;
  status: string;
  /** False once the 12-hour cutoff has passed or the departure is full. */
  bookable: boolean;
}

export interface TourDetail extends TourSummary {
  body: string;
  meetingPoint: string;
  endPoint: string | null;
  inclusions: Array<{ label: string; included: boolean }>;
  allowedBikeTypeIds: string[];
  departures: TourDeparture[];
  capacity: number | null;
}

export const TOUR_CATEGORY_LABEL: Record<TourCategory, string> = {
  bike: "Biking tours",
  combo: "Hike & bike",
  hike: "Hiking",
  trail_run: "Trail run",
};

export const TOUR_CATEGORY_ORDER: TourCategory[] = ["bike", "combo", "hike", "trail_run"];

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface TourRow {
  id: string;
  slug: string;
  title: string;
  category: TourCategory;
  difficulty: TourDifficulty;
  summary: string;
  body: string;
  duration_min: number;
  distance_km: number | null;
  ascent_m: number | null;
  summit_m: number | null;
  meeting_point: string;
  end_point: string | null;
  requires_bike: number;
  image: string | null;
  facts: string | null;
  weekday_mask: number | null;
  start_time: string | null;
  price_minor: number | null;
  private_price_minor: number | null;
  capacity: number | null;
}

interface DepartureRow {
  id: string;
  tour_id: string;
  starts_at: number;
  ends_at: number;
  capacity: number;
  seats_taken: number;
  price_minor: number;
  min_participants: number;
  status: string;
}

const TOUR_SELECT = `
  SELECT t.id, t.slug, t.title, t.category, t.difficulty, t.summary, t.body, t.duration_min, t.distance_km,
         t.ascent_m, t.summit_m, t.meeting_point, t.end_point, t.requires_bike, t.image, t.facts,
         s.weekday_mask, s.start_time, s.price_minor, s.private_price_minor, s.capacity
    FROM tours t
    LEFT JOIN tour_schedules s ON s.tour_id = t.id AND s.active = 1`;

/** The published catalogue, with the next open departure of each tour. */
export async function listTours(d1: D1Database, now: number = Date.now()): Promise<TourSummary[]> {
  const [tours, next] = await Promise.all([
    d1.prepare(`${TOUR_SELECT} WHERE t.published = 1 ORDER BY t.category, s.weekday_mask, t.title`).all<TourRow>(),
    d1
      .prepare(
        `SELECT d.id, d.tour_id, d.starts_at, d.ends_at, d.capacity, d.seats_taken, d.price_minor, d.min_participants, d.status
           FROM tour_departures d
          WHERE d.status = 'open' AND d.is_private = 0 AND d.starts_at > ?1 AND d.seats_taken < d.capacity
          ORDER BY d.starts_at`,
      )
      .bind(now)
      .all<DepartureRow>(),
  ]);
  const firstOpen = new Map<string, DepartureRow>();
  for (const d of next.results ?? []) {
    if (!firstOpen.has(d.tour_id) && bookingIsOpen(new Date(d.starts_at), now, 12)) firstOpen.set(d.tour_id, d);
  }
  return (tours.results ?? []).map((r) => summarise(r, firstOpen.get(r.id)));
}

/** One tour with its next departures (open or not — sold-out ones stay visible, struck through). */
export async function getTour(
  d1: D1Database,
  slug: string,
  now: number = Date.now(),
  limit = 6,
  /** Restrict the departures to [from, to) — a calendar month, usually. */
  window?: { from: number; to: number },
): Promise<TourDetail | null> {
  const row = await d1.prepare(`${TOUR_SELECT} WHERE t.slug = ?1`).bind(slug).first<TourRow>();
  if (!row) return null;
  const from = Math.max(now, window?.from ?? now);
  const to = window?.to ?? Number.MAX_SAFE_INTEGER;
  const [deps, incl, bikes] = await Promise.all([
    d1
      .prepare(
        `SELECT id, tour_id, starts_at, ends_at, capacity, seats_taken, price_minor, min_participants, status
           FROM tour_departures WHERE tour_id = ?1 AND is_private = 0 AND starts_at > ?2 AND starts_at < ?4 AND status IN ('open','closed')
          ORDER BY starts_at LIMIT ?3`,
      )
      .bind(row.id, from, window ? 40 : limit, to)
      .all<DepartureRow>(),
    d1.prepare(`SELECT label, included FROM tour_inclusions WHERE tour_id = ?1 ORDER BY seq`).bind(row.id).all<{ label: string; included: number }>(),
    d1.prepare(`SELECT bike_type_id FROM tour_bike_types WHERE tour_id = ?1`).bind(row.id).all<{ bike_type_id: string }>(),
  ]);
  const departures = (deps.results ?? []).map((d) => toDeparture(d, now));
  const firstOpen = (deps.results ?? []).find((d) => toDeparture(d, now).bookable);
  return {
    ...summarise(row, firstOpen),
    body: row.body,
    meetingPoint: row.meeting_point,
    endPoint: row.end_point,
    inclusions: (incl.results ?? []).map((i) => ({ label: i.label, included: Boolean(i.included) })),
    allowedBikeTypeIds: (bikes.results ?? []).map((b) => b.bike_type_id),
    departures,
    capacity: row.capacity,
  };
}

export async function getDeparture(d1: D1Database, id: string, now: number = Date.now()): Promise<(TourDeparture & { tourId: string }) | null> {
  const d = await d1
    .prepare(`SELECT id, tour_id, starts_at, ends_at, capacity, seats_taken, price_minor, min_participants, status FROM tour_departures WHERE id = ?1`)
    .bind(id)
    .first<DepartureRow>();
  return d ? { ...toDeparture(d, now), tourId: d.tour_id } : null;
}

function toDeparture(d: DepartureRow, now: number): TourDeparture {
  const seatsLeft = Math.max(0, d.capacity - d.seats_taken);
  return {
    id: d.id,
    startsAt: d.starts_at,
    endsAt: d.ends_at,
    capacity: d.capacity,
    seatsTaken: d.seats_taken,
    seatsLeft,
    priceMinor: d.price_minor,
    minParticipants: d.min_participants || minimumFor(new Date(d.starts_at)),
    status: d.status,
    bookable: d.status === "open" && seatsLeft > 0 && bookingIsOpen(new Date(d.starts_at), now, 12),
  };
}

function summarise(r: TourRow, next: DepartureRow | undefined): TourSummary {
  let weekday: string | null = null;
  if (r.weekday_mask != null) {
    const i = WEEKDAY_BITS.findIndex((bit) => (r.weekday_mask! & bit) !== 0);
    weekday = i >= 0 ? (WEEKDAY_NAMES[i] ?? null) : null;
  }
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    difficulty: r.difficulty,
    summary: r.summary,
    durationMin: r.duration_min,
    distanceKm: r.distance_km,
    ascentM: r.ascent_m,
    summitM: r.summit_m,
    requiresBike: Boolean(r.requires_bike),
    image: r.image,
    weekday,
    startTime: r.start_time,
    priceMinor: r.price_minor ?? 0,
    privatePriceMinor: r.private_price_minor,
    nextSeatsLeft: next ? Math.max(0, next.capacity - next.seats_taken) : null,
    nextStartsAt: next ? next.starts_at : null,
    facts: r.facts ? r.facts.split("|").map((f) => f.trim()).filter(Boolean) : [],
  };
}
