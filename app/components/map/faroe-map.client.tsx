/**
 * The MapLibre map as a controlled React component. This is the only module
 * that imports maplibre-gl; the `.client` suffix keeps it out of the Worker
 * build, and the route mounts it lazily after hydration.
 *
 * The parent owns the state (which legend groups are on, what is selected,
 * where to fly); this component mirrors it onto the map and reports clicks.
 */
import { useEffect, useRef } from "react";
import { AttributionControl, Map as MapLibre, NavigationControl, ScaleControl, setWorkerUrl, type MapGeoJSONFeature } from "maplibre-gl";
// MapLibre parses tiles in a web worker it locates relative to its own module
// URL, which does not survive bundling. Vite bundles the worker with its
// imports and hands us the address instead.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { ICONS, type IconId } from "./icons";
import { FAROE_BOUNDS, INTERACTIVE_LAYERS, LAYER_GROUPS, MAX_BOUNDS, buildStyle } from "./style";
import type { FlyTarget, LayerGroupId, MapContent, MapSelection, TunnelLetter } from "~/data/map/types";

export interface FaroeMapProps {
  content: MapContent;
  scenicNames: string[];
  visible: Record<LayerGroupId, boolean>;
  selected: MapSelection | null;
  flyTo: FlyTarget | null;
  reducedMotion: boolean;
  onSelect: (selection: MapSelection | null) => void;
  onReady?: () => void;
}

setWorkerUrl(workerUrl);

const CREDIT = "Map design © R Hokwerda 2025, with permission";

/** A selection as the map addresses it: which source, which feature id. */
function stateKey(sel: MapSelection): { source: string; id: string } {
  switch (sel.kind) {
    case "tunnel":
      return { source: "tunnels", id: sel.id };
    case "note":
      return { source: "notes", id: sel.id };
    case "poi":
      return { source: "pois", id: sel.id };
    case "ferry":
      return { source: "ferries", id: sel.id };
    case "loop":
      return { source: "loops", id: sel.id };
    case "tour":
      return { source: "tours", id: sel.slug };
  }
}

/** What a click on a rendered feature means. */
export function selectionFrom(f: MapGeoJSONFeature): MapSelection | null {
  const p = f.properties as Record<string, unknown>;
  const id = String(p.id ?? f.id ?? "");
  switch (f.layer.id) {
    case "notes":
      return { kind: "note", id };
    case "poi-scenic":
    case "poi-webcam":
    case "poi-services":
    case "poi-trailhead":
    case "poi-bus":
    case "poi-ferry":
    case "hazards":
      return { kind: "poi", id };
    case "tour-line":
      return { kind: "tour", slug: String(p.tourSlug) };
    case "loop-halo":
      return { kind: "loop", id };
    case "ferry":
      return { kind: "ferry", id, name: String(p.name ?? ""), bikes: Boolean(p.bikes), note: p.note ? String(p.note) : undefined };
    case "tunnel-open":
    case "tunnel-closed":
    case "tunnel-portals": {
      const tunnelId = p.kind === "portal" ? String(p.tunnelId) : id;
      return {
        kind: "tunnel",
        id: tunnelId,
        name: String(p.name ?? "Tunnel"),
        open: Boolean(p.open),
        letter: p.letter ? (String(p.letter) as TunnelLetter) : undefined,
        lengthKm: typeof p.lengthKm === "number" ? p.lengthKm : undefined,
      };
    }
    default:
      return null;
  }
}

export default function FaroeMap({ content, scenicNames, visible, selected, flyTo, reducedMotion, onSelect, onReady }: FaroeMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const readyRef = useRef(false);
  const selectedRef = useRef<MapSelection | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create once. Everything data-driven is passed at construction; the props
  // that change afterwards are handled by the effects below.
  useEffect(() => {
    if (!holder.current) return;
    const map = new MapLibre({
      container: holder.current,
      style: buildStyle(content, scenicNames),
      bounds: FAROE_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      maxBounds: MAX_BOUNDS,
      minZoom: 6.5,
      maxZoom: 15.5,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      fadeDuration: reducedMotion ? 0 : 300,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true, customAttribution: CREDIT }), "bottom-right");
    map.getCanvas().setAttribute("aria-label", "Cycling map of the Faroe Islands");

    // Icons are rasterised on demand from the SVG strings — no sprite sheet.
    map.setMissingStyleImageResolver(async (id) => {
      if (!(id in ICONS) || map.hasImage(id)) return;
      const img = new Image(96, 96);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`icon ${id}`));
        img.src = `data:image/svg+xml;utf8,${encodeURIComponent(ICONS[id as IconId])}`;
      });
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
    });

    const canvas = map.getCanvas();
    map.on("mousemove", (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: INTERACTIVE_LAYERS });
      canvas.style.cursor = hit.length ? "pointer" : "";
    });
    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: INTERACTIVE_LAYERS })[0];
      onSelectRef.current(hit ? selectionFrom(hit) : null);
    });

    // A GeoJSON source arriving after the first render drops any feature
    // state set before it; put the selection back when the source is in.
    map.on("sourcedata", (e) => {
      const sel = selectedRef.current;
      if (e.isSourceLoaded && sel && stateKey(sel).source === e.sourceId) applySelection(map, null, sel);
    });

    // "style.load" — the layers exist — rather than "load", which also waits
    // for every tile source and never comes if a tile host is unreachable.
    map.once("style.load", () => {
      readyRef.current = true;
      applyVisibility(map, visible);
      applySelection(map, selectedRef.current, selected);
      selectedRef.current = selected;
      onReady?.();
    });

    if (import.meta.env.DEV) (window as unknown as { __faroeMap?: MapLibre }).__faroeMap = map;
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyVisibility(map, visible);
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applySelection(map, selectedRef.current, selected);
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    const target = { center: flyTo.center, zoom: flyTo.zoom ?? Math.max(map.getZoom(), 11) };
    if (reducedMotion) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 900, essential: true });
  }, [flyTo, reducedMotion]);

  // maplibre-gl.css makes the container position: relative, so size it outright.
  return <div ref={holder} className="h-full w-full" />;
}

function applyVisibility(map: MapLibre, visible: Record<LayerGroupId, boolean>) {
  for (const [group, layers] of Object.entries(LAYER_GROUPS) as [LayerGroupId, string[]][]) {
    for (const id of layers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible[group] ? "visible" : "none");
    }
  }
}

function applySelection(map: MapLibre, prev: MapSelection | null, next: MapSelection | null) {
  if (prev) {
    const k = stateKey(prev);
    if (map.getSource(k.source)) map.setFeatureState(k, { selected: false });
  }
  if (next) {
    const k = stateKey(next);
    if (map.getSource(k.source)) map.setFeatureState(k, { selected: true });
  }
}
