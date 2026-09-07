import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/context";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },

  // Rule B5: release held bookings whose payment never completed — and keep
  // the next 400 days of tour departures generated from the weekly schedules.
  async scheduled(_controller, env, ctx) {
    const [{ sweepExpiredHolds }, { ensureDepartures }] = await Promise.all([
      import("../app/lib/booking/sweeper"),
      import("../app/lib/tours/ensure"),
    ]);
    ctx.waitUntil(Promise.all([sweepExpiredHolds(env), ensureDepartures(env.DB)]));
  },
} satisfies ExportedHandler<Env>;
