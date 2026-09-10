/**
 * Everything the cycling map draws, typed once. The geometry files under
 * public/map/ are produced by scripts/map/build-map-data.ts; the small
 * editorial lists (tunnel texts, notes, POIs, labels, distances) live next
 * to this file as TypeScript so they are reviewable and type-checked.
 */

import type { FeatureCollection, Point } from "geojson";

/** [longitude, latitude], GeoJSON order. */
export type LngLat = [number, number];

/** The print map's road classes, in drawing order from thinnest to loudest. */
export type RoadClass = "local" | "gravel" | "mtb" | "main" | "classA";

export interface RoadProps {
  id: string;
  cls: RoadClass;
  name?: string;
  ref?: string;
  /** Sóljuleið, the buttercup tourist route — a flag on top of the class. */
  buttercup?: boolean;
  /** Single-lane road with lay-bys — drawn with tick marks on top of the class. */
  singleLane?: boolean;
  osmId?: number;
}

export type TunnelLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface TunnelProps {
  id: string;
  kind: "tunnel";
  name: string;
  open: boolean;
  /** Only the seven in the "Special tunnels" panel carry a letter. */
  letter?: TunnelLetter;
  lengthKm?: number;
  osmId?: number;
}

/** A portal is a point at either end of a tunnel; the style draws the end bar there. */
export interface PortalProps {
  id: string;
  kind: "portal";
  tunnelId: string;
  /** Degrees clockwise from north, the direction the tunnel runs at this end. */
  bearing: number;
  open: boolean;
  /** Copied from the tunnel so a click on a portal can name it. */
  name: string;
  letter?: TunnelLetter;
  lengthKm?: number;
}

export interface FerryProps {
  id: string;
  name: string;
  bikes: boolean;
  note?: string;
}

/** The long text for one of the lettered tunnels. */
export interface TunnelInfo {
  letter: TunnelLetter;
  name: string;
  lengthKm: number;
  /** "W-E profile +43 to -105 to +11 m" — copied as printed. */
  profile?: string;
  status: "open" | "closed";
  /** One entry per paragraph. */
  cycling: string;
  bus?: string;
  /** Other spellings OSM may use; the build joins on the name. */
  aliases?: string[];
  /** Where to fly when picked from the legend. */
  at: LngLat;
}

export type PoiKind =
  | "scenicVillage"
  | "petrol"
  | "campTent"
  | "campNoTent"
  | "webcam"
  | "busStop"
  | "bus"
  | "ferryPort"
  | "trailhead"
  | "noCycling"
  | "busyRoad"
  | "demanding"
  | "steep";

export interface Poi {
  id: string;
  kind: PoiKind;
  name: string;
  at: LngLat;
  note?: string;
  url?: string;
  /** Hide below this zoom to keep the overview clean. */
  minzoom?: number;
  /** Guided tours that start or pass here. */
  tourSlugs?: string[];
}

export interface Note {
  id: string;
  at: LngLat;
  text: string;
  /** "See note D" — links the callout to the tunnel panel. */
  refTunnel?: TunnelLetter;
  anchor?: "left" | "right" | "top" | "bottom";
  minzoom?: number;
  /** The print is dated 2025; flag the lines that will go stale. */
  dated?: boolean;
}

export interface MapLabel {
  id: string;
  text: string;
  at: LngLat;
  kind: "island" | "region" | "natural" | "water";
  size?: "sm" | "md" | "lg";
  /** Degrees, for the region names that run along the coast. */
  rotate?: number;
}

export interface DistanceLabel {
  id: string;
  at: LngLat;
  km: number;
}

export interface LoopInfo {
  id: string;
  name: string;
  description: string;
  includesBus?: boolean;
  distanceKm?: number;
  color: string;
  at: LngLat;
  tourSlugs?: string[];
}

export interface TourLink {
  slug: string;
  /** Where the map flies when the tour is picked. */
  at: LngLat;
  zoom?: number;
}

/**
 * What is picked on the map. Tunnels and ferries carry their properties along,
 * because those live only in the GeoJSON the map fetched, not in the page.
 */
export type MapSelection =
  | { kind: "tunnel"; id: string; name: string; open: boolean; letter?: TunnelLetter; lengthKm?: number }
  | { kind: "note"; id: string }
  | { kind: "poi"; id: string }
  | { kind: "ferry"; id: string; name: string; bikes: boolean; note?: string }
  | { kind: "loop"; id: string }
  | { kind: "tour"; slug: string };

/** Where the map should go next; a new object each time so the effect re-runs. */
export interface FlyTarget {
  center: LngLat;
  zoom?: number;
}

export const LAYER_GROUP_IDS = [
  "classA",
  "buttercup",
  "mainRoads",
  "localRoads",
  "tunnels",
  "hazards",
  "ferries",
  "bus",
  "trailheads",
  "villages",
  "services",
  "webcams",
  "distances",
  "notes",
  "loops",
  "tours",
  "print",
] as const;
export type LayerGroupId = (typeof LAYER_GROUP_IDS)[number];

/** The small collections the page builds from the TS lists and hands to the map inline. */
export interface MapContent {
  pois: FeatureCollection<Point>;
  notes: FeatureCollection<Point>;
  labels: FeatureCollection<Point>;
  distances: FeatureCollection<Point>;
}

/** What the loader hands the panel for each tour drawn on the map. */
export interface MapTour {
  slug: string;
  title: string;
  summary: string;
  category: string;
  priceMinor: number;
  durationMin: number;
  distanceKm: number | null;
  image: string | null;
  weekday: string | null;
  nextSeatsLeft: number | null;
}

/** A planned ride: where it starts and ends, and what the router found. */
export interface PlannedRoute {
  coords: LngLat[];
  start: LngLat;
  end: LngLat;
}
