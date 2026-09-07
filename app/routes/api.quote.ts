import type { Route } from "./+types/api.quote";
import { cloudflareContext } from "~/context";
import { keysOf, loadQuoteCatalogue } from "~/lib/pricing/catalogue";
import { priceQuote, QuoteError, type QuoteRequest } from "~/lib/pricing/quote";
import { formatDKKCode } from "~/lib/money";

/**
 * POST /api/quote — the server prices.
 *
 * The client sends what it wants: bike type ids, quantities, a date range,
 * add-ons and locations. It does NOT send prices, and there is nowhere in this
 * handler for a client-supplied price to enter. In the old app the browser
 * posted `total_price`, so a booking could be created at any amount the
 * customer cared to type (defect 5).
 *
 * The same function serves the admin flyout, so staff and customers cannot
 * quote different numbers for identical dates (defect 7).
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  const { env } = context.get(cloudflareContext);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  let req: QuoteRequest;
  try {
    req = parseQuoteRequest(body);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const catalogue = await loadQuoteCatalogue(env.DB, keysOf(req));
    const quote = priceQuote(req, catalogue);
    return Response.json({
      days: quote.days,
      currency: quote.currency,
      lines: quote.lines.map((l) => ({
        kind: l.kind,
        label: l.label,
        riderLabel: l.riderLabel,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
        lineTotalMinor: l.lineTotalMinor,
        lineTotalFormatted: formatDKKCode(l.lineTotalMinor),
      })),
      totalMinor: quote.totalMinor,
      totalFormatted: formatDKKCode(quote.totalMinor),
    });
  } catch (e) {
    if (e instanceof QuoteError || e instanceof RangeError) {
      return Response.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}

/**
 * Accept only the shape we expect, and nothing else. Notably there is no
 * `price`, `total` or `amount` field anywhere — an extra key in the body is
 * ignored rather than trusted.
 */
export type ParsedQuoteRequest = QuoteRequest & { startAt: Date; endAt: Date };

export function parseQuoteRequest(body: unknown): ParsedQuoteRequest {
  if (typeof body !== "object" || body === null) throw new Error("body must be an object");
  const b = body as Record<string, unknown>;

  const startAt = asDate(b.startAt, "startAt");
  const endAt = asDate(b.endAt, "endAt");

  if (!Array.isArray(b.bikes) || b.bikes.length === 0) throw new Error("bikes must be a non-empty array");
  const bikes = b.bikes.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) throw new Error(`bikes[${i}] must be an object`);
    const r = raw as Record<string, unknown>;
    return {
      bikeTypeId: asString(r.bikeTypeId, `bikes[${i}].bikeTypeId`),
      qty: asPositiveInt(r.qty, `bikes[${i}].qty`),
      riderLabel: r.riderLabel === undefined ? undefined : asString(r.riderLabel, `bikes[${i}].riderLabel`),
    };
  });

  const addons = Array.isArray(b.addons)
    ? b.addons.map((raw, i) => {
        if (typeof raw !== "object" || raw === null) throw new Error(`addons[${i}] must be an object`);
        const r = raw as Record<string, unknown>;
        return {
          addonId: asString(r.addonId, `addons[${i}].addonId`),
          qty: asPositiveInt(r.qty, `addons[${i}].qty`),
        };
      })
    : undefined;

  return {
    startAt,
    endAt,
    bikes,
    addons,
    pickupLocationId: b.pickupLocationId === undefined ? undefined : asString(b.pickupLocationId, "pickupLocationId"),
    dropoffLocationId:
      b.dropoffLocationId === undefined ? undefined : asString(b.dropoffLocationId, "dropoffLocationId"),
  };
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function asPositiveInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new Error(`${field} must be a positive integer`);
  return v;
}

function asDate(v: unknown, field: string): Date {
  if (typeof v !== "string" && typeof v !== "number") throw new Error(`${field} must be an ISO string or epoch ms`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date`);
  return d;
}
