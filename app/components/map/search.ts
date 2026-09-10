/**
 * One list to search: villages, the places on the map, the tunnels, the
 * loops and our tours. Typing without accents still finds "Tórshavn".
 */
import { LOOPS, POIS, TUNNELS } from "~/data/map";
import { VILLAGES } from "~/data/map/villages";
import type { LngLat, MapSelection, MapTour, TunnelInfo } from "~/data/map/types";

export interface SearchHit {
  id: string;
  label: string;
  sub: string;
  at: LngLat;
  zoom?: number;
  selection?: MapSelection;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ð/g, "d")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function tunnelSelection(t: TunnelInfo): MapSelection {
  return { kind: "tunnel", id: `tunnel-${t.letter}`, name: t.name, open: t.status === "open", letter: t.letter, lengthKm: t.lengthKm };
}

export function searchIndex(tours: MapTour[], tourAt: (slug: string) => LngLat | undefined): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const v of VILLAGES) hits.push({ id: `v-${v.name}-${v.island}`, label: v.name, sub: v.island, at: v.at, zoom: 12 });
  for (const t of TUNNELS) hits.push({ id: `t-${t.letter}`, label: t.name, sub: `Tunnel ${t.letter} · ${t.status === "open" ? "open to cyclists" : "closed to cyclists"}`, at: t.at, zoom: 11.5, selection: tunnelSelection(t) });
  for (const l of LOOPS) hits.push({ id: `l-${l.id}`, label: l.name, sub: "Loop", at: l.at, zoom: 10.5, selection: { kind: "loop", id: l.id } });
  for (const p of POIS) if (p.kind !== "scenicVillage" && p.kind !== "steep") hits.push({ id: `p-${p.id}`, label: p.name, sub: POI_SUB[p.kind] ?? "", at: p.at, zoom: 12, selection: { kind: "poi", id: p.id } });
  for (const t of tours) {
    const at = tourAt(t.slug);
    if (at) hits.push({ id: `tour-${t.slug}`, label: t.title, sub: "Guided tour", at, zoom: 11.5, selection: { kind: "tour", slug: t.slug } });
  }
  return hits;
}

const POI_SUB: Record<string, string> = {
  petrol: "Petrol",
  campTent: "Campsite",
  campNoTent: "Campsite, no tents",
  webcam: "Webcam",
  busStop: "Bus stop",
  bus: "Bus by-pass",
  ferryPort: "Ferry",
  trailhead: "Hike",
  noCycling: "No cycling",
  busyRoad: "Busy road",
  demanding: "Demanding",
};

export function search(index: SearchHit[], query: string, limit = 8): SearchHit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const starts = index.filter((h) => fold(h.label).startsWith(q));
  const within = index.filter((h) => !starts.includes(h) && fold(h.label).includes(q));
  return [...starts, ...within].slice(0, limit);
}

/** Villages only, for the planner's start and end. */
export function villageHits(): SearchHit[] {
  return VILLAGES.map((v) => ({ id: `v-${v.name}-${v.island}`, label: v.name, sub: v.island, at: v.at, zoom: 12 }));
}
