/**
 * The cycling map: R Hokwerda's 2025 Faroe cycling tour map, redrawn as an
 * interactive page. Roads and tunnels are our own GeoJSON (public/map/),
 * classified as the print classifies them; the base and the relief come from
 * open tiles. The map itself is browser-only and loads after hydration.
 */
import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/map";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { cloudflareContext } from "~/context";
import { FeaturePanel } from "~/components/map/feature-panel";
import { defaultVisibility } from "~/components/map/legend-config";
import { MapLegend } from "~/components/map/map-legend";
import { PlannerPanel, planPointLabel } from "~/components/map/planner-panel";
import { searchIndex, type SearchHit } from "~/components/map/search";
import { useHydrated, useReducedMotion } from "~/components/map/use-hydrated";
import { usePlanner, type PlanPoint } from "~/components/map/use-planner";
import { Header } from "~/components/site";
import { PillButton, cx } from "~/components/ui";
import { LOOPS, NOTES, POIS, TOUR_LINKS, TUNNELS, mapContent, scenicVillageNames, tourSlugsOnMap } from "~/data/map";
import { VILLAGES } from "~/data/map/villages";
import type { FlyTarget, LayerGroupId, LngLat, MapSelection, MapTour, PlannedRoute, TunnelInfo } from "~/data/map/types";
import { listTours } from "~/lib/tours/catalogue";

const FaroeMap = lazy(() => import("~/components/map/faroe-map.client"));

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Faroe Islands cycling map — Rent a Bike & Outdoor" },
    {
      name: "description",
      content: "Every road you can ride on the Faroe Islands: scenic routes, tunnels open and closed to bikes, ferries, bus links, campsites and the loops worth a day. The interactive version of the 2025 Faroe cycling tour map.",
    },
  ];
}

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: maplibreCss }];

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const wanted = new Set(tourSlugsOnMap());
  const tours: MapTour[] = (await listTours(env.DB))
    .filter((t) => wanted.has(t.slug))
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      category: t.category,
      priceMinor: t.priceMinor,
      durationMin: t.durationMin,
      distanceKm: t.distanceKm,
      image: t.image,
      weekday: t.weekday,
      nextSeatsLeft: t.nextSeatsLeft,
    }));
  return { tours };
}

function tunnelSelection(t: TunnelInfo): MapSelection {
  return { kind: "tunnel", id: `tunnel-${t.letter}`, name: t.name, open: t.status === "open", letter: t.letter, lengthKm: t.lengthKm };
}

/** `?f=tunnel:E`, `?f=note:kalsoy`, `?f=poi:…`, `?loop=…`, `?tour=…` — a shareable pick. */
function fromSearch(params: URLSearchParams): { selection: MapSelection; fly: FlyTarget } | null {
  const tour = params.get("tour");
  if (tour) {
    const link = TOUR_LINKS.find((t) => t.slug === tour);
    if (link) return { selection: { kind: "tour", slug: tour }, fly: { center: link.at, zoom: link.zoom } };
  }
  const loop = params.get("loop");
  if (loop) {
    const l = LOOPS.find((x) => x.id === loop);
    if (l) return { selection: { kind: "loop", id: l.id }, fly: { center: l.at, zoom: 10.5 } };
  }
  const f = params.get("f");
  if (!f) return null;
  const [kind, id] = f.split(":", 2);
  if (kind === "tunnel") {
    const t = TUNNELS.find((x) => x.letter === id);
    if (t) return { selection: tunnelSelection(t), fly: { center: t.at, zoom: 11.5 } };
  }
  if (kind === "note") {
    const n = NOTES.find((x) => x.id === id);
    if (n) return { selection: { kind: "note", id: n.id }, fly: { center: n.at, zoom: 11.5 } };
  }
  if (kind === "poi") {
    const p = POIS.find((x) => x.id === id);
    if (p) return { selection: { kind: "poi", id: p.id }, fly: { center: p.at, zoom: 11.5 } };
  }
  return null;
}

