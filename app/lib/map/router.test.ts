import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { Router } from "./router";

// Two villages joined by a road with a closed tunnel in the middle, a long
// open road around, and a ferry that takes bikes across the water.
//
//   A(0,0) ── road ── B(1,0) ── closed tunnel ── C(2,0) ── road ── D(3,0)
//                      └───── long open road via (1.5, 5) ─────┘
//   ferry: A ─── E(3,-1) with a road E ─ D
const fc = (features: unknown[]): FeatureCollection => ({ type: "FeatureCollection", features: features as FeatureCollection["features"] });
const P = (x: number, y: number): [number, number] => [-7 + x * 0.01, 62 + y * 0.01];
const line = (id: string, coords: [number, number][], props: Record<string, unknown>) => ({ type: "Feature", id, geometry: { type: "LineString", coordinates: coords }, properties: { id, ...props } });
const roads = fc([
  line("ab", [P(0, 0), P(0.5, 0), P(1, 0)], { cls: "classA" }),
  line("cd", [P(2, 0), P(3, 0)], { cls: "main" }),
  line("bd-long", [P(1, 0), P(1.5, 5), P(2, 0)], { cls: "local" }),
  line("ed", [P(3, -1), P(3, 0)], { cls: "local" }),
]);
const tunnels = fc([{ type: "Feature", id: "tunnel-E", geometry: { type: "MultiLineString", coordinates: [[P(1, 0), P(2, 0)]] }, properties: { id: "tunnel-E", kind: "tunnel", name: "Eysturoyartunnilin", open: false, letter: "E" } }]);
const ferries = fc([line("ferry-1", [P(0, 0.001), P(3, -1.001)], { name: "A – E", bikes: true })]);

describe("router", () => {
  const r = Router.fromGeoJSON(roads, tunnels, ferries);

  it("snaps to the closest point on a road", () => {
    const s = r.snap(P(0.5, 0.05))!;
    expect(s.edge).toBe(r.edges.findIndex((e) => e.id === "ab"));
    expect(s.point[0]).toBeCloseTo(P(0.5, 0)[0], 5);
  });

  it("goes round a closed tunnel", () => {
    const res = r.route(r.snap(P(0, 0))!, r.snap(P(3, 0))!, { ferries: false })!;
    expect(res.illegal).toBe(false);
    expect(res.featureIds).toEqual(["ab", "bd-long", "cd"]);
    expect(res.legs.map((l) => l.kind)).toEqual(["road"]);
  });

  it("takes the ferry when it is cheaper than the detour", () => {
    const res = r.route(r.snap(P(0, 0))!, r.snap(P(3, 0))!)!;
    expect(res.legs.map((l) => l.kind)).toEqual(["road", "ferry", "road"]);
    expect(res.legs[1]!.name).toBe("A – E");
  });

  it("reports the closed tunnel when nothing else connects", () => {
    const cut = Router.fromGeoJSON(fc([roads.features[0], roads.features[1]]), tunnels, fc([]));
    const res = cut.route(cut.snap(P(0, 0))!, cut.snap(P(3, 0))!)!;
    expect(res.illegal).toBe(true);
    expect(res.legs.find((l) => l.kind === "tunnel")?.letter).toBe("E");
    expect(res.distanceM).toBeCloseTo(3 * 0.01 * 52400, -3);
  });

  it("handles start and end on the same road", () => {
    const res = r.route(r.snap(P(0.2, 0))!, r.snap(P(0.8, 0))!)!;
    expect(res.featureIds).toEqual(["ab"]);
    expect(res.distanceM).toBeCloseTo(0.6 * 0.01 * 52400, -2);
  });
});
