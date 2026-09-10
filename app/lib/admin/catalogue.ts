/**
 * What staff may change about the catalogue without a developer: a bike
 * type's facts and its rate tiers, the add-on prices, the pickup points and
 * their fees, and a tour's weekly slot. Every write is an UPDATE plus an
 * audit row saying who, what, from and to. Nothing here touches a booking.
 */
import type { AddonUnit, BikeCategory } from "~/db/schema";
import { ensureDepartures } from "~/lib/tours/ensure";
import { validateTourForPublish, type Problem } from "~/lib/tours/validate";

function audit(d1: D1Database, entity: string, entityId: string, from: string | null, to: string | null, staff: string, note: string, now: number) {
  return d1
    .prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`)
    .bind(crypto.randomUUID(), entity, entityId, from, to, staff, note, now);
}

/** Field-by-field diff to an audit row, so the log reads "stock 3 → 4, listed yes → no". */
function changes(before: object, after: object): string[] {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return Object.keys(a)
    .filter((k) => String(b[k] ?? "") !== String(a[k] ?? ""))
    .map((k) => `${k} ${b[k] ?? "—"} → ${a[k] ?? "—"}`);
}

// ---------------------------------------------------------------------------
// Bike types and their tiers
// ---------------------------------------------------------------------------

export interface BikeTypeAdmin {
  id: string;
  slug: string;
  name: string;
  category: BikeCategory;
  model: string | null;
  sizeLabel: string | null;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  stock: number;
  listed: boolean;
  description: string | null;
  image: string | null;
  tiers: TierRow[];
  /** Which tours allow this bike. */
  tours: Array<{ id: string; title: string }>;
  /** Add-ons this bike can take. */
  addons: Array<{ id: string; name: string }>;
}

export interface TierRow {
  id: string;
  minDays: number;
  maxDays: number;
  priceMinor: number;
  perDay: boolean;
}

export async function getBikeTypeAdmin(d1: D1Database, id: string): Promise<BikeTypeAdmin | null> {
  const b = await d1.prepare(`SELECT id, slug, name, category, model, size_label, rider_min_cm, rider_max_cm, stock, listed, description, image FROM bike_types WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  if (!b) return null;
  const [tiers, tours, addons] = await Promise.all([
    d1.prepare(`SELECT id, min_days, max_days, price_minor, per_day FROM rate_tiers WHERE bike_type_id = ?1 ORDER BY min_days`).bind(id).all<Record<string, unknown>>(),
    d1.prepare(`SELECT t.id, t.title FROM tour_bike_types tb JOIN tours t ON t.id = tb.tour_id WHERE tb.bike_type_id = ?1 ORDER BY t.title`).bind(id).all<{ id: string; title: string }>(),
    d1.prepare(`SELECT a.id, a.name FROM bike_addons ba JOIN addons a ON a.id = ba.addon_id WHERE ba.bike_type_id = ?1 ORDER BY a.name`).bind(id).all<{ id: string; name: string }>(),
  ]);
  return {
    id: b.id as string,
    slug: b.slug as string,
    name: b.name as string,
    category: b.category as BikeCategory,
    model: (b.model as string | null) ?? null,
    sizeLabel: (b.size_label as string | null) ?? null,
    riderMinCm: (b.rider_min_cm as number | null) ?? null,
    riderMaxCm: (b.rider_max_cm as number | null) ?? null,
    stock: b.stock as number,
    listed: Boolean(b.listed),
    description: (b.description as string | null) ?? null,
    image: (b.image as string | null) ?? null,
    tiers: (tiers.results ?? []).map((t) => ({ id: t.id as string, minDays: t.min_days as number, maxDays: t.max_days as number, priceMinor: t.price_minor as number, perDay: Boolean(t.per_day) })),
    tours: tours.results ?? [],
    addons: addons.results ?? [],
  };
}

export interface BikeTypeEdit {
  name: string;
  model: string | null;
  sizeLabel: string | null;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  stock: number;
  listed: boolean;
  description: string | null;
}

