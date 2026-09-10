/**
 * The legend as the print lays it out, one row per switchable group. The
 * swatches are drawn here with the same colours the style uses.
 */
import type { ReactNode } from "react";
import { iconDataUrl, type IconId } from "./icons";
import { PAPER } from "./style";
import type { LayerGroupId } from "~/data/map/types";

export interface LegendRow {
  id: LayerGroupId;
  label: string;
  swatch: ReactNode;
  defaultOn: boolean;
}

export interface LegendSection {
  title: string;
  rows: LegendRow[];
}

function Line({ color, casing, width = 5, dash, ticks }: { color: string; casing?: string; width?: number; dash?: string; ticks?: boolean }) {
  return (
    <svg viewBox="0 0 48 20" width="48" height="20" aria-hidden className="shrink-0">
      {ticks && <line x1="4" y1="10" x2="44" y2="10" stroke={casing} strokeWidth={width + 8} strokeDasharray="1.6 9" />}
      {casing && <line x1="4" y1="10" x2="44" y2="10" stroke={casing} strokeWidth={width + 2.4} strokeLinecap="round" strokeDasharray={dash} />}
      <line x1="4" y1="10" x2="44" y2="10" stroke={color} strokeWidth={width} strokeLinecap={dash ? "butt" : "round"} strokeDasharray={dash} />
    </svg>
  );
}

function Tunnel({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 48 20" width="48" height="20" aria-hidden className="shrink-0">
      <line x1="6" y1="10" x2="42" y2="10" stroke={PAPER.tunnel} strokeWidth={open ? 5 : 3.5} strokeDasharray={open ? undefined : "4 4"} />
      <rect x="3" y="4" width="4" height="12" fill={PAPER.ink} />
      <rect x="41" y="4" width="4" height="12" fill={PAPER.ink} />
    </svg>
  );
}

function Icons({ ids }: { ids: IconId[] }) {
  return (
    <span className="flex w-12 shrink-0 items-center justify-center gap-[2px]" aria-hidden>
      {ids.map((id) => (
        <img key={id} src={iconDataUrl(id)} alt="" width={ids.length > 2 ? 14 : 20} height={ids.length > 2 ? 14 : 20} />
      ))}
    </span>
  );
}

export const LEGEND: LegendSection[] = [
  {
    title: "Roads and routes",
    rows: [
      { id: "classA", label: "Class A scenic and bike-friendly route", swatch: <Line color={PAPER.classA} casing={PAPER.classACase} width={7} />, defaultOn: true },
      { id: "buttercup", label: "Sóljuleið Buttercup Tourist Route", swatch: <Icons ids={["buttercup"]} />, defaultOn: true },
      { id: "mainRoads", label: "Other main road · single-lane road with lay-bys", swatch: <Line color={PAPER.yellow} casing={PAPER.yellowCase} width={4} ticks />, defaultOn: true },
      { id: "localRoads", label: "Local or semi-public road with bike access", swatch: <Line color={PAPER.white} casing={PAPER.whiteCase} width={3} />, defaultOn: true },
      { id: "tunnels", label: "Tunnels — solid open to cyclists, dashed closed", swatch: <Tunnel open />, defaultOn: true },
      { id: "hazards", label: "No cycling · busy road · demanding · steep", swatch: <Icons ids={["noCycling", "busyRoad", "demanding", "steep"]} />, defaultOn: true },
      { id: "distances", label: "Road distance between pins, km", swatch: <span className="num flex w-12 shrink-0 justify-center font-display text-[15px] font-bold text-ink">5</span>, defaultOn: true },
    ],
  },
  {
    title: "Alternative transport",
    rows: [
      { id: "bus", label: "SSL bus service to by-pass tunnel · key bus stop", swatch: <Icons ids={["bus", "busStop"]} />, defaultOn: true },
      { id: "ferries", label: "Ferry", swatch: <Line color={PAPER.ferry} casing={PAPER.ferryCase} width={3} dash="7 5" />, defaultOn: true },
      { id: "trailheads", label: "Trailhead of popular hike (no bikes allowed)", swatch: <Icons ids={["trailhead"]} />, defaultOn: true },
    ],
  },
  {
    title: "Other information",
    rows: [
      { id: "villages", label: "Scenic village", swatch: <Icons ids={["scenicVillage"]} />, defaultOn: true },
      { id: "services", label: "Petrol station · campsite with / without tent pitches", swatch: <Icons ids={["petrol", "campTent", "campNoTent"]} />, defaultOn: true },
      { id: "webcams", label: "Live weather and road webcam (lv.fo)", swatch: <Icons ids={["webcam"]} />, defaultOn: true },
      { id: "notes", label: "Advice written on the map", swatch: <Icons ids={["noteDot"]} />, defaultOn: true },
    ],
  },
  {
    title: "Rides",
    rows: [
      { id: "loops", label: "Named loops", swatch: <Line color="#f28b2e" width={9} />, defaultOn: true },
      { id: "tours", label: "Our guided tours", swatch: <Line color={PAPER.brand} width={3} dash="4 5" />, defaultOn: true },
    ],
  },
];

export function defaultVisibility(): Record<LayerGroupId, boolean> {
  const v = {} as Record<LayerGroupId, boolean>;
  for (const s of LEGEND) for (const r of s.rows) v[r.id] = r.defaultOn;
  return v;
}
