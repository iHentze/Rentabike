/**
 * The ride planner's road network, built in the browser from the same
 * GeoJSON the map draws. Segments meet at shared endpoints (the build
 * rounds both to five decimals), tunnels join where their parts end, and
 * ferries are stitched to the nearest road at each pier.
 *
 * A route is the cheapest path: Class A roads are preferred, tunnels open
 * to cyclists cost more, tunnels closed to them are never taken. If no
 * legal road exists the planner says so, and shows the road it would have
 * taken so the rider knows which tunnel to take the bus through.
 */
import type { Feature, FeatureCollection, LineString, MultiLineString } from "geojson";
import type { FerryProps, RoadProps, TunnelLetter, TunnelProps } from "~/data/map/types";

export type Coord = [number, number];

export interface Edge {
  index: number;
  id: string;
  a: number;
  b: number;
  lengthM: number;
  coords: Coord[];
  kind: "road" | "tunnel" | "ferry" | "link";
  cls?: RoadProps["cls"];
  name?: string;
  /** Tunnels: open to cyclists. Ferries: takes bikes. */
  open: boolean;
  letter?: TunnelLetter;
  buttercup?: boolean;
}

export interface Snap {
  edge: number;
  /** Index of the vertex before the snapped point. */
  vertex: number;
  /** 0..1 along that vertex's segment. */
  t: number;
  point: Coord;
  distM: number;
}

export interface Leg {
  kind: Edge["kind"];
  name?: string;
  distanceM: number;
  open: boolean;
  letter?: TunnelLetter;
}

export interface RouteResult {
  coords: Coord[];
  distanceM: number;
  legs: Leg[];
  /** True when the only way there uses a tunnel closed to cyclists. */
  illegal: boolean;
  /** Ids of the road/tunnel features used, for highlighting. */
  featureIds: string[];
}

export interface RouteOptions {
  ferries?: boolean;
  avoidMain?: boolean;
}

/** Metres between two lon/lat points. */
export function distanceM(a: Coord, b: Coord): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const lengthM = (c: Coord[]) => c.reduce((m, p, i) => (i ? m + distanceM(c[i - 1]!, p) : 0), 0);

export class Router {
  nodes: Coord[] = [];
  edges: Edge[] = [];
  private adjacency: number[][] = [];
  private keyToNode = new Map<string, number>();

  static fromGeoJSON(roads: FeatureCollection, tunnels: FeatureCollection, ferries: FeatureCollection): Router {
    const r = new Router();
    for (const f of roads.features as Feature<LineString, RoadProps>[]) {
      if (f.geometry.type !== "LineString") continue;
      r.addEdge(f.geometry.coordinates as Coord[], { id: f.properties.id, kind: "road", cls: f.properties.cls, name: f.properties.name, open: true, buttercup: f.properties.buttercup });
    }
    for (const f of tunnels.features as Feature<MultiLineString, TunnelProps>[]) {
      if (f.geometry.type !== "MultiLineString") continue;
      for (const part of f.geometry.coordinates) r.addEdge(part as Coord[], { id: f.properties.id, kind: "tunnel", name: f.properties.name, open: f.properties.open, letter: f.properties.letter });
    }
    for (const f of ferries.features as Feature<LineString, FerryProps>[]) {
      if (f.geometry.type !== "LineString") continue;
      const coords = f.geometry.coordinates as Coord[];
      const e = r.addEdge(coords, { id: f.properties.id, kind: "ferry", name: f.properties.name, open: f.properties.bikes });
      // Piers rarely sit on a road node: walk to the nearest one within 400 m.
      for (const end of [e.a, e.b]) {
        const near = r.nearestNode(r.nodes[end]!, (n) => n !== end && r.adjacency[n]!.some((i) => r.edges[i]!.kind === "road"));
        if (near && near.distM < 400) r.addEdge([r.nodes[end]!, r.nodes[near.node]!], { id: `${f.properties.id}-link`, kind: "link", open: true });
      }
    }
    return r;
  }

  private node(c: Coord): number {
    const key = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
    let n = this.keyToNode.get(key);
    if (n === undefined) {
      n = this.nodes.length;
      this.nodes.push(c);
      this.adjacency.push([]);
      this.keyToNode.set(key, n);
    }
    return n;
  }

  private addEdge(coords: Coord[], props: Omit<Edge, "index" | "a" | "b" | "lengthM" | "coords">): Edge {
    const e: Edge = { ...props, index: this.edges.length, a: this.node(coords[0]!), b: this.node(coords[coords.length - 1]!), lengthM: lengthM(coords), coords };
    this.edges.push(e);
    this.adjacency[e.a]!.push(e.index);
    this.adjacency[e.b]!.push(e.index);
    return e;
  }

  nearestNode(p: Coord, accept: (n: number) => boolean = () => true): { node: number; distM: number } | null {
    let best: { node: number; distM: number } | null = null;
    for (let n = 0; n < this.nodes.length; n++) {
      if (!accept(n)) continue;
      const d = distanceM(p, this.nodes[n]!);
      if (!best || d < best.distM) best = { node: n, distM: d };
    }
    return best;
  }

  /** The closest point on any rideable road or tunnel. */
  snap(p: Coord): Snap | null {
    let best: Snap | null = null;
    for (const e of this.edges) {
      if (e.kind === "ferry" || e.kind === "link") continue;
      for (let i = 1; i < e.coords.length; i++) {
        const a = e.coords[i - 1]!;
        const b = e.coords[i]!;
        const { t, point } = project(p, a, b);
        const d = distanceM(p, point);
        if (!best || d < best.distM) best = { edge: e.index, vertex: i - 1, t, point, distM: d };
      }
    }
    return best;
  }