export async function updateBikeType(d1: D1Database, id: string, edit: BikeTypeEdit, staff: string, now = Date.now()): Promise<string | null> {
  if (edit.name.trim().length < 2) return "A name, please.";
  if (!Number.isInteger(edit.stock) || edit.stock < 0 || edit.stock > 999) return "Stock is a whole number from 0 to 999.";
  if ((edit.riderMinCm == null) !== (edit.riderMaxCm == null)) return "Give both ends of the rider height range, or neither.";
  if (edit.riderMinCm != null && edit.riderMaxCm != null && (edit.riderMinCm < 80 || edit.riderMaxCm > 230 || edit.riderMinCm >= edit.riderMaxCm)) return "The rider range must run from at least 80 cm up to at most 230 cm.";
  const before = await getBikeTypeAdmin(d1, id);
  if (!before) return "That bike is gone.";
  const b = { name: before.name, model: before.model, sizeLabel: before.sizeLabel, riderMinCm: before.riderMinCm, riderMaxCm: before.riderMaxCm, stock: before.stock, listed: before.listed, description: before.description };
  const diff = changes(b, { ...edit });
  if (diff.length === 0) return null;
  await d1.batch([
    d1
      .prepare(`UPDATE bike_types SET name = ?2, model = ?3, size_label = ?4, rider_min_cm = ?5, rider_max_cm = ?6, stock = ?7, listed = ?8, description = ?9, updated_at = ?10 WHERE id = ?1`)
      .bind(id, edit.name.trim(), edit.model, edit.sizeLabel, edit.riderMinCm, edit.riderMaxCm, edit.stock, edit.listed ? 1 : 0, edit.description, now),
    audit(d1, "bike_type", id, null, null, staff, diff.join(", "), now),
  ]);
  return null;
}

/**
 * Replace a bike type's tiers with the rows given. Tiers must cover 1 day
 * upward without gaps or overlaps, or the quote engine has nothing to price
 * a rental with — so the whole set is validated before anything is written.
 */
export async function saveTiers(d1: D1Database, bikeTypeId: string, tiers: Array<{ minDays: number; maxDays: number; priceMinor: number; perDay: boolean }>, staff: string, now = Date.now()): Promise<string | null> {
  if (tiers.length === 0) return "At least one tier — a rental needs a price.";
  const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
  let expect = 1;
  for (const t of sorted) {
    if (!Number.isInteger(t.minDays) || !Number.isInteger(t.maxDays) || t.minDays < 1 || t.maxDays < t.minDays) return `A tier runs from a day to a later day; "${t.minDays}–${t.maxDays}" doesn't.`;
    if (!Number.isInteger(t.priceMinor) || t.priceMinor < 0) return "Prices are whole kroner, zero or more.";
    if (t.minDays !== expect) return expect > t.minDays ? `Tiers overlap at day ${t.minDays}.` : `There is a gap: nothing covers day ${expect}.`;
    expect = t.maxDays + 1;
  }
  if (sorted[sorted.length - 1]!.maxDays < 365) return "The last tier should run to 365 days so a long rental still has a price.";
  const before = await d1.prepare(`SELECT min_days, max_days, price_minor, per_day FROM rate_tiers WHERE bike_type_id = ?1 ORDER BY min_days`).bind(bikeTypeId).all<{ min_days: number; max_days: number; price_minor: number; per_day: number }>();
  const was = (before.results ?? []).map((t) => `${t.min_days}–${t.max_days}: ${t.price_minor / 100}${t.per_day ? "/day" : ""}`).join(", ");
  const is = sorted.map((t) => `${t.minDays}–${t.maxDays}: ${t.priceMinor / 100}${t.perDay ? "/day" : ""}`).join(", ");
  if (was === is) return null;
  await d1.batch([
    d1.prepare(`DELETE FROM rate_tiers WHERE bike_type_id = ?1`).bind(bikeTypeId),
    ...sorted.map((t) => d1.prepare(`INSERT INTO rate_tiers (id, bike_type_id, min_days, max_days, price_minor, per_day) VALUES (?1,?2,?3,?4,?5,?6)`).bind(crypto.randomUUID(), bikeTypeId, t.minDays, t.maxDays, t.priceMinor, t.perDay ? 1 : 0)),
    audit(d1, "bike_type", bikeTypeId, null, null, staff, `tiers ${was || "—"} → ${is}`, now),
  ]);
  return null;
}

// ---------------------------------------------------------------------------
// Add-ons and places
// ---------------------------------------------------------------------------

export interface AddonAdmin {
  id: string;
  name: string;
  unit: AddonUnit;
  priceMinor: number;
  isSale: boolean;
  /** How many bike types can take it. */
  bikes: number;
}

