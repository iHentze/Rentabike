/**
 * Fire-and-forget senders for the request handlers. The booking is already
 * written when these run; a mail failure is logged, never surfaced to the
 * customer as a failed booking.
 */
import type { BookingView } from "~/lib/booking/lookup";
import { getBookingById } from "~/lib/booking/lookup";
import { mailerFor, type MailerEnv } from "./mailer";
import { cancellationMail, confirmationMail } from "./templates";

interface SendEnv extends MailerEnv {
  DB: D1Database;
}

export function originOf(request: Request): string {
  const url = new URL(request.url);
  // Behind Cloudflare the Worker sees https; in wrangler dev it sees http. Either is right for its links.
  return `${url.protocol}//${url.host}`;
}

export async function sendConfirmation(env: SendEnv, bookingId: string, origin: string): Promise<void> {
  try {
    const booking = await getBookingById(env.DB, bookingId);
    if (!booking) return;
    await mailerFor(env).send(confirmationMail(booking, { origin }));
  } catch (err) {
    console.error(`confirmation email failed for booking ${bookingId}:`, err);
  }
}

export async function sendCancellation(env: SendEnv, booking: BookingView, opts: { refundMinor: number; byShop: boolean; reason?: string }, origin: string): Promise<void> {
  try {
    await mailerFor(env).send(cancellationMail(booking, opts, { origin }));
  } catch (err) {
    console.error(`cancellation email failed for booking ${booking.id}:`, err);
  }
}
