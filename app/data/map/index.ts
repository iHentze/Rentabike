/**
 * The editorial layer of the map as GeoJSON the style can draw inline.
 * Geometry (roads, tunnels, ferries, loops, tours) is fetched from
 * public/map/ instead; see MAP_DATA_URLS in the style.
 */
import type { Feature, FeatureCollection, Point } from "geojson";
import { DISTANCES } from "./distances";
import { LABELS } from "./labels";
import { LOOPS } from "./loops";
import { NOTES } from "./notes";
import { POIS } from "./pois";
import { TOUR_LINKS } from "./tours";
import { TUNNELS } from "./tunnels";
import type { LngLat, MapContent } from "./types";

export { DISTANCES, LABELS, LOOPS, NOTES, POIS, TOUR_LINKS, TUNNELS };

/** When the shop last walked through the notes and tunnels against the real roads. */
export const REVIEWED = "10 September 2026";
export const TIMETABLES_URL = "https://www.ssl.fo/en/";

function point<P extends { id: string; at: LngLat }>(item: P): Feature<Point, Omit<P, "at">> {
  const { at, ...properties } = item;
  return { type: "Feature", id: item.id, geometry: { type: "Point", coordinates: at }, properties };
}

function collection<P extends { id: string; at: LngLat }>(items: readonly P[]): FeatureCollection<Point> {
  return { type: "FeatureCollection", features: items.map(point) };
}

export function mapContent(): MapContent {
  return {
    pois: collection(POIS),
    notes: collection(NOTES),
    labels: collection(LABELS),
    distances: collection(DISTANCES),
  };
}

/** Village names we draw ourselves, so the tile labels must not repeat them. */
export function scenicVillageNames(): string[] {
  return POIS.filter((p) => p.kind === "scenicVillage").map((p) => p.name);
}

/** Every guided tour the map refers to — the loader fetches just these. */
export function tourSlugsOnMap(): string[] {
  const slugs = new Set<string>(TOUR_LINKS.map((t) => t.slug));
  for (const p of POIS) for (const s of p.tourSlugs ?? []) slugs.add(s);
  for (const l of LOOPS) for (const s of l.tourSlugs ?? []) slugs.add(s);
  return [...slugs];
}
