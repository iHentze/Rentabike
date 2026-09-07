/**
 * Product photos still live on the shop's WordPress at rentabike.fo. A browser
 * fetching them straight from another site can be refused (hotlink
 * protection), and the links go stale the day the domain moves — so the site
 * serves every photo through its own /img/ route: the Worker fetches the
 * original, Cloudflare caches it at the edge, and the browser only ever talks
 * to us. At cutover the same route can read from R2 instead; no URL changes.
 */
const UPLOADS = "https://rentabike.fo/wp-content/uploads/";

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The address the browser should load a catalogue photo from. Anything not on the shop's uploads passes through untouched. */
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith(UPLOADS)) return url;
  const rest = url.slice(UPLOADS.length);
  // Re-encode segment by segment: the shop's file names carry "•" and spaces.
  return "/img/" + rest.split("/").map((seg) => encodeURIComponent(decodeSafe(seg))).join("/");
}

/** The upstream file for a path under /img/, or null when it is not one of ours. Only YYYY/MM/file under the shop's uploads is ever fetched. */
export function upstreamFor(pathname: string): string | null {
  if (!pathname.startsWith("/img/")) return null;
  const rest = pathname.slice("/img/".length);
  const plain = rest.split("/").map(decodeSafe).join("/");
  if (!/^\d{4}\/\d{2}\/[^/\\]+$/.test(plain) || plain.includes("..")) return null;
  return UPLOADS + rest;
}
