/**
 * The quote engine — rules A2–A7.
 *
 * THE SERVER PRICES. The browser sends a bike, a date range and a set of
 * add-ons; it never sends a total. In the old app the entire pricing formula
 * was four lines in CartProvider.tsx executed in the customer's browser, so a
 * booking could be posted at any price (defect 5).
 *
 * `priceQuote` is deliberately PURE — it takes an already-resolved catalogue
 * and returns priced lines. That makes every rule testable without a database,
 * and it is what lets the public and admin paths share one implementation and
 * be asserted byte-identical (defect 7).
 */
import { billableDays, tierDays, type BillableDays } from "./duration";
import type { AddonUnit, LineKind } from "~/db/schema";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface QuoteTier {
  minDays: number;
  maxDays: number;
  priceMinor: number;
  /** Per-day rate (bikes) vs a total for the whole period (some Extra items). */
  perDay: boolean;
}

export interface QuoteBikeType {
  id: string;
  name: string;
  tiers: QuoteTier[];
}

export interface QuoteAddon {
  id: string;
  name: string;
  unit: AddonUnit;
  priceMinor: number;
}

export interface QuoteLocation {
  id: string;
  name: string;
  pickupFeeMinor: number;
  dropoffFeeMinor: number;
}

export interface QuoteCatalogue {
  bikeTypes: Map<string, QuoteBikeType>;
  addons: Map<string, QuoteAddon>;
  locations: Map<string, QuoteLocation>;
}

export interface QuoteRequest {
  startAt: Date | number;
  endAt: Date | number;
  bikes: Array<{ bikeTypeId: string; qty: number; riderLabel?: string }>;
  /** `riderLabel` ties a per-bike add-on to the rider who wears it; per-booking add-ons carry none. */
  addons?: Array<{ addonId: string; qty: number; riderLabel?: string }>;
  pickupLocationId?: string;
  /** Only charged when it differs from pickup — see A6. */
  dropoffLocationId?: string;
}

export interface QuoteLine {
  kind: LineKind;
  bikeTypeId?: string;
  addonId?: string;
  riderLabel?: string;
  label: string;
  qty: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface Quote {
  days: BillableDays;
  tierDays: number;
  lines: QuoteLine[];
  totalMinor: number;
  currency: "DKK";
}

export class QuoteError extends Error {}

// ---------------------------------------------------------------------------
// Tier selection — rule A2/A3
// ---------------------------------------------------------------------------

/**
 * The band whose [minDays, maxDays] contains the whole-day ceiling of the
 * rental. The ladder is FLAT across the whole rental, not graduated: 8 days is
 * 8 × 350, never 6 × 400 + 2 × 350.
 *
 * The real data has overlapping bands (one product prices day 6 twice, another
 * day 27) and ladders that stop at 60 days. First match wins by ascending
 * minDays, and a duration past the last band clamps to it rather than throwing
 * — a customer must never see a crash because they asked for 90 days.
 */
export function selectTier(tiers: readonly QuoteTier[], whole: number): QuoteTier {
  if (tiers.length === 0) throw new QuoteError("no rate tiers configured for this bike");
  const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
  const hit = sorted.find((t) => whole >= t.minDays && whole <= t.maxDays);
  if (hit) return hit;
  const first = sorted[0]!;
  if (whole < first.minDays) return first;
  return sorted[sorted.length - 1]!;
}

// ---------------------------------------------------------------------------
// The quote
// ---------------------------------------------------------------------------

export function priceQuote(req: QuoteRequest, cat: QuoteCatalogue): Quote {
  const days = billableDays(req.startAt, req.endAt);
  const whole = tierDays(days);

  // A customer with their own bike still rents helmets and bags: add-ons alone are a booking.
  if (req.bikes.length === 0 && (req.addons ?? []).length === 0) throw new QuoteError("a booking needs at least one bike or add-on");

  const lines: QuoteLine[] = [];

  // --- bikes ---------------------------------------------------------------
  for (const sel of req.bikes) {
    if (!Number.isInteger(sel.qty) || sel.qty < 1) {
      throw new QuoteError(`invalid quantity for ${sel.bikeTypeId}`);
    }
    const bike = cat.bikeTypes.get(sel.bikeTypeId);
    if (!bike) throw new QuoteError(`unknown bike type ${sel.bikeTypeId}`);

    const tier = selectTier(bike.tiers, whole);
    // perDay: the band is a daily rate, so a 1.5-day rental pays 1.5× it (A4).
    // Otherwise the band price IS the total for the period.
    const unit = tier.priceMinor;
    const perUnitTotal = tier.perDay ? Math.round(unit * days) : unit;

    lines.push({
      kind: "bike",
      bikeTypeId: bike.id,
      riderLabel: sel.riderLabel,
      label: bike.name,
      qty: sel.qty,
      unitPriceMinor: unit,
      lineTotalMinor: perUnitTotal * sel.qty,
    });
  }

  // --- add-ons -------------------------------------------------------------
  // Rule A5: flat per bike, NEVER multiplied by days. Helmet 50, pedals 100.
  for (const sel of req.addons ?? []) {
    if (!Number.isInteger(sel.qty) || sel.qty < 1) {
      throw new QuoteError(`invalid quantity for addon ${sel.addonId}`);
    }
    const addon = cat.addons.get(sel.addonId);
    if (!addon) throw new QuoteError(`unknown addon ${sel.addonId}`);

    let total: number;
    switch (addon.unit) {
      case "per_bike":
        total = addon.priceMinor * sel.qty;
        break;
      case "per_bike_per_day":
        total = Math.round(addon.priceMinor * days) * sel.qty;
        break;
      case "per_booking":
        total = addon.priceMinor;
        break;
    }

    lines.push({
      kind: "addon",
      addonId: addon.id,
      riderLabel: sel.riderLabel,
      label: addon.name,
      qty: addon.unit === "per_booking" ? 1 : sel.qty,
      unitPriceMinor: addon.priceMinor,
      lineTotalMinor: total,
    });
  }

  // --- location fees -------------------------------------------------------
  // Rule A6: per booking, once each. These were displayed to the customer and
  // never added to the total — a live revenue leak (defect 6). Making them a
  // line item is what fixes it by construction: a total that omits one cannot
  // be built, because the total is the sum of the lines.
  const pickup = req.pickupLocationId ? cat.locations.get(req.pickupLocationId) : undefined;
  if (req.pickupLocationId && !pickup) throw new QuoteError(`unknown location ${req.pickupLocationId}`);
  if (pickup && pickup.pickupFeeMinor > 0) {
    lines.push({
      kind: "fee",
      label: `Pickup at ${pickup.name}`,
      qty: 1,
      unitPriceMinor: pickup.pickupFeeMinor,
      lineTotalMinor: pickup.pickupFeeMinor,
    });
  }

  const dropoff = req.dropoffLocationId ? cat.locations.get(req.dropoffLocationId) : undefined;
  if (req.dropoffLocationId && !dropoff) throw new QuoteError(`unknown location ${req.dropoffLocationId}`);
  // Returning where you started is not a drop-off.
  if (dropoff && dropoff.id !== req.pickupLocationId && dropoff.dropoffFeeMinor > 0) {
    lines.push({
      kind: "fee",
      label: `Drop-off at ${dropoff.name}`,
      qty: 1,
      unitPriceMinor: dropoff.dropoffFeeMinor,
      lineTotalMinor: dropoff.dropoffFeeMinor,
    });
  }

  const totalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  if (!Number.isInteger(totalMinor)) throw new QuoteError("total is not an integer number of øre");

  return { days, tierDays: whole, lines, totalMinor, currency: "DKK" };
}
