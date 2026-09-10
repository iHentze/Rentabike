/**
 * Roads, tunnels, ferries, loops and tours for the cycling map, from
 * OpenStreetMap, classified as the print classifies them.
 *
 *   npm run map:build            rebuild public/map/*.geojson from the cache
 *   npm run map:build -- --fetch refresh the cache from Overpass first
 *   npm run map:list [-- --fetch] print the places OSM knows, for authoring
 *
 * The cache (scripts/map/cache/) is committed, so the build is reproducible
 * offline; the workflow .github/workflows/map-data.yml refreshes it on a
 * runner with network access.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from "geojson";
import { LOOPS } from "../../app/data/map/loops";
import { TUNNELS } from "../../app/data/map/tunnels";
import type { FerryProps, PortalProps, RoadClass, RoadProps, TunnelProps } from "../../app/data/map/types";
import { CLASS_A, FERRIES_NO_BIKES, GRAVEL, HIGHWAY_DEFAULT, LOCAL, LOOP_ROUTES, MAIN, MTB, TOUR_ROUTES, TUNNELS_CLOSED, type RouteSpec } from "./classification";
import { RoadGraph, distanceM, type Segment } from "./graph";
import { QUERIES, overpass, type OsmNode, type OsmWay } from "./overpass";
import { round5, simplify, type Coord } from "./simplify";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "public", "map");
const HAND = join(HERE, "hand");
const TOLERANCE = 0.00003; // ≈ 3 m
const SNAP_MAX_M = 1500;

const args = new Set(process.argv.slice(2));
const fetchFresh = args.has("--fetch");

async function main() {
  // One query at a time: the public Overpass servers rate-limit parallel calls.
  const placesRaw = await overpass("places", QUERIES.places, fetchFresh);
  const ferriesRaw = await overpass("ferries", QUERIES.ferries, fetchFresh);
  const roadsRaw = await overpass("roads", QUERIES.roads, fetchFresh);
  const ways = roadsRaw.filter((e): e is OsmWay => e.type === "way");
  const places = placesRaw.filter((e): e is OsmNode => e.type === "node" && Number.isFinite(e.lat) && Number.isFinite(e.lon));
  if (places.length === 0) throw new Error("the places cache has no coordinates — refetch with --fetch");

  if (args.has("--list")) return list(places);

  const graph = new RoadGraph(ways);
  const warnings: string[] = [];
  const resolve = placeResolver(places, warnings);

  // 1. Which segment gets which class. Later routes win, so Class A last.
  const cls = new Map<string, RoadClass>();
  const flags = new Map<string, { buttercup?: boolean; singleLane?: boolean }>();
  const routeOf = new Map<string, string>();
  const trace = (spec: RouteSpec, onSegment: (s: Segment) => void) => {
    const pins = spec.via.map(resolve);
    if (pins.some((p) => !p)) {
      warnings.push(`route ${spec.id}: skipped, unresolved place`);
      return;
    }
    for (let i = 1; i < pins.length; i++) {
      const a = graph.nearestNode(pins[i - 1]!);
      const b = graph.nearestNode(pins[i]!);
      if (!a || !b) continue;
      if (a.distM > SNAP_MAX_M || b.distM > SNAP_MAX_M) warnings.push(`route ${spec.id}: leg ${i} snapped ${Math.round(Math.max(a.distM, b.distM))} m from the road`);
      const path = graph.shortestPath(a.node, b.node, (s) => cost(s, spec));
      if (!path) {
        warnings.push(`route ${spec.id}: no road between ${spec.via[i - 1]} and ${spec.via[i]}`);
        continue;
      }
      for (const s of path) onSegment(s);
    }
  };
  const classify = (specs: RouteSpec[], c: RoadClass) => {
    for (const spec of specs) {
      trace(spec, (s) => {
        cls.set(s.id, c);
        routeOf.set(s.id, spec.id);
        const f = flags.get(s.id) ?? {};
        if (spec.buttercup) f.buttercup = true;
        if (spec.singleLane) f.singleLane = true;
        flags.set(s.id, f);
      });
    }
  };
  classify(LOCAL, "local");
  classify(GRAVEL, "gravel");
  classify(MTB, "mtb");
  classify(MAIN, "main");
  classify(CLASS_A, "classA");

  // 2. Roads and tunnels.
  const roads: Feature<LineString, RoadProps>[] = [];
  const tunnelSegs = new Map<string, Segment[]>();
  for (const s of graph.segments) {
    const c = cls.get(s.id) ?? HIGHWAY_DEFAULT[s.tags.highway ?? ""] ?? null;
    if (!c) continue;
    if (s.tags.tunnel && s.tags.tunnel !== "no" && s.tags.tunnel !== "building_passage") {
      const key = s.tags.name ?? `way-${s.wayId}`;
      tunnelSegs.set(key, [...(tunnelSegs.get(key) ?? []), s]);
      continue;
    }
    const f = flags.get(s.id) ?? {};
    roads.push({
      type: "Feature",
      id: s.id,
      geometry: { type: "LineString", coordinates: simplify(s.coords, TOLERANCE).map(round5) },
      properties: { id: s.id, cls: c, ...(s.tags.name && { name: s.tags.name }), ...(s.tags.ref && { ref: s.tags.ref }), ...(f.buttercup && { buttercup: true }), ...(f.singleLane && { singleLane: true }), osmId: s.wayId },
    });
  }

  // Tunnels sharing a letter (the Kalsoy ones, D) become one feature.
  const tunnelGroups = new Map<string, { info: (typeof TUNNELS)[number] | undefined; name: string; segs: Segment[]; parts: Segment[][] }>();
  for (const [name, segs] of tunnelSegs) {
    const info = TUNNELS.find((t) => t.name === name || t.aliases?.includes(name));
    const key = info ? info.letter : name;
    const g = tunnelGroups.get(key) ?? { info, name: info?.name ?? (name.startsWith("way-") ? "Tunnel" : name), segs: [], parts: [] };
    g.segs.push(...segs);
    g.parts.push(segs);
    tunnelGroups.set(key, g);
    if (!info && !TUNNELS_CLOSED.includes(name)) warnings.push(`tunnel "${name}" (${Math.round(segs.reduce((m, s) => m + s.lengthM, 0) / 100) / 10} km) is not in the A–G list and not in TUNNELS_CLOSED — drawn as open`);
  }
  const tunnels: Feature<MultiLineString | Point, TunnelProps | PortalProps>[] = [];
  for (const [key, g] of tunnelGroups) {
    const id = g.info ? `tunnel-${g.info.letter}` : `tunnel-${g.segs[0]!.wayId}`;
    const open = g.info ? g.info.status === "open" : !TUNNELS_CLOSED.includes(key);
    const km = Math.round((g.segs.reduce((m, s) => m + s.lengthM, 0) / 1000) * 10) / 10;
    const props: TunnelProps = { id, kind: "tunnel", name: g.name, open, ...(g.info && { letter: g.info.letter }), lengthKm: g.info?.lengthKm ?? km, osmId: g.segs[0]!.wayId };
    tunnels.push({ type: "Feature", id, geometry: { type: "MultiLineString", coordinates: g.segs.map((s) => simplify(s.coords, TOLERANCE).map(round5)) }, properties: props });
    // Portals: per tunnel, the ends no other segment of that tunnel continues.
    let p = 0;
    for (const segs of g.parts) {
      const degree = new Map<number, number>();
      for (const s of segs) for (const n of [s.from, s.to]) degree.set(n, (degree.get(n) ?? 0) + 1);
      for (const s of segs) {
        for (const end of ["from", "to"] as const) {
          if ((degree.get(s[end]) ?? 0) !== 1) continue;
          const coords = end === "from" ? s.coords : [...s.coords].reverse();
          const at = coords[0]!;
          const next = coords.find((c) => distanceM(c, at) > 15) ?? coords[coords.length - 1]!;
          const portal = { id: `${id}-p${p++}`, kind: "portal" as const, tunnelId: id, bearing: Math.round(bearing(at, next)), open, name: props.name, letter: props.letter, lengthKm: props.lengthKm };
          tunnels.push({ type: "Feature", id: portal.id, geometry: { type: "Point", coordinates: round5(at) }, properties: portal });
        }
      }
    }
  }
  for (const t of TUNNELS) if (!tunnelGroups.has(t.letter)) warnings.push(`tunnel ${t.letter} ${t.name}: no OSM tunnel of that name`);

  // 3. Ferries.
  const ferries: Feature<LineString, FerryProps>[] = ferriesRaw
    .filter((e): e is OsmWay => e.type === "way" && !!e.geometry)
    .map((w) => {
      const name = w.tags?.name ?? [w.tags?.from, w.tags?.to].filter(Boolean).join(" – ") ?? `Ferry ${w.id}`;
      const text = `${name} ${w.tags?.from ?? ""} ${w.tags?.to ?? ""}`;
      const bikes = !FERRIES_NO_BIKES.some((n) => text.includes(n));
      return {
        type: "Feature" as const,
        id: `ferry-${w.id}`,
        geometry: { type: "LineString" as const, coordinates: simplify(w.geometry.map((g): Coord => [g.lon, g.lat]), TOLERANCE).map(round5) },
        properties: { id: `ferry-${w.id}`, name, bikes, ...(!bikes && { note: "Bikes not accepted on this ferry." }) },
      };
    });

  // 4. Loops and tours, as the roads they follow.
  const lines = (spec: RouteSpec): Coord[][] => {
    const out: Coord[][] = [];
    trace(spec, (s) => out.push(simplify(s.coords, TOLERANCE).map(round5)));
    return out;
  };
  const loops: Feature<MultiLineString>[] = LOOP_ROUTES.map((spec) => {
    const info = LOOPS.find((l) => l.id === spec.id);
    if (!info) warnings.push(`loop ${spec.id} has no entry in app/data/map/loops.ts`);
    return { type: "Feature", id: spec.id, geometry: { type: "MultiLineString", coordinates: lines(spec) }, properties: { id: spec.id, name: info?.name ?? spec.id, color: info?.color ?? "#f28b2e" } };
  });
  const tours: Feature<MultiLineString>[] = TOUR_ROUTES.map((spec) => ({ type: "Feature", id: spec.id, geometry: { type: "MultiLineString", coordinates: lines(spec) }, properties: { id: spec.id, tourSlug: spec.id } }));

  // 5. Hand-drawn extras: anything OSM lacks, per target collection.
  const collections: Record<string, Feature[]> = { roads, tunnels, ferries, loops, tours };
  if (existsSync(HAND)) {
    for (const file of readdirSync(HAND).filter((f) => f.endsWith(".geojson"))) {
      const fc = JSON.parse(readFileSync(join(HAND, file), "utf8")) as FeatureCollection;
      for (const f of fc.features) {
        const target = String((f.properties as Record<string, unknown> | null)?.target ?? "roads");
        if (!collections[target]) {
          warnings.push(`${file}: unknown target ${target}`);
          continue;
        }
        const props = { ...f.properties } as Record<string, unknown>;
        delete props.target;
        const id = String(props.id ?? `${file}-${collections[target]!.length}`);
        collections[target]!.push({ ...f, id, properties: { ...props, id } });
      }
    }
  }

  // 6. Write, sorted, so a rebuild diffs cleanly.
  mkdirSync(OUT, { recursive: true });
  for (const [name, features] of Object.entries(collections)) {
    features.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    writeFileSync(join(OUT, `${name}.geojson`), JSON.stringify({ type: "FeatureCollection", features }));
  }

  const count = (c: RoadClass) => roads.filter((r) => r.properties.cls === c).length;
  console.log(`roads: ${roads.length} segments — classA ${count("classA")}, main ${count("main")}, local ${count("local")}, gravel ${count("gravel")}, mtb ${count("mtb")}; buttercup ${roads.filter((r) => r.properties.buttercup).length}, single-lane ${roads.filter((r) => r.properties.singleLane).length}`);
  console.log(`tunnels: ${tunnels.filter((t) => t.properties.kind === "tunnel").length}, ferries: ${ferries.length}, loops: ${loops.length}, tours: ${tours.length}`);
  for (const w of warnings) console.warn(`! ${w}`);
  console.log(`${warnings.length} warning(s)`);
  if (roads.length === 0) {
    console.error("no roads — refusing to write an empty map");
    process.exit(1);
  }
}

/** Tunnels and minor tracks only when nothing else leads there. */
function cost(s: Segment, spec: RouteSpec): number {
  let c = 1;
  const hw = s.tags.highway ?? "";
  if (s.tags.tunnel && s.tags.tunnel !== "no") c *= spec.allowTunnel ? 1.2 : 40;
  if (hw === "service" || hw === "track" || hw === "path" || hw === "cycleway") c *= 6;
  if (hw === "residential" || hw === "living_street") c *= 1.5;
  if (s.tags.access === "private" || s.tags.access === "no") c *= 30;
  return c;
}

