/**
 * Loads the catalogue a quote needs out of D1 and hands it to the pure engine.
 *
 * This is the only place the two halves meet. `priceQuote` stays free of the
 * database so every rule can be unit-tested, and this file stays free of
 * pricing rules so it can be read as plain data access.
 */
import type { QuoteCatalogue, QuoteRequest, QuoteTier } from "./quote";
import type { AddonUnit } from "~/db/schema";

export interface CatalogueKeys {
  bikeTypeIds: readonly string[];
  addonIds?: readonly string[];
  locationIds?: readonly string[];
}

/** Everything the request references, in three queries. */
export async function loadQuoteCatalogue(d1: D1Database, keys: CatalogueKeys): Promise<QuoteCatalogue> {
  const bikeIds = unique(keys.bikeTypeIds);
  const addonIds = unique(keys.addonIds ?? []);
  const locationIds = unique(keys.locationIds ?? []);

  const [bikeRows, tierRows, addonRows, locationRows] = await Promise.all([
    bikeIds.length
      ? d1
          .prepare(`SELECT id, name FROM bike_types WHERE id IN (${placeholders(bikeIds.length)})`)
          .bind(...bikeIds)
          .all<{ id: string; name: string }>()
      : emptyResult<{ id: string; name: string }>(),
    bikeIds.length
      ? d1
          .prepare(
            `SELECT bike_type_id, min_days, max_days, price_minor, per_day
               FROM rate_tiers
              WHERE bike_type_id IN (${placeholders(bikeIds.length)})
              ORDER BY bike_type_id, min_days`,
          )
          .bind(...bikeIds)
          .all<{ bike_type_id: string; min_days: number; max_days: number; price_minor: number; per_day: number }>()
      : emptyResult<never>(),
    addonIds.length
      ? d1
          .prepare(`SELECT id, name, unit, price_minor FROM addons WHERE id IN (${placeholders(addonIds.length)})`)
          .bind(...addonIds)
          .all<{ id: string; name: string; unit: AddonUnit; price_minor: number }>()
      : emptyResult<never>(),
    locationIds.length
      ? d1
          .prepare(
            `SELECT id, name, pickup_fee_minor, dropoff_fee_minor
               FROM locations WHERE id IN (${placeholders(locationIds.length)})`,
          )
          .bind(...locationIds)
          .all<{ id: string; name: string; pickup_fee_minor: number; dropoff_fee_minor: number }>()
      : emptyResult<never>(),
  ]);

  const tiersByBike = new Map<string, QuoteTier[]>();
  for (const t of tierRows.results ?? []) {
    const list = tiersByBike.get(t.bike_type_id) ?? [];
    list.push({
      minDays: t.min_days,
      maxDays: t.max_days,
      priceMinor: t.price_minor,
      // SQLite has no boolean; 1/0 comes back as a number.
      perDay: Boolean(t.per_day),
    });
    tiersByBike.set(t.bike_type_id, list);
  }

  const bikeTypes = new Map(
    (bikeRows.results ?? []).map((b) => [b.id, { id: b.id, name: b.name, tiers: tiersByBike.get(b.id) ?? [] }]),
  );
  const addons = new Map(
    (addonRows.results ?? []).map((a) => [a.id, { id: a.id, name: a.name, unit: a.unit, priceMinor: a.price_minor }]),
  );
  const locations = new Map(
    (locationRows.results ?? []).map((l) => [
      l.id,
      { id: l.id, name: l.name, pickupFeeMinor: l.pickup_fee_minor, dropoffFeeMinor: l.dropoff_fee_minor },
    ]),
  );

  return { bikeTypes, addons, locations };
}

/** Convenience: pull exactly the keys a request mentions. */
export function keysOf(req: QuoteRequest): CatalogueKeys {
  return {
    bikeTypeIds: req.bikes.map((b) => b.bikeTypeId),
    addonIds: (req.addons ?? []).map((a) => a.addonId),
    locationIds: [req.pickupLocationId, req.dropoffLocationId].filter((x): x is string => Boolean(x)),
  };
}

function unique(xs: readonly string[]): string[] {
  return [...new Set(xs)];
}

function placeholders(n: number): string {
  return Array.from({ length: n }, (_, i) => `?${i + 1}`).join(",");
}

function emptyResult<T>(): Promise<{ results: T[] }> {
  return Promise.resolve({ results: [] });
}
