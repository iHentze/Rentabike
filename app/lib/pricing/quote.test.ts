import { describe, expect, it } from "vitest";
import { priceQuote, selectTier, QuoteError, type QuoteCatalogue, type QuoteTier } from "./quote";

const h = (n: number) => n * 3_600_000;
const T0 = Date.UTC(2026, 5, 12, 10, 0, 0);
const days = (n: number) => ({ startAt: T0, endAt: T0 + h(24 * n) });

/** The real ladder carried by most bikes in the export. */
const STANDARD: QuoteTier[] = [
  { minDays: 1, maxDays: 1, priceMinor: 45000, perDay: true },
  { minDays: 2, maxDays: 6, priceMinor: 40000, perDay: true },
  { minDays: 7, maxDays: 13, priceMinor: 35000, perDay: true },
  { minDays: 14, maxDays: 20, priceMinor: 30000, perDay: true },
  { minDays: 21, maxDays: 27, priceMinor: 25000, perDay: true },
  { minDays: 28, maxDays: 60, priceMinor: 20000, perDay: true },
];

/** Mountain bikes sit a band lower. */
const MTB: QuoteTier[] = [
  { minDays: 1, maxDays: 1, priceMinor: 35000, perDay: true },
  { minDays: 2, maxDays: 6, priceMinor: 30000, perDay: true },
];

/** An Extra item: the band price is a TOTAL for the period, and ascends. */
const TRAILER: QuoteTier[] = [
  { minDays: 1, maxDays: 6, priceMinor: 20000, perDay: false },
  { minDays: 7, maxDays: 13, priceMinor: 30000, perDay: false },
];

function catalogue(): QuoteCatalogue {
  return {
    bikeTypes: new Map([
      ["gravel-54", { id: "gravel-54", name: "Gravel size 54cm", tiers: STANDARD }],
      ["mtb-17", { id: "mtb-17", name: 'Mountain Bike size 17"', tiers: MTB }],
      ["trailer", { id: "trailer", name: "Tag-along bike", tiers: TRAILER }],
      ["untiered", { id: "untiered", name: "Misconfigured", tiers: [] }],
    ]),
    addons: new Map([
      ["helmet", { id: "helmet", name: "Helmet for rent", unit: "per_bike" as const, priceMinor: 5000 }],
      ["pedals", { id: "pedals", name: "Pedals (SPD)", unit: "per_bike" as const, priceMinor: 10000 }],
      ["storage", { id: "storage", name: "Bag storage", unit: "per_booking" as const, priceMinor: 10000 }],
      ["gps", { id: "gps", name: "GPS", unit: "per_bike_per_day" as const, priceMinor: 10000 }],
    ]),
    locations: new Map([
      ["shop", { id: "shop", name: "Sverrisgøta 20", pickupFeeMinor: 0, dropoffFeeMinor: 0 }],
      ["campsite", { id: "campsite", name: "Við Gjónna", pickupFeeMinor: 15000, dropoffFeeMinor: 15000 }],
    ]),
  };
}

describe("selectTier — rule A2/A3", () => {
  it("picks the band containing the whole-day ceiling", () => {
    expect(selectTier(STANDARD, 1).priceMinor).toBe(45000);
    expect(selectTier(STANDARD, 3).priceMinor).toBe(40000);
    expect(selectTier(STANDARD, 8).priceMinor).toBe(35000);
    expect(selectTier(STANDARD, 30).priceMinor).toBe(20000);
  });

  it("clamps past the last band rather than throwing — 90 days must not crash checkout", () => {
    expect(selectTier(STANDARD, 90).priceMinor).toBe(20000);
  });

  it("throws when a bike has no ladder at all", () => {
    expect(() => selectTier([], 1)).toThrow(QuoteError);
  });
});

