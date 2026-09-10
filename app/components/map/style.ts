/**
 * The map style, built in code rather than shipped as JSON so the palette,
 * the layer order and the legend share one set of ids.
 *
 * The base is OpenFreeMap's vector tiles (land, water, place names) under a
 * hillshade from the AWS terrain tiles — the print's shaded relief. Every
 * road on screen is our own GeoJSON, classified as the print classifies it;
 * the tiles' roads are never drawn, so the map reads like the print, not like
 * a street map.
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { LayerGroupId, MapContent } from "~/data/map/types";

export const FAROE_BOUNDS: [[number, number], [number, number]] = [
  [-7.75, 61.35],
  [-6.2, 62.45],
];
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-9.6, 60.6],
  [-4.4, 63.2],
];

export const MAP_DATA_URLS = {
  roads: "/map/roads.geojson",
  tunnels: "/map/tunnels.geojson",
  ferries: "/map/ferries.geojson",
  loops: "/map/loops.geojson",
  tours: "/map/tours.geojson",
} as const;

export const TILES = {
  vector: "https://tiles.openfreemap.org/planet",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  terrain: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
} as const;

/** The print's paper: pale green land, grey sea, yellow roads. */
export const PAPER = {
  land: "#e3e9d7",
  wood: "#cddab9",
  grass: "#d8e2c6",
  residential: "#d4dbc7",
  sea: "#c3cacf",
  coast: "#8f9aa3",
  river: "#a9b6bd",
  ink: "#1d2429",
  inkSoft: "#4a545c",
  inkMute: "#6c767e",
  yellow: "#f7c948",
  yellowCase: "#8a6a12",
  classA: "#ffd12e",
  classACase: "#5f4a0c",
  white: "#ffffff",
  whiteCase: "#8f9486",
  gravel: "#8a6a3a",
  tunnel: "#7f868c",
  ferry: "#ffffff",
  ferryCase: "#6d777f",
  red: "#d8323c",
  brand: "#0a78d6",
} as const;

const FONT = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
};

const ex = (e: unknown) => e as ExpressionSpecification;
/** A width that grows with zoom: `at8` px at zoom 8, `at14` px at zoom 14. */
const grow = (at8: number, at14: number) => ex(["interpolate", ["exponential", 1.5], ["zoom"], 8, at8, 14, at14]);
const cls = (c: string) => ex(["==", ["get", "cls"], c]);

/**
 * Which style layers each legend row switches. Keep in step with LAYERS
 * below — style.test.ts checks every id here exists.
 */
export const LAYER_GROUPS: Record<LayerGroupId, string[]> = {
  classA: ["road-classA-casing", "road-classA"],
  buttercup: ["road-buttercup"],
  mainRoads: ["road-main-casing", "road-main", "road-singlelane-ticks"],
  localRoads: ["road-local-casing", "road-local", "road-gravel", "road-mtb"],
  tunnels: ["tunnel-closed", "tunnel-open", "tunnel-portals", "tunnels-selected"],
  hazards: ["hazards"],
  ferries: ["ferry-casing", "ferry", "ferry-label", "ferries-selected", "poi-ferry"],
  bus: ["poi-bus"],
  trailheads: ["poi-trailhead"],
  villages: ["poi-scenic"],
  services: ["poi-services"],
  webcams: ["poi-webcam"],
  distances: ["distance-labels"],
  notes: ["notes", "notes-selected"],
  loops: ["loop-halo", "loop-label", "loops-selected"],
  tours: ["tour-halo", "tour-line", "tours-selected"],
};

/** Layers a click can land on, top-most first. */
export const INTERACTIVE_LAYERS = [
  "notes",
  "poi-scenic",
  "poi-webcam",
  "poi-services",
  "poi-trailhead",
  "poi-bus",
  "poi-ferry",
  "hazards",
  "tour-line",
  "loop-halo",
  "ferry",
  "tunnel-open",
  "tunnel-closed",
  "tunnel-portals",
];

/** Island names come in three sizes on the print. */
const sizeFactor = ["match", ["get", "size"], "lg", 1.45, "sm", 0.85, 1];

const selectedWidth = ex(["case", ["boolean", ["feature-state", "selected"], false], 1, 0]);

