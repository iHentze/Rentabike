import type { Route } from "./+types/booked.$code.calendar[.]ics";
import { cloudflareContext } from "~/context";
import { getBookingByCode } from "~/lib/booking/lookup";
import { SHOP } from "~/components/site";

/** A calendar entry for the rental — works offline, which the shop's signal sometimes doesn't. */
export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const booking = await getBookingByCode(env.DB, params.code);
  if (!booking) throw new Response("Not found", { status: 404 });
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const bikes = booking.lines.filter((l) => l.kind === "bike").map((l) => `${l.riderLabel ? `${l.riderLabel}: ` : ""}${l.label}`).join(", ");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rent a Bike & Outdoor//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@rentabike.fo`,
    `DTSTAMP:${stamp(booking.createdAt)}`,
    `DTSTART:${stamp(booking.startAt)}`,
    `DTEND:${stamp(booking.endAt)}`,
    `SUMMARY:${esc(`Bike rental · code ${booking.code}`)}`,
    `LOCATION:${esc(`${SHOP.name}, ${booking.pickupName ?? SHOP.address}, ${SHOP.town}`)}`,
    `DESCRIPTION:${esc(`Pickup code ${booking.code}. ${bikes}. Bring the code and something with your name on it. ${SHOP.phone}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="rentabike-${booking.code}.ics"` },
  });
}