describe("the real rate card, row by row", () => {
  const cat = catalogue();
  const one = (n: number, id = "gravel-54") =>
    priceQuote({ ...days(n), bikes: [{ bikeTypeId: id, qty: 1 }] }, cat).totalMinor;

  it("1 day = 450", () => expect(one(1)).toBe(45000));
  it("3 days = 1,200 (flat at the 2–6 band, not graduated)", () => expect(one(3)).toBe(120000));
  it("8 days = 2,800", () => expect(one(8)).toBe(280000));
  it("30 days = 6,000", () => expect(one(30)).toBe(600000));
  it("mountain bikes sit a band lower: 3 days = 900", () => expect(one(3, "mtb-17")).toBe(90000));
});

describe("half days — rules A1/A2/A4", () => {
  const cat = catalogue();

  it("28 h bills 1.5 days at the 2–6 band: 600, and stays monotonic against 1 d and 2 d", () => {
    const q = priceQuote({ startAt: T0, endAt: T0 + h(28), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }] }, cat);
    expect(q.days).toBe(1.5);
    expect(q.tierDays).toBe(2);
    expect(q.totalMinor).toBe(60000);

    const oneDay = priceQuote({ ...days(1), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }] }, cat).totalMinor;
    const twoDay = priceQuote({ ...days(2), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }] }, cat).totalMinor;
    expect(oneDay).toBeLessThan(q.totalMinor);
    expect(q.totalMinor).toBeLessThan(twoDay);
  });
});

describe("add-ons — rule A5", () => {
  const cat = catalogue();

  it("a helmet is 50 flat per bike, NOT multiplied by days", () => {
    const q = priceQuote(
      { ...days(3), bikes: [{ bikeTypeId: "gravel-54", qty: 2 }], addons: [{ addonId: "helmet", qty: 2 }] },
      cat,
    );
    const helmet = q.lines.find((l) => l.addonId === "helmet")!;
    expect(helmet.lineTotalMinor).toBe(10000); // 2 × 50, not 2 × 50 × 3
  });

  it("a per_booking add-on is charged once regardless of quantity", () => {
    const q = priceQuote(
      { ...days(3), bikes: [{ bikeTypeId: "gravel-54", qty: 2 }], addons: [{ addonId: "storage", qty: 5 }] },
      cat,
    );
    expect(q.lines.find((l) => l.addonId === "storage")!.lineTotalMinor).toBe(10000);
  });

  it("a per_bike_per_day add-on does scale with days", () => {
    const q = priceQuote(
      { ...days(3), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }], addons: [{ addonId: "gps", qty: 1 }] },
      cat,
    );
    expect(q.lines.find((l) => l.addonId === "gps")!.lineTotalMinor).toBe(30000);
  });
});

describe("Extra items price as a period total, not per day", () => {
  it("a trailer for 3 days is 200 total — the ladder ascends and must not be × days", () => {
    const q = priceQuote({ ...days(3), bikes: [{ bikeTypeId: "trailer", qty: 1 }] }, catalogue());
    expect(q.totalMinor).toBe(20000);
  });

  it("the same trailer for 8 days is 300, not cheaper", () => {
    const q = priceQuote({ ...days(8), bikes: [{ bikeTypeId: "trailer", qty: 1 }] }, catalogue());
    expect(q.totalMinor).toBe(30000);
  });
});

