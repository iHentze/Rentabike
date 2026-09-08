import { type RouteConfig, index, route } from "@react-router/dev/routes";

// One route per canvas artboard. Filled in through Phase 4.
export default [
  index("routes/home.tsx"),
  route("bikes", "routes/bikes.tsx"),
  route("bikes/:slug", "routes/bikes.$slug.tsx"),
  route("choose", "routes/choose.tsx"),
  route("riders", "routes/riders.tsx"),
  route("checkout", "routes/checkout.tsx"),
  route("tours", "routes/tours.tsx"),
  route("tours/:slug", "routes/tours.$slug.tsx"),
  route("booking", "routes/booking.tsx"),
  // The booking guide, for the customer who is not sure what happens next.
  route("how-to-book", "routes/how-to-book.tsx"),
  route("booked/:code", "routes/booked.$code.tsx"),
  route("booked/:code/calendar.ics", "routes/booked.$code.calendar[.]ics.ts"),
  // Card payment for a held booking, and ePay's notification about it.
  route("pay/:code", "routes/pay.$code.tsx"),
  route("api/epay/webhook", "routes/api.epay.webhook.ts"),
  // The counter — staff only, see app/lib/admin/auth.ts.
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/today.tsx"),
    route("login", "routes/admin/login.tsx"),
    route("logout", "routes/admin/logout.ts"),
    route("bookings", "routes/admin/bookings.tsx"),
    route("bookings/:id", "routes/admin/booking.tsx"),
    route("stock", "routes/admin/stock.tsx"),
  ]),
  route("health", "routes/health.ts"),
  // Catalogue photos, fetched from the shop by the Worker and cached at the edge.
  route("img/*", "routes/img.ts"),
  // The server prices. There is no route that accepts a price from the client.
  route("api/quote", "routes/api.quote.ts"),
] satisfies RouteConfig;
