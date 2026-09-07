/**
 * The basket — which rider gets which bike, the extras, where the bikes are
 * collected and returned — lives in a cookie so every page of the funnel can
 * be reloaded and no server state exists until the customer actually books.
 * Prices are never stored here: ids and quantities only. The server prices.
 */
import { createCookie } from "react-router";
import type { Trip } from "./trip";

export interface BasketRider {
  name?: string;
  heightCm?: number;
  bikeTypeId?: string;
}

export interface Basket {
  riders: BasketRider[];
  /** Rentable extras (child seats, bags, pedals for your own bike): bike_type id → quantity. */
  extras: Record<string, number>;
  /** Per-bike accessories from the add-on allowlist: addon id → quantity. */
  addons: Record<string, number>;
  pickupLocationId?: string;
  dropoffLocationId?: string;
  /** "If a bike goes while I'm booking, put me on the closest one at the same price or less." */
  autoSwap?: boolean;
}

const cookie = createCookie("rb_basket", {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 7,
});

export const EMPTY_BASKET: Basket = { riders: [], extras: {}, addons: {} };

/** Read the basket and size its rider list to the trip's rider count. */
export async function readBasket(request: Request, trip: Trip): Promise<Basket> {
  const raw = (await cookie.parse(request.headers.get("Cookie"))) as Partial<Basket> | null;
  const basket: Basket = {
    riders: Array.isArray(raw?.riders) ? raw!.riders.map(cleanRider) : [],
    extras: cleanCounts(raw?.extras),
    addons: cleanCounts(raw?.addons),
    pickupLocationId: typeof raw?.pickupLocationId === "string" ? raw.pickupLocationId : undefined,
    dropoffLocationId: typeof raw?.dropoffLocationId === "string" ? raw.dropoffLocationId : undefined,
    autoSwap: raw?.autoSwap === true,
  };
  while (basket.riders.length < trip.riders) basket.riders.push({});
  basket.riders.length = trip.riders;
  return basket;
}

export async function basketHeaders(basket: Basket): Promise<HeadersInit> {
  return { "Set-Cookie": await cookie.serialize(basket) };
}

export async function clearBasketHeaders(): Promise<HeadersInit> {
  return { "Set-Cookie": await cookie.serialize(EMPTY_BASKET, { maxAge: 0 }) };
}

function cleanRider(r: unknown): BasketRider {
  if (typeof r !== "object" || r === null) return {};
  const o = r as Record<string, unknown>;
  return {
    name: typeof o.name === "string" ? o.name.slice(0, 60) : undefined,
    heightCm: typeof o.heightCm === "number" && o.heightCm >= 80 && o.heightCm <= 230 ? Math.round(o.heightCm) : undefined,
    bikeTypeId: typeof o.bikeTypeId === "string" ? o.bikeTypeId : undefined,
  };
}

function cleanCounts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof v !== "object" || v === null) return out;
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 20) out[k] = n;
  }
  return out;
}

/** How many riders are on a given bike type. */
export function ridersOn(basket: Basket, bikeTypeId: string): number {
  return basket.riders.filter((r) => r.bikeTypeId === bikeTypeId).length;
}

/** The first rider still without a bike, or -1. */
export function nextRiderWithoutBike(basket: Basket): number {
  return basket.riders.findIndex((r) => !r.bikeTypeId);
}

export function riderLabel(basket: Basket, i: number): string {
  const r = basket.riders[i];
  return r?.name?.trim() ? r.name.trim() : `Rider ${i + 1}`;
}

/**
 * Apply an add/remove from any page. Riders' bikes fill the first empty seat
 * and leave from the last; extras just count. `free` caps both so the basket
 * never promises more than the guard could accept.
 */
export function applyIntent(basket: Basket, bike: { id: string; category: string; free: number }, intent: string): Basket {
  if (bike.category === "extra") {
    const n = basket.extras[bike.id] ?? 0;
    if (intent === "add" && n < bike.free) basket.extras[bike.id] = n + 1;
    if (intent === "remove") {
      if (n <= 1) delete basket.extras[bike.id];
      else basket.extras[bike.id] = n - 1;
    }
    return basket;
  }
  if (intent === "add") {
    const i = nextRiderWithoutBike(basket);
    if (i >= 0 && ridersOn(basket, bike.id) < bike.free) basket.riders[i]!.bikeTypeId = bike.id;
  } else if (intent === "remove") {
    const i = basket.riders.map((r) => r.bikeTypeId).lastIndexOf(bike.id);
    if (i >= 0) delete basket.riders[i]!.bikeTypeId;
  }
  return basket;
}
