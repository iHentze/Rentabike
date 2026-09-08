import type { Route } from "./+types/booked.$code.calendar[.]ics";
import { cloudflareContext } from "~/context";
import { getBookingByCode } from "~/lib/booking/lookup";
import { bookingIcs } from "~/lib/booking/ics";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const booking = await getBookingByCode(env.DB, params.code);
  if (!booking) throw new Response("Not found", { status: 404 });
  return new Response(bookingIcs(booking), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="rentabike-${booking.code}.ics"` },
  });
}