  route(from: Snap, to: Snap, opts: RouteOptions = {}): RouteResult | null {
    const legal = this.dijkstra(from, to, opts, false);
    if (legal) return legal;
    const any = this.dijkstra(from, to, opts, true);
    return any ? { ...any, illegal: true } : null;
  }

  private cost(e: Edge, opts: RouteOptions, allowClosed: boolean): number {
    switch (e.kind) {
      case "road": {
        const f = { classA: 1, main: opts.avoidMain ? 1.8 : 1.15, local: 1.05, gravel: 1.4, mtb: 1.8 }[e.cls ?? "local"];
        return f;
      }
      case "tunnel":
        if (!e.open) return allowClosed ? 1 : Infinity;
        // A and C are open but the print says unpleasant; B, F and the short ones are fine.
        return e.letter === "A" || e.letter === "C" ? 3 : 1.6;
      case "ferry":
        if (!e.open || opts.ferries === false) return Infinity;
        return 4;
      case "link":
        return 1;
    }
  }

  private dijkstra(from: Snap, to: Snap, opts: RouteOptions, allowClosed: boolean): RouteResult | null {
    // Two virtual nodes where the rider starts and ends, part-way along an edge.
    const S = -1;
    const T = -2;
    const ef = this.edges[from.edge]!;
    const et = this.edges[to.edge]!;
    const virtual = new Map<number, Array<{ to: number; costM: number; edge: Edge; coords: Coord[] }>>();
    const partial = (e: Edge, snap: Snap, toEnd: "a" | "b"): { to: number; costM: number; edge: Edge; coords: Coord[] } => {
      const coords = toEnd === "a" ? [snap.point, ...e.coords.slice(0, snap.vertex + 1).reverse()] : [snap.point, ...e.coords.slice(snap.vertex + 1)];
      return { to: toEnd === "a" ? e.a : e.b, costM: lengthM(coords) * this.cost(e, opts, allowClosed), edge: e, coords };
    };
    virtual.set(S, [partial(ef, from, "a"), partial(ef, from, "b")]);
    // Start and end on the same edge: the direct piece along it.
    if (from.edge === to.edge) {
      const [lo, hi] = from.vertex + from.t <= to.vertex + to.t ? [from, to] : [to, from];
      const mid = [lo.point, ...ef.coords.slice(lo.vertex + 1, hi.vertex + 1), hi.point];
      const coords = lo === from ? mid : [...mid].reverse();
      virtual.get(S)!.push({ to: T, costM: lengthM(coords) * this.cost(ef, opts, allowClosed), edge: ef, coords });
    }
    const endLinks = [partial(et, to, "a"), partial(et, to, "b")];

    const dist = new Map<number, number>([[S, 0]]);
    const via = new Map<number, { from: number; edge: Edge; coords: Coord[] }>();
    const done = new Set<number>();
    const heap: Array<[number, number]> = [[0, S]];
    const push = (k: number, v: number) => {
      heap.push([k, v]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p]![0] <= heap[i]![0]) break;
        [heap[p], heap[i]] = [heap[i]!, heap[p]!];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
          if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i]!, heap[m]!];
          i = m;
        }
      }
      return top;
    };
    const relax = (n: number, d: number, to: number, costM: number, edge: Edge, coords: Coord[]) => {
      if (!Number.isFinite(costM)) return;
      const nd = d + costM;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        via.set(to, { from: n, edge, coords });
        push(nd, to);
      }
    };
    while (heap.length) {
      const [d, n] = pop();
      if (done.has(n)) continue;
      done.add(n);
      if (n === T) break;
      for (const v of virtual.get(n) ?? []) relax(n, d, v.to, v.costM, v.edge, v.coords);
      if (n < 0) continue;
      for (const i of this.adjacency[n]!) {
        const e = this.edges[i]!;
        const m = e.a === n ? e.b : e.a;
        relax(n, d, m, e.lengthM * this.cost(e, opts, allowClosed), e, e.a === n ? e.coords : [...e.coords].reverse());
      }
      // The last stretch: from either end of the destination edge to the point on it.
      for (const l of endLinks) if (l.to === n) relax(n, d, T, l.costM, l.edge, [...l.coords].reverse());
    }
    if (!dist.has(T)) return null;

    const steps: Array<{ edge: Edge; coords: Coord[] }> = [];
    for (let n = T; n !== S; ) {
      const v = via.get(n)!;
      steps.push(v);
      n = v.from;
    }
    steps.reverse();
    const coords: Coord[] = [];
    const legs: Leg[] = [];
    const ids = new Set<string>();
    for (const s of steps) {
      for (const c of s.coords) if (!coords.length || coords[coords.length - 1]![0] !== c[0] || coords[coords.length - 1]![1] !== c[1]) coords.push(c);
      const m = lengthM(s.coords);
      const last = legs[legs.length - 1];
      const kind = s.edge.kind === "link" ? "road" : s.edge.kind;
      const name = kind === "road" ? undefined : s.edge.name;
      if (last && last.kind === kind && last.name === name) last.distanceM += m;
      else legs.push({ kind, name, distanceM: m, open: s.edge.open, letter: s.edge.letter });
      if (s.edge.kind !== "link") ids.add(s.edge.id);
    }
    return { coords, distanceM: lengthM(coords), legs, illegal: false, featureIds: [...ids] };
  }
}

function project(p: Coord, a: Coord, b: Coord): { t: number; point: Coord } {
  // Planar in degrees, longitude scaled for the latitude — fine at this size.
  const k = Math.cos((a[1] * Math.PI) / 180);
  const dx = (b[0] - a[0]) * k;
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (((p[0] - a[0]) * k) * dx + (p[1] - a[1]) * dy) / len2));
  return { t, point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
}
