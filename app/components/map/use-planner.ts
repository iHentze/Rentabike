/**
 * The ride planner's state: where it starts and ends, how it got there.
 * The road network is fetched and built once, the first time it is needed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { MAP_DATA_URLS } from "./style";
import type { LngLat } from "~/data/map/types";
import type { RouteOptions, RouteResult, Router } from "~/lib/map/router";

export interface PlanPoint {
  at: LngLat;
  label: string;
}

export interface PlannerState {
  start: PlanPoint | null;
  end: PlanPoint | null;
  picking: "start" | "end" | null;
  options: RouteOptions;
  result: RouteResult | null;
  /** Network still loading, or the router is thinking. */
  busy: boolean;
  error: string | null;
}

let routerPromise: Promise<Router> | null = null;
function loadRouter(): Promise<Router> {
  if (!routerPromise) {
    routerPromise = (async () => {
      const [{ Router }, roads, tunnels, ferries] = await Promise.all([
        import("~/lib/map/router"),
        ...(["roads", "tunnels", "ferries"] as const).map((k) => fetch(MAP_DATA_URLS[k]).then((r) => r.json() as Promise<FeatureCollection>)),
      ]);
      return Router.fromGeoJSON(roads!, tunnels!, ferries!);
    })();
    routerPromise.catch(() => (routerPromise = null));
  }
  return routerPromise;
}

export function usePlanner(initial?: { start?: PlanPoint; end?: PlanPoint }) {
  const [state, setState] = useState<PlannerState>({ start: initial?.start ?? null, end: initial?.end ?? null, picking: null, options: { ferries: true }, result: null, busy: false, error: null });
  const run = useRef(0);

  useEffect(() => {
    const { start, end, options } = state;
    if (!start || !end) {
      setState((s) => (s.result || s.busy ? { ...s, result: null, busy: false } : s));
      return;
    }
    const id = ++run.current;
    setState((s) => ({ ...s, busy: true, error: null }));
    loadRouter()
      .then((router) => {
        if (id !== run.current) return;
        const a = router.snap(start.at);
        const b = router.snap(end.at);
        if (!a || !b) throw new Error("No road near there.");
        if (a.distM > 2500 || b.distM > 2500) throw new Error("That point is too far from any road.");
        const result = router.route(a, b, options);
        setState((s) => ({ ...s, result, busy: false, error: result ? null : "No road joins these two, not even by ferry." }));
      })
      .catch((e: Error) => id === run.current && setState((s) => ({ ...s, result: null, busy: false, error: e.message || "The planner could not load." })));
  }, [state.start, state.end, state.options]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((patch: Partial<PlannerState>) => setState((s) => ({ ...s, ...patch })), []);
  const setPoint = useCallback((which: "start" | "end", p: PlanPoint | null) => setState((s) => ({ ...s, [which]: p, picking: null })), []);
  const swap = useCallback(() => setState((s) => ({ ...s, start: s.end, end: s.start })), []);
  const clear = useCallback(() => setState((s) => ({ ...s, start: null, end: null, picking: null, result: null, error: null })), []);
  return { state, set, setPoint, swap, clear };
}
