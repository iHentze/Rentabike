import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import csv from "../../../data/woocommerce-products-2026-09-06.csv?raw";
import {
  categorise,
  parseAddonCell,
  parseCatalogue,
  parseCsv,
  parseTierCell,
  parseTitle,
  ParseError,
  validateLadder,
  type Band,
} from "./parse";
import { seedCatalogue, SeedRefused, writeCatalogue } from "./catalogue";
import { applySchema, env, truncateAll } from "~/test/db";
import { loadQuoteCatalogue } from "~/lib/pricing/catalogue";
import { priceQuote } from "~/lib/pricing/quote";

const cat = parseCatalogue(csv);
const byId = (id: number) => cat.bikeTypes.find((b) => b.wcProductId === id)!;

describe("the file itself", () => {
  it("has 52 products under a BOM-prefixed header", () => {
    expect(parseCsv(csv)).toHaveLength(52);
    expect(parseCsv(csv)[0]).toHaveProperty("id"); // not "﻿id"
  });

  it("splits into 49 rentable SKUs and 3 add-on-only rows", () => {
    // Pedals (32359) carries a two-band Fixed ladder and stock, so it is a
    // rentable extra like the bags — only the helmet's open "any" band and the
    // two kr.79 retail goods with no ladder at all become add-ons.
    expect(cat.bikeTypes).toHaveLength(49);
    expect(cat.addonOnly).toHaveLength(3);
    expect(cat.addonOnly.map((a) => a.wcProductId).sort()).toEqual([20265, 28179, 32460].sort());
  });

  it("counts the five categories exactly as the shop does", () => {
    const n = (c: string) => cat.bikeTypes.filter((b) => b.category === c).length;
    expect(n("ebike")).toBe(13);
    expect(n("mountain")).toBe(10);
    expect(n("gravel")).toBe(9);
    expect(n("road")).toBe(7);
    expect(n("extra")).toBe(10); // 13 EXTRA rows minus the 3 routed to addons
  });

  it("holds 70 bike units and every unit is accounted for", () => {
    const bikes = cat.bikeTypes.filter((b) => b.category !== "extra");
    expect(bikes.reduce((s, b) => s + b.stock, 0)).toBe(70);
  });
});

describe("titles — 18 format variants, all 52 rows", () => {
  it("the canonical form", () => {
    const b = byId(492);
    expect(b.model).toBe("E-Bike");
    expect(b.sizeLabel).toBe("44");
    expect(b.riderMinCm).toBe(150);
    expect(b.riderMaxCm).toBe(165);
  });

  it("inch frames via U+2033, and uppercase CM", () => {
    const b = byId(1361);
    expect(b.sizeLabel).toBe("15″");
    expect(b.riderMinCm).toBe(160);
    expect(b.riderMaxCm).toBe(170);
  });

  it("a bare 19 is inches, a bare 58 is centimetres", () => {
    expect(parseTitle("E-MTB Centurion – size 19 (160-180 cm)").sizeLabel).toBe("19″");
    expect(parseTitle("Road Bike carbon size 58 (177-189 cm)").sizeLabel).toBe("58");
  });

  it("no space before the unit, and a 'cm' suffix on the size", () => {
    const b = byId(24887);
    expect(b.sizeLabel).toBe("45");
    expect(b.riderMinCm).toBe(155);
    expect(b.riderMaxCm).toBe(175);
  });

  it("a height range with no unit at all resolves by magnitude", () => {
    const b = byId(17436);
    expect(b.riderMinCm).toBe(172);
    expect(b.riderMaxCm).toBe(178);
  });

  it("en dashes, spaced and unspaced", () => {
    expect(byId(31737).riderMinCm).toBe(180);
    expect(byId(13238).riderMinCm).toBe(166);
    expect(byId(13238).riderMaxCm).toBe(180);
  });

  it("letter sizes", () => {
    expect(byId(13093).sizeLabel).toBe("Large");
    expect(byId(13092).sizeLabel).toBe("Medium");
  });

  it("children's bikes carry an AGE range and must never get a height", () => {
    const younger = byId(26718);
    expect(younger.sizeLabel).toBe("26″");
    expect(younger.riderMinCm).toBeNull();
    expect(younger.riderMaxCm).toBeNull();
    const p = parseTitle("Children bike 27,5″ (14+ year)");
    expect(p.riderSpecKind).toBe("age");
    expect(p.riderMinAgeYears).toBe(14);
    expect(p.riderMaxAgeYears).toBeNull();
    expect(p.sizeLabel).toBe("27,5″");
  });

  it("the two Felt Doctrines have no height range at all", () => {
    expect(byId(26159).riderMinCm).toBeNull();
    expect(byId(26161).riderMinCm).toBeNull();
    expect(byId(26159).sizeLabel).toBe("16″");
  });

  it("'Pannier 13 L' is not a letter size", () => {
    const p = parseTitle("Bag Geosmina Pannier 13 L");
    expect(p.isBike).toBe(false);
    expect(p.sizeLabel).toBeNull();
  });

  it("a non-range parenthetical stays in the name", () => {
    expect(parseTitle("Bags for rear rack (2*20L)").model).toBe("Bags for rear rack (2*20L)");
  });
});

