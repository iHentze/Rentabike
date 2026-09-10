/**
 * The basket — which rider gets which bike, the extras, where the bikes are
 * collected and returned — lives in a cookie so every page of the funnel can
 * be reloaded and no server state exists until the customer actually books.
 * Prices are never stored here: ids and quantities only. The server prices.
 */
import { createCookie } from "react-router";
import { readTrip, tripHref, tripParams, type Trip } from "./trip";

export interface BasketRider {
  name?: string;
  heightCm?: number;
  bikeTypeId?: string;
  /** This rider's own extras — helmet, pedals, bags — from their bike's allowlist: addon id → quantity. */
  addons: Record<string, number>;
  /** The rider has been through their extras step, even if they chose nothing. */
  extrasDone?: boolean;
  /** Asked about a helmet by name and said no. Without this a "no" leaves no trace and the question looks unanswered. */
  helmetDeclined?: boolean;
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
  /**
   * The trip this basket was last touched with, as query params. The trip
   * lives in the URL; this copy is what lets a customer who wandered off to
   * the home page or a tour pick the booking up again from where they were.
   */
  trip?: string;
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
    trip: tripParams(trip).toString(),
  };
  while (basket.riders.length < trip.riders) basket.riders.push({ addons: {} });
  basket.riders.length = trip.riders;
  if (!basket.pickupLocationId && trip.pickupLocationId) basket.pickupLocationId = trip.pickupLocationId;
  if (!basket.dropoffLocationId && trip.dropoffLocationId) basket.dropoffLocationId = trip.dropoffLocationId;
  return basket;
}

/** What the resume bar needs to know about an unfinished booking, from any page, without a trip in the URL. */
export interface BasketPeek {
  /** The trip as query params — append to /riders or /checkout. */
  trip: string;
  riders: number;
  /** Riders with a bike picked. */
  withBike: number;
  /** Riders with a bike and a height — the ones the counter can fit. */
  ridersReady: number;
  /** Own-bike bookings: helmets and bags only, no rider steps. */
  ownBike: boolean;
  /** Where "Continue" goes. */
  href: string;
}

/**
 * Read the basket cookie for what it says about an unfinished booking, or
 * null if there is nothing to resume. Used by the root loader on every page.
 */
export async function peekBasket(request: Request, now: number = Date.now()): Promise<BasketPeek | null> {
  const raw = (await cookie.parse(request.headers.get("Cookie"))) as Partial<Basket> | null;
  if (!raw || typeof raw.trip !== "string" || !raw.trip) return null;
  const params = new URLSearchParams(raw.trip);
  const trip = params.has("tour") ? null : readTrip(params, now);
  // A tour basket carries a departure id; the riders page resolves it. A rental in the past is not worth resuming.
  if (trip && trip.startAt.getTime() < now) return null;
  const riders = Array.isArray(raw.riders) ? raw.riders.map(cleanRider) : [];
  const extras = cleanCounts(raw.extras);
  const addons = cleanCounts(raw.addons);
  const started = riders.some((r) => r.bikeTypeId || r.heightCm || r.name) || Object.keys(extras).length > 0 || Object.keys(addons).length > 0;
  if (!started) return null;
  const basket: Basket = { riders, extras, addons };
  const ownBike = ownBikeOnly(basket);
  const next = nextStep(basket);
  const href = ownBike || !next ? `/checkout?${params}` : `/riders?${params}&r=${next.rider + 1}&step=${next.step}`;
  return {
    trip: params.toString(),
    riders: riders.length,
    withBike: riders.filter((r) => r.bikeTypeId).length,
    ridersReady: riders.filter((r) => riderReady(r) && r.bikeTypeId).length,
    ownBike,
    href,
  };
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
    helmetDeclined: o.helmetDeclined === true,
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

/**
 * A rider we can hand a bike to: one with a height, because the frame is
 * sized to the rider. A name is welcome but not needed — "Rider 2" is a
 * perfectly good label at the counter.
 */
export function riderReady(r: BasketRider): boolean {
  return typeof r.heightCm === "number";
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
  const noBike = basket.riders.findIndex((r) => !r.bikeTypeId || !riderReady(r));
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
