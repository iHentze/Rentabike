/**
 * A tour booking is an ordinary booking whose dates are the departure's and
 * whose bikes come from the tour's allowlist at no charge. `?tour=<departure>`
 * on any funnel page switches it into that mode; everything else — riders,
 * basket, the guard — is the same code.
 */
import { readTrip, type Trip } from "./trip";
import { getDeparture } from "./tours/catalogue";

export interface TourContext {
  departureId: string;
  tourId: string;
  slug: string;
  title: string;
  requiresBike: boolean;
  allowedBikeTypeIds: string[];
  /** Per person. */
  priceMinor: number;
  seatsLeft: number;
  bookable: boolean;
  startsAt: number;
  endsAt: number;
}

export interface Resolved {
  trip: Trip;
  tour: TourContext | null;
}

/** Trip from the URL, or from the departure when `tour=` is present. */
export async function resolveTrip(d1: D1Database, params: URLSearchParams, now: number = Date.now()): Promise<Resolved> {
  const depId = params.get("tour");
  if (!depId) return { trip: readTrip(params, now), tour: null };
  const dep = await getDeparture(d1, depId, now);
  if (!dep) return { trip: readTrip(params, now), tour: null };
  const t = await d1
    .prepare(`SELECT id, slug, title, requires_bike FROM tours WHERE id = ?1`)
    .bind(dep.tourId)
    .first<{ id: string; slug: string; title: string; requires_bike: number }>();
  if (!t) return { trip: readTrip(params, now), tour: null };
  const allowed = await d1.prepare(`SELECT bike_type_id FROM tour_bike_types WHERE tour_id = ?1`).bind(t.id).all<{ bike_type_id: string }>();
  const ridersRaw = Number.parseInt(params.get("riders") ?? "", 10);
  const riders = Number.isFinite(ridersRaw) ? Math.min(12, Math.max(1, ridersRaw)) : 1;
  const trip: Trip = { startAt: new Date(dep.startsAt), endAt: new Date(dep.endsAt), riders, explicit: true, tourDepartureId: depId };
  return {
    trip,
    tour: {
      departureId: depId,
      tourId: t.id,
      slug: t.slug,
      title: t.title,
      requiresBike: Boolean(t.requires_bike),
      allowedBikeTypeIds: (allowed.results ?? []).map((r) => r.bike_type_id),
      priceMinor: dep.priceMinor,
      seatsLeft: dep.seatsLeft,
      bookable: dep.bookable,
      startsAt: dep.startsAt,
      endsAt: dep.endsAt,
    },
  };
}
