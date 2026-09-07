import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applySchema, env, seedBike, seedTour, truncateAll } from "~/test/db";
import { availableUnits, reserveBooking } from "./reserve";
import type { Quote } from "~/lib/pricing/quote";

const T0 = Date.UTC(2026, 5, 12, 9, 0, 0);
const h = (n: number) => n * 3_600_000;
const START = new Date(T0);
const END = new Date(T0 + h(72));

function bikeQuote(bikeTypeId: string, qty: number, riderLabel?: string): Quote {
  return {
    days: 3,
    tierDays: 3,
    totalMinor: 120000 * qty,
    currency: "DKK",
    lines: [
      {
        kind: "bike",
        bikeTypeId,
        riderLabel,
        label: bikeTypeId,
        qty,
        unitPriceMinor: 40000,
        lineTotalMinor: 120000 * qty,
      },
    ],
  };
}

const base = {
  kind: "rental" as const,
  startAt: START,
  endAt: END,
  customerName: "Jóhanna",
  customerEmail: "j@example.fo",
  now: T0,
};

beforeAll(applySchema);
beforeEach(truncateAll);

describe("the conditional-insert guard — rules B1, B6", () => {
  it("takes a booking when stock allows", async () => {
    await seedBike("gravel-54", 3);
    const r = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 2) });
    expect(r.ok).toBe(true);
    expect(await availableUnits(env.DB, "gravel-54", START, END)).toBe(1);
  });

  it("refuses when the request exceeds stock, and writes nothing", async () => {
    await seedBike("gravel-54", 1);
    const r = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 2) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("sold_out");

    const bookings = await env.DB.prepare("SELECT COUNT(*) c FROM bookings").first<{ c: number }>();
    const lines = await env.DB.prepare("SELECT COUNT(*) c FROM booking_lines").first<{ c: number }>();
    expect(bookings?.c).toBe(0);
    expect(lines?.c).toBe(0);
    expect(await availableUnits(env.DB, "gravel-54", START, END)).toBe(1);
  });

  it("N+1 sequential reservations against stock N: exactly N succeed", async () => {
    await seedBike("gravel-54", 3);
    const outcomes = [];
    for (let i = 0; i < 4; i++) {
      outcomes.push(await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) }));
    }
    expect(outcomes.filter((o) => o.ok)).toHaveLength(3);
    expect(outcomes.filter((o) => !o.ok)).toHaveLength(1);
    expect(await availableUnits(env.DB, "gravel-54", START, END)).toBe(0);
  });

  it("never oversells under concurrency — 6 simultaneous requests, stock 3", async () => {
    await seedBike("gravel-54", 3);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) })),
    );
    const taken = results.filter((r) => r.ok).length;
    expect(taken).toBeLessThanOrEqual(3);

    // The invariant that actually matters: committed lines never exceed stock.
    const sum = await env.DB.prepare(
      `SELECT COALESCE(SUM(bl.qty),0) q FROM booking_lines bl
         JOIN bookings b ON b.id = bl.booking_id
        WHERE bl.kind='bike' AND b.status IN ('held','confirmed','picked_up')`,
    ).first<{ q: number }>();
    expect(sum?.q).toBeLessThanOrEqual(3);
  });
});

describe("overlap is half-open [start, end) — rule B3", () => {
  it("a bike returned at 14:00 is rentable at 14:00", async () => {
    await seedBike("gravel-54", 1);
    const first = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) });
    expect(first.ok).toBe(true);

    const second = await reserveBooking(env.DB, {
      ...base,
      startAt: END, // exactly when the first ends
      endAt: new Date(END.getTime() + h(24)),
      quote: bikeQuote("gravel-54", 1),
    });
    expect(second.ok).toBe(true);
  });

  it("but one minute of overlap is refused", async () => {
    await seedBike("gravel-54", 1);
    await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) });
    const overlapping = await reserveBooking(env.DB, {
      ...base,
      startAt: new Date(END.getTime() - 60_000),
      endAt: new Date(END.getTime() + h(24)),
      quote: bikeQuote("gravel-54", 1),
    });
    expect(overlapping.ok).toBe(false);
  });
});

describe("only inventory-holding statuses consume stock — rule C", () => {
  it("a cancelled booking releases its bikes", async () => {
    await seedBike("gravel-54", 1);
    const r = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) });
    expect(r.ok).toBe(true);
    expect(await availableUnits(env.DB, "gravel-54", START, END)).toBe(0);

    if (r.ok) await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=?1").bind(r.bookingId).run();
    expect(await availableUnits(env.DB, "gravel-54", START, END)).toBe(1);

    const after = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) });
    expect(after.ok).toBe(true);
  });
});