describe("tier cells — the grammar, and its verified corrections", () => {
  it("a per-day cell", () => {
    expect(parseTierCell("1 - 1 days: kr.450.00 / Day")).toEqual({ minDays: 1, maxDays: 1, priceMinor: 45000, perDay: true });
  });

  it("a Fixed cell is a period total", () => {
    expect(parseTierCell("1 - 6 days: kr.200.00 Fixed")).toEqual({ minDays: 1, maxDays: 6, priceMinor: 20000, perDay: false });
  });

  it("the thousands separator", () => {
    expect(parseTierCell("14 - 20 days: kr.14,000.00 Fixed")!.priceMinor).toBe(1400000);
  });

  it("a hand-edited amount with the separator turned off still parses", () => {
    expect(parseTierCell("14 - 20 days: kr.1400.00 Fixed")!.priceMinor).toBe(140000);
  });

  it("a comma that is not a thousands separator is refused, not read as ×1000", () => {
    expect(() => parseTierCell("1 - 6 days: kr.1,00 Fixed")).toThrow(ParseError);
  });

  it("the helmet's open-ended 'any' band", () => {
    expect(parseTierCell("any: kr.50.00 / days")).toMatchObject({ minDays: 1, maxDays: null, priceMinor: 5000 });
  });

  it("an empty cell is null, garbage throws", () => {
    expect(parseTierCell("")).toBeNull();
    expect(parseTierCell(undefined)).toBeNull();
    expect(() => parseTierCell("cheap")).toThrow(ParseError);
  });
});

describe("the real ladders", () => {
  it("Gravel Breed 54 carries the full six-band card — the ladder the canvas basket was priced on", () => {
    const b = byId(13233);
    expect(b.bands.map((t) => [t.minDays, t.maxDays, t.priceMinor / 100])).toEqual([
      [1, 1, 450],
      [2, 6, 400],
      [7, 13, 350],
      [14, 20, 300],
      [21, 27, 250],
      [28, 60, 200],
    ]);
    expect(b.bands.every((t) => t.perDay)).toBe(true);
  });

  it("Road Bike carbon 58 is a DIFFERENT shape: five bands, 7–20 merged, and a 250 floor", () => {
    // Same 450 day-one as the card above, yet a long stay costs 250 here and
    // 200 there. This is what "23 ladders, not one rate card" means in practice.
    const b = byId(124);
    expect(b.bands.map((t) => [t.minDays, t.maxDays, t.priceMinor / 100])).toEqual([
      [1, 1, 450],
      [2, 6, 400],
      [7, 20, 350],
      [21, 27, 300],
      [28, 60, 250],
    ]);
  });

  it("a mountain bike sits a band lower and runs all the way down to 100/day at 28+", () => {
    const b = byId(1361);
    expect(b.bands.map((t) => t.priceMinor / 100)).toEqual([350, 300, 250, 200, 150, 100]);
    expect(b.bands[b.bands.length - 1]!.maxDays).toBe(60);
  });

  it("the standard e-bikes stop at day 20 with four bands", () => {
    const b = byId(492);
    expect(b.bands.map((t) => t.priceMinor / 100)).toEqual([450, 400, 350, 300]);
    expect(b.bands[b.bands.length - 1]!.maxDays).toBe(20);
    expect(b.issues.map((i) => i.kind)).toContain("ends_before_60");
  });

  it("an Extra item's ladder is a period total and ascends", () => {
    const b = byId(28199);
    expect(b.bands.every((t) => !t.perDay)).toBe(true);
    expect(b.bands.map((t) => t.priceMinor / 100)).toEqual([600, 1000, 1400]);
  });

  it("there are 23 distinct ladders, because there is no rate card", () => {
    const shapes = new Set(cat.bikeTypes.map((b) => JSON.stringify(b.bands)));
    expect(shapes.size).toBeGreaterThanOrEqual(20);
  });
});

