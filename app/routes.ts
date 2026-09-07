import { type RouteConfig, index, route } from "@react-router/dev/routes";

// One route per canvas artboard. Filled in through Phase 4.
export default [
  index("routes/home.tsx"),
  route("bikes", "routes/bikes.tsx"),
  route("bikes/:slug", "routes/bikes.$slug.tsx"),
  route("riders", "routes/riders.tsx"),
  route("checkout", "routes/checkout.tsx"),
  route("tours", "routes/tours.tsx"),
  route("tours/:slug", "routes/tours.$slug.tsx"),
  route("booked/:code", "routes/booked.$code.tsx"),
  route("booked/:code/calendar.ics", "routes/booked.$code.calendar[.]ics.ts"),
  route("health", "routes/health.ts"),
  // The server prices. There is no route that accepts a price from the client.
  route("api/quote", "routes/api.quote.ts"),
] satisfies RouteConfig;
