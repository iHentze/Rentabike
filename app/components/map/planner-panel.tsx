/**
 * Plan a ride: pick two places, get the bike-legal road between them with
 * its tunnels and ferries spelled out, the climbing, and a GPX to take
 * along.
 */
import { useMemo } from "react";
import { PlaceSearch } from "./place-search";
import { ProfileChart, useProfile } from "./profile-chart";
import { villageHits } from "./search";
import { Sheet } from "./sheet";
import type { PlannerState, PlanPoint } from "./use-planner";
import { Lbl, PillButton, cx } from "~/components/ui";
import { TUNNELS } from "~/data/map";
import type { LngLat, MapSelection } from "~/data/map/types";
import { download, toGpx } from "~/lib/map/gpx";
import type { RouteOptions } from "~/lib/map/router";

const km = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export function PlannerPanel({ open, state, onPoint, onPick, onOptions, onSwap, onClear, onSelect, onClose }: {
  open: boolean;
  state: PlannerState;
  onPoint: (which: "start" | "end", p: PlanPoint | null) => void;
  onPick: (which: "start" | "end") => void;
  onOptions: (o: RouteOptions) => void;
  onSwap: () => void;
  onClear: () => void;
  onSelect: (s: MapSelection, fly?: boolean) => void;
  onClose: () => void;
}) {
  const villages = useMemo(villageHits, []);
  const coords = state.result?.coords ?? null;
  const { profile, loading } = useProfile(coords);
  const r = state.result;

  return (
    <Sheet open={open} side="left" title="Plan a ride" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <PointRow which="start" point={state.start} villages={villages} onPoint={onPoint} onPick={onPick} />
          <PointRow which="end" point={state.end} villages={villages} onPoint={onPoint} onPick={onPick} />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
            {state.start && state.end && (
              <button type="button" onClick={onSwap} className="font-semibold text-brand-bright hover:text-ink">
                Swap ends
              </button>
            )}
            {(state.start || state.end) && (
              <button type="button" onClick={onClear} className="font-semibold text-ink-mute hover:text-ink">
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Lbl>Options</Lbl>
          <label className="flex items-center gap-3 text-[14.5px]">
            <input type="checkbox" checked={state.options.ferries !== false} onChange={(e) => onOptions({ ...state.options, ferries: e.target.checked })} className="size-4 accent-brand" />
            Use ferries that take bikes
          </label>
          <label className="flex items-center gap-3 text-[14.5px]">
            <input type="checkbox" checked={Boolean(state.options.avoidMain)} onChange={(e) => onOptions({ ...state.options, avoidMain: e.target.checked })} className="size-4 accent-brand" />
            Keep off the main roads where you can
          </label>
        </div>

        {state.busy && <p className="text-[14px] text-ink-mute">Finding the road…</p>}
        {state.error && <p className="text-[14.5px] text-warn-ink">{state.error}</p>}

        {r && (
          <div className="flex flex-col gap-4">
            {r.illegal && (
              <p className="rounded-field bg-danger/15 px-4 py-3 text-[14px] leading-[1.5] text-ink">
                No road open to bikes joins these two. The ride below goes through a tunnel that is <b>closed to cyclists</b> — take the SSL bus through that part.
              </p>
            )}
            <div className="flex items-baseline gap-3">
              <span className="num font-display text-[30px] font-bold tracking-[-.02em]">{km(r.distanceM)}</span>
              <span className="text-[13.5px] text-ink-mute">{r.legs.filter((l) => l.kind === "ferry").length ? "including the ferry" : "by road"}</span>
            </div>
            <ProfileChart profile={profile} loading={loading} />
            <div className="flex flex-col">
              <Lbl className="mb-1">The way</Lbl>
              {r.legs.map((l, i) => {
                const t = l.letter ? TUNNELS.find((x) => x.letter === l.letter) : undefined;
                return (
                  <div key={i} className={cx("flex items-start gap-3 py-[7px] text-[14px]", i > 0 && "border-t border-white/6")}>
                    <span className={cx("mt-[3px] size-[10px] shrink-0 rounded-full", l.kind === "road" ? "bg-[#f7c948]" : l.kind === "ferry" ? "bg-white" : l.open ? "bg-[#8a9096]" : "bg-danger")} aria-hidden />
                    <span className="flex-1 leading-[1.4]">
                      {l.kind === "road" && "Ride"}
                      {l.kind === "ferry" && `Ferry ${l.name}`}
                      {l.kind === "tunnel" && (
                        <>
                          {l.name}
                          {" — "}
                          <span className={l.open ? "text-ok" : "text-danger"}>{l.open ? "open to cyclists" : "closed to cyclists"}</span>
                          {t && (
                            <>
                              {" · "}
                              <button type="button" onClick={() => onSelect({ kind: "tunnel", id: `tunnel-${t.letter}`, name: t.name, open: t.status === "open", letter: t.letter, lengthKm: t.lengthKm }, true)} className="font-semibold text-brand-bright hover:text-ink">
                                note {t.letter}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </span>
                    <span className="num shrink-0 text-ink-mute">{km(l.distanceM)}</span>
                  </div>
                );
              })}
            </div>
            <PillButton tone="ghost" size="sm" className="self-start" onClick={() => download(`ride-${state.start?.label ?? "start"}-${state.end?.label ?? "end"}.gpx`.replace(/\s+/g, "-").toLowerCase(), toGpx(`${state.start?.label} – ${state.end?.label}`, r.coords, profile?.e && profile.d.length === r.coords.length ? profile.e : undefined))}>
              Download GPX
            </PillButton>
            <p className="text-[12.5px] leading-[1.5] text-ink-dim">Roads from OpenStreetMap, classified as the 2025 print. Check the tunnel notes before you ride; the planner cannot see today's weather or roadworks.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function PointRow({ which, point, villages, onPoint, onPick }: { which: "start" | "end"; point: PlanPoint | null; villages: ReturnType<typeof villageHits>; onPoint: (which: "start" | "end", p: PlanPoint | null) => void; onPick: (which: "start" | "end") => void }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <Lbl>{which === "start" ? "From" : "To"}</Lbl>
      {point ? (
        <div className="flex items-center gap-3 rounded-field bg-white/6 px-[14px] py-[10px]">
          <span className={cx("size-3 shrink-0 rounded-full", which === "start" ? "bg-ok" : "bg-[#e0245e]")} aria-hidden />
          <span className="flex-1 text-[15px] font-semibold">{point.label}</span>
          <button type="button" onClick={() => onPoint(which, null)} className="text-[13px] font-semibold text-ink-mute hover:text-ink">
            Change
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <PlaceSearch index={villages} placeholder="Type a village…" className="flex-1" onPick={(h) => onPoint(which, { at: h.at, label: h.label })} />
          <button type="button" onClick={() => onPick(which)} className="shrink-0 rounded-field bg-white/10 px-[14px] text-[13.5px] font-semibold hover:bg-white/16">
            Tap the map
          </button>
        </div>
      )}
    </div>
  );
}

export function planPointLabel(at: LngLat): string {
  return `${at[1].toFixed(4)}, ${at[0].toFixed(4)}`;
}
