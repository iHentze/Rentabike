/**
 * The legend: every row is a switch for its layers, and the "Special
 * tunnels" index jumps to the tunnel's text.
 */
import { LEGEND_SHOWN } from "./legend-config";
import { PlaceSearch } from "./place-search";
import type { SearchHit } from "./search";
import { Sheet } from "./sheet";
import { Lbl, cx } from "~/components/ui";
import { REVIEWED, TUNNELS } from "~/data/map";
import type { LayerGroupId, TunnelInfo } from "~/data/map/types";

export function MapLegend({ open, visible, index, onGo, onToggle, onReset, onTunnel, onClose }: {
  open: boolean;
  visible: Record<LayerGroupId, boolean>;
  index: SearchHit[];
  onGo: (hit: SearchHit) => void;
  onToggle: (id: LayerGroupId) => void;
  onReset: () => void;
  onTunnel: (t: TunnelInfo) => void;
  onClose: () => void;
}) {
  const allOn = Object.values(visible).every(Boolean);
  return (
    <Sheet open={open} side="left" title="Legend" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <PlaceSearch index={index} placeholder="Find a village, a tunnel, a tour…" onPick={onGo} />
        {LEGEND_SHOWN.map((section) => (
          <div key={section.title} className="flex flex-col gap-[6px]">
            <Lbl>{section.title}</Lbl>
            <div className="flex flex-col">
              {section.rows.map((row) => {
                const on = visible[row.id];
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(row.id)}
                    className={cx("flex items-center gap-3 rounded-field px-2 py-[7px] text-left text-[13.5px] leading-[1.3] hover:bg-white/6", on ? "text-ink" : "text-ink-dim")}
                  >
                    <span className={cx("flex shrink-0 items-center rounded-[6px] bg-[#e3e9d7] px-1 py-[3px]", !on && "opacity-40")}>{row.swatch}</span>
                    <span className="flex-1">{row.label}</span>
                    <span aria-hidden className={cx("h-4 w-7 shrink-0 rounded-full p-[2px] transition-colors", on ? "bg-brand" : "bg-white/15")}>
                      <span className={cx("block size-3 rounded-full bg-white transition-transform", on && "translate-x-3")} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {!allOn && (
          <button type="button" onClick={onReset} className="self-start text-[13.5px] font-semibold text-brand-bright hover:text-ink">
            Show everything again
          </button>
        )}

        {TUNNELS.length > 0 && (
          <div className="flex flex-col gap-[6px]">
            <Lbl>Special tunnels</Lbl>
            <div className="flex flex-col">
              {TUNNELS.map((t) => (
                <button key={t.letter} type="button" onClick={() => onTunnel(t)} className="flex items-center gap-3 rounded-field px-2 py-[7px] text-left text-[13.5px] hover:bg-white/6">
                  <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", t.status === "closed" ? "bg-danger/20 text-danger" : "bg-white/10 text-ink")}>{t.letter}</span>
                  <span className="flex-1">{t.name}</span>
                  <span className="num text-[12.5px] text-ink-mute">{t.lengthKm} km</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="border-t border-white/7 pt-4 text-[12px] leading-[1.5] text-ink-dim">
          Notes and tunnels last reviewed {REVIEWED}. Map design © R Hokwerda, 27 February 2025. Background by Meinhard Absalon. Reproduced with permission. Classification of Class A routes is the author's personal discretion and not officially endorsed. Roads © OpenStreetMap contributors; tiles © OpenFreeMap.
        </p>
      </div>
    </Sheet>
  );
}
