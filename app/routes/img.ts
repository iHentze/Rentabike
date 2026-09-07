import type { Route } from "./+types/img";
import { upstreamFor } from "~/lib/catalogue/images";

/**
 * Catalogue photos, served from our own origin. The Worker fetches the
 * original from the shop's WordPress (as a normal visitor would), Cloudflare
 * keeps it at the edge for a month, and the browser caches it for a year —
 * the file names are content-stamped by WordPress, so they never change.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const upstream = upstreamFor(new URL(request.url).pathname);
  if (!upstream) throw new Response("Not found", { status: 404 });

  const res = await fetch(upstream, {
    headers: { Referer: "https://rentabike.fo/", Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    cf: { cacheEverything: true, cacheTtl: 60 * 60 * 24 * 30 },
  });
  if (!res.ok || !res.body) throw new Response("Not found", { status: res.status === 404 ? 404 : 502 });

  const headers = new Headers({
    "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  const length = res.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);
  return new Response(res.body, { status: 200, headers });
}
