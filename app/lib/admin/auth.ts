/**
 * Who is at the counter. Two doors, checked in this order:
 *
 *  1. Cloudflare Access. When ACCESS_TEAM_DOMAIN and ACCESS_AUD are set, the
 *     request must carry a `Cf-Access-Jwt-Assertion` signed by that team's
 *     keys for that application. Access is the door once the shop's domain
 *     is on Cloudflare; the identity is the staff member's login email.
 *  2. A shared password. ADMIN_PASSWORD (a secret) unlocks a signed cookie
 *     for twelve hours; the staff member types their name so the audit log
 *     says who did what. This is the door on workers.dev, where Access
 *     would cover the public site too.
 *
 * Neither set in production → the admin is closed, with a page saying so.
 * Neither set in development → open as "dev", so wrangler dev just works.
 */
import { redirect } from "react-router";

export interface AuthEnv {
  APP_ENV?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_PASSWORD?: string;
}

export interface Staff {
  /** What goes in audit rows: an email under Access, a typed name under the password. */
  actor: string;
  via: "access" | "password" | "dev";
}

export const STAFF_COOKIE = "rb_staff";
const SESSION_HOURS = 12;

export class AdminClosed extends Error {}

/** Loaders and actions call this first. Throws a redirect to the login page, or AdminClosed. */
export async function requireStaff(request: Request, env: AuthEnv): Promise<Staff> {
  const staff = await currentStaff(request, env);
  if (staff) return staff;
  if (!adminEnabled(env)) throw new AdminClosed("admin is not switched on");
  const url = new URL(request.url);
  throw redirect(`/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
}

export function adminEnabled(env: AuthEnv): boolean {
  return Boolean((env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) || env.ADMIN_PASSWORD || env.APP_ENV !== "production");
}

export async function currentStaff(request: Request, env: AuthEnv): Promise<Staff | null> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get("cf-access-jwt-assertion");
    if (token) {
      const email = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
      if (email) return { actor: email, via: "access" };
    }
  }
  if (env.ADMIN_PASSWORD) {
    const name = await readStaffCookie(request, env.ADMIN_PASSWORD);
    if (name) return { actor: name, via: "password" };
    return null;
  }
  if (env.APP_ENV !== "production" && !(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD)) return { actor: "dev", via: "dev" };
  return null;
}

// --- the password door --------------------------------------------------------

export async function login(env: AuthEnv, password: string, name: string): Promise<string | null> {
  if (!env.ADMIN_PASSWORD || !timingSafeEqual(password, env.ADMIN_PASSWORD)) return null;
  const who = name.trim().slice(0, 40) || "staff";
  const exp = Date.now() + SESSION_HOURS * 3_600_000;
  const payload = `${exp}.${encodeURIComponent(who)}`;
  const sig = await hmac(env.ADMIN_PASSWORD, payload);
  return `${STAFF_COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`;
}

export function logoutCookie(): string {
  return `${STAFF_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function readStaffCookie(request: Request, password: string): Promise<string | null> {
  const raw = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${STAFF_COOKIE}=`))
    ?.slice(STAFF_COOKIE.length + 1);
  if (!raw) return null;
  const [exp, who, sig] = raw.split(".");
  if (!exp || !who || !sig) return null;
  if (!timingSafeEqual(sig, await hmac(password, `${exp}.${who}`))) return null;
  if (Number(exp) < Date.now()) return null;
  return decodeURIComponent(who);
}

async function hmac(secret: string, data: string): Promise<string> {
  // The cookie key is derived from the password, never the password itself.
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rb-staff-cookie:${secret}`));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

// --- the Access door ----------------------------------------------------------

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

let certCache: { fetchedAt: number; keys: Jwk[] } | null = null;

async function accessKeys(teamDomain: string): Promise<Jwk[]> {
  if (certCache && Date.now() - certCache.fetchedAt < 3_600_000) return certCache.keys;
  const res = await fetch(`${teamDomain.replace(/\/$/, "")}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs ${res.status}`);
  const data = (await res.json()) as { keys?: Jwk[] };
  certCache = { fetchedAt: Date.now(), keys: data.keys ?? [] };
  return certCache.keys;
}

/** RS256 JWT from Access → the email claim, or null when anything is off. */
export async function verifyAccessJwt(token: string, teamDomain: string, aud: string, now = Date.now()): Promise<string | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const header = JSON.parse(fromB64url(h)) as { alg?: string; kid?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const jwk = (await accessKeys(teamDomain)).find((k) => k.kid === header.kid);
    if (!jwk) {
      certCache = null; // rotated — one refetch on the next request
      return null;
    }
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const claims = JSON.parse(fromB64url(p)) as { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(aud)) return null;
    if (claims.iss && claims.iss.replace(/\/$/, "") !== teamDomain.replace(/\/$/, "")) return null;
    const sec = Math.floor(now / 1000);
    if (typeof claims.exp !== "number" || claims.exp < sec) return null;
    if (typeof claims.nbf === "number" && claims.nbf > sec + 60) return null;
    return claims.email && typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fromB64url(s: string): string {
  return new TextDecoder().decode(fromB64urlBytes(s));
}
