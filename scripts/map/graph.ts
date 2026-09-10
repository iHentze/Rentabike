/**
 * The road network as a graph: OSM ways split at every junction into
 * segments, so a route can use part of a way. Routes are authored as a list
 * of places; each is snapped to the nearest junction and the shortest road
 * path between them is the route.
 */
import type { OsmWay } from "./overpass";
import type { Coord } from "./simplify";

export interface Segment {
  id: string;
  wayId: number;
  index: number;
  tags: Record<string, string>;
  /** Node ids at the two ends. */
  from: number;
  to: number;
  coords: Coord[];
  lengthM: number;
}

/** Metres between two lon/lat points, good enough at 62°N. */
export function distanceM(a: Coord, b: Coord): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function lengthM(coords: Coord[]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += distanceM(coords[i - 1]!, coords[i]!);
  return m;
}

export class RoadGraph {
  segments: Segment[] = [];
  /** node id → segments touching it */
  adjacency = new Map<number, Segment[]>();
  nodeCoord = new Map<number, Coord>();

  constructor(ways: OsmWay[]) {
    const uses = new Map<number, number>();
    for (const w of ways) for (const n of w.nodes) uses.set(n, (uses.get(n) ?? 0) + 1);
    for (const w of ways) {
      if (w.nodes.length < 2 || !w.geometry) continue;
      w.nodes.forEach((n, i) => {
        const g = w.geometry[i];
        if (g) this.nodeCoord.set(n, [g.lon, g.lat]);
      });
      let start = 0;
      let index = 0;
      for (let i = 1; i < w.nodes.length; i++) {
        const junction = (uses.get(w.nodes[i]!) ?? 0) > 1 || i === w.nodes.length - 1;
        if (!junction) continue;
        const coords = w.geometry.slice(start, i + 1).map((g): Coord => [g.lon, g.lat]);
        const seg: Segment = { id: `${w.id}-${index}`, wayId: w.id, index, tags: w.tags ?? {}, from: w.nodes[start]!, to: w.nodes[i]!, coords, lengthM: lengthM(coords) };
        this.segments.push(seg);
        for (const n of [seg.from, seg.to]) {
          const list = this.adjacency.get(n) ?? [];
          list.push(seg);
          this.adjacency.set(n, list);
        }
        start = i;
        index++;
      }
    }
  }

  /** The junction node nearest a point, among nodes of segments the filter accepts. */
  nearestNode(p: Coord, accept: (s: Segment) => boolean = () => true): { node: number; distM: number } | null {
    let best: { node: number; distM: number } | null = null;
    for (const [node, segs] of this.adjacency) {
      if (!segs.some(accept)) continue;
      const d = distanceM(p, this.nodeCoord.get(node)!);
      if (!best || d < best.distM) best = { node, distM: d };
    }
    return best;
  }

  /** Dijkstra over segments; cost is length times a per-segment factor. */
  shortestPath(from: number, to: number, cost: (s: Segment) => number): Segment[] | null {
    const dist = new Map<number, number>([[from, 0]]);
    const via = new Map<number, Segment>();
    const done = new Set<number>();
    const heap = new MinHeap();
    heap.push(0, from);
    while (heap.size) {
      const [d, n] = heap.pop()!;
      if (done.has(n)) continue;
      done.add(n);
      if (n === to) break;
      for (const s of this.adjacency.get(n) ?? []) {
        const c = cost(s);
        if (!Number.isFinite(c)) continue;
        const m = s.from === n ? s.to : s.from;
        const nd = d + s.lengthM * c;
        if (nd < (dist.get(m) ?? Infinity)) {
          dist.set(m, nd);
          via.set(m, s);
          heap.push(nd, m);
        }
      }
    }
    if (!dist.has(to)) return null;
    const path: Segment[] = [];
    let n = to;
    while (n !== from) {
      const s = via.get(n)!;
      path.push(s);
      n = s.from === n ? s.to : s.from;
    }
    return path.reverse();
  }
}

class MinHeap {
  private a: Array<[number, number]> = [];
  get size() {
    return this.a.length;
  }
  push(k: number, v: number) {
    this.a.push([k, v]);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p]![0] <= this.a[i]![0]) break;
      [this.a[p], this.a[i]] = [this.a[i]!, this.a[p]!];
      i = p;
    }
  }
  pop(): [number, number] | undefined {
    if (this.a.length === 0) return undefined;
    const top = this.a[0]!;
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l]![0] < this.a[m]![0]) m = l;
        if (r < this.a.length && this.a[r]![0] < this.a[m]![0]) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i]!, this.a[m]!];
        i = m;
      }
    }
    return top;
  }
}
