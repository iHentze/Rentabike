/**
 * The funnel, spelled out: dates and time, then for every rider a bike and
 * their extras, then checkout. One strip on every screen of the funnel, so
 * a customer always sees where they are, what is done, and what comes next.
 * Every finished step is a link back to it.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { Check } from "./icons";
import { Shell } from "./site";
import { cx } from "./ui";
import type { Trip } from "~/lib/trip";
import { tripHref } from "~/lib/trip";
import { fmtDayTime } from "~/lib/format";

export interface StepRider {
  label: string;
  bikeDone: boolean;
  extrasDone: boolean;
}

export type FunnelPosition = { at: "dates" } | { at: "rider"; i: number; step: "bike" | "extras" } | { at: "checkout" };

type State = "done" | "now" | "todo";

export function FunnelSteps({ trip, riders, position, canCheckout, addRiderHref, tour }: { trip: Trip; riders: StepRider[]; position: FunnelPosition; canCheckout: boolean; addRiderHref?: string; tour?: { title: string } | null }) {
  const riderState = (i: number, step: "bike" | "extras"): State => {
    if (position.at === "rider" && position.i === i && position.step === step) return "now";
    const r = riders[i]!;
    return (step === "bike" ? r.bikeDone : r.extrasDone) ? "done" : "todo";
  };
  const datesHref = tour ? undefined : tripHref("/", trip);

  // On a phone the strip scrolls sideways; open it on the stage the customer is at.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>("[data-now]");
    if (el && strip.current) strip.current.scrollTo({ left: Math.max(0, el.offsetLeft - strip.current.offsetLeft - 16) });
  }, [position.at, position.at === "rider" ? position.i : -1, position.at === "rider" ? position.step : ""]);

  return (
    <div className="border-t border-white/5 bg-header">
      <Shell className="px-5 md:px-8">
        <div ref={strip} className="flex items-stretch gap-2 overflow-x-auto py-3">
        <Stage state={position.at === "dates" ? "now" : "done"} href={datesHref}>
          <Dot state={position.at === "dates" ? "now" : "done"} n={1} />
          <span className="flex flex-col gap-[1px]">
            <span className="text-[13.5px] font-semibold">{tour ? "Tour" : "Dates & time"}</span>
            <span className="num max-w-[190px] truncate text-[12px] text-ink-mute">{tour ? tour.title : `${fmtDayTime(trip.startAt)} → ${fmtDayTime(trip.endAt)}`}</span>
          </span>
        </Stage>

        {riders.map((r, i) => {
          const bike = riderState(i, "bike");
          const extras = riderState(i, "extras");
          const here = position.at === "rider" && position.i === i;
          const all = bike === "done" && extras === "done";
          return (
            <div key={i} className="flex items-stretch gap-2">
              <Joint />
              <div data-now={here ? "" : undefined} className={cx("flex shrink-0 items-center gap-3 rounded-field px-3 py-2", here ? "bg-brand/14 shadow-[inset_0_0_0_1.5px_#0A78D6]" : all ? "bg-ok/8" : "bg-white/4")}>
                <Dot state={all ? "done" : here ? "now" : "todo"} n={i + 2} />
                <span className="flex flex-col gap-[3px]">
                  <span className={cx("text-[13.5px] font-semibold", !here && !all && "text-ink-mute")}>{r.label}</span>
                  <span className="flex items-center gap-1">
                    <Chip state={bike} href={tripHref("/riders", trip, { r: i + 1, step: "bike" })}>
                      Bike
                    </Chip>
                    <span className="text-[11px] text-ink-dim">›</span>
                    <Chip state={extras} href={r.bikeDone ? tripHref("/riders", trip, { r: i + 1, step: "extras" }) : undefined}>
                      Extras
                    </Chip>
                  </span>
                </span>
              </div>
            </div>
          );
        })}

        <Joint />
        <Stage state={position.at === "checkout" ? "now" : canCheckout ? "todo" : "todo"} href={canCheckout && position.at !== "checkout" ? tripHref("/checkout", trip) : undefined} dim={!canCheckout && position.at !== "checkout"}>
          <Dot state={position.at === "checkout" ? "now" : "todo"} n={riders.length + 2} />
          <span className="flex flex-col gap-[1px]">
            <span className="text-[13.5px] font-semibold">Checkout</span>
            <span className="text-[12px] text-ink-mute">{canCheckout || position.at === "checkout" ? "Details and payment" : "After the extras"}</span>
          </span>
        </Stage>

        {addRiderHref && (
          <Link to={addRiderHref} className="ml-auto flex shrink-0 items-center self-center pl-4 text-[13.5px] font-semibold text-brand-bright hover:text-ink">
            + Add a rider
          </Link>
        )}
        </div>
      </Shell>
    </div>
  );
}

function Stage({ state, href, dim, children }: { state: State; href?: string; dim?: boolean; children: ReactNode }) {
  const cls = cx("flex shrink-0 items-center gap-3 rounded-field px-3 py-2", state === "now" ? "bg-brand/14 shadow-[inset_0_0_0_1.5px_#0A78D6]" : state === "done" ? "bg-ok/8" : "bg-white/4", dim && "opacity-60");
  return href ? (
    <Link to={href} className={cx(cls, "hover:bg-white/8")}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

function Dot({ state, n }: { state: State; n: number }) {
  return (
    <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-full", state === "done" ? "bg-ok text-ok-ink" : state === "now" ? "border-2 border-brand text-brand-bright" : "border-2 border-dashed border-ink-dim text-ink-dim")}>
      {state === "done" ? <Check size={14} strokeWidth={3.2} /> : <span className="text-[12px] font-bold">{n}</span>}
    </span>
  );
}

/** "Bike ✓", "Extras ●" — a rider's two sub-steps. */
function Chip({ state, href, children }: { state: State; href?: string; children: ReactNode }) {
  const cls = cx(
    "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11.5px] font-bold tracking-[.02em]",
    state === "done" ? "bg-ok/16 text-ok" : state === "now" ? "bg-brand text-white" : "bg-white/6 text-ink-mute",
  );
  const mark = state === "done" ? <Check size={10} strokeWidth={3.5} /> : state === "now" ? <span className="size-[6px] rounded-full bg-white" /> : null;
  return href ? (
    <Link to={href} className={cx(cls, "hover:brightness-125")}>
      {mark}
      {children}
    </Link>
  ) : (
    <span className={cls}>
      {mark}
      {children}
    </span>
  );
}

function Joint() {
  return <span className="my-auto h-px w-4 shrink-0 bg-white/12" />;
}
