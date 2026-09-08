import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applySchema, env, seedBike, truncateAll } from "~/test/db";
import { reserveBooking } from "~/lib/booking/reserve";
import { sweepExpiredHolds } from "~/lib/booking/sweeper";
import type { Quote } from "~/lib/pricing/quote";
import { EpayClient, parseSession, sessionIdFromNotification } from "./epay";
import { captureBooking, refundBooking, settleSession, startCardPayment } from "./settle";

const T0 = Date.UTC(2026, 5, 12, 9, 0, 0);
const h = (n: number) => n * 3_600_000;

/** A stand-in for payments.epay.eu: sessions in memory, every call recorded. */
function fakeEpay(opts: { state?: string } = {}) {
  const sessions = new Map<string, { state: string; amount: number; reference: string }>();
  const calls: string[] = [];
  let n = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url).pathname.replace(/^\/v1/, "");
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    if (method === "POST" && path === "/cit") {
      const body = JSON.parse(String(init?.body));
      const id = `sess-${++n}`;
      sessions.set(id, { state: opts.state ?? "CREATED", amount: body.amount, reference: body.reference });
      return Response.json({ session: { id }, key: `key-${id}`, javascript: "https://fake/epay.js", paymentWindowUrl: `https://fake/pay/${id}` });
    }
    const m = /^\/sessions\/(.+)$/.exec(path);
    if (m && method === "GET") {
      const s = sessions.get(m[1]!);
      if (!s) return new Response("not found", { status: 404 });
      return Response.json({ session: { id: m[1], state: s.state, reference: s.reference }, transaction: s.state === "COMPLETED" ? { id: `tx-${m[1]}`, amount: s.amount } : undefined });
    }
    if (/^\/transactions\/[^/]+\/(capture|refund|void)$/.test(path) && method === "POST") return Response.json({ ok: true });
    return new Response("nope", { status: 404 });
  };
  return {
    fetchImpl,
    calls,
    complete: (id: string) => sessions.get(id) && (sessions.get(id)!.state = "COMPLETED"),
    expire: (id: string) => sessions.get(id) && (sessions.get(id)!.state = "EXPIRED"),
  };
}

function envWith(fake: ReturnType<typeof fakeEpay>, capture: "instant" | "pickup" = "instant") {
  return { DB: env.DB, EPAY_API_KEY: "test", EPAY_POS_ID: "pos", EPAY_BASE_URL: "https://fake/v1", EPAY_CAPTURE: capture, EPAY_FETCH: fake.fetchImpl };
}

function quote(): Quote {
  return { days: 3, tierDays: 3, totalMinor: 120000, currency: "DKK", lines: [{ kind: "bike", bikeTypeId: "gravel-m", riderLabel: "Anna", label: "Gravel M", qty: 1, unitPriceMinor: 40000, lineTotalMinor: 120000 }] };
}

async function heldBooking() {
  const r = await reserveBooking(env.DB, { quote: quote(), kind: "rental", startAt: new Date(T0), endAt: new Date(T0 + h(72)), customerName: "Anna", customerEmail: "a@example.fo", now: T0 });
  if (!r.ok) throw new Error("reserve failed");
  return r;
}

async function status(id: string) {
  return (await env.DB.prepare(`SELECT status, paid_minor, refunded_minor, payment_method FROM bookings WHERE id = ?1`).bind(id).first<{ status: string; paid_minor: number; refunded_minor: number; payment_method: string }>())!;
}

beforeAll(applySchema);
beforeEach(async () => {
  await truncateAll();
  await seedBike("gravel-m", 2, "Gravel M");
});

