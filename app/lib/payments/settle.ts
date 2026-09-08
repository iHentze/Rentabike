/**
 * Money meets bookings. Every path in here is idempotent, because ePay's
 * notification, the customer's return to the site and a staff refresh can
 * all report the same session within the same second.
 *
 *   startCardPayment  held booking → pending payments row + ePay session
 *   settleSession     read the session from ePay; COMPLETED → authorised or
 *                     captured, and the booking held → confirmed. The hold
 *                     may have lapsed meanwhile: then the money goes straight
 *                     back and the customer is told to book again.
 *   captureBooking    at the counter, when the card was only authorised
 *   refundBooking     cancellation — captured money is refunded, an
 *                     authorisation is voided
 */
import { EpayClient, captureMode, epayFor, type EpayEnv } from "./epay";
import { transition, TransitionError } from "~/lib/booking/lifecycle";

export interface SettleEnv extends EpayEnv {
  DB: D1Database;
}

export interface PaymentRow {
  id: string;
  booking_id: string;
  session_id: string | null;
  transaction_id: string | null;
  status: "pending" | "authorized" | "captured" | "failed" | "voided" | "refunded";
  amount_minor: number;
  captured_minor: number;
  refunded_minor: number;
}

export async function startCardPayment(env: SettleEnv, input: { bookingId: string; code: string; amountMinor: number; notificationUrl: string; timeoutMinutes: number }) {
  const epay = epayFor(env);
  if (!epay) throw new Error("ePay is not configured");
  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  const session = await epay.createSession({
    amountMinor: input.amountMinor,
    reference: `${input.code}-${suffix}`,
    notificationUrl: input.notificationUrl,
    instantCapture: captureMode(env) === "instant",
    timeoutMinutes: input.timeoutMinutes,
  });
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO payments (id, booking_id, provider, session_id, status, amount_minor, currency, created_at, updated_at)
       VALUES (?1, ?2, 'epay', ?3, 'pending', ?4, 'DKK', ?5, ?5)`,
    ).bind(crypto.randomUUID(), input.bookingId, session.sessionId, input.amountMinor, now),
    env.DB.prepare(`UPDATE bookings SET payment_method = 'card', updated_at = ?2 WHERE id = ?1`).bind(input.bookingId, now),
  ]);
  return session;
}

export type SettleOutcome =
  | { outcome: "confirmed"; bookingId: string }
  | { outcome: "already"; bookingId: string }
  | { outcome: "pending"; bookingId: string; state: string }
  | { outcome: "failed"; bookingId: string; state: string }
  | { outcome: "lapsed"; bookingId: string }
  | { outcome: "unknown-session" };

/**
 * Read the session from ePay and act on it. `actor` is who asked — "webhook"
 * or "customer" — for the audit row. Safe to call any number of times.
 */
export async function settleSession(env: SettleEnv, sessionId: string, actor: string, now = Date.now()): Promise<SettleOutcome> {
  const epay = epayFor(env);
  if (!epay) throw new Error("ePay is not configured");
  const row = await env.DB.prepare(`SELECT id, booking_id, session_id, transaction_id, status, amount_minor, captured_minor, refunded_minor FROM payments WHERE session_id = ?1`).bind(sessionId).first<PaymentRow>();
  if (!row) return { outcome: "unknown-session" };
  if (row.status !== "pending") return { outcome: "already", bookingId: row.booking_id };

  const status = await epay.getSession(sessionId);
  if (status.state !== "COMPLETED") {
    if (status.state === "EXPIRED" || status.state === "FAILED" || status.state === "CANCELLED") {
      await env.DB.prepare(`UPDATE payments SET status = 'failed', raw_payload = ?2, updated_at = ?3 WHERE id = ?1 AND status = 'pending'`).bind(row.id, JSON.stringify(status.raw), now).run();
      return { outcome: "failed", bookingId: row.booking_id, state: status.state };
    }
    return { outcome: "pending", bookingId: row.booking_id, state: status.state };
  }

  // Paid. Record it exactly once: the event id is unique, and the status guard
  // means a second reader writes zero rows and stops here.
  const instant = captureMode(env) === "instant";
  const paidMinor = status.amountMinor ?? row.amount_minor;
  const rec = await env.DB.prepare(
    `UPDATE payments
        SET status = ?2, transaction_id = ?3, captured_minor = ?4, event_id = ?5, raw_payload = ?6, updated_at = ?7
      WHERE id = ?1 AND status = 'pending'`,
  )
    .bind(row.id, instant ? "captured" : "authorized", status.transactionId, instant ? paidMinor : 0, `${sessionId}:completed`, JSON.stringify(status.raw), now)
    .run();
  if ((rec.meta?.changes ?? 0) !== 1) return { outcome: "already", bookingId: row.booking_id };
  await env.DB.prepare(`UPDATE bookings SET paid_minor = paid_minor + ?2, updated_at = ?3 WHERE id = ?1`).bind(row.booking_id, paidMinor, now).run();

  try {
    await transition(env.DB, { bookingId: row.booking_id, from: "held", to: "confirmed", actor, note: `ePay ${instant ? "captured" : "authorised"} ${paidMinor} øre, session ${sessionId}`, now });
    return { outcome: "confirmed", bookingId: row.booking_id };
  } catch (err) {
    if (!(err instanceof TransitionError) || err.code !== "conflict") throw err;
    const current = await env.DB.prepare(`SELECT status FROM bookings WHERE id = ?1`).bind(row.booking_id).first<{ status: string }>();
    if (current?.status === "confirmed" || current?.status === "picked_up") return { outcome: "already", bookingId: row.booking_id };
    // The hold lapsed while the card was being typed (or someone cancelled). The
    // bikes may be gone, so the money goes back now, with an audit row saying so.
    await releasePayment(env, epay, { ...row, status: instant ? "captured" : "authorized", transaction_id: status.transactionId, captured_minor: instant ? paidMinor : 0 }, "system", `paid after the hold lapsed (booking ${current?.status}) — returned in full`, now);
    return { outcome: "lapsed", bookingId: row.booking_id };
  }
}

/** The counter takes the money on an authorised card. No-op when already captured or paid at the shop. */
export async function captureBooking(env: SettleEnv, bookingId: string, actor: string, now = Date.now()): Promise<{ capturedMinor: number }> {
  const epay = epayFor(env);
  const row = await paymentFor(env, bookingId);
  if (!epay || !row || row.status !== "authorized" || !row.transaction_id) return { capturedMinor: 0 };
  const amount = row.amount_minor - row.captured_minor;
  await epay.capture(row.transaction_id, amount);
  await env.DB.batch([
    env.DB.prepare(`UPDATE payments SET status = 'captured', captured_minor = captured_minor + ?2, updated_at = ?3 WHERE id = ?1`).bind(row.id, amount, now),
    env.DB.prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'payment',?2,'authorized','captured',?3,?4,?5)`).bind(crypto.randomUUID(), row.id, actor, `captured ${amount} øre at pickup`, now),
  ]);
  return { capturedMinor: amount };
}

