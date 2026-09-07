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
import type { TourContext } from "./tour-trip";

export interface PricedLine {
  addonId: string;
  label: string;
  qty: number;
  totalMinor: number;
}

export interface PricedBasket {
  request: QuoteRequest;
  quote: Quote | null;
  /** Rider index → their bike line total, for the summary rail. */
  riderTotals: Array<number | null>;
  /** Rider index → their own extras, priced. */
  riderExtras: PricedLine[][];
  /** Add-ons that belong to the booking, not a rider: car carriers, bag storage, own-bike helmets. */
  bookingAddonLines: PricedLine[];
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
  // A rider's extras carry their label, so the booking knows whose helmet is whose.
  const addons: NonNullable<QuoteRequest["addons"]> = [];
  basket.riders.forEach((r, i) => {
    for (const [addonId, qty] of Object.entries(r.addons)) addons.push({ addonId, qty, riderLabel: riderLabel(basket, i) });
  });
  for (const [addonId, qty] of Object.entries(basket.addons)) addons.push({ addonId, qty });
  return {
    startAt: trip.startAt,
    endAt: trip.endAt,
    bikes,
    addons,
    pickupLocationId: basket.pickupLocationId,
    dropoffLocationId: basket.dropoffLocationId,
  };
}

export async function priceBasket(d1: D1Database, trip: Trip, basket: Basket, tour: TourContext | null = null): Promise<PricedBasket> {
  const request = quoteRequestFor(trip, basket);
  if (request.bikes.length === 0 && (request.addons ?? []).length === 0) {
    if (tour && !tour.requiresBike) {
      // A hike or run: seats only.
      const seat = seatLine(tour, basket.riders.length);
      const quote: Quote = { days: 1, tierDays: 1, lines: [seat], totalMinor: seat.lineTotalMinor, currency: "DKK" };
      return { request, quote, riderTotals: basket.riders.map(() => 0), riderExtras: basket.riders.map(() => []), bookingAddonLines: [], addonsTotal: 0, extrasTotal: 0, feesTotal: 0 };
    }
    return { request, quote: null, riderTotals: basket.riders.map(() => null), riderExtras: basket.riders.map(() => []), bookingAddonLines: [], addonsTotal: 0, extrasTotal: 0, feesTotal: 0 };
  }
  const catalogue = await loadQuoteCatalogue(d1, {
    bikeTypeIds: request.bikes.map((b) => b.bikeTypeId),
    addonIds: request.addons?.map((a) => a.addonId) ?? [],
    locationIds: [request.pickupLocationId, request.dropoffLocationId].filter((x): x is string => Boolean(x)),
  });
  let quote = priceQuote(request, catalogue);
  if (tour) quote = tourify(quote, tour, basket);
  const riderTotals = basket.riders.map((r, i) => {
    if (!r.bikeTypeId) return null;
    const label = riderLabel(basket, i);
    return quote.lines.find((l) => l.kind === "bike" && l.riderLabel === label && l.bikeTypeId === r.bikeTypeId)?.lineTotalMinor ?? null;
  });
  const extrasIds = new Set(Object.keys(basket.extras));
  const asLine = (l: Quote["lines"][number]): PricedLine => ({ addonId: l.addonId ?? "", label: l.label, qty: l.qty, totalMinor: l.lineTotalMinor });
  const riderExtras = basket.riders.map((_, i) => {
    const label = riderLabel(basket, i);
    return quote.lines.filter((l) => l.kind === "addon" && l.riderLabel === label).map(asLine);
  });
  return {
    request,
    quote,
    riderTotals,
    riderExtras,
    bookingAddonLines: quote.lines.filter((l) => l.kind === "addon" && !l.riderLabel).map(asLine),
    addonsTotal: quote.lines.filter((l) => l.kind === "addon").reduce((n, l) => n + l.lineTotalMinor, 0),
    extrasTotal: quote.lines.filter((l) => l.kind === "bike" && !l.riderLabel && l.bikeTypeId && extrasIds.has(l.bikeTypeId)).reduce((n, l) => n + l.lineTotalMinor, 0),
    feesTotal: quote.lines.filter((l) => l.kind === "fee").reduce((n, l) => n + l.lineTotalMinor, 0),
  };
}

function seatLine(tour: TourContext, seats: number): Quote["lines"][number] {
  return { kind: "tour_seat", label: tour.title, qty: seats, unitPriceMinor: tour.priceMinor, lineTotalMinor: tour.priceMinor * seats };
}

/**
 * Rule A7 / the tour price: the seat carries the money, the rider's bike and
 * helmet ride along at zero. Extras and other add-ons stay priced.
 */
function tourify(quote: Quote, tour: TourContext, basket: Basket): Quote {
  const riderBikes = new Set(basket.riders.map((r) => r.bikeTypeId).filter(Boolean));
  const lines = quote.lines.map((l) =>
    (l.kind === "bike" && l.riderLabel && riderBikes.has(l.bikeTypeId)) || (l.kind === "addon" && l.addonId === "addon-helmet-for-rent")
      ? { ...l, unitPriceMinor: 0, lineTotalMinor: 0 }
      : l,
  );
  lines.unshift(seatLine(tour, basket.riders.length));
  return { ...quote, lines, totalMinor: lines.reduce((n, l) => n + l.lineTotalMinor, 0) };
}