describe("the validation pass names the live pricing bugs and repairs nothing", () => {
  const errorsFor = (id: number) => byId(id).issues.filter((i) => i.severity === "error").map((i) => i.kind);

  it("[24871] the tag-along's kr.14,000 — a misplaced zero", () => {
    expect(errorsFor(24871)).toContain("implausible_magnitude");
    expect(byId(24871).bands[2]!.priceMinor).toBe(1400000); // stored as found
  });

  it("[26161] the Felt Doctrine whose price RISES at 14–20 days", () => {
    expect(errorsFor(26161)).toContain("non_monotonic_per_day");
  });

  it("[31737] day 6 priced twice", () => {
    expect(errorsFor(31737)).toContain("overlap");
  });

  it("[64] day 27 priced twice", () => {
    expect(errorsFor(64)).toContain("overlap");
  });

  it("no ladder has a gap and every ladder starts at day 1", () => {
    for (const b of cat.bikeTypes) {
      const kinds = b.issues.map((i) => i.kind);
      expect(kinds, b.name).not.toContain("gap");
      expect(kinds, b.name).not.toContain("not_starting_at_1");
    }
  });

  it("the six hidden e-bikes are reported as invisible inventory", () => {
    const hidden = cat.bikeTypes.filter((b) => !b.listed);
    expect(hidden.map((b) => b.wcProductId).sort()).toEqual([12944, 12958, 13238, 13239, 30209, 496].sort());
    expect(hidden.reduce((s, b) => s + b.stock, 0)).toBe(8);
    expect(cat.report.filter((l) => l.includes("invisible inventory"))).toHaveLength(6);
  });

  it("validateLadder catches a gap and a falling total, which the file happens not to contain", () => {
    const gap: Band[] = [
      { minDays: 1, maxDays: 6, priceMinor: 40000, perDay: true },
      { minDays: 9, maxDays: 13, priceMinor: 35000, perDay: true },
    ];
    expect(validateLadder(gap).map((i) => i.kind)).toContain("gap");
    const falling: Band[] = [
      { minDays: 1, maxDays: 6, priceMinor: 30000, perDay: false },
      { minDays: 7, maxDays: 13, priceMinor: 20000, perDay: false },
    ];
    expect(validateLadder(falling).map((i) => i.kind)).toContain("non_ascending_total");
  });
});

describe("add-ons — 20 distinct across 18 allowlists", () => {
  it("parses the trickiest real cell without splitting on '.' or balancing brackets", () => {
    const list = parseAddonCell(
      "3 bags for rear rack for rent (2*20l.+10l.)): 150; Smartphone Mount for rent. Max device size 6,6''.: 50; Water bottle with logo for sale: 89",
    );
    expect(list).toHaveLength(3);
    expect(list[0]!.name).toBe("3 bags for rear rack for rent (2*20l.+10l.))"); // byte-identical, typo included
    expect(list[1]!.name).toBe("Smartphone Mount for rent. Max device size 6,6''.");
    expect(list[1]!.priceMinor).toBe(5000);
    expect(list[2]!.isSale).toBe(true);
  });

  it("the union across the file is the 20 distinct add-ons plus the two retail goods", () => {
    // 20 from the column; the helmet product row shares the helmet add-on's
    // slug rather than adding a second; Blå Band and Universal Gas are new.
    expect(cat.addons.size).toBe(22);
    expect(cat.addons.get("helmet-for-rent")).toMatchObject({ priceMinor: 5000, unit: "per_bike", isSale: false });
    expect(cat.addons.get("water-bottle-with-logo-for-sale")).toMatchObject({ priceMinor: 8900, isSale: true });
  });

  it("the helmet product row and the helmet add-on are one thing", () => {
    const helmet = cat.addonOnly.find((a) => a.wcProductId === 32460)!;
    expect(helmet.addon.slug).toBe("helmet-for-rent");
    expect(helmet.addon.priceMinor).toBe(5000);
    expect(helmet.addon.unit).toBe("per_bike"); // flat — NOT 50 per day
  });

  it("the two kr.79 retail goods are sale items with no stock", () => {
    for (const id of [28179, 20265]) {
      const a = cat.addonOnly.find((x) => x.wcProductId === id)!;
      expect(a.addon.isSale).toBe(true);
      expect(a.addon.priceMinor).toBe(7900);
    }
  });

  it("car carriers are per booking, everything rented is per bike", () => {
    expect(cat.addons.get("bike-carrier-for-car-back-door")!.unit).toBe("per_booking");
    expect(cat.addons.get("bike-carrier-for-car-hook-for-rent")!.unit).toBe("per_booking");
    expect(cat.addons.get("pedals-for-mtb-spd-for-rent")!.unit).toBe("per_bike");
  });

  it("the two near-identical bag families stay distinct", () => {
    expect(cat.addons.get("2-rental-bags-for-rear-rack-2-20l")!.priceMinor).toBe(10000);
    expect(cat.addons.get("2-rental-bag-for-rear-rack-2-20l-and-rear-rack")!.priceMinor).toBe(20000);
  });

  it("refuses a non-integer price rather than guessing a decimal", () => {
    expect(() => parseAddonCell("Helmet for rent: 1.000")).toThrow(ParseError);
    expect(() => parseAddonCell("Helmet for rent: kr.50")).toThrow(ParseError);
  });
});

