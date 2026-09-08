/**
 * What staff can do to a booking, each a lifecycle transition plus whatever
 * money and mail it implies. The today board and the booking page both post
 * here, so a pickup at the counter behaves the same from either screen.
 */
import type { BookingStatus } from "~/db/schema";
import type { BookingView } from "~/lib/booking/lookup";
import { transition, TransitionError } from "~/lib/booking/lifecycle";
import { refundFor } from "~/lib/booking/cancellation";
import { captureBooking, refundBooking, type SettleEnv } from "~/lib/payments/settle";
import { sendCancellation } from "~/lib/email/send";
import type { MailerEnv } from "~/lib/email/mailer";

export type StaffIntent = "pickup" | "return" | "no_show" | "cancel" | "confirm" | "notes" | "capture";

export interface StaffActionEnv extends SettleEnv, MailerEnv {}

export interface StaffActionResult {
  ok: boolean;
  message: string;
}

export async function staffAction(
  env: StaffActionEnv,
  ctx: ExecutionContext,
  booking: BookingView,
  intent: StaffIntent,
  staff: string,
  opts: { reason?: string; notes?: string; origin: string },
  now = Date.now(),
): Promise<StaffActionResult> {
  const from = booking.status as BookingStatus;
  try {
    switch (intent) {
      case "pickup": {
        await transition(env.DB, { bookingId: booking.id, from, to: "picked_up", actor: staff, note: "collected at the counter", now });
        const cap = await captureBooking(env, booking.id, staff, now).catch((err) => {
          console.error(`capture failed for ${booking.code}:`, err);
          return { capturedMinor: -1 };
        });
        if (cap.capturedMinor > 0) return { ok: true, message: `${booking.code} is out. Card captured.` };
        if (cap.capturedMinor < 0) return { ok: true, message: `${booking.code} is out, but the card capture failed — take payment at the counter and check ePay.` };
        return { ok: true, message: `${booking.code} is out.` };
      }
      case "return":
        await transition(env.DB, { bookingId: booking.id, from, to: "returned", actor: staff, note: "bikes back", now });
        return { ok: true, message: `${booking.code} returned. Thanks.` };
      case "no_show":
        await transition(env.DB, { bookingId: booking.id, from, to: "no_show", actor: staff, note: opts.reason || "did not collect", now });
        return { ok: true, message: `${booking.code} marked as a no-show. Any card money stays charged.` };
      case "confirm":
        await transition(env.DB, { bookingId: booking.id, from, to: "confirmed", actor: staff, note: opts.reason || "confirmed by staff", now });
        return { ok: true, message: `${booking.code} confirmed.` };
      case "cancel": {
        // D2: shop-initiated is always a full refund of whatever the card holds.
        const refund = refundFor(booking.startAt, now, booking.paidMinor - booking.refundedMinor, "shop");
        await transition(env.DB, { bookingId: booking.id, from, to: "cancelled", actor: staff, note: opts.reason ? `cancelled by the shop: ${opts.reason}` : "cancelled by the shop", now });
        await releaseSeats(env.DB, booking);
        const money = await refundBooking(env, booking.id, refund.refundMinor, staff, opts.reason ? `shop cancellation: ${opts.reason}` : "shop cancellation", now).catch((err) => {
          console.error(`refund failed for ${booking.code}:`, err);
          return null;
        });
        const refunded = money ? money.refundedMinor : 0;
        ctx.waitUntil(sendCancellation(env, { ...booking, status: "cancelled" }, { refundMinor: money?.voided ? booking.paidMinor : refunded, byShop: true, reason: opts.reason }, opts.origin));
        if (!money) return { ok: true, message: `${booking.code} cancelled, but the refund failed — do it by hand in ePay.` };
        return { ok: true, message: `${booking.code} cancelled.${money.voided ? " The card authorisation was released." : refunded > 0 ? ` ${refunded / 100} kr refunded.` : ""}` };
      }
      case "capture": {
        const cap = await captureBooking(env, booking.id, staff, now);
        return cap.capturedMinor > 0 ? { ok: true, message: `Captured ${cap.capturedMinor / 100} kr.` } : { ok: false, message: "Nothing to capture on this booking." };
      }
      case "notes":
        await env.DB.prepare(`UPDATE bookings SET staff_notes = ?2, updated_at = ?3 WHERE id = ?1`).bind(booking.id, (opts.notes ?? "").trim().slice(0, 2000) || null, now).run();
        return { ok: true, message: "Note saved." };
    }
  } catch (err) {
    if (err instanceof TransitionError) return { ok: false, message: err.message };
    throw err;
  }
  return { ok: false, message: "Unknown action." };
}

/** A tour booking hands its seats back; bikes free themselves because a cancelled booking holds nothing. */
export async function releaseSeats(d1: D1Database, booking: BookingView): Promise<void> {
  const seat = booking.lines.find((l) => l.kind === "tour_seat" && l.tourDepartureId);
  if (seat?.tourDepartureId) {
    await d1.prepare(`UPDATE tour_departures SET seats_taken = MAX(0, seats_taken - ?2) WHERE id = ?1`).bind(seat.tourDepartureId, seat.qty).run();
  }
}

export async function setStock(d1: D1Database, bikeTypeId: string, stock: number, staff: string, now = Date.now()): Promise<boolean> {
  if (!Number.isInteger(stock) || stock < 0 || stock > 999) return false;
  const before = await d1.prepare(`SELECT stock FROM bike_types WHERE id = ?1`).bind(bikeTypeId).first<{ stock: number }>();
  if (!before) return false;
  if (before.stock === stock) return true;
  await d1.batch([
    d1.prepare(`UPDATE bike_types SET stock = ?2, updated_at = ?3 WHERE id = ?1`).bind(bikeTypeId, stock, now),
    d1.prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'bike_type',?2,?3,?4,?5,'stock changed',?6)`).bind(crypto.randomUUID(), bikeTypeId, String(before.stock), String(stock), staff, now),
  ]);
  return true;
}
