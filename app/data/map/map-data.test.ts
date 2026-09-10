/**
 * The map's data, checked as data: the generated GeoJSON parses and stays
 * on the Faroes, the seven tunnels are all there, ids are unique, and every
 * tour the map refers to is a tour the seed knows.
 */
import { describe, expect, it } from "vitest";
import type { Feature, FeatureCollection } from "geojson";
import { TOURS } from "../../../scripts/tours-data";
import { DISTANCES, LABELS, LOOPS, NOTES, POIS, TOUR_LINKS, TUNNELS, tourSlugsOnMap } from "./index";
import { LAYER_GROUP_IDS } from "./types";

const FILES = import.meta.glob("../../../public/map/*.geojson", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const load = (name: string): FeatureCollection => {
  const key = Object.keys(FILES).find((k) => k.endsWith(`/${name}.geojson`));
  if (!key) throw new Error(`public/map/${name}.geojson missing`);
  return JSON.parse(FILES[key]!) as FeatureCollection;
};
const inFaroes = ([lon, lat]: number[]) => lon! > -7.8 && lon! < -6.1 && lat! > 61.3 && lat! < 62.5;
const coordsOf = (f: Feature): number[][] => {
  const g = f.geometry;
  if (g.type === "Point") return [g.coordinates];
  if (g.type === "LineString") return g.coordinates;
  if (g.type === "MultiLineString") return g.coordinates.flat();
  throw new Error(`unexpected ${g.type} in ${f.id}`);
};

describe("generated geometry", () => {
  for (const name of ["roads", "tunnels", "ferries", "loops", "tours"]) {
    it(`${name}.geojson is a well-formed collection on the Faroes`, () => {
      const fc = load(name);
      expect(fc.type).toBe("FeatureCollection");
      const ids = fc.features.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const f of fc.features) {
        expect(typeof f.id, name).toBe("string");
        expect(f.properties?.id).toBe(f.id);
        for (const c of coordsOf(f)) {
          expect(c.every(Number.isFinite)).toBe(true);
          expect(inFaroes(c), `${name} ${f.id} at ${c}`).toBe(true);
        }
      }
    });
  }

  it("roads carry every class the legend shows", () => {
    const roads = load("roads");
    if (roads.features.length === 0) return; // not built yet
    const classes = new Set(roads.features.map((f) => f.properties?.cls));
    for (const c of ["classA", "main", "local"]) expect(classes, c).toContain(c);
    expect(roads.features.some((f) => f.properties?.buttercup)).toBe(true);
    expect(roads.features.some((f) => f.properties?.singleLane)).toBe(true);
    for (const f of roads.features) expect(["classA", "main", "local", "gravel", "mtb"]).toContain(f.properties?.cls);
  });

  it("the seven lettered tunnels are drawn, and every portal belongs to a tunnel", () => {
    const fc = load("tunnels");
    if (fc.features.length === 0) return;
    const tunnels = fc.features.filter((f) => f.properties?.kind === "tunnel");
    const letters = tunnels.map((f) => f.properties?.letter).filter(Boolean).sort();
    expect(letters).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    for (const t of TUNNELS) {
      const f = tunnels.find((x) => x.properties?.letter === t.letter)!;
      expect(f.properties?.open, t.name).toBe(t.status === "open");
      expect(f.id).toBe(`tunnel-${t.letter}`);
    }
    const ids = new Set(tunnels.map((f) => f.id));
    for (const p of fc.features.filter((f) => f.properties?.kind === "portal")) expect(ids.has(p.properties?.tunnelId)).toBe(true);
  });

  it("loops and tours in the geometry match the lists", () => {
    const loops = load("loops");
    if (loops.features.length) expect(loops.features.map((f) => f.id).sort()).toEqual(LOOPS.map((l) => l.id).sort());
    for (const f of load("tours").features) expect(TOUR_LINKS.map((t) => t.slug)).toContain(f.properties?.tourSlug);
  });
});

describe("editorial content", () => {
  it("ids are unique and every point is on the Faroes", () => {
    for (const [name, list] of Object.entries({ POIS, NOTES, LABELS, DISTANCES, LOOPS, TUNNELS: TUNNELS.map((t) => ({ id: t.letter, at: t.at })) })) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size, name).toBe(ids.length);
      for (const x of list) expect(inFaroes(x.at), `${name} ${x.id}`).toBe(true);
    }
    expect(TUNNELS.map((t) => t.letter)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    for (const n of NOTES) if (n.refTunnel) expect(TUNNELS.map((t) => t.letter)).toContain(n.refTunnel);
  });

  it("every tour on the map is a tour in the catalogue seed", () => {
    const seeded = new Set(TOURS.map((t) => t.slug));
    for (const slug of tourSlugsOnMap()) expect(seeded.has(slug), slug).toBe(true);
  });

  it("layer group ids and legend agree", async () => {
    const { LEGEND } = await import("~/components/map/legend-config");
    const rows = LEGEND.flatMap((s) => s.rows.map((r) => r.id)).sort();
    expect(rows).toEqual([...LAYER_GROUP_IDS].sort());
  });
});