/** `?from=lon,lat&to=lon,lat` — a planned ride, shareable. */
function pointParam(v: string | null): PlanPoint | undefined {
  if (!v) return undefined;
  const [lon, lat] = v.split(",").map(Number);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
  const at: LngLat = [lon!, lat!];
  const near = VILLAGES.find((x) => Math.abs(x.at[0] - at[0]) < 0.0006 && Math.abs(x.at[1] - at[1]) < 0.0006);
  return { at, label: near?.name ?? planPointLabel(at) };
}
const pointStr = (p: PlanPoint) => `${p.at[0].toFixed(5)},${p.at[1].toFixed(5)}`;

function toSearch(sel: MapSelection | null): Record<string, string> {
  if (!sel) return {};
  switch (sel.kind) {
    case "tour":
      return { tour: sel.slug };
    case "loop":
      return { loop: sel.id };
    case "tunnel":
      return sel.letter ? { f: `tunnel:${sel.letter}` } : {};
    case "note":
      return { f: `note:${sel.id}` };
    case "poi":
      return { f: `poi:${sel.id}` };
    case "ferry":
      return {};
  }
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  const { tours } = loaderData;
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const initial = useMemo(() => fromSearch(params), []); // eslint-disable-line react-hooks/exhaustive-deps
  const initialPlan = useMemo(() => ({ start: pointParam(params.get("from")), end: pointParam(params.get("to")) }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [visible, setVisible] = useState<Record<LayerGroupId, boolean>>(defaultVisibility);
  const [selected, setSelected] = useState<MapSelection | null>(initial?.selection ?? null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(initial?.fly ?? null);
  const [sheet, setSheet] = useState<"legend" | "planner" | null>(initialPlan.start || initialPlan.end ? "planner" : null);
  const planner = usePlanner(initialPlan);

  const content = useMemo(mapContent, []);
  const scenicNames = useMemo(scenicVillageNames, []);
  const index = useMemo(() => searchIndex(tours, (slug) => TOUR_LINKS.find((t) => t.slug === slug)?.at), [tours]);

  // Everything that is in the address bar: the pick, or the planned ride.
  const syncUrl = useCallback(
    (sel: MapSelection | null, start: PlanPoint | null, end: PlanPoint | null) => {
      const next = { ...toSearch(sel), ...(start && { from: pointStr(start) }), ...(end && { to: pointStr(end) }) };
      setParams(next, { replace: true, preventScrollReset: true });
    },
    [setParams],
  );

  const select = useCallback(
    (sel: MapSelection | null, fly?: boolean) => {
      setSelected(sel);
      if (sel) setSheet(null);
      if (fly && sel) {
        const at = flyTargetFor(sel);
        if (at) setFlyTo(at);
      }
      syncUrl(sel, planner.state.start, planner.state.end);
    },
    [syncUrl, planner.state.start, planner.state.end],
  );

  const setPoint = (which: "start" | "end", p: PlanPoint | null) => {
    planner.setPoint(which, p);
    const start = which === "start" ? p : planner.state.start;
    const end = which === "end" ? p : planner.state.end;
    syncUrl(selected, start, end);
    if (p && !(start && end)) setFlyTo({ center: p.at, zoom: 11 });
  };

  const onPick = (at: LngLat) => {
    const which = planner.state.picking;
    if (!which) return;
    const near = VILLAGES.find((v) => Math.abs(v.at[0] - at[0]) < 0.004 && Math.abs(v.at[1] - at[1]) < 0.002);
    setPoint(which, { at, label: near ? near.name : planPointLabel(at) });
    setSheet("planner");
  };

  const goTo = (h: SearchHit) => {
    if (h.selection) select(h.selection, true);
    else {
      setFlyTo({ center: h.at, zoom: h.zoom });
      setSheet(null);
    }
  };

  const toggle = (id: LayerGroupId) => setVisible((v) => ({ ...v, [id]: !v[id] }));
  const planned: PlannedRoute | null = planner.state.result && planner.state.start && planner.state.end ? { coords: planner.state.result.coords, start: planner.state.start.at, end: planner.state.end.at } : null;
  const picking = planner.state.picking;

  const openSheet = (which: "legend" | "planner") => {
    setSheet(which);
    if (selected) select(null);
  };

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="relative min-h-0 flex-1 bg-[#e3e9d7]" aria-label="Cycling map of the Faroe Islands">
        {hydrated ? (
          <Suspense fallback={<MapSkeleton />}>
            <FaroeMap content={content} scenicNames={scenicNames} visible={visible} selected={selected} flyTo={flyTo} reducedMotion={reducedMotion} onSelect={select} planned={planned} picking={picking} onPick={onPick} />
          </Suspense>
        ) : (
          <MapSkeleton />
        )}

        {/* while a point is being picked the sheets get out of the way */}
        {picking && (
          <div className="absolute inset-x-4 top-4 z-20 flex items-center gap-3 rounded-full bg-night/90 px-5 py-3 text-[14.5px] text-ink shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2">
            <span className={cx("size-3 shrink-0 rounded-full", picking === "start" ? "bg-ok" : "bg-[#e0245e]")} aria-hidden />
            <span className="flex-1">Tap the map where the ride {picking === "start" ? "starts" : "ends"}</span>
            <button type="button" onClick={() => planner.set({ picking: null })} className="font-semibold text-brand-bright hover:text-ink">
              Cancel
            </button>
          </div>
        )}

        {/* the pills sit bottom-left, clear of the zoom buttons and the scale */}
        {!sheet && !picking && (
          <div className="absolute bottom-[max(14px,env(safe-area-inset-bottom))] left-4 z-10 flex gap-2">
            <PillButton size="sm" tone="primary" onClick={() => openSheet("legend")} className="shadow-[0_6px_24px_rgba(0,0,0,.3)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Legend
            </PillButton>
            <PillButton size="sm" tone={planned ? "brand" : "ghost"} onClick={() => openSheet("planner")} className={cx("shadow-[0_6px_24px_rgba(0,0,0,.3)] backdrop-blur", !planned && "bg-night/85! text-ink")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M8.5 16.5 15.5 8" />
              </svg>
              {planned ? "Your ride" : "Plan a ride"}
            </PillButton>
          </div>
        )}

        <MapLegend
          open={sheet === "legend" && !picking}
          visible={visible}
          index={index}
          onGo={goTo}
          onToggle={toggle}
          onReset={() => setVisible(defaultVisibility())}
          onTunnel={(t) => select(tunnelSelection(t), true)}
          onClose={() => setSheet(null)}
        />
        <PlannerPanel
          open={sheet === "planner" && !picking}
          state={planner.state}
          onPoint={setPoint}
          onPick={(which) => planner.set({ picking: which })}
          onOptions={(options) => planner.set({ options })}
          onSwap={planner.swap}
          onClear={() => {
            planner.clear();
            syncUrl(selected, null, null);
          }}
          onSelect={select}
          onClose={() => setSheet(null)}
        />
        <FeaturePanel selection={selected} tours={tours} onSelect={select} onClose={() => select(null)} />

        <noscript>
          <div className="absolute inset-0 flex items-center justify-center bg-ground/90 p-6 text-center text-ink">
            <p>The interactive map needs JavaScript. The tunnels open to cyclists are listed on each tour page, or call us on +298 270 600.</p>
          </div>
        </noscript>
      </main>
    </div>
  );
}

function flyTargetFor(sel: MapSelection): FlyTarget | null {
  switch (sel.kind) {
    case "tunnel": {
      const t = TUNNELS.find((x) => x.letter === sel.letter);
      return t ? { center: t.at, zoom: 11.5 } : null;
    }
    case "note": {
      const n = NOTES.find((x) => x.id === sel.id);
      return n ? { center: n.at, zoom: 11.5 } : null;
    }
    case "poi": {
      const p = POIS.find((x) => x.id === sel.id);
      return p ? { center: p.at, zoom: 11.5 } : null;
    }
    case "loop": {
      const l = LOOPS.find((x) => x.id === sel.id);
      return l ? { center: l.at, zoom: 10.5 } : null;
    }
    case "tour": {
      const t = TOUR_LINKS.find((x) => x.slug === sel.slug);
      return t ? { center: t.at, zoom: t.zoom } : null;
    }
    case "ferry":
      return null;
  }
}

/** Same footprint and colour as the map, so nothing jumps when it arrives. */
function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#e3e9d7]" aria-hidden>
      <span className="rounded-full bg-white/70 px-4 py-2 text-[13.5px] font-semibold text-[#4a545c]">Loading the map…</span>
    </div>
  );
}
