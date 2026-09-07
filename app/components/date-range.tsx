/**
 * The dates on the booking bar. The browser's own date picker is a tiny
 * system dialog that ignores the design and knows nothing about the shop —
 * this one is ours: two months side by side, pick a first day then a last,
 * past days closed, opening hours in the time menus. It writes the same
 * from/to fields the form always sent, so nothing downstream changes.
 *
 * All date arithmetic is on YYYY-MM-DD strings via UTC, so the server and the
 * browser render byte-identical markup whatever timezone either sits in.
 */
import { useEffect, useRef, useState } from "react";
import { Chevron, ChevronDown } from "./icons";
import { Lbl, cx } from "./ui";
import { OPENING_TIMES } from "~/lib/trip";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(d: string): [number, number, number] {
  const [y = 1970, m = 1, day = 1] = d.split("-").map(Number);
  return [y, m, day];
}
function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}
function addDays(d: string, n: number): string {
  const [y, m, day] = parts(d);
  return iso(y, m, day + n);
}
function addMonths(ym: string, n: number): string {
  const [y, m] = parts(`${ym}-01`);
  return iso(y, m + n, 1).slice(0, 7);
}
/** "Tue 8 Sep" — the shape the rest of the site uses for a day. */
export function dayLabel(d: string): string {
  const [y, m, day] = parts(d);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${WEEKDAYS_SHORT[wd]} ${day} ${MONTHS_SHORT[m - 1]}`;
}

/** The 6 × 7 grid of one month, Monday first, padded with the neighbours' days (null). */
function monthGrid(ym: string): Array<string | null> {
  const [y, m] = parts(`${ym}-01`);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(iso(y, m, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function DateRangeCells({ from, to, fromTime, toTime, today }: { from: string; to: string; fromTime: string; toTime: string; today: string }) {
  const [range, setRange] = useState({ from, to });
  const [times, setTimes] = useState({ from: fromTime, to: toTime });
  const [open, setOpen] = useState(false);
  // What the next tap means: the first day, the last day, or the times before Done.
  const [phase, setPhase] = useState<"from" | "to" | "times">("from");
  const [month, setMonth] = useState(from.slice(0, 7));
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape — the two ways every popover should close.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const show = (which: "from" | "to") => {
    setMonth((which === "from" ? range.from : range.to).slice(0, 7));
    setPhase(which);
    setOpen(true);
  };

  // Two taps for the days; the popover stays put so the times can follow. Only Done closes it.
  const pick = (d: string) => {
    if (phase === "from" || d < range.from) {
      setRange({ from: d, to: range.to < d ? d : range.to });
      setPhase("to");
    } else {
      setRange({ ...range, to: d });
      setPhase("times");
    }
  };

  const firstMonth = today.slice(0, 7);
  // Same day out and back: the return must come after the pickup, so the menu only offers later slots.
  const sameDay = range.from === range.to;
  const returnSlots = sameDay ? OPENING_TIMES.filter((t) => t > times.from) : OPENING_TIMES;
  const toTimeShown = returnSlots.includes(times.to) ? times.to : (returnSlots[0] ?? times.to);
  // While picking the last day, the range previews up to the day under the pointer.
  const previewTo = phase === "to" && hover && hover >= range.from ? hover : range.to;

  return (
    <div ref={box} className="contents">
      <input type="hidden" name="from" value={range.from} />
      <input type="hidden" name="to" value={range.to} />
      <input type="hidden" name="fromTime" value={times.from} />
      <input type="hidden" name="toTime" value={toTimeShown} />
      <div className="relative flex flex-col gap-1 px-[18px] py-[14px] lg:border-l lg:border-white/7">
        <Lbl>From</Lbl>
        <div className="flex items-center gap-2 text-[16px] font-semibold">
          <button type="button" onClick={() => show("from")} aria-haspopup="dialog" aria-expanded={open} className={cx("num -mx-1 rounded-md px-1 text-left hover:text-brand-bright", open && phase === "from" && "text-brand-bright")}>
            {dayLabel(range.from)} <span className="text-ink-mute">·</span> {times.from}
          </button>
        </div>

        {open && (
          <div role="dialog" aria-label="Choose your dates" className="absolute left-0 top-[calc(100%+8px)] z-30 w-[min(640px,calc(100vw-24px))] rounded-card bg-card p-4 shadow-[0_18px_60px_rgba(0,0,0,.55),inset_0_0_0_1px_rgba(255,255,255,.06)] max-sm:fixed max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-auto max-sm:max-h-[calc(100dvh-16px)] max-sm:w-auto max-sm:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink-soft">{phase === "from" ? "Pick the first day" : phase === "to" ? "Now the last day" : "Set the times, then Done"}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMonth(addMonths(month, -1))} disabled={month <= firstMonth} aria-label="Earlier month" className="flex size-8 items-center justify-center rounded-full hover:bg-white/8 disabled:opacity-25">
                  <Chevron size={15} className="rotate-180" />
                </button>
                <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Later month" className="flex size-8 items-center justify-center rounded-full hover:bg-white/8">
                  <Chevron size={15} />
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-1 flex size-8 items-center justify-center rounded-full bg-white/8 text-[18px] leading-none hover:bg-white/14 sm:hidden">
                  ×
                </button>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {[month, addMonths(month, 1)].map((ym, i) => (
                <Month key={ym} ym={ym} today={today} from={range.from} to={previewTo} onPick={pick} onHover={setHover} className={i === 1 ? "hidden sm:block" : undefined} />
              ))}
            </div>
            {/* the times, in the same place as the days — one visit settles the whole trip */}
            <div className="mt-4 grid gap-3 border-t border-white/6 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TimePick label="Collect" day={dayLabel(range.from)} value={times.from} slots={OPENING_TIMES} onChange={(t) => setTimes({ ...times, from: t })} />
              <TimePick label="Return" day={dayLabel(range.to)} value={toTimeShown} slots={returnSlots} onChange={(t) => setTimes({ ...times, to: t })} />
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white px-[20px] py-[10px] text-[14px] font-bold text-night hover:bg-ink-pale">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-[18px] py-[14px] lg:border-l lg:border-white/7">
        <Lbl>Until</Lbl>
        <div className="flex items-center gap-2 text-[16px] font-semibold">
          <button type="button" onClick={() => show("to")} aria-haspopup="dialog" aria-expanded={open} className={cx("num -mx-1 rounded-md px-1 text-left hover:text-brand-bright", open && phase !== "from" && "text-brand-bright")}>
            {dayLabel(range.to)} <span className="text-ink-mute">·</span> {toTimeShown}
          </button>
        </div>
      </div>
    </div>
  );
}

function Month({ ym, today, from, to, onPick, onHover, className }: { ym: string; today: string; from: string; to: string; onPick: (d: string) => void; onHover: (d: string | null) => void; className?: string }) {
  const [y, m] = parts(`${ym}-01`);
  return (
    <div className={className} onMouseLeave={() => onHover(null)}>
      <div className="mb-2 text-[15px] font-semibold">
        {MONTHS[m - 1]} {y}
      </div>
      <div className="grid grid-cols-7 gap-y-[2px]">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-center text-[11.5px] font-semibold tracking-[.04em] text-ink-mute">
            {d}
          </span>
        ))}
        {monthGrid(ym).map((d, i) => {
          if (!d) return <span key={i} />;
          const past = d < today;
          const start = d === from;
          const end = d === to;
          const inside = d > from && d < to;
          return (
            <button
              key={d}
              type="button"
              disabled={past}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              aria-label={`${dayLabel(d)} ${y}`}
              aria-pressed={start || end}
              className={cx(
                "num relative flex h-9 items-center justify-center text-[14px]",
                past && "text-ink-dim/60",
                !past && !start && !end && !inside && "rounded-full hover:bg-white/10",
                inside && "bg-brand/18",
                start && (end ? "rounded-full" : "rounded-l-full"),
                end && !start && "rounded-r-full",
                (start || end) && "bg-brand font-bold text-white",
                d === today && !start && !end && "font-bold text-brand-bright",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Collect · Fri 18 Sep · [09:00]" — a half-hour menu within opening hours, dressed as a pill. */
function TimePick({ label, day, value, slots, onChange }: { label: string; day: string; value: string; slots: string[]; onChange: (t: string) => void }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <Lbl>
        {label} · {day}
      </Lbl>
      <span className="relative inline-flex">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="num w-full appearance-none rounded-full bg-white/8 py-[9px] pl-4 pr-9 text-[15px] font-semibold focus:outline-2 focus:outline-brand-bright">
          {slots.map((t) => (
            <option key={t} value={t} className="bg-card">
              {t}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute" />
      </span>
    </label>
  );
}
