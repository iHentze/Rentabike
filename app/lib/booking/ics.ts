/**
 * A calendar entry for the rental — works offline, which the shop's signal
 * sometimes doesn't. Attached to the confirmation email and served from
 * /booked/:code/calendar.ics, from the same function so they never drift.
 */
import type { BookingView } from "./lookup";
import { SHOP } from "~/components/site";

export function bookingIcs(booking: BookingView): string {
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const bikes = booking.lines.filter((l) => l.kind === "bike").map((l) => `${l.riderLabel ? `${l.riderLabel}: ` : ""}${l.label}`).join(", ");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const summary = booking.kind === "tour" ? `Tour with Rent a Bike · code ${booking.code}` : `Bike rental · code ${booking.code}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rent a Bike & Outdoor//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@rentabike.fo`,
    `DTSTAMP:${stamp(booking.createdAt)}`,
    `DTSTART:${stamp(booking.startAt)}`,
    `DTEND:${stamp(booking.endAt)}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(`${SHOP.name}, ${booking.pickupName ?? SHOP.address}, ${SHOP.town}`)}`,
    `DESCRIPTION:${esc(`Pickup code ${booking.code}. ${bikes}. Bring the code and something with your name on it. ${SHOP.phone}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