export function buildStyle(content: MapContent, scenicNames: string[]): StyleSpecification {
  const layers: LayerSpecification[] = [
    { id: "background", type: "background", paint: { "background-color": PAPER.land } },
    {
      id: "landcover-wood",
      type: "fill",
      source: "ofm",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": PAPER.wood, "fill-opacity": 0.7, "fill-antialias": false },
    },
    {
      id: "landcover-grass",
      type: "fill",
      source: "ofm",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "farmland", "wetland"]]],
      paint: { "fill-color": PAPER.grass, "fill-opacity": 0.5, "fill-antialias": false },
    },
    {
      id: "landuse-residential",
      type: "fill",
      source: "ofm",
      "source-layer": "landuse",
      filter: ["==", ["get", "class"], "residential"],
      paint: { "fill-color": PAPER.residential, "fill-opacity": 0.8, "fill-antialias": false },
    },
    { id: "water", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": PAPER.sea } },
    {
      id: "coastline",
      type: "line",
      source: "ofm",
      "source-layer": "water",
      paint: { "line-color": PAPER.coast, "line-width": grow(0.6, 1.4), "line-opacity": 0.8 },
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: "dem",
      paint: {
        "hillshade-exaggeration": ex(["interpolate", ["linear"], ["zoom"], 7, 0.55, 11, 0.45, 14, 0.25]),
        "hillshade-shadow-color": "#5b6656",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#4c5747",
        "hillshade-illumination-anchor": "map",
        "hillshade-illumination-direction": 335,
      },
    },
    {
      id: "waterway",
      type: "line",
      source: "ofm",
      "source-layer": "waterway",
      minzoom: 11,
      paint: { "line-color": PAPER.river, "line-width": grow(0.4, 1.2) },
    },

    // --- roads, thinnest class first ------------------------------------
    {
      id: "road-local-casing",
      type: "line",
      source: "roads",
      filter: cls("local"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.whiteCase, "line-width": grow(1.4, 5.2) },
    },
    {
      id: "road-local",
      type: "line",
      source: "roads",
      filter: cls("local"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.white, "line-width": grow(0.7, 3.4) },
    },
    {
      id: "road-gravel",
      type: "line",
      source: "roads",
      filter: cls("gravel"),
      layout: { "line-join": "round" },
      paint: { "line-color": PAPER.gravel, "line-width": grow(0.9, 3), "line-dasharray": [2, 1.4] },
    },
    {
      id: "road-mtb",
      type: "line",
      source: "roads",
      filter: cls("mtb"),
      layout: { "line-join": "round" },
      paint: { "line-color": PAPER.ink, "line-width": grow(0.7, 2.2), "line-dasharray": [1.2, 1.2] },
    },
    {
      id: "road-main-casing",
      type: "line",
      source: "roads",
      filter: cls("main"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.yellowCase, "line-width": grow(2.2, 7) },
    },
    {
      id: "road-main",
      type: "line",
      source: "roads",
      filter: cls("main"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.yellow, "line-width": grow(1.2, 4.6) },
    },
    // A wide, sparse dash under a narrow road reads as the lay-by tick marks.
    {
      id: "road-singlelane-ticks",
      type: "line",
      source: "roads",
      filter: ["==", ["get", "singleLane"], true],
      minzoom: 9,
      paint: { "line-color": PAPER.yellowCase, "line-width": grow(6, 14), "line-dasharray": [0.18, 2.4] },
    },
    {
      id: "road-classA-casing",
      type: "line",
      source: "roads",
      filter: cls("classA"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.classACase, "line-width": grow(3.6, 11) },
    },
    {
      id: "road-classA",
      type: "line",
      source: "roads",
      filter: cls("classA"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.classA, "line-width": grow(2.4, 8) },
    },
    {
      id: "road-buttercup",
      type: "symbol",
      source: "roads",
      filter: ["==", ["get", "buttercup"], true],
      minzoom: 8.5,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 160,
        "icon-image": "buttercup",
        "icon-size": ex(["interpolate", ["linear"], ["zoom"], 8.5, 0.28, 13, 0.5]),
        "icon-rotation-alignment": "viewport",
        "icon-allow-overlap": false,
      },
    },

    // --- tunnels ---------------------------------------------------------
    {
      id: "tunnel-closed",
      type: "line",
      source: "tunnels",
      filter: ["all", ["==", ["get", "kind"], "tunnel"], ["!", ["get", "open"]]],
      paint: { "line-color": PAPER.tunnel, "line-width": grow(1.6, 5), "line-dasharray": [1.6, 1.6] },
    },
    {
      id: "tunnel-open",
      type: "line",
      source: "tunnels",
      filter: ["all", ["==", ["get", "kind"], "tunnel"], ["get", "open"]],
      layout: { "line-cap": "butt" },
      paint: { "line-color": PAPER.tunnel, "line-width": grow(2.4, 6.5) },
    },
    {
      id: "tunnels-selected",
      type: "line",
      source: "tunnels",
      filter: ["==", ["get", "kind"], "tunnel"],
      paint: { "line-color": PAPER.brand, "line-width": grow(6, 14), "line-opacity": ex(["*", 0.45, selectedWidth]) },
    },
    {
      id: "tunnel-portals",
      type: "symbol",
      source: "tunnels",
      filter: ["==", ["get", "kind"], "portal"],
      minzoom: 8.5,
      layout: {
        "icon-image": "portal",
        "icon-rotate": ex(["get", "bearing"]),
        "icon-rotation-alignment": "map",
        "icon-size": ex(["interpolate", ["linear"], ["zoom"], 8.5, 0.22, 14, 0.5]),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },

    // --- ferries ---------------------------------------------------------
    {
      id: "ferry-casing",
      type: "line",
      source: "ferries",
      paint: { "line-color": PAPER.ferryCase, "line-width": grow(2.2, 5), "line-dasharray": [3, 2.2] },
    },
    {
      id: "ferry",
      type: "line",
      source: "ferries",
      paint: { "line-color": PAPER.ferry, "line-width": grow(1.1, 2.6), "line-dasharray": [3, 2.2] },
    },
    {
      id: "ferries-selected",
      type: "line",
      source: "ferries",
      paint: { "line-color": PAPER.brand, "line-width": grow(6, 14), "line-opacity": ex(["*", 0.45, selectedWidth]) },
    },
    {
      id: "ferry-label",
      type: "symbol",
      source: "ferries",
      minzoom: 10,
      layout: {
        "symbol-placement": "line",
        "text-field": ex(["get", "name"]),
        "text-font": FONT.italic,
        "text-size": 11,
        "text-letter-spacing": 0.05,
      },
      paint: { "text-color": PAPER.inkSoft, "text-halo-color": PAPER.sea, "text-halo-width": 1.5 },
    },

    // --- named loops and our tours: soft halos along the roads -----------
    {
      id: "loop-halo",
      type: "line",
      source: "loops",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ex(["get", "color"]), "line-width": grow(3.5, 22), "line-opacity": 0.28, "line-blur": 1 },
    },
    {
      id: "loops-selected",
      type: "line",
      source: "loops",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ex(["get", "color"]), "line-width": grow(3.5, 22), "line-opacity": ex(["*", 0.35, selectedWidth]) },
    },
    {
      id: "loop-label",
      type: "symbol",
      source: "loops",
      minzoom: 9,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 600,
        "text-field": ex(["get", "name"]),
        "text-font": FONT.bold,
        "text-size": 11,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.18,
      },
      paint: { "text-color": ex(["get", "color"]), "text-halo-color": PAPER.white, "text-halo-width": 1.6 },
    },
    {
      id: "tour-halo",
      type: "line",
      source: "tours",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.brand, "line-width": grow(3, 18), "line-opacity": 0.25, "line-blur": 1 },
    },
    {
      id: "tour-line",
      type: "line",
      source: "tours",
      layout: { "line-join": "round" },
      paint: { "line-color": PAPER.brand, "line-width": grow(1.4, 3.2), "line-dasharray": [1, 1.6] },
    },
    {
      id: "tours-selected",
      type: "line",
      source: "tours",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": PAPER.brand, "line-width": grow(3, 18), "line-opacity": ex(["*", 0.4, selectedWidth]) },
    },

    // --- points ----------------------------------------------------------
    {
      id: "hazards",
      type: "symbol",
      source: "pois",
      filter: ["in", ["get", "kind"], ["literal", ["noCycling", "busyRoad", "demanding", "steep"]]],
      layout: {
        "icon-image": ex(["get", "kind"]),
        "icon-size": ex(["interpolate", ["linear"], ["zoom"], 7, 0.3, 12, 0.55]),
        "icon-allow-overlap": true,
      },
    },
    {
      id: "distance-labels",
      type: "symbol",
      source: "distances",
      minzoom: 9.5,
      layout: {
        "text-field": ex(["to-string", ["get", "km"]]),
        "text-font": FONT.bold,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 9.5, 10, 13, 13]),
        "text-padding": 4,
      },
      paint: { "text-color": PAPER.ink, "text-halo-color": PAPER.land, "text-halo-width": 1.8 },
    },
    ...poiLayer("poi-services", ["petrol", "campTent", "campNoTent"]),
    ...poiLayer("poi-bus", ["bus", "busStop"]),
    ...poiLayer("poi-ferry", ["ferryPort"]),
    ...poiLayer("poi-trailhead", ["trailhead"]),
    ...poiLayer("poi-webcam", ["webcam"]),
    {
      id: "poi-scenic",
      type: "symbol",
      source: "pois",
      filter: ["==", ["get", "kind"], "scenicVillage"],
      layout: {
        "icon-image": "scenicVillage",
        "icon-size": ex(["interpolate", ["linear"], ["zoom"], 7, 0.3, 12, 0.5]),
        "icon-anchor": "bottom",
        "text-field": ex(["get", "name"]),
        "text-font": FONT.bold,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 7, 9.5, 12, 13]),
        "text-anchor": "top",
        "text-offset": [0, 0.3],
        "text-optional": true,
      },
      paint: { "text-color": PAPER.ink, "text-halo-color": PAPER.land, "text-halo-width": 1.6 },
    },
    {
      id: "points-selected",
      type: "circle",
      source: "pois",
      paint: {
        "circle-radius": ex(["interpolate", ["linear"], ["zoom"], 7, 12, 13, 22]),
        "circle-color": PAPER.brand,
        "circle-opacity": ex(["*", 0.25, selectedWidth]),
        "circle-stroke-color": PAPER.brand,
        "circle-stroke-width": ex(["*", 2, selectedWidth]),
      },
    },

    // --- names -----------------------------------------------------------
    {
      id: "place-town",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 7.5,
      filter: ["all", ["in", ["get", "class"], ["literal", ["city", "town"]]], ["!", ["in", ["get", "name"], ["literal", scenicNames]]]],
      layout: {
        "text-field": ex(["coalesce", ["get", "name:latin"], ["get", "name"]]),
        "text-font": FONT.bold,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 7.5, 11, 12, 15]),
        "text-anchor": "top",
        "text-offset": [0, 0.2],
      },
      paint: { "text-color": PAPER.ink, "text-halo-color": PAPER.land, "text-halo-width": 1.6 },
    },
    {
      id: "place-village",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 9,
      filter: ["all", ["in", ["get", "class"], ["literal", ["village", "hamlet"]]], ["!", ["in", ["get", "name"], ["literal", scenicNames]]]],
      layout: {
        "text-field": ex(["coalesce", ["get", "name:latin"], ["get", "name"]]),
        "text-font": FONT.regular,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 9, 9.5, 13, 13]),
        "text-anchor": "top",
        "text-offset": [0, 0.2],
      },
      paint: { "text-color": PAPER.inkSoft, "text-halo-color": PAPER.land, "text-halo-width": 1.4 },
    },
    {
      id: "label-natural",
      type: "symbol",
      source: "labels",
      filter: ["==", ["get", "kind"], "natural"],
      minzoom: 9.5,
      layout: { "text-field": ex(["get", "text"]), "text-font": FONT.italic, "text-size": 11, "text-max-width": 8 },
      paint: { "text-color": PAPER.inkSoft, "text-halo-color": PAPER.land, "text-halo-width": 1.4 },
    },
    {
      id: "label-water",
      type: "symbol",
      source: "labels",
      filter: ["==", ["get", "kind"], "water"],
      layout: {
        "text-field": ex(["get", "text"]),
        "text-font": FONT.italic,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 7, 10, 11, 14]),
        "text-letter-spacing": 0.3,
        "text-rotate": ex(["coalesce", ["get", "rotate"], 0]),
      },
      paint: { "text-color": PAPER.inkMute, "text-halo-color": PAPER.sea, "text-halo-width": 1 },
    },
    {
      id: "label-island",
      type: "symbol",
      source: "labels",
      filter: ["==", ["get", "kind"], "island"],
      maxzoom: 12,
      layout: {
        "text-field": ex(["get", "text"]),
        "text-font": FONT.italic,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 7, ["*", 11, sizeFactor], 11, ["*", 20, sizeFactor]]),
        "text-letter-spacing": 0.32,
        "text-rotate": ex(["coalesce", ["get", "rotate"], 0]),
        "text-allow-overlap": true,
      },
      paint: { "text-color": PAPER.inkSoft, "text-opacity": 0.85, "text-halo-color": PAPER.land, "text-halo-width": 1.2 },
    },
    {
      id: "label-region",
      type: "symbol",
      source: "labels",
      filter: ["==", ["get", "kind"], "region"],
      maxzoom: 10.5,
      layout: {
        "text-field": ex(["get", "text"]),
        "text-font": FONT.italic,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 7, 13, 10, 24]),
        "text-letter-spacing": 0.5,
        "text-rotate": ex(["coalesce", ["get", "rotate"], 0]),
        "text-allow-overlap": true,
      },
      paint: { "text-color": PAPER.inkMute, "text-opacity": 0.55 },
    },
    {
      id: "notes-selected",
      type: "circle",
      source: "notes",
      paint: {
        "circle-radius": 10,
        "circle-color": PAPER.brand,
        "circle-opacity": ex(["*", 0.3, selectedWidth]),
        "circle-stroke-color": PAPER.brand,
        "circle-stroke-width": ex(["*", 2, selectedWidth]),
      },
    },
    {
      id: "notes",
      type: "symbol",
      source: "notes",
      minzoom: 8.5,
      layout: {
        "icon-image": "noteDot",
        "icon-size": 0.32,
        "icon-allow-overlap": true,
        "text-field": ex(["get", "text"]),
        "text-font": FONT.italic,
        "text-size": ex(["interpolate", ["linear"], ["zoom"], 8.5, 9.5, 12, 11.5]),
        "text-max-width": 11,
        "text-anchor": ex(["coalesce", ["get", "anchor"], "top"]),
        "text-radial-offset": 0.7,
        "text-justify": "auto",
        "text-optional": true,
        "symbol-sort-key": ex(["coalesce", ["get", "minzoom"], 0]),
      },
      paint: { "text-color": PAPER.ink, "text-halo-color": PAPER.white, "text-halo-width": 2 },
    },
  ];

  return {
    version: 8,
    glyphs: TILES.glyphs,
    sources: {
      ofm: { type: "vector", url: TILES.vector },
      dem: {
        type: "raster-dem",
        tiles: [TILES.terrain],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        attribution: "Terrain: Mapzen / AWS Open Data",
      },
      roads: { type: "geojson", data: MAP_DATA_URLS.roads, promoteId: "id", attribution: "Roads © OpenStreetMap contributors" },
      tunnels: { type: "geojson", data: MAP_DATA_URLS.tunnels, promoteId: "id" },
      ferries: { type: "geojson", data: MAP_DATA_URLS.ferries, promoteId: "id" },
      loops: { type: "geojson", data: MAP_DATA_URLS.loops, promoteId: "id" },
      tours: { type: "geojson", data: MAP_DATA_URLS.tours, promoteId: "id" },
      pois: { type: "geojson", data: content.pois, promoteId: "id" },
      notes: { type: "geojson", data: content.notes, promoteId: "id" },
      labels: { type: "geojson", data: content.labels, promoteId: "id" },
      distances: { type: "geojson", data: content.distances, promoteId: "id" },
    },
    layers,
  };
}

function poiLayer(id: string, kinds: string[]): LayerSpecification[] {
  return [
    {
      id,
      type: "symbol",
      source: "pois",
      filter: ["all", ["in", ["get", "kind"], ["literal", kinds]], [">=", ["zoom"], ["coalesce", ["get", "minzoom"], 0]]],
      layout: {
        "icon-image": ex(["get", "kind"]),
        "icon-size": ex(["interpolate", ["linear"], ["zoom"], 7, 0.3, 12, 0.5]),
        "icon-allow-overlap": true,
        "icon-padding": 1,
      },
    },
  ];
}