function bearing(a: Coord, b: Coord): number {
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function placeResolver(places: OsmNode[], warnings: string[]) {
  const byName = new Map<string, OsmNode[]>();
  const rank: Record<string, number> = { city: 0, town: 1, village: 2, hamlet: 3, locality: 4, isolated_dwelling: 5 };
  for (const p of places) {
    const n = p.tags?.name;
    if (!n || !p.tags?.place) continue;
    byName.set(n, [...(byName.get(n) ?? []), p]);
  }
  return (name: string): Coord | null => {
    const m = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(name);
    if (m) return [Number(m[2]), Number(m[1])];
    const hits = (byName.get(name) ?? []).sort((a, b) => (rank[a.tags!.place!] ?? 9) - (rank[b.tags!.place!] ?? 9));
    if (hits.length === 0) {
      warnings.push(`place "${name}" not found in OSM`);
      return null;
    }
    if (hits.length > 1 && (rank[hits[0]!.tags!.place!] ?? 9) === (rank[hits[1]!.tags!.place!] ?? 9)) warnings.push(`place "${name}" is ambiguous (${hits.length} nodes); using ${hits[0]!.lat},${hits[0]!.lon}`);
    return [hits[0]!.lon, hits[0]!.lat];
  };
}

function list(places: OsmNode[]) {
  const rows = places
    .map((p) => ({ kind: p.tags?.place ?? p.tags?.highway ?? p.tags?.amenity ?? p.tags?.tourism ?? p.tags?.natural ?? (p.tags?.mountain_pass ? "pass" : "?"), name: p.tags?.name ?? "", lat: p.lat, lon: p.lon, id: p.id }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  for (const r of rows) console.log(`${r.kind.padEnd(18)} ${r.name.padEnd(28)} ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}  n${r.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
