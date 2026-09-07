import { type RouteConfig, index, route } from "@react-router/dev/routes";

// One route per canvas artboard. Filled in through Phase 4.
export default [
  index("routes/home.tsx"),
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
