import { describe, expect, it } from "vitest";
import { RoadGraph } from "../../../scripts/map/graph";
import type { OsmWay } from "../../../scripts/map/overpass";

// A small road net: a straight road 1-2-3-4 with a side road 2-5 and a
// tunnel 3-6 that shortcuts to 4 via 6.
const way = (id: number, nodes: number[], tags: Record<string, string> = {}): OsmWay => ({
  type: "way",
  id,
  nodes,
  geometry: nodes.map((n) => ({ lat: 62 + Math.floor(n / 10) * 0.01, lon: -7 + (n % 10) * 0.01 })),
  tags,
});
const ways = [way(1, [1, 2, 3, 4], { highway: "primary" }), way(2, [2, 5], { highway: "unclassified" }), way(3, [3, 6], { highway: "primary", tunnel: "yes" }), way(4, [6, 4], { highway: "primary" })];

describe("road graph", () => {
  const g = new RoadGraph(ways);

  it("splits ways at junctions", () => {
    expect(g.segments.map((s) => s.id)).toEqual(["1-0", "1-1", "1-2", "2-0", "3-0", "4-0"]);
  });

  it("finds the shortest path and respects costs", () => {
    const direct = g.shortestPath(1, 4, () => 1)!;
    expect(direct.map((s) => s.id)).toEqual(["1-0", "1-1", "1-2"]);
    const noTunnel = g.shortestPath(3, 4, (s) => (s.tags.tunnel ? Infinity : 1))!;
    expect(noTunnel.map((s) => s.id)).toEqual(["1-2"]);
    expect(g.shortestPath(5, 6, (s) => (s.tags.tunnel ? Infinity : 1))!.map((s) => s.id)).toEqual(["2-0", "1-1", "1-2", "4-0"]);
  });

  it("snaps a point to the nearest junction", () => {
    expect(g.nearestNode([-7 + 0.05 + 0.002, 62])!.node).toBe(5);
  });
});
