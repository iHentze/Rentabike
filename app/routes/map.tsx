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
import { useHydrated, useReducedMotion } from "~/components/map/use-hydrated";
import { Header } from "~/components/site";
import { PillButton } from "~/components/ui";
import { LOOPS, NOTES, POIS, TOUR_LINKS, TUNNELS, mapContent, scenicVillageNames, tourSlugsOnMap } from "~/data/map";
import type { FlyTarget, LayerGroupId, MapSelection, MapTour, TunnelInfo } from "~/data/map/types";
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

  const [visible, setVisible] = useState<Record<LayerGroupId, boolean>>(defaultVisibility);
  const [selected, setSelected] = useState<MapSelection | null>(initial?.selection ?? null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(initial?.fly ?? null);
  const [legendOpen, setLegendOpen] = useState(false);

  const content = useMemo(mapContent, []);
  const scenicNames = useMemo(scenicVillageNames, []);

  const select = useCallback(
    (sel: MapSelection | null, fly?: boolean) => {
      setSelected(sel);
      if (sel) setLegendOpen(false);
      if (fly && sel) {
        const at = flyTargetFor(sel);
        if (at) setFlyTo(at);
      }
      setParams(toSearch(sel), { replace: true, preventScrollReset: true });
    },
    [setParams],
  );

  const toggle = (id: LayerGroupId) => setVisible((v) => ({ ...v, [id]: !v[id] }));

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="relative min-h-0 flex-1 bg-[#e3e9d7]" aria-label="Cycling map of the Faroe Islands">
        {hydrated ? (
          <Suspense fallback={<MapSkeleton />}>
            <FaroeMap content={content} scenicNames={scenicNames} visible={visible} selected={selected} flyTo={flyTo} reducedMotion={reducedMotion} onSelect={select} />
          </Suspense>
        ) : (
          <MapSkeleton />
        )}

        {/* the legend pill sits bottom-left, clear of the zoom buttons and the scale */}
        {!legendOpen && (
          <PillButton
            size="sm"
            tone="primary"
            onClick={() => {
              setLegendOpen(true);
              if (selected) select(null);
            }}
            className="absolute bottom-[max(14px,env(safe-area-inset-bottom))] left-4 z-10 shadow-[0_6px_24px_rgba(0,0,0,.3)]"
            aria-expanded={legendOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            Legend
          </PillButton>
        )}

        <MapLegend
          open={legendOpen}
          visible={visible}
          onToggle={toggle}
          onReset={() => setVisible(defaultVisibility())}
          onTunnel={(t) => select(tunnelSelection(t), true)}
          onClose={() => setLegendOpen(false)}
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
