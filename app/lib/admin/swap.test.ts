import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applySchema, env, seedBike, truncateAll } from "~/test/db";
import { reserveBooking } from "~/lib/booking/reserve";
import { getBookingById } from "~/lib/booking/lookup";
import type { Quote } from "~/lib/pricing/quote";
import { swapBike, swapCandidates } from "./actions";

const T0 = Date.UTC(2026, 5, 12, 9, 0, 0);
const h = (n: number) => n * 3_600_000;
const START = new Date(T0);
const END = new Date(T0 + h(72));

function bikeQuote(bikeTypeId: string, riderLabel: string): Quote {
  return { days: 3, tierDays: 3, totalMinor: 120000, currency: "DKK", lines: [{ kind: "bike", bikeTypeId, riderLabel, label: bikeTypeId, qty: 1, unitPriceMinor: 40000, lineTotalMinor: 120000 }] };
}

async function tiers(bikeTypeId: string, perDayMinor: number) {
  await env.DB.prepare(`INSERT INTO rate_tiers (id, bike_type_id, min_days, max_days, price_minor, per_day) VALUES (?1, ?2, 1, 365, ?3, 1)`).bind(`tier-${bikeTypeId}`, bikeTypeId, perDayMinor).run();
}

async function book(bikeTypeId: string, name = "Jóhanna") {
  const r = await reserveBooking(env.DB, { quote: bikeQuote(bikeTypeId, "Rider 1"), kind: "rental", startAt: START, endAt: END, customerName: name, customerEmail: "j@example.fo", now: T0 });
  if (!r.ok) throw new Error("fixture booking failed");
  return (await getBookingById(env.DB, r.bookingId))!;
}

beforeAll(applySchema);
beforeEach(async () => {
  await truncateAll();
  await seedBike("cube-m", 1, "Cube M");
  await seedBike("cube-l", 1, "Cube L");
  await seedBike("felt-s", 2, "Felt S");
  await tiers("cube-m", 40000);
  await tiers("cube-l", 40000);
  await tiers("felt-s", 30000);
});

describe("swapping a bike at the counter", () => {
  it("offers only bikes that are free over the booking's own window, priced for it", async () => {
    const mine = await book("cube-m");
    await book("cube-l", "Marek"); // the only Cube L is now taken
    const line = mine.lines.find((l) => l.kind === "bike")!;
    const c = await swapCandidates(env.DB, mine, line.id);
    expect(c.map((x) => x.id)).toEqual(["felt-s"]);
    expect(c[0]!.free).toBe(2);
    expect(c[0]!.tripMinor).toBe(90000); // 3 days × 300
  });

  it("moves the line, re-prices it, and updates the booking total", async () => {
    const mine = await book("cube-m");
    const line = mine.lines.find((l) => l.kind === "bike")!;
    const r = await swapBike(env.DB, mine, line.id, "felt-s", "Berit", T0 + h(1));
    expect(r.ok).toBe(true);
    expect(r.deltaMinor).toBe(-30000);
    const after = (await getBookingById(env.DB, mine.id))!;
    const moved = after.lines.find((l) => l.id === line.id)!;
    expect(moved.bikeTypeId).toBe("felt-s");
    expect(moved.label).toBe("Felt S");
    expect(moved.lineTotalMinor).toBe(90000);
    expect(after.totalMinor).toBe(90000);
    // The Cube M is free again for someone else.
    const again = await reserveBooking(env.DB, { quote: bikeQuote("cube-m", "Rider 1"), kind: "rental", startAt: START, endAt: END, customerName: "Anna", customerEmail: "a@example.fo", now: T0 });
    expect(again.ok).toBe(true);
  });

  it("refuses a bike that went while the counter was looking", async () => {
    const mine = await book("cube-m");
    const line = mine.lines.find((l) => l.kind === "bike")!;
    // Candidates computed, then somebody else takes the last Cube L.
    await book("cube-l", "Marek");
    const r = await swapBike(env.DB, mine, line.id, "cube-l", "Berit");
    expect(r.ok).toBe(false);
    const after = (await getBookingById(env.DB, mine.id))!;
    expect(after.lines.find((l) => l.id === line.id)!.bikeTypeId).toBe("cube-m");
    expect(after.totalMinor).toBe(120000);
  });

  it("will not touch a cancelled booking", async () => {
    const mine = await book("cube-m");
    await env.DB.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?1`).bind(mine.id).run();
    const cancelled = (await getBookingById(env.DB, mine.id))!;
    const r = await swapBike(env.DB, cancelled, cancelled.lines[0]!.id, "felt-s", "Berit");
    expect(r.ok).toBe(false);
  });
});
