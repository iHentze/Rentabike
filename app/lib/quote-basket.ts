/**
 * From trip + basket to a priced quote. The one path every funnel page uses
 * to show a total, and the same lines reserveBooking writes — so what the
 * customer saw is what the booking holds.
 */
import type { Basket } from "./basket";
import { riderLabel } from "./basket";
import type { Trip } from "./trip";
import { loadQuoteCatalogue } from "./pricing/catalogue";
import { priceQuote, type Quote, type QuoteRequest } from "./pricing/quote";

export interface PricedBasket {
  request: QuoteRequest;
  quote: Quote | null;
  /** Rider index → their bike line total, for the summary rail. */
  riderTotals: Array<number | null>;
  addonsTotal: number;
  extrasTotal: number;
  feesTotal: number;
}

export function quoteRequestFor(trip: Trip, basket: Basket): QuoteRequest {
  const bikes: QuoteRequest["bikes"] = [];
  basket.riders.forEach((r, i) => {
    if (r.bikeTypeId) bikes.push({ bikeTypeId: r.bikeTypeId, qty: 1, riderLabel: riderLabel(basket, i) });
  });
  for (const [id, qty] of Object.entries(basket.extras)) bikes.push({ bikeTypeId: id, qty });
  const addons = Object.entries(basket.addons).map(([addonId, qty]) => ({ addonId, qty }));
  return {
    startAt: trip.startAt,
    endAt: trip.endAt,
    bikes,
    addons,
    pickupLocationId: basket.pickupLocationId,
    dropoffLocationId: basket.dropoffLocationId,
  };
}

export async function priceBasket(d1: D1Database, trip: Trip, basket: Basket): Promise<PricedBasket> {
  const request = quoteRequestFor(trip, basket);
  if (request.bikes.length === 0) {
    return { request, quote: null, riderTotals: basket.riders.map(() => null), addonsTotal: 0, extrasTotal: 0, feesTotal: 0 };
  }
  const catalogue = await loadQuoteCatalogue(d1, {
    bikeTypeIds: request.bikes.map((b) => b.bikeTypeId),
    addonIds: request.addons?.map((a) => a.addonId) ?? [],
    locationIds: [request.pickupLocationId, request.dropoffLocationId].filter((x): x is string => Boolean(x)),
  });
  const quote = priceQuote(request, catalogue);
  const riderTotals = basket.riders.map((r, i) => {
    if (!r.bikeTypeId) return null;
    const label = riderLabel(basket, i);
    return quote.lines.find((l) => l.kind === "bike" && l.riderLabel === label && l.bikeTypeId === r.bikeTypeId)?.lineTotalMinor ?? null;
  });
  const extrasIds = new Set(Object.keys(basket.extras));
  return {
    request,
    quote,
    riderTotals,
    addonsTotal: quote.lines.filter((l) => l.kind === "addon").reduce((n, l) => n + l.lineTotalMinor, 0),
    extrasTotal: quote.lines.filter((l) => l.kind === "bike" && !l.riderLabel && l.bikeTypeId && extrasIds.has(l.bikeTypeId)).reduce((n, l) => n + l.lineTotalMinor, 0),
    feesTotal: quote.lines.filter((l) => l.kind === "fee").reduce((n, l) => n + l.lineTotalMinor, 0),
  };
}
