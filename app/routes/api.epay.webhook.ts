import type { Route } from "./+types/api.epay.webhook";
import { cloudflareContext } from "~/context";
import { epayConfigured, sessionIdFromNotification } from "~/lib/payments/epay";
import { settleSession } from "~/lib/payments/settle";
import { sendConfirmation, originOf } from "~/lib/email/send";

/**
 * POST /api/epay/webhook — ePay's notification.
 *
 * The body is not trusted. It names a session; the server reads that
 * session from ePay over the authenticated API and acts on what ePay says.
 * A forged or replayed notification can therefore do nothing a legitimate
 * one would not, and a replay is a no-op because the payment row moves
 * out of `pending` exactly once.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
  if (!epayConfigured(env)) return Response.json({ received: false, reason: "epay not configured" }, { status: 503 });
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const sessionId = sessionIdFromNotification(body);
  if (!sessionId) return Response.json({ error: "no session id" }, { status: 400 });
  const result = await settleSession(env, sessionId, "webhook");
  if (result.outcome === "confirmed") ctx.waitUntil(sendConfirmation(env, result.bookingId, originOf(request)));
  // Always 200 once we have read the session: ePay retries on anything else, and a retry changes nothing.
  return Response.json({ received: true, outcome: result.outcome });
}

export function loader() {
  return Response.json({ error: "POST only" }, { status: 405 });
}