describe("EpayClient", () => {
  it("creates a session and reads it back", async () => {
    const fake = fakeEpay();
    const c = new EpayClient({ apiKey: "k", pointOfSaleId: "pos", baseUrl: "https://fake/v1", fetch: fake.fetchImpl });
    const s = await c.createSession({ amountMinor: 45000, reference: "ABC123-X", notificationUrl: "https://x/hook", instantCapture: true, timeoutMinutes: 20 });
    expect(s.sessionId).toBe("sess-1");
    expect((await c.getSession("sess-1")).state).toBe("CREATED");
    expect(fake.calls).toEqual(["POST /cit", "GET /sessions/sess-1"]);
  });
  it("refuses a zero or fractional amount", async () => {
    const c = new EpayClient({ apiKey: "k", pointOfSaleId: "pos", baseUrl: "https://fake/v1", fetch: fakeEpay().fetchImpl });
    await expect(c.createSession({ amountMinor: 0, reference: "A", notificationUrl: "u", instantCapture: true, timeoutMinutes: 5 })).rejects.toThrow(/positive integer/);
    await expect(c.createSession({ amountMinor: 10.5, reference: "A", notificationUrl: "u", instantCapture: true, timeoutMinutes: 5 })).rejects.toThrow(/positive integer/);
  });
  it("parses either shape of session document, and only the id from a notification", () => {
    expect(parseSession({ session: { id: "s", state: "completed" }, transaction: { id: "t", amount: 100 } })).toMatchObject({ state: "COMPLETED", transactionId: "t", amountMinor: 100 });
    expect(parseSession({ id: "s", state: "EXPIRED" })).toMatchObject({ state: "EXPIRED", transactionId: null });
    expect(sessionIdFromNotification({ session: { id: "abc", state: "COMPLETED" }, transaction: { id: "evil" } })).toBe("abc");
    expect(sessionIdFromNotification({ sessionId: "abc" })).toBe("abc");
    expect(sessionIdFromNotification("abc")).toBeNull();
    expect(sessionIdFromNotification({ session: { id: "" } })).toBeNull();
  });
});

