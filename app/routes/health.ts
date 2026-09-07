import type { Route } from "./+types/health";
import { cloudflareContext } from "~/context";

// Proves the D1 binding is live. Used by CI and by wrangler dev smoke tests.
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const row = await env.DB.prepare("select 1 as ok").first<{ ok: number }>();
  return Response.json({ ok: row?.ok === 1, env: env.APP_ENV });
}
