/**
 * The basket — which rider gets which bike, the extras, where the bikes are
 * collected and returned — lives in a cookie so every page of the funnel can
 * be reloaded and no server state exists until the customer actually books.
 * Prices are never stored here: ids and quantities only. The server prices.
 */
import { createCookie } from "react-router";
import { tripHref, type Trip } from "./trip";

export interface BasketRider {
  name?: string;
  heightCm?: number;
  bikeTypeId?: string;
  /** This rider's own extras — helmet, pedals, bags — from their bike's allowlist: addon id → quantity. */
  addons: Record<string, number>;
  /** The rider has been through their extras step, even if they chose nothing. */
  extrasDone?: boolean;
}

export interface Basket {
  riders: BasketRider[];
  /** Rentable extras (child seats, bags, pedals for your own bike): bike_type id → quantity. */
  extras: Record<string, number>;
  /** Add-ons that belong to the booking rather than a rider — car carriers, bag storage, and helmets for people on their own bikes: addon id → quantity. */
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
  while (basket.riders.length < trip.riders) basket.riders.push({ addons: {} });
  basket.riders.length = trip.riders;
  if (!basket.pickupLocationId && trip.pickupLocationId) basket.pickupLocationId = trip.pickupLocationId;
  if (!basket.dropoffLocationId && trip.dropoffLocationId) basket.dropoffLocationId = trip.dropoffLocationId;
  return basket;
}

export async function basketHeaders(basket: Basket): Promise<HeadersInit> {
  return { "Set-Cookie": await cookie.serialize(basket) };
}

export async function clearBasketHeaders(): Promise<HeadersInit> {
  return { "Set-Cookie": await cookie.serialize(EMPTY_BASKET, { maxAge: 0 }) };
}

function cleanRider(r: unknown): BasketRider {
  if (typeof r !== "object" || r === null) return { addons: {} };
  const o = r as Record<string, unknown>;
  return {
    name: typeof o.name === "string" ? o.name.slice(0, 60) : undefined,
    heightCm: typeof o.heightCm === "number" && o.heightCm >= 80 && o.heightCm <= 230 ? Math.round(o.heightCm) : undefined,
    bikeTypeId: typeof o.bikeTypeId === "string" ? o.bikeTypeId : undefined,
    addons: cleanCounts(o.addons),
    extrasDone: o.extrasDone === true,
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

/** Nothing but helmets and bags — the customer has their own bike. */
export function ownBikeOnly(basket: Basket): boolean {
  return basket.riders.every((r) => !r.bikeTypeId) && (Object.keys(basket.addons).length > 0 || Object.keys(basket.extras).length > 0);
}

/** How many riders are on a given bike type. */
export function ridersOn(basket: Basket, bikeTypeId: string): number {
  return basket.riders.filter((r) => r.bikeTypeId === bikeTypeId).length;
}

/** The first rider still without a bike, or -1. */
export function nextRiderWithoutBike(basket: Basket): number {
  return basket.riders.findIndex((r) => !r.bikeTypeId);
}

/** "Jóhanna", "Rider 2" — and "Anna (2)" when two riders share a name, so every line in the quote points at one person. */
export function riderLabel(basket: Basket, i: number): string {
  const name = basket.riders[i]?.name?.trim();
  if (!name) return `Rider ${i + 1}`;
  const earlier = basket.riders.slice(0, i).filter((r) => r.name?.trim().toLowerCase() === name.toLowerCase()).length;
  return earlier ? `${name} (${earlier + 1})` : name;
}

export interface FunnelStep {
  rider: number;
  step: "bike" | "extras";
}

/**
 * Where the funnel goes next: the first rider without a bike, else the first
 * rider who has not been asked about their extras, else nowhere — checkout.
 * One rider at a time, bike then extras, so nobody reaches checkout without
 * having been asked about a helmet by name.
 */
export function nextStep(basket: Basket): FunnelStep | null {
  const noBike = basket.riders.findIndex((r) => !r.bikeTypeId);
  if (noBike >= 0) return { rider: noBike, step: "bike" };
  const noExtras = basket.riders.findIndex((r) => r.bikeTypeId && !r.extrasDone);
  if (noExtras >= 0) return { rider: noExtras, step: "extras" };
  return null;
}

export function stepHref(trip: Trip, step: FunnelStep): string {
  return tripHref("/riders", trip, { r: step.rider + 1, step: step.step });
}

/** Put a rider on a bike. Extras that the new bike cannot take are dropped, and the rider is asked about extras again. */
export function assignBike(rider: BasketRider, bike: { id: string; addonIds?: string[] }): void {
  if (rider.bikeTypeId !== bike.id) rider.extrasDone = false;
  rider.bikeTypeId = bike.id;
  if (bike.addonIds) for (const id of Object.keys(rider.addons)) if (!bike.addonIds.includes(id)) delete rider.addons[id];
}

/** Take a rider off their bike. Their extras go with it — they belonged to that bike. */
export function unassignBike(rider: BasketRider): void {
  delete rider.bikeTypeId;
  rider.addons = {};
  rider.extrasDone = false;
}

/**
 * Apply an add/remove from any page. Riders' bikes fill the first empty seat
 * and leave from the last; extras just count. `free` caps both so the basket
 * never promises more than the guard could accept.
 */
export function applyIntent(basket: Basket, bike: { id: string; category: string; free: number; addonIds?: string[] }, intent: string): Basket {
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
    if (i >= 0 && ridersOn(basket, bike.id) < bike.free) assignBike(basket.riders[i]!, bike);
  } else if (intent === "remove") {
    const i = basket.riders.map((r) => r.bikeTypeId).lastIndexOf(bike.id);
    if (i >= 0) unassignBike(basket.riders[i]!);
  }
  return basket;
}
