import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applySchema, env, seedBike, truncateAll } from "~/test/db";
import { reserveBooking } from "./reserve";
import { canTransition, isTerminal, transition, TransitionError } from "./lifecycle";
import { sweepExpiredHolds } from "./sweeper";
import { freeCancellationDeadline, refundFor } from "./cancellation";
import type { Quote } from "~/lib/pricing/quote";

const T0 = Date.UTC(2026, 5, 12, 9, 0, 0);
const h = (n: number) => n * 3_600_000;

const quote: Quote = {
  days: 3,
  tierDays: 3,
  totalMinor: 120000,
  currency: "DKK",
  lines: [{ kind: "bike", bikeTypeId: "gravel-54", label: "gravel-54", qty: 1, unitPriceMinor: 40000, lineTotalMinor: 120000 }],
};

const base = {
  kind: "rental" as const,
  startAt: new Date(T0 + h(240)),
  endAt: new Date(T0 + h(312)),
  customerName: "Jóhanna",
  customerEmail: "j@example.fo",
  quote,
  now: T0,
};

async function held() {
  await seedBike("gravel-54", 2);
  const r = await reserveBooking(env.DB, base);
  if (!r.ok) throw new Error("setup failed");
  return r.bookingId;
}

beforeAll(applySchema);
beforeEach(truncateAll);

