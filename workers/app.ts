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

  // Rule B5: release held bookings whose payment never completed.
  async scheduled(_controller, env, ctx) {
    const { sweepExpiredHolds } = await import("../app/lib/booking/sweeper");
    ctx.waitUntil(sweepExpiredHolds(env));
  },
} satisfies ExportedHandler<Env>;
