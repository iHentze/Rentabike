import { type RouteConfig, index, route } from "@react-router/dev/routes";

// One route per canvas artboard. Filled in through Phase 4.
export default [
  index("routes/home.tsx"),
  route("bikes", "routes/bikes.tsx"),
  route("bikes/:slug", "routes/bikes.$slug.tsx"),
  route("health", "routes/health.ts"),
  // The server prices. There is no route that accepts a price from the client.
  route("api/quote", "routes/api.quote.ts"),
] satisfies RouteConfig;