describe("the state machine — rule C", () => {
  it("permits the happy path and refuses shortcuts", () => {
    expect(canTransition("draft", "held")).toBe(true);
    expect(canTransition("held", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "picked_up")).toBe(true);
    expect(canTransition("picked_up", "returned")).toBe(true);

    expect(canTransition("held", "picked_up")).toBe(false);
    expect(canTransition("draft", "confirmed")).toBe(false);
    expect(canTransition("returned", "cancelled")).toBe(false);
  });

  it("knows which statuses are terminal", () => {
    for (const s of ["returned", "expired", "cancelled", "no_show"] as const) expect(isTerminal(s)).toBe(true);
    for (const s of ["draft", "held", "confirmed", "picked_up"] as const) expect(isTerminal(s)).toBe(false);
  });

  it("moves a real booking and audits it", async () => {
    const id = await held();
    await transition(env.DB, { bookingId: id, from: "held", to: "confirmed", actor: "webhook", now: T0 + 1000 });

    const row = await env.DB.prepare("SELECT status, hold_expires_at FROM bookings WHERE id=?1").bind(id).first<{
      status: string;
      hold_expires_at: number | null;
    }>();
    expect(row?.status).toBe("confirmed");
    // Leaving `held` clears the expiry, so the sweeper cannot touch it later.
    expect(row?.hold_expires_at).toBeNull();

    const audit = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE entity_id=?1 AND to_status='confirmed'",
    )
      .bind(id)
      .first<{ from_status: string; actor: string }>();
    expect(audit?.from_status).toBe("held");
    expect(audit?.actor).toBe("webhook");
  });

  it("rejects an illegal transition without touching the row", async () => {
    const id = await held();
    await expect(
      transition(env.DB, { bookingId: id, from: "held", to: "returned", actor: "staff@rentabike.fo" }),
    ).rejects.toThrow(TransitionError);

    const row = await env.DB.prepare("SELECT status FROM bookings WHERE id=?1").bind(id).first<{ status: string }>();
    expect(row?.status).toBe("held");
  });

  it("only the first of two concurrent movers wins", async () => {
    const id = await held();
    await transition(env.DB, { bookingId: id, from: "held", to: "cancelled", actor: "staff@rentabike.fo" });

    // The second staff member's cancel must fail loudly, not silently no-op.
    await expect(
      transition(env.DB, { bookingId: id, from: "held", to: "cancelled", actor: "other@rentabike.fo" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("a rejected transition writes NO audit row — a log that lies is worse than none", async () => {
    const id = await held();
    await transition(env.DB, { bookingId: id, from: "held", to: "confirmed", actor: "webhook" });
    await expect(
      transition(env.DB, { bookingId: id, from: "held", to: "cancelled", actor: "staff@rentabike.fo" }),
    ).rejects.toThrow();

    const bogus = await env.DB.prepare("SELECT COUNT(*) c FROM audit_log WHERE entity_id=?1 AND to_status='cancelled'")
      .bind(id)
      .first<{ c: number }>();
    expect(bogus?.c).toBe(0);
  });

  it("reports a missing booking distinctly from a conflict", async () => {
    await expect(
      transition(env.DB, { bookingId: "does-not-exist", from: "held", to: "confirmed", actor: "webhook" }),
    ).rejects.toMatchObject({ code: "missing" });
  });
});

describe("the hold sweeper — rule B5, defect 11", () => {
  it("releases an abandoned checkout and its bikes", async () => {
    const id = await held();

    // Before the TTL: untouched.
    let swept = await sweepExpiredHolds(env, T0 + h(0.25));
    expect(swept.released).toBe(0);

    // After 30 minutes: released.
    swept = await sweepExpiredHolds(env, T0 + h(1));
    expect(swept.released).toBe(1);

    const row = await env.DB.prepare("SELECT status FROM bookings WHERE id=?1").bind(id).first<{ status: string }>();
    expect(row?.status).toBe("expired");

    // And the stock is genuinely free again.
    const r2 = await reserveBooking(env.DB, { ...base, now: T0 + h(1) });
    expect(r2.ok).toBe(true);
  });

  it("never touches a confirmed booking", async () => {
    const id = await held();
    await transition(env.DB, { bookingId: id, from: "held", to: "confirmed", actor: "webhook" });
    const swept = await sweepExpiredHolds(env, T0 + h(99));
    expect(swept.released).toBe(0);
  });

  it("is idempotent — a second sweep releases nothing", async () => {
    await held();
    expect((await sweepExpiredHolds(env, T0 + h(1))).released).toBe(1);
    expect((await sweepExpiredHolds(env, T0 + h(1))).released).toBe(0);
  });

  it("audits the release as the sweeper, not as a person", async () => {
    const id = await held();
    await sweepExpiredHolds(env, T0 + h(1));
    const audit = await env.DB.prepare("SELECT actor, to_status FROM audit_log WHERE entity_id=?1 AND to_status='expired'")
      .bind(id)
      .first<{ actor: string }>();
    expect(audit?.actor).toBe("sweeper");
  });

  it("refuses a nonsense TTL rather than sweeping everything", async () => {
    await expect(sweepExpiredHolds({ DB: env.DB, HOLD_TTL_MINUTES: "0" }, T0)).rejects.toThrow();
    await expect(sweepExpiredHolds({ DB: env.DB, HOLD_TTL_MINUTES: "nope" }, T0)).rejects.toThrow();
    await expect(sweepExpiredHolds({ DB: env.DB, HOLD_TTL_MINUTES: "-5" }, T0)).rejects.toThrow();
  });
});

describe("cancellation and refunds — rules D1 and D2", () => {
  const start = T0 + h(240);
  const paid = 255000;

  it("49 h before: full refund", () => {
    expect(refundFor(start, start - h(49), paid, "customer").refundMinor).toBe(paid);
  });

  it("exactly 48 h before: still free — the boundary is inclusive", () => {
    expect(refundFor(start, start - h(48), paid, "customer").refundMinor).toBe(paid);
  });

  it("47 h before: nothing", () => {
    expect(refundFor(start, start - h(47), paid, "customer").refundMinor).toBe(0);
  });

  it("after the booking started: nothing", () => {
    const d = refundFor(start, start + h(2), paid, "customer");
    expect(d.refundMinor).toBe(0);
    expect(d.reason).toMatch(/after the booking started/);
  });

  it("shop-initiated at one hour out: full refund anyway — rule D2", () => {
    const d = refundFor(start, start - h(1), paid, "shop");
    expect(d.refundMinor).toBe(paid);
    expect(d.fraction).toBe(1);
  });

  it("shop-initiated after the start: still a full refund", () => {
    expect(refundFor(start, start + h(3), paid, "shop").refundMinor).toBe(paid);
  });

  it("the deadline shown to the customer is 48 h before the start", () => {
    expect(freeCancellationDeadline(start).getTime()).toBe(start - h(48));
  });

  it("refuses a nonsense paid amount", () => {
    expect(() => refundFor(start, T0, -1, "customer")).toThrow(RangeError);
    expect(() => refundFor(start, T0, 12.5, "customer")).toThrow(RangeError);
  });
});