describe("location fees — rule A6, defect 6", () => {
  const cat = catalogue();

  it("a non-default drop-off produces a fee line AND is inside the total", () => {
    const q = priceQuote(
      {
        ...days(3),
        bikes: [{ bikeTypeId: "gravel-54", qty: 2 }],
        pickupLocationId: "shop",
        dropoffLocationId: "campsite",
      },
      cat,
    );
    const fee = q.lines.find((l) => l.kind === "fee");
    expect(fee).toBeDefined();
    expect(fee!.lineTotalMinor).toBe(15000);
    // The leak was: shown to the customer, never summed. The total is the sum
    // of the lines, so a total that omits a shown fee cannot be constructed.
    expect(q.totalMinor).toBe(q.lines.reduce((s, l) => s + l.lineTotalMinor, 0));
  });

  it("returning to the pickup location is not a drop-off and costs nothing", () => {
    const q = priceQuote(
      { ...days(3), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }], pickupLocationId: "campsite", dropoffLocationId: "campsite" },
      cat,
    );
    expect(q.lines.filter((l) => l.kind === "fee")).toHaveLength(1); // pickup only
  });

  it("the canonical basket from the design: 2 bikes × 3 days × 400 + drop-off 150 = 2,550", () => {
    const q = priceQuote(
      {
        ...days(3),
        bikes: [{ bikeTypeId: "gravel-54", qty: 2 }],
        pickupLocationId: "shop",
        dropoffLocationId: "campsite",
      },
      cat,
    );
    expect(q.totalMinor).toBe(255000);
  });
});

describe("the total is always the sum of the lines", () => {
  it("holds across a mixed basket", () => {
    const q = priceQuote(
      {
        ...days(5),
        bikes: [
          { bikeTypeId: "gravel-54", qty: 2, riderLabel: "Rider 1" },
          { bikeTypeId: "mtb-17", qty: 1, riderLabel: "Rider 2" },
        ],
        addons: [
          { addonId: "helmet", qty: 3 },
          { addonId: "pedals", qty: 1 },
        ],
        pickupLocationId: "shop",
        dropoffLocationId: "campsite",
      },
      catalogue(),
    );
    expect(q.totalMinor).toBe(q.lines.reduce((s, l) => s + l.lineTotalMinor, 0));
    expect(Number.isInteger(q.totalMinor)).toBe(true);
  });
});

describe("rejects nonsense rather than pricing it", () => {
  const cat = catalogue();
  it("no bikes", () => {
    expect(() => priceQuote({ ...days(1), bikes: [] }, cat)).toThrow(QuoteError);
  });
  it("unknown bike", () => {
    expect(() => priceQuote({ ...days(1), bikes: [{ bikeTypeId: "nope", qty: 1 }] }, cat)).toThrow(QuoteError);
  });
  it("unknown addon", () => {
    expect(() =>
      priceQuote({ ...days(1), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }], addons: [{ addonId: "nope", qty: 1 }] }, cat),
    ).toThrow(QuoteError);
  });
  it("unknown location", () => {
    expect(() =>
      priceQuote({ ...days(1), bikes: [{ bikeTypeId: "gravel-54", qty: 1 }], dropoffLocationId: "nope" }, cat),
    ).toThrow(QuoteError);
  });
  it("zero or fractional quantity", () => {
    expect(() => priceQuote({ ...days(1), bikes: [{ bikeTypeId: "gravel-54", qty: 0 }] }, cat)).toThrow(QuoteError);
    expect(() => priceQuote({ ...days(1), bikes: [{ bikeTypeId: "gravel-54", qty: 1.5 }] }, cat)).toThrow(QuoteError);
  });
  it("a bike with no configured ladder", () => {
    expect(() => priceQuote({ ...days(1), bikes: [{ bikeTypeId: "untiered", qty: 1 }] }, cat)).toThrow(QuoteError);
  });
});

describe("add-ons that belong to a rider", () => {
  it("carry the rider's label on their line, so the booking knows whose helmet is whose", () => {
    const cat = catalogue();
    const helmet = [...cat.addons.keys()][0]!;
    const q = priceQuote(
      { startAt: T0, endAt: T0 + h(24), bikes: [], addons: [{ addonId: helmet, qty: 1, riderLabel: "Jóhanna" }, { addonId: helmet, qty: 1, riderLabel: "Marek" }, { addonId: helmet, qty: 1 }] },
      cat,
    );
    const lines = q.lines.filter((l) => l.kind === "addon");
    expect(lines.map((l) => l.riderLabel)).toEqual(["Jóhanna", "Marek", undefined]);
    expect(q.totalMinor).toBe(lines.reduce((n, l) => n + l.lineTotalMinor, 0));
  });
});