export async function listAddonsAdmin(d1: D1Database): Promise<AddonAdmin[]> {
  const rows = await d1
    .prepare(`SELECT a.id, a.name, a.unit, a.price_minor, a.is_sale, (SELECT COUNT(*) FROM bike_addons ba WHERE ba.addon_id = a.id) AS bikes FROM addons a ORDER BY a.unit, a.name`)
    .all<{ id: string; name: string; unit: AddonUnit; price_minor: number; is_sale: number; bikes: number }>();
  return (rows.results ?? []).map((a) => ({ id: a.id, name: a.name, unit: a.unit, priceMinor: a.price_minor, isSale: Boolean(a.is_sale), bikes: a.bikes }));
}

export async function updateAddon(d1: D1Database, id: string, edit: { name: string; priceMinor: number }, staff: string, now = Date.now()): Promise<string | null> {
  if (edit.name.trim().length < 2) return "A name, please.";
  if (!Number.isInteger(edit.priceMinor) || edit.priceMinor < 0) return "Prices are whole kroner, zero or more.";
  const before = await d1.prepare(`SELECT name, price_minor FROM addons WHERE id = ?1`).bind(id).first<{ name: string; price_minor: number }>();
  if (!before) return "That add-on is gone.";
  const diff = changes({ name: before.name, price: before.price_minor / 100 }, { name: edit.name.trim(), price: edit.priceMinor / 100 });
  if (diff.length === 0) return null;
  await d1.batch([d1.prepare(`UPDATE addons SET name = ?2, price_minor = ?3 WHERE id = ?1`).bind(id, edit.name.trim(), edit.priceMinor), audit(d1, "addon", id, null, null, staff, diff.join(", "), now)]);
  return null;
}

export interface LocationAdmin {
  id: string;
  name: string;
  address: string | null;
  pickupFeeMinor: number;
  dropoffFeeMinor: number;
  isDefault: boolean;
  active: boolean;
  note: string | null;
}

export async function listLocationsAdmin(d1: D1Database): Promise<LocationAdmin[]> {
  const rows = await d1.prepare(`SELECT id, name, address, pickup_fee_minor, dropoff_fee_minor, is_default, active, note FROM locations ORDER BY is_default DESC, active DESC, pickup_fee_minor, name`).all<Record<string, unknown>>();
  return (rows.results ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    address: (l.address as string | null) ?? null,
    pickupFeeMinor: l.pickup_fee_minor as number,
    dropoffFeeMinor: l.dropoff_fee_minor as number,
    isDefault: Boolean(l.is_default),
    active: Boolean(l.active),
    note: (l.note as string | null) ?? null,
  }));
}