describe("ONE FLEET — defect 10, the regression test that matters most", () => {
  it("a tour that takes the whole fleet leaves nothing to rent", async () => {
    await seedBike("gravel-54", 3);
    await seedTour("tour-1", "dep-1", 8, START.getTime(), END.getTime());

    // A tour booking is an ordinary booking: a tour_seat line plus N bike lines.
    const tourQuote: Quote = {
      days: 1,
      tierDays: 1,
      totalMinor: 282000,
      currency: "DKK",
      lines: [
        { kind: "tour_seat", label: "Viewpoint Norðadalsskarð × 3", qty: 3, unitPriceMinor: 94000, lineTotalMinor: 282000 },
        { kind: "bike", bikeTypeId: "gravel-54", label: "Gravel 54", qty: 3, unitPriceMinor: 0, lineTotalMinor: 0 },
      ],
    };

    const tour = await reserveBooking(env.DB, {
      ...base,
      kind: "tour",
      tourDepartureId: "dep-1",
      seats: 3,
      quote: tourQuote,
    });
    expect(tour.ok).toBe(true);

    // In the old system this rental succeeded, because tour_participants was a
    // table no availability query had ever joined. Here it must be refused.
    const rental = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) });
    expect(rental.ok).toBe(false);
    if (!rental.ok) expect(rental.unavailable).toContain("gravel-54");

    const dep = await env.DB.prepare("SELECT seats_taken FROM tour_departures WHERE id='dep-1'").first<{
      seats_taken: number;
    }>();
    expect(dep?.seats_taken).toBe(3);
  });

  it("a seat is never sold without its bike: if the bikes are gone, the seats are not taken", async () => {
    await seedBike("gravel-54", 1);
    await seedTour("tour-1", "dep-1", 8, START.getTime(), END.getTime());
    await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) }); // takes the only bike

    const tourQuote: Quote = {
      days: 1,
      tierDays: 1,
      totalMinor: 188000,
      currency: "DKK",
      lines: [
        { kind: "tour_seat", label: "Tour × 2", qty: 2, unitPriceMinor: 94000, lineTotalMinor: 188000 },
        { kind: "bike", bikeTypeId: "gravel-54", label: "Gravel 54", qty: 2, unitPriceMinor: 0, lineTotalMinor: 0 },
      ],
    };
    const tour = await reserveBooking(env.DB, {
      ...base,
      kind: "tour",
      tourDepartureId: "dep-1",
      seats: 2,
      quote: tourQuote,
    });
    expect(tour.ok).toBe(false);

    const dep = await env.DB.prepare("SELECT seats_taken FROM tour_departures WHERE id='dep-1'").first<{
      seats_taken: number;
    }>();
    expect(dep?.seats_taken).toBe(0);
  });
});

describe("tour seats — defect 8", () => {
  it("refuses to exceed departure capacity", async () => {
    await seedBike("gravel-54", 99);
    await seedTour("tour-1", "dep-1", 2, START.getTime(), END.getTime());

    const seatQuote = (n: number): Quote => ({
      days: 1,
      tierDays: 1,
      totalMinor: 94000 * n,
      currency: "DKK",
      lines: [{ kind: "tour_seat", label: `Tour × ${n}`, qty: n, unitPriceMinor: 94000, lineTotalMinor: 94000 * n }],
    });

    const a = await reserveBooking(env.DB, { ...base, kind: "tour", tourDepartureId: "dep-1", seats: 2, quote: seatQuote(2) });
    expect(a.ok).toBe(true);
    const b = await reserveBooking(env.DB, { ...base, kind: "tour", tourDepartureId: "dep-1", seats: 1, quote: seatQuote(1) });
    expect(b.ok).toBe(false);
  });

  it("refuses a departure that is not open", async () => {
    await seedTour("tour-1", "dep-1", 8, START.getTime(), END.getTime());
    await env.DB.prepare("UPDATE tour_departures SET status='cancelled' WHERE id='dep-1'").run();
    const q: Quote = {
      days: 1,
      tierDays: 1,
      totalMinor: 94000,
      currency: "DKK",
      lines: [{ kind: "tour_seat", label: "Tour", qty: 1, unitPriceMinor: 94000, lineTotalMinor: 94000 }],
    };
    const r = await reserveBooking(env.DB, { ...base, kind: "tour", tourDepartureId: "dep-1", seats: 1, quote: q });
    expect(r.ok).toBe(false);
  });
});

describe("the booking row", () => {
  it("records the server-computed total and a hold expiry", async () => {
    await seedBike("gravel-54", 2);
    const r = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1), holdTtlMinutes: 30 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const row = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(r.bookingId).first<{
      status: string;
      total_minor: number;
      hold_expires_at: number;
      code: string;
    }>();
    expect(row?.status).toBe("held");
    expect(row?.total_minor).toBe(120000);
    expect(row?.hold_expires_at).toBe(T0 + 30 * 60_000);
    expect(row?.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("writes an audit row for the transition", async () => {
    await seedBike("gravel-54", 2);
    const r = await reserveBooking(env.DB, { ...base, quote: bikeQuote("gravel-54", 1) });
    expect(r.ok).toBe(true);
    const audit = await env.DB.prepare("SELECT * FROM audit_log WHERE entity='booking'").first<{
      to_status: string;
      actor: string;
    }>();
    expect(audit?.to_status).toBe("held");
    expect(audit?.actor).toBe("customer");
  });
});
