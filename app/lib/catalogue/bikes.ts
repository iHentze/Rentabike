/**
 * The catalogue as the customer sees it: every listed product with what is
 * free on their dates and what it costs per day for that length of rental.
 *
 * Availability is the same subtraction the reservation guard makes —
 * stock minus everything overlapping that still holds inventory — so the
 * number on the card is the number the INSERT will accept. Read-only here;
 * the guard in reserve.ts is what actually decides.
 */
import type { BikeCategory } from "~/db/schema";
import { selectTier, type QuoteTier } from "~/lib/pricing/quote";
import { tierDays } from "~/lib/pricing/duration";
import type { Trip } from "~/lib/trip";
import { tripDays } from "~/lib/trip";

export interface CatalogueBike {
  id: string;
  slug: string;
  name: string;
  category: BikeCategory;
  model: string | null;
  sizeLabel: string | null;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  stock: number;
  free: number;
  image: string | null;
  /** Every photo, main first. Empty when the shop has none. */
  images: string[];
  description: string | null;
  tiers: QuoteTier[];
  /** Per-day rate for this trip's length, or the period total for Extra items priced that way. */
  rateMinor: number;
  perDay: boolean;
  /** What this bike costs for the whole trip. */
  tripMinor: number;
  addonIds: string[];
}

export const CATEGORY_LABEL: Record<BikeCategory, string> = {
  ebike: "E-Bikes",
  mountain: "Mountain",
  gravel: "Gravel",
  road: "Road",
  extra: "Extras",
};

export const CATEGORY_ORDER: BikeCategory[] = ["ebike", "mountain", "gravel", "road", "extra"];

interface BikeRow {
  id: string;
  slug: string;
  name: string;
  category: BikeCategory;
  model: string | null;
  size_label: string | null;
  rider_min_cm: number | null;
  rider_max_cm: number | null;
  stock: number;
  free: number;
  image: string | null;
  images: string | null;
  description: string | null;
}

interface TierRow {
  bike_type_id: string;
  min_days: number;
  max_days: number;
  price_minor: number;
  per_day: number;
}

const AVAILABILITY = `
  bt.stock - COALESCE((
    SELECT SUM(bl.qty)
      FROM booking_lines bl
      JOIN bookings b ON b.id = bl.booking_id
     WHERE bl.bike_type_id = bt.id
       AND bl.kind = 'bike'
       AND b.status IN ('held', 'confirmed', 'picked_up')
       AND b.start_at < ?2
       AND b.end_at > ?1), 0) AS free`;

const COLUMNS = `bt.id, bt.slug, bt.name, bt.category, bt.model, bt.size_label, bt.rider_min_cm, bt.rider_max_cm,
  bt.stock, bt.image, bt.images, bt.description`;

/** Every listed product, priced and counted for the trip. */
export async function listBikes(d1: D1Database, trip: Trip): Promise<CatalogueBike[]> {
  const start = trip.startAt.getTime();
  const end = trip.endAt.getTime();
  const [bikes, tiers, links] = await Promise.all([
    d1
      .prepare(`SELECT ${COLUMNS}, ${AVAILABILITY} FROM bike_types bt WHERE bt.listed = 1 ORDER BY bt.category, bt.name`)
      .bind(start, end)
      .all<BikeRow>(),
    d1.prepare(`SELECT bike_type_id, min_days, max_days, price_minor, per_day FROM rate_tiers ORDER BY bike_type_id, min_days`).all<TierRow>(),
    d1.prepare(`SELECT bike_type_id, addon_id FROM bike_addons`).all<{ bike_type_id: string; addon_id: string }>(),
  ]);
  return assemble(bikes.results ?? [], tiers.results ?? [], links.results ?? [], trip);
}

/** One product by slug, priced and counted for the trip. Unlisted products still resolve — a link is a link. */
export async function getBike(d1: D1Database, slug: string, trip: Trip): Promise<CatalogueBike | null> {
  const start = trip.startAt.getTime();
  const end = trip.endAt.getTime();
  const bike = await d1
    .prepare(`SELECT ${COLUMNS}, ${AVAILABILITY} FROM bike_types bt WHERE bt.slug = ?3`)
    .bind(start, end, slug)
    .first<BikeRow>();
  if (!bike) return null;
  const [tiers, links] = await Promise.all([
    d1
      .prepare(`SELECT bike_type_id, min_days, max_days, price_minor, per_day FROM rate_tiers WHERE bike_type_id = ?1 ORDER BY min_days`)
      .bind(bike.id)
      .all<TierRow>(),
    d1.prepare(`SELECT bike_type_id, addon_id FROM bike_addons WHERE bike_type_id = ?1`).bind(bike.id).all<{ bike_type_id: string; addon_id: string }>(),
  ]);
  return assemble([bike], tiers.results ?? [], links.results ?? [], trip)[0] ?? null;
}

