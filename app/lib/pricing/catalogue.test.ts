import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applySchema, env, truncateAll } from "~/test/db";
import { keysOf, loadQuoteCatalogue } from "./catalogue";
import { priceQuote } from "./quote";
import { parseQuoteRequest } from "~/routes/api.quote";

const T0 = Date.UTC(2026, 5, 12, 10, 0, 0);
const h = (n: number) => n * 3_600_000;

/** A slice of the real export: a gravel bike on the standard ladder. */
async function seedRealCatalogue() {
  await env.DB.prepare(
    `INSERT INTO bike_types (id, slug, name, category, size_label, rider_min_cm, rider_max_cm, stock, listed, created_at, updated_at)
     VALUES ('gravel-54','gravel-54','Gravel size 54cm','gravel','54',170,185,4,1,0,0)`,
  ).run();

  const ladder: Array<[number, number, number]> = [
    [1, 1, 45000],
    [2, 6, 40000],
    [7, 13, 35000],
    [14, 20, 30000],
    [21, 27, 25000],
    [28, 60, 20000],
  ];
  for (const [min, max, price] of ladder) {
    await env.DB.prepare(
      `INSERT INTO rate_tiers (id, bike_type_id, min_days, max_days, price_minor, per_day)
       VALUES (?1,'gravel-54',?2,?3,?4,1)`,
    )
      .bind(`t-${min}`, min, max, price)
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO addons (id, slug, name, unit, price_minor, is_sale)
     VALUES ('helmet','helmet-for-rent','Helmet for rent','per_bike',5000,0)`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO locations (id, slug, name, pickup_fee_minor, dropoff_fee_minor, is_default, active)
     VALUES ('shop','sverrisgota-20','Sverrisgøta 20',0,0,1,1),
            ('campsite','vid-gjonna','Við Gjónna',15000,15000,0,1)`,
  ).run();
}

beforeAll(applySchema);
beforeEach(async () => {
  await truncateAll();
  await seedRealCatalogue();
});

describe("loading the catalogue out of D1", () => {
  it("rebuilds the ladder with per_day converted from SQLite's 1/0", async () => {
    const cat = await loadQuoteCatalogue(env.DB, { bikeTypeIds: ["gravel-54"] });
    const bike = cat.bikeTypes.get("gravel-54")!;
    expect(bike.tiers).toHaveLength(6);
    expect(bike.tiers.every((t) => t.perDay === true)).toBe(true);
    expect(bike.tiers[0]).toMatchObject({ minDays: 1, maxDays: 1, priceMinor: 45000 });
  });

  it("prices a real request end to end", async () => {
    const cat = await loadQuoteCatalogue(env.DB, {
      bikeTypeIds: ["gravel-54"],
      addonIds: ["helmet"],
      locationIds: ["shop", "campsite"],
    });
    const q = priceQuote(
      {
        startAt: T0,
        endAt: T0 + h(72),
        bikes: [{ bikeTypeId: "gravel-54", qty: 2 }],
        addons: [{ addonId: "helmet", qty: 2 }],
        pickupLocationId: "shop",
        dropoffLocationId: "campsite",
      },
      cat,
    );
    // 2 × 3 × 400 + 2 × 50 + 150 = 2,650
    expect(q.totalMinor).toBe(265000);
  });

  it("asks for nothing it was not given keys for", async () => {
    const cat = await loadQuoteCatalogue(env.DB, { bikeTypeIds: [] });
    expect(cat.bikeTypes.size).toBe(0);
    expect(cat.addons.size).toBe(0);
    expect(cat.locations.size).toBe(0);
  });

  it("keysOf pulls exactly what a request references", () => {
    const keys = keysOf({
      startAt: T0,
      endAt: T0 + h(24),
      bikes: [{ bikeTypeId: "a", qty: 1 }, { bikeTypeId: "a", qty: 1 }],
      addons: [{ addonId: "helmet", qty: 1 }],
      dropoffLocationId: "campsite",
    });
    expect(keys.bikeTypeIds).toEqual(["a", "a"]);
    expect(keys.locationIds).toEqual(["campsite"]);
  });
});

describe("the quote endpoint accepts no price from the client", () => {
  const valid = {
    startAt: new Date(T0).toISOString(),
    endAt: new Date(T0 + h(72)).toISOString(),
    bikes: [{ bikeTypeId: "gravel-54", qty: 2 }],
  };

  it("parses a well-formed request", () => {
    const req = parseQuoteRequest(valid);
    expect(req.bikes).toHaveLength(1);
    expect(req.startAt.getTime()).toBe(T0);
  });

  it("silently ignores a price the client tries to smuggle in", () => {
    const req = parseQuoteRequest({
      ...valid,
      totalMinor: 1,
      total_price: 1,
      price: 1,
      bikes: [{ bikeTypeId: "gravel-54", qty: 2, unitPriceMinor: 1 }],
    }) as unknown as Record<string, unknown>;
    expect(req.totalMinor).toBeUndefined();
    expect(req.price).toBeUndefined();
    expect((req.bikes as Array<Record<string, unknown>>)[0]!.unitPriceMinor).toBeUndefined();
  });

  it("rejects malformed input rather than guessing", () => {
    expect(() => parseQuoteRequest(null)).toThrow();
    expect(() => parseQuoteRequest({ ...valid, bikes: [] })).toThrow();
    expect(() => parseQuoteRequest({ ...valid, startAt: "not a date" })).toThrow();
    expect(() => parseQuoteRequest({ ...valid, bikes: [{ bikeTypeId: "x", qty: 0 }] })).toThrow();
    expect(() => parseQuoteRequest({ ...valid, bikes: [{ bikeTypeId: "x", qty: 1.5 }] })).toThrow();
    expect(() => parseQuoteRequest({ ...valid, bikes: [{ qty: 1 }] })).toThrow();
  });
});
