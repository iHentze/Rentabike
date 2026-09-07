/**
 * "Your two bikes" — the running total on the right of every funnel screen.
 * Rows come from the priced basket, so the number here is the number the
 * booking will carry. Green means included, a dashed ring means still to pick.
 */
import type { ReactNode } from "react";
import { Check } from "./icons";
import { Amount, Card, cx } from "./ui";
import { formatDKKCode } from "~/lib/money";
import { fmtDays } from "~/lib/format";

export interface RailRider {
  label: string;
  heightCm?: number;
  bikeName: string | null;
  detail?: string | null;
  totalMinor: number | null;
  /** Struck through — the bike went while the customer was typing. */
  lost?: boolean;
}

export interface RailLine {
  label: string;
  totalMinor: number;
  included?: boolean;
}

export function SummaryRail({ title = "Your booking", days, riders, lines, totalMinor, totalLabel = "So far", totalNote, children, footer }: {
  title?: string;
  days: number;
  riders: RailRider[];
  lines: RailLine[];
  totalMinor: number;
  totalLabel?: string;
  totalNote?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-white/6 px-[18px] py-4">
        <h2 className="text-[16.5px] font-semibold">{title}</h2>
        <span className="num text-[13px] text-ink-mute">{fmtDays(days)}</span>
      </div>
      <div className="flex flex-col gap-[15px] px-[18px] py-4">
        {riders.map((r, i) => (
          <div key={i} className={cx("flex gap-3 border-b border-white/6 pb-[15px]", r.lost && "rounded-field bg-warn/10 px-[13px] pt-3")}>
            <div className={cx("flex size-8 shrink-0 items-center justify-center rounded-full", r.bikeName && !r.lost ? "bg-ok text-ok-ink" : "border-2 border-dashed border-[#2C4A63] text-brand-bright")}>
              {r.bikeName && !r.lost ? <Check size={16} strokeWidth={3} /> : <span className="text-[13px] font-bold">{i + 1}</span>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className={cx("num text-[14.5px] font-semibold", r.lost && "text-warn-soft line-through")}>
                {r.label}
                {r.heightCm ? ` · ${r.heightCm} cm` : ""}
              </span>
              {r.bikeName ? (
                <>
                  <span className={cx("text-[13.5px]", r.lost ? "text-warn-soft" : "text-ink-soft")}>{r.bikeName}</span>
                  {r.detail && <span className="num text-[13px] text-ink-mute">{r.detail}</span>}
                </>
              ) : (
                <span className="text-[13.5px] font-semibold text-brand-bright">Pick a bike →</span>
              )}
            </div>
            {r.totalMinor != null ? <Amount minor={r.totalMinor} className={cx("text-[14.5px]", r.lost && "text-ink-mute line-through")} /> : <span className="text-[14.5px] text-ink-dim">—</span>}
          </div>
        ))}
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-3 text-[14px]">
            <span className="text-ink-soft">{l.label}</span>
            {l.included ? <span className="font-semibold text-ok">Included</span> : <Amount minor={l.totalMinor} />}
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-white/6 pt-[15px]">
          <div className="flex flex-col gap-[2px]">
            <span className="text-[15.5px] font-semibold">{totalLabel}</span>
            {totalNote && <span className="text-[12.5px] text-ink-mute">{totalNote}</span>}
          </div>
          <span className="num font-display text-[27px] font-bold tracking-[-.02em]">{formatDKKCode(totalMinor)}</span>
        </div>
        {children}
        {footer && <div className="text-[13px] leading-[1.5] text-ink-mute">{footer}</div>}
      </div>
    </Card>
  );
}