/** Several products by id, priced and counted — the basket's bikes on the rider and checkout pages. */
export async function getBikesById(d1: D1Database, ids: readonly string[], trip: Trip): Promise<Map<string, CatalogueBike>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const start = trip.startAt.getTime();
  const end = trip.endAt.getTime();
  const marks = unique.map((_, i) => `?${i + 3}`).join(", ");
  const [bikes, tiers, links] = await Promise.all([
    d1.prepare(`SELECT ${COLUMNS}, ${AVAILABILITY} FROM bike_types bt WHERE bt.id IN (${marks})`).bind(start, end, ...unique).all<BikeRow>(),
    d1
      .prepare(`SELECT bike_type_id, min_days, max_days, price_minor, per_day FROM rate_tiers WHERE bike_type_id IN (${unique.map((_, i) => `?${i + 1}`).join(", ")}) ORDER BY bike_type_id, min_days`)
      .bind(...unique)
      .all<TierRow>(),
    d1
      .prepare(`SELECT bike_type_id, addon_id FROM bike_addons WHERE bike_type_id IN (${unique.map((_, i) => `?${i + 1}`).join(", ")})`)
      .bind(...unique)
      .all<{ bike_type_id: string; addon_id: string }>(),
  ]);
  return new Map(assemble(bikes.results ?? [], tiers.results ?? [], links.results ?? [], trip).map((b) => [b.id, b]));
}

function assemble(rows: BikeRow[], tierRows: TierRow[], linkRows: { bike_type_id: string; addon_id: string }[], trip: Trip): CatalogueBike[] {
  const days = tripDays(trip);
  const whole = tierDays(days);
  const tiersByBike = new Map<string, QuoteTier[]>();
  for (const t of tierRows) {
    const list = tiersByBike.get(t.bike_type_id) ?? [];
    list.push({ minDays: t.min_days, maxDays: t.max_days, priceMinor: t.price_minor, perDay: Boolean(t.per_day) });
    tiersByBike.set(t.bike_type_id, list);
  }
  const addonsByBike = new Map<string, string[]>();
  for (const l of linkRows) {
    const list = addonsByBike.get(l.bike_type_id) ?? [];
    list.push(l.addon_id);
    addonsByBike.set(l.bike_type_id, list);
  }
  const out: CatalogueBike[] = [];
  for (const r of rows) {
    const tiers = tiersByBike.get(r.id) ?? [];
    if (tiers.length === 0) continue; // nothing to sell it for
    const tier = selectTier(tiers, whole);
    const tripMinor = tier.perDay ? Math.round(tier.priceMinor * days) : tier.priceMinor;
    out.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category,
      model: r.model,
      sizeLabel: r.size_label,
      riderMinCm: r.rider_min_cm,
      riderMaxCm: r.rider_max_cm,
      stock: r.stock,
      free: Math.max(0, r.free),
      image: r.image,
      images: parseImages(r.images, r.image),
      description: r.description,
      tiers,
      rateMinor: tier.priceMinor,
      perDay: tier.perDay,
      tripMinor,
      addonIds: addonsByBike.get(r.id) ?? [],
    });
  }
  return out;
}

/** The stored JSON list, or just the main photo for rows seeded before the column existed. */
function parseImages(json: string | null, main: string | null): string[] {
  if (json) {
    try {
      const list = JSON.parse(json);
      if (Array.isArray(list) && list.every((u) => typeof u === "string")) return list;
    } catch {
      // fall through to the single image
    }
  }
  return main ? [main] : [];
}

/** True when a rider of this height fits the frame. Products without a range fit everyone. */
export function fitsRider(bike: Pick<CatalogueBike, "riderMinCm" | "riderMaxCm">, heightCm: number | null | undefined): boolean {
  if (heightCm == null) return true;
  if (bike.riderMinCm == null || bike.riderMaxCm == null) return true;
  return heightCm >= bike.riderMinCm && heightCm <= bike.riderMaxCm;
}

export interface CategorySummary {
  category: BikeCategory;
  label: string;
  free: number;
  fromMinor: number | null;
}

/** "E-Bikes · 12 free · from 380" for the home page grid. Extras are left out — they aren't bikes. */
export function summariseCategories(bikes: CatalogueBike[]): CategorySummary[] {
  return CATEGORY_ORDER.filter((c) => c !== "extra").map((category) => {
    const inCat = bikes.filter((b) => b.category === category);
    const priced = inCat.filter((b) => b.free > 0 && b.perDay);
    return {
      category,
      label: CATEGORY_LABEL[category],
      free: inCat.reduce((n, b) => n + b.free, 0),
      fromMinor: priced.length ? Math.min(...priced.map((b) => b.rateMinor)) : null,
    };
  });
}

/** Bikes only — the things a rider sits on. */
export function ridable(bikes: CatalogueBike[]): CatalogueBike[] {
  return bikes.filter((b) => b.category !== "extra");
}

export interface CatalogueAddon {
  id: string;
  slug: string;
  name: string;
  unit: "per_bike" | "per_bike_per_day" | "per_booking";
  priceMinor: number;
  isSale: boolean;
  image: string | null;
}

/** Add-ons by id — the allowlist of one product, or everything in a basket. */
export async function getAddonsById(d1: D1Database, ids: readonly string[]): Promise<Map<string, CatalogueAddon>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await d1
    .prepare(`SELECT id, slug, name, unit, price_minor, is_sale, image FROM addons WHERE id IN (${unique.map((_, i) => `?${i + 1}`).join(", ")}) ORDER BY price_minor, name`)
    .bind(...unique)
    .all<{ id: string; slug: string; name: string; unit: CatalogueAddon["unit"]; price_minor: number; is_sale: number; image: string | null }>();
  return new Map((rows.results ?? []).map((a) => [a.id, { id: a.id, slug: a.slug, name: a.name, unit: a.unit, priceMinor: a.price_minor, isSale: Boolean(a.is_sale), image: a.image }]));
}

export const ADDON_UNIT_LABEL: Record<CatalogueAddon["unit"], string> = {
  per_bike: "per bike",
  per_bike_per_day: "per bike per day",
  per_booking: "per booking",
};
