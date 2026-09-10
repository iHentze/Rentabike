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
import { INVENTORY_HOLDING_STATUSES } from "~/db/schema";
import { getBikesById, listBikes, ridable, type CatalogueBike } from "~/lib/catalogue/bikes";
import type { Trip } from "~/lib/trip";

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

// ---------------------------------------------------------------------------
// Swapping a bike at the counter — the frame doesn't fit, or the bike is
// not back yet. The line changes under the same availability guard the
// reservation used, so the shop never promises a bike it does not have.
// ---------------------------------------------------------------------------

const HOLDING = INVENTORY_HOLDING_STATUSES.map((s) => `'${s}'`).join(",");

function tripOf(booking: BookingView): Trip {
  return { startAt: new Date(booking.startAt), endAt: new Date(booking.endAt), riders: 1, explicit: true };
}

export interface SwapCandidate {
  id: string;
  name: string;
  category: string;
  sizeLabel: string | null;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  free: number;
  /** What this bike would cost for the booking's window; 0 on a tour, where the bike is included. */
  tripMinor: number;
}

/** Bikes that could take a line's place: free over the booking's own window, and, on a tour, allowed on it. */
export async function swapCandidates(d1: D1Database, booking: BookingView, lineId: string): Promise<SwapCandidate[]> {
  const line = booking.lines.find((l) => l.id === lineId && l.kind === "bike");
  if (!line) return [];
  const trip = tripOf(booking);
  let bikes: CatalogueBike[] = ridable(await listBikes(d1, trip));
  const seat = booking.lines.find((l) => l.kind === "tour_seat" && l.tourDepartureId);
  if (seat?.tourDepartureId) {
    const allowed = await d1.prepare(`SELECT bike_type_id FROM tour_bike_types WHERE tour_id = (SELECT tour_id FROM tour_departures WHERE id = ?1)`).bind(seat.tourDepartureId).all<{ bike_type_id: string }>();
    const ids = new Set((allowed.results ?? []).map((r) => r.bike_type_id));
    bikes = bikes.filter((b) => ids.has(b.id));
  }
  // This booking's own units count as free for it — listBikes counted them as taken.
  const own = new Map<string, number>();
  for (const l of booking.lines) if (l.kind === "bike" && l.bikeTypeId) own.set(l.bikeTypeId, (own.get(l.bikeTypeId) ?? 0) + l.qty);
  return bikes
    .map((b) => ({ id: b.id, name: b.name, category: b.category, sizeLabel: b.sizeLabel, riderMinCm: b.riderMinCm, riderMaxCm: b.riderMaxCm, free: b.free + (own.get(b.id) ?? 0), tripMinor: seat ? 0 : b.tripMinor * line.qty }))
    .filter((b) => b.id !== line.bikeTypeId && b.free >= line.qty);
}

export interface SwapResult {
  ok: boolean;
  message: string;
  /** Total before and after, so the counter knows what to take or give back. */
  deltaMinor?: number;
}

export async function swapBike(d1: D1Database, booking: BookingView, lineId: string, bikeTypeId: string, staff: string, now = Date.now()): Promise<SwapResult> {
  const line = booking.lines.find((l) => l.id === lineId && l.kind === "bike");
  if (!line) return { ok: false, message: "That line is not a bike." };
  if (!["held", "confirmed", "picked_up"].includes(booking.status)) return { ok: false, message: `A ${booking.status} booking cannot change bikes.` };
  if (line.bikeTypeId === bikeTypeId) return { ok: false, message: "That is the bike they already have." };
  const candidate = (await swapCandidates(d1, booking, lineId)).find((c) => c.id === bikeTypeId);
  if (!candidate) return { ok: false, message: "That bike is not free for these dates, or not allowed on this tour." };
  const bike = (await getBikesById(d1, [bikeTypeId], tripOf(booking))).get(bikeTypeId);
  if (!bike) return { ok: false, message: "That bike is gone." };
  const isTour = booking.kind === "tour";
  const unit = isTour ? 0 : bike.rateMinor;
  const total = isTour ? 0 : bike.tripMinor * line.qty;

  // The guard: the line moves only if the new type still has room over the window, this booking's own lines aside.
  const res = await d1.batch([
    d1
      .prepare(
        `UPDATE booking_lines SET bike_type_id = ?2, label = ?3, unit_price_minor = ?4, line_total_minor = ?5
          WHERE id = ?1
            AND qty <= (SELECT bt.stock - COALESCE((
                  SELECT SUM(bl.qty) FROM booking_lines bl JOIN bookings b ON b.id = bl.booking_id
                   WHERE bl.bike_type_id = bt.id AND bl.kind = 'bike' AND b.status IN (${HOLDING})
                     AND b.id <> ?6 AND b.start_at < ?8 AND b.end_at > ?7), 0)
                FROM bike_types bt WHERE bt.id = ?2)`,
      )
      .bind(lineId, bikeTypeId, bike.name, unit, total, booking.id, booking.startAt, booking.endAt),
    d1.prepare(`UPDATE bookings SET total_minor = (SELECT COALESCE(SUM(line_total_minor), 0) FROM booking_lines WHERE booking_id = ?1), updated_at = ?2 WHERE id = ?1`).bind(booking.id, now),
    d1
      .prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'booking',?2,?3,?4,?5,?6,?7)`)
      .bind(crypto.randomUUID(), booking.id, null, null, staff, `${line.riderLabel ? `${line.riderLabel}: ` : ""}${line.label} → ${bike.name}${total !== line.lineTotalMinor ? ` (${line.lineTotalMinor / 100} → ${total / 100} kr)` : ""}`, now),
  ]);
  if ((res[0]?.meta.changes ?? 0) !== 1) {
    // The guard said no: the total and the audit row above are harmless no-ops in that case, but say so.
    return { ok: false, message: "Gone while you looked — that bike is no longer free for these dates." };
  }
  const delta = total - line.lineTotalMinor;
  return { ok: true, message: `${line.riderLabel ? `${line.riderLabel} now has` : "Now"} ${bike.name}.${delta > 0 ? ` ${delta / 100} kr more — take it at the counter.` : delta < 0 ? ` ${-delta / 100} kr less — give it back${booking.paidMinor > 0 ? " or refund it" : ""}.` : ""}`, deltaMinor: delta };
}