describe("settleSession", () => {
  it("does nothing while the session is open, confirms once it completes, and is a no-op on replay", async () => {
    const fake = fakeEpay();
    const e = envWith(fake);
    const b = await heldBooking();
    const s = await startCardPayment(e, { bookingId: b.bookingId, code: b.code, amountMinor: 120000, notificationUrl: "https://x/hook", timeoutMinutes: 20 });
    expect((await status(b.bookingId)).payment_method).toBe("card");

    expect((await settleSession(e, s.sessionId, "webhook", T0 + h(0.1))).outcome).toBe("pending");
    expect((await status(b.bookingId)).status).toBe("held");

    fake.complete(s.sessionId);
    const first = await settleSession(e, s.sessionId, "webhook", T0 + h(0.2));
    expect(first.outcome).toBe("confirmed");
    const after = await status(b.bookingId);
    expect(after.status).toBe("confirmed");
    expect(after.paid_minor).toBe(120000);

    // The customer's page and a retried notification both arrive after the fact.
    expect((await settleSession(e, s.sessionId, "customer", T0 + h(0.3))).outcome).toBe("already");
    expect((await settleSession(e, s.sessionId, "webhook", T0 + h(0.4))).outcome).toBe("already");
    expect((await status(b.bookingId)).paid_minor).toBe(120000);
    const audit = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ?1 AND to_status = 'confirmed'`).bind(b.bookingId).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("a forged notification for an unknown session does nothing", async () => {
    const e = envWith(fakeEpay());
    expect((await settleSession(e, "sess-does-not-exist", "webhook")).outcome).toBe("unknown-session");
  });

  it("an expired session marks the payment failed and leaves the hold alone", async () => {
    const fake = fakeEpay();
    const e = envWith(fake);
    const b = await heldBooking();
    const s = await startCardPayment(e, { bookingId: b.bookingId, code: b.code, amountMinor: 120000, notificationUrl: "u", timeoutMinutes: 20 });
    fake.expire(s.sessionId);
    expect((await settleSession(e, s.sessionId, "customer")).outcome).toBe("failed");
    expect((await status(b.bookingId)).status).toBe("held");
    const p = await env.DB.prepare(`SELECT status FROM payments WHERE session_id = ?1`).bind(s.sessionId).first<{ status: string }>();
    expect(p?.status).toBe("failed");
  });

  it("money that arrives after the sweeper released the hold goes straight back", async () => {
    const fake = fakeEpay();
    const e = envWith(fake);
    const b = await heldBooking();
    const s = await startCardPayment(e, { bookingId: b.bookingId, code: b.code, amountMinor: 120000, notificationUrl: "u", timeoutMinutes: 20 });
    await sweepExpiredHolds({ DB: env.DB, HOLD_TTL_MINUTES: "30" }, T0 + h(1));
    expect((await status(b.bookingId)).status).toBe("expired");
    fake.complete(s.sessionId);
    expect((await settleSession(e, s.sessionId, "webhook", T0 + h(1.1))).outcome).toBe("lapsed");
    expect(fake.calls.at(-1)).toBe(`POST /transactions/tx-${s.sessionId}/refund`);
    const after = await status(b.bookingId);
    expect(after.status).toBe("expired");
    expect(after.refunded_minor).toBe(120000);
  });

  it("in pickup mode the card is authorised at booking, captured at the counter, and voided if cancelled before", async () => {
    const fake = fakeEpay();
    const e = envWith(fake, "pickup");
    const b = await heldBooking();
    const s = await startCardPayment(e, { bookingId: b.bookingId, code: b.code, amountMinor: 120000, notificationUrl: "u", timeoutMinutes: 20 });
    fake.complete(s.sessionId);
    expect((await settleSession(e, s.sessionId, "webhook")).outcome).toBe("confirmed");
    let p = await env.DB.prepare(`SELECT status, captured_minor FROM payments WHERE session_id = ?1`).bind(s.sessionId).first<{ status: string; captured_minor: number }>();
    expect(p).toMatchObject({ status: "authorized", captured_minor: 0 });

    expect((await captureBooking(e, b.bookingId, "berit")).capturedMinor).toBe(120000);
    p = await env.DB.prepare(`SELECT status, captured_minor FROM payments WHERE session_id = ?1`).bind(s.sessionId).first<{ status: string; captured_minor: number }>();
    expect(p).toMatchObject({ status: "captured", captured_minor: 120000 });
    // capturing twice is a no-op
    expect((await captureBooking(e, b.bookingId, "berit")).capturedMinor).toBe(0);

    // a second booking, authorised then cancelled: void, not refund
    const b2 = await heldBooking();
    const s2 = await startCardPayment(e, { bookingId: b2.bookingId, code: b2.code, amountMinor: 120000, notificationUrl: "u", timeoutMinutes: 20 });
    fake.complete(s2.sessionId);
    await settleSession(e, s2.sessionId, "webhook");
    const r = await refundBooking(e, b2.bookingId, 0, "berit", "shop cancellation");
    expect(r.voided).toBe(true);
    expect(fake.calls.at(-1)).toBe(`POST /transactions/tx-${s2.sessionId}/void`);
    expect((await status(b2.bookingId)).paid_minor).toBe(0);
  });

  it("refunds what the rule allows and no more than was captured", async () => {
    const fake = fakeEpay();
    const e = envWith(fake);
    const b = await heldBooking();
    const s = await startCardPayment(e, { bookingId: b.bookingId, code: b.code, amountMinor: 120000, notificationUrl: "u", timeoutMinutes: 20 });
    fake.complete(s.sessionId);
    await settleSession(e, s.sessionId, "webhook");
    expect((await refundBooking(e, b.bookingId, 0, "customer", "inside the window")).refundedMinor).toBe(0);
    expect((await refundBooking(e, b.bookingId, 999999, "berit", "shop cancellation")).refundedMinor).toBe(120000);
    expect((await status(b.bookingId)).refunded_minor).toBe(120000);
    expect((await refundBooking(e, b.bookingId, 120000, "berit", "again")).refundedMinor).toBe(0);
  });
});