export async function updateLocation(d1: D1Database, id: string, edit: { name: string; address: string | null; pickupFeeMinor: number; dropoffFeeMinor: number; active: boolean; note: string | null }, staff: string, now = Date.now()): Promise<string | null> {
  if (edit.name.trim().length < 2) return "A name, please.";
  if (![edit.pickupFeeMinor, edit.dropoffFeeMinor].every((n) => Number.isInteger(n) && n >= 0)) return "Fees are whole kroner, zero or more.";
  const before = await d1.prepare(`SELECT name, address, pickup_fee_minor, dropoff_fee_minor, is_default, active, note FROM locations WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  if (!before) return "That place is gone.";
  if (before.is_default && !edit.active) return "The shop itself can't be switched off — it is where everything starts.";
  const diff = changes(
    { name: before.name, address: before.address, pickup: (before.pickup_fee_minor as number) / 100, dropoff: (before.dropoff_fee_minor as number) / 100, active: Boolean(before.active), note: before.note },
    { name: edit.name.trim(), address: edit.address, pickup: edit.pickupFeeMinor / 100, dropoff: edit.dropoffFeeMinor / 100, active: edit.active, note: edit.note },
  );
  if (diff.length === 0) return null;
  await d1.batch([
    d1.prepare(`UPDATE locations SET name = ?2, address = ?3, pickup_fee_minor = ?4, dropoff_fee_minor = ?5, active = ?6, note = ?7 WHERE id = ?1`).bind(id, edit.name.trim(), edit.address, edit.pickupFeeMinor, edit.dropoffFeeMinor, edit.active ? 1 : 0, edit.note),
    audit(d1, "location", id, null, null, staff, diff.join(", "), now),
  ]);
  return null;
}

// ---------------------------------------------------------------------------
// A tour and its weekly slot
// ---------------------------------------------------------------------------

export interface TourAdmin {
  id: string;
  slug: string;
  title: string;
  category: string;
  published: boolean;
  requiresBike: boolean;
  durationMin: number;
  summary: string;
  schedule: {
    id: string;
    seasonStart: string;
    seasonEnd: string;
    weekdayMask: number;
    startTime: string;
    capacity: number;
    priceMinor: number;
    privatePriceMinor: number | null;
    minParticipants: number;
    bookingCutoffHours: number;
  } | null;
  problems: Problem[];
  /** Departures ahead, and how many already carry a booking. */
  ahead: number;
  aheadBooked: number;
}

export async function getTourAdmin(d1: D1Database, id: string, now = Date.now()): Promise<TourAdmin | null> {
  const t = await d1.prepare(`SELECT id, slug, title, category, published, requires_bike, duration_min, summary FROM tours WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  if (!t) return null;
  const [s, v, ahead] = await Promise.all([
    d1.prepare(`SELECT id, season_start, season_end, weekday_mask, start_time, capacity, price_minor, private_price_minor, min_participants, booking_cutoff_hours FROM tour_schedules WHERE tour_id = ?1 AND active = 1 ORDER BY season_start DESC LIMIT 1`).bind(id).first<Record<string, unknown>>(),
    validateTourForPublish(d1, id),
    d1
      .prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN seats_taken > 0 THEN 1 ELSE 0 END) AS booked FROM tour_departures WHERE tour_id = ?1 AND starts_at >= ?2 AND status <> 'cancelled'`)
      .bind(id, now)
      .first<{ n: number; booked: number | null }>(),
  ]);
  return {
    id: t.id as string,
    slug: t.slug as string,
    title: t.title as string,
    category: t.category as string,
    published: Boolean(t.published),
    requiresBike: Boolean(t.requires_bike),
    durationMin: t.duration_min as number,
    summary: t.summary as string,
    schedule: s
      ? {
          id: s.id as string,
          seasonStart: s.season_start as string,
          seasonEnd: s.season_end as string,
          weekdayMask: s.weekday_mask as number,
          startTime: s.start_time as string,
          capacity: s.capacity as number,
          priceMinor: s.price_minor as number,
          privatePriceMinor: (s.private_price_minor as number | null) ?? null,
          minParticipants: s.min_participants as number,
          bookingCutoffHours: s.booking_cutoff_hours as number,
        }
      : null,
    problems: v.problems,
    ahead: ahead?.n ?? 0,
    aheadBooked: ahead?.booked ?? 0,
  };
}

export async function setTourPublished(d1: D1Database, id: string, published: boolean, staff: string, now = Date.now()): Promise<string | null> {
  if (published) {
    const v = await validateTourForPublish(d1, id);
    if (!v.publishable) return `Not ready to publish: ${v.problems.filter((p) => p.severity === "error").map((p) => p.message).join("; ")}`;
  }
  const before = await d1.prepare(`SELECT published FROM tours WHERE id = ?1`).bind(id).first<{ published: number }>();
  if (!before) return "That tour is gone.";
  if (Boolean(before.published) === published) return null;
  await d1.batch([
    d1.prepare(`UPDATE tours SET published = ?2, updated_at = ?3 WHERE id = ?1`).bind(id, published ? 1 : 0, now),
    audit(d1, "tour", id, before.published ? "published" : "unpublished", published ? "published" : "unpublished", staff, published ? "published" : "taken off the site", now),
  ]);
  if (published) await ensureDepartures(d1, now);
  return null;
}

export interface ScheduleEdit {
  seasonStart: string;
  seasonEnd: string;
  weekdayMask: number;
  startTime: string;
  capacity: number;
  priceMinor: number;
  privatePriceMinor: number | null;
  minParticipants: number;
  bookingCutoffHours: number;
  /** Also push the new seats and price onto departures ahead that nobody has booked yet. */
  applyAhead: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Save the tour's weekly slot. New departures grow from it at once; the
 * ones already there keep their seats and price unless asked, and never
 * change once somebody has booked — those are promises.
 */
export async function saveSchedule(d1: D1Database, tourId: string, edit: ScheduleEdit, staff: string, now = Date.now()): Promise<string | null> {
  if (!ISO.test(edit.seasonStart) || !ISO.test(edit.seasonEnd) || edit.seasonEnd < edit.seasonStart) return "The season needs a start date and a later end date.";
  if (edit.weekdayMask <= 0 || edit.weekdayMask > 0b1111111) return "Tick at least one weekday.";
  if (!HHMM.test(edit.startTime)) return "Start time as HH:MM, for instance 10:15.";
  if (!Number.isInteger(edit.capacity) || edit.capacity < 1 || edit.capacity > 99) return "Seats: a whole number from 1 to 99.";
  if (!Number.isInteger(edit.priceMinor) || edit.priceMinor < 0) return "Price per person: whole kroner.";
  if (edit.privatePriceMinor != null && (!Number.isInteger(edit.privatePriceMinor) || edit.privatePriceMinor < 0)) return "Private price: whole kroner, or blank.";
  if (!Number.isInteger(edit.minParticipants) || edit.minParticipants < 0 || edit.minParticipants > edit.capacity) return "Minimum: from 0 up to the number of seats.";
  if (!Number.isInteger(edit.bookingCutoffHours) || edit.bookingCutoffHours < 0 || edit.bookingCutoffHours > 168) return "Cutoff: hours before departure, 0 to 168.";

  const before = await d1.prepare(`SELECT id, season_start, season_end, weekday_mask, start_time, capacity, price_minor, private_price_minor, min_participants, booking_cutoff_hours FROM tour_schedules WHERE tour_id = ?1 AND active = 1 ORDER BY season_start DESC LIMIT 1`).bind(tourId).first<Record<string, unknown>>();
  const was = before
    ? { season: `${before.season_start}→${before.season_end}`, weekdays: before.weekday_mask, time: before.start_time, seats: before.capacity, price: (before.price_minor as number) / 100, private: before.private_price_minor == null ? null : (before.private_price_minor as number) / 100, min: before.min_participants, cutoff: before.booking_cutoff_hours }
    : {};
  const is = { season: `${edit.seasonStart}→${edit.seasonEnd}`, weekdays: edit.weekdayMask, time: edit.startTime, seats: edit.capacity, price: edit.priceMinor / 100, private: edit.privatePriceMinor == null ? null : edit.privatePriceMinor / 100, min: edit.minParticipants, cutoff: edit.bookingCutoffHours };
  const diff = changes(was, is);
  const stmts: D1PreparedStatement[] = [];
  if (before) {
    stmts.push(
      d1
        .prepare(`UPDATE tour_schedules SET season_start = ?2, season_end = ?3, weekday_mask = ?4, start_time = ?5, capacity = ?6, price_minor = ?7, private_price_minor = ?8, min_participants = ?9, booking_cutoff_hours = ?10 WHERE id = ?1`)
        .bind(before.id, edit.seasonStart, edit.seasonEnd, edit.weekdayMask, edit.startTime, edit.capacity, edit.priceMinor, edit.privatePriceMinor, edit.minParticipants, edit.bookingCutoffHours),
    );
  } else {
    stmts.push(
      d1
        .prepare(`INSERT INTO tour_schedules (id, tour_id, season_start, season_end, weekday_mask, start_time, capacity, price_minor, private_price_minor, min_participants, booking_cutoff_hours, active) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,1)`)
        .bind(crypto.randomUUID(), tourId, edit.seasonStart, edit.seasonEnd, edit.weekdayMask, edit.startTime, edit.capacity, edit.priceMinor, edit.privatePriceMinor, edit.minParticipants, edit.bookingCutoffHours),
    );
  }
  if (edit.applyAhead) {
    // Only departures nobody has booked: a sold seat is a promise at that price.
    stmts.push(d1.prepare(`UPDATE tour_departures SET capacity = ?2, price_minor = ?3 WHERE tour_id = ?1 AND starts_at >= ?4 AND seats_taken = 0 AND status IN ('open','closed')`).bind(tourId, edit.capacity, edit.priceMinor, now));
  }
  if (diff.length || edit.applyAhead) stmts.push(audit(d1, "tour_schedule", tourId, null, null, staff, `${diff.join(", ") || "slot unchanged"}${edit.applyAhead ? " — applied to unbooked departures ahead" : ""}`, now));
  if (stmts.length === 1 && !diff.length) return null;
  await d1.batch(stmts);
  await ensureDepartures(d1, now);
  return null;
}