/**
 * Money back on cancellation. `refundMinor` is what the cancellation rule
 * decided; an authorisation that was never captured is voided whatever the
 * rule says, because there is nothing to keep.
 */
export async function refundBooking(env: SettleEnv, bookingId: string, refundMinor: number, actor: string, note: string, now = Date.now()): Promise<{ refundedMinor: number; voided: boolean }> {
  const epay = epayFor(env);
  const row = await paymentFor(env, bookingId);
  if (!epay || !row || !row.transaction_id) return { refundedMinor: 0, voided: false };
  if (row.status === "authorized") {
    await releasePayment(env, epay, row, actor, note, now);
    return { refundedMinor: 0, voided: true };
  }
  if (row.status !== "captured") return { refundedMinor: 0, voided: false };
  const amount = Math.min(refundMinor, row.captured_minor - row.refunded_minor);
  if (amount <= 0) return { refundedMinor: 0, voided: false };
  await epay.refund(row.transaction_id, amount);
  const full = row.refunded_minor + amount >= row.captured_minor;
  await env.DB.batch([
    env.DB.prepare(`UPDATE payments SET status = ?2, refunded_minor = refunded_minor + ?3, updated_at = ?4 WHERE id = ?1`).bind(row.id, full ? "refunded" : "captured", amount, now),
    env.DB.prepare(`UPDATE bookings SET refunded_minor = refunded_minor + ?2, updated_at = ?3 WHERE id = ?1`).bind(bookingId, amount, now),
    env.DB.prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'payment',?2,'captured',?3,?4,?5,?6)`).bind(crypto.randomUUID(), row.id, full ? "refunded" : "captured", actor, `${note} — refunded ${amount} øre`, now),
  ]);
  return { refundedMinor: amount, voided: false };
}

/** Void an authorisation, or refund a capture in full — whichever the row is in. */
async function releasePayment(env: SettleEnv, epay: EpayClient, row: PaymentRow, actor: string, note: string, now: number): Promise<void> {
  if (!row.transaction_id) return;
  if (row.status === "authorized") {
    await epay.void(row.transaction_id);
    await env.DB.batch([
      env.DB.prepare(`UPDATE payments SET status = 'voided', updated_at = ?2 WHERE id = ?1`).bind(row.id, now),
      env.DB.prepare(`UPDATE bookings SET paid_minor = 0, updated_at = ?2 WHERE id = ?1`).bind(row.booking_id, now),
      env.DB.prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'payment',?2,'authorized','voided',?3,?4,?5)`).bind(crypto.randomUUID(), row.id, actor, note, now),
    ]);
    return;
  }
  const amount = row.captured_minor - row.refunded_minor;
  if (amount <= 0) return;
  await epay.refund(row.transaction_id, amount);
  await env.DB.batch([
    env.DB.prepare(`UPDATE payments SET status = 'refunded', refunded_minor = refunded_minor + ?2, updated_at = ?3 WHERE id = ?1`).bind(row.id, amount, now),
    env.DB.prepare(`UPDATE bookings SET refunded_minor = refunded_minor + ?2, updated_at = ?3 WHERE id = ?1`).bind(row.booking_id, amount, now),
    env.DB.prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'payment',?2,'captured','refunded',?3,?4,?5)`).bind(crypto.randomUUID(), row.id, actor, `${note} — refunded ${amount} øre`, now),
  ]);
}

export async function paymentFor(env: { DB: D1Database }, bookingId: string): Promise<PaymentRow | null> {
  return env.DB.prepare(
    `SELECT id, booking_id, session_id, transaction_id, status, amount_minor, captured_minor, refunded_minor
       FROM payments WHERE booking_id = ?1 AND status IN ('authorized','captured','refunded','pending')
      ORDER BY CASE status WHEN 'pending' THEN 1 ELSE 0 END, created_at DESC LIMIT 1`,
  )
    .bind(bookingId)
    .first<PaymentRow>();
}