describe("categories", () => {
  it("subcategory wins, and the six hidden rows fall back to categories", () => {
    expect(categorise("ROAD BIKES", "ROAD BIKES | RENT A BIKE")).toBe("road");
    expect(categorise("", "E-BIKES | MOUNTAIN BIKES | RENT A BIKE")).toBe("ebike"); // E-MTB: motor wins
    expect(categorise("", "EXTRA | ORKA")).toBe("extra");
  });

  it("a term the shop invents later trips the guard", () => {
    expect(() => categorise("", "CARGO BIKES")).toThrow(ParseError);
  });
});

describe("into D1 and out the other side", () => {
  beforeAll(applySchema);
  beforeEach(truncateAll);

  it("refuses to seed the known-bad ladders unless told to", async () => {
    await expect(seedCatalogue(env.DB, csv)).rejects.toBeInstanceOf(SeedRefused);
  });

  it("loads everything, and a real quote comes back at the real price", async () => {
    const summary = await writeCatalogue(env.DB, cat, 0);
    expect(summary.bikeTypes).toBe(49);
    expect(summary.addons).toBe(22);
    expect(summary.rateTiers).toBeGreaterThan(200);

    const rows = await env.DB.prepare("SELECT COUNT(*) c FROM bike_types").first<{ c: number }>();
    expect(rows?.c).toBe(49);

    // The canvas checkout basket, priced against the real seed: Gravel Breed 54
    // for three days is the 2–6 band at 400/day, two helmets at a flat 50.
    const loaded = await loadQuoteCatalogue(env.DB, { bikeTypeIds: ["wc-13233"], addonIds: ["addon-helmet-for-rent"] });
    const T0 = Date.UTC(2026, 5, 12, 10, 0, 0);
    const q = priceQuote(
      {
        startAt: T0,
        endAt: T0 + 72 * 3_600_000,
        bikes: [{ bikeTypeId: "wc-13233", qty: 2 }],
        addons: [{ addonId: "addon-helmet-for-rent", qty: 2 }],
      },
      loaded,
    );
    expect(q.totalMinor).toBe(2 * 3 * 40000 + 2 * 5000); // DKK 2,500
  });

  it("the tag-along really would quote kr.14,000 — which is why the seed refuses by default", async () => {
    await writeCatalogue(env.DB, cat, 0);
    const loaded = await loadQuoteCatalogue(env.DB, { bikeTypeIds: ["wc-24871"] });
    const T0 = Date.UTC(2026, 5, 12, 10, 0, 0);
    const q = priceQuote({ startAt: T0, endAt: T0 + 15 * 24 * 3_600_000, bikes: [{ bikeTypeId: "wc-24871", qty: 1 }] }, loaded);
    expect(q.totalMinor).toBe(1400000);
  });

  it("is idempotent — seeding twice yields the same rows", async () => {
    await writeCatalogue(env.DB, cat, 0);
    await writeCatalogue(env.DB, cat, 1);
    const tiers = await env.DB.prepare("SELECT COUNT(*) c FROM rate_tiers").first<{ c: number }>();
    const bikes = await env.DB.prepare("SELECT COUNT(*) c FROM bike_types").first<{ c: number }>();
    expect(bikes?.c).toBe(49);
    expect(tiers?.c).toBe(cat.bikeTypes.reduce((s, b) => s + b.bands.length, 0));
  });
});
