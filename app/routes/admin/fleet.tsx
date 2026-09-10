/**
 * The fleet board: fourteen days across, every bike type down, units out in
 * each cell. Rentals and tour bikes are the same lines on the same counter,
 * so a Saturday that looks full because of the Sunday ride's bikes shows the
 * ride in the column header. Red means the shop has promised more than it
 * has — the guard should make that impossible, so red is a stock edit to go
 * and check.
 */
import { Link } from "react-router";
import type { Route } from "./+types/fleet";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { faroeDay, fleetBoard } from "~/lib/admin/queries";
import { CATEGORY_LABEL } from "~/lib/catalogue/bikes";
import type { BikeCategory } from "~/db/schema";
import { cx } from "~/components/ui";
import { fmtDay, fmtWeekday } from "~/lib/format";

const DAYS = 14;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const url = new URL(request.url);
  const now = Date.now();
  const today = faroeDay(now).date;
  const fromParam = url.searchParams.get("from");
  const from = fromParam && ISO.test(fromParam) ? fromParam : today;
  const board = await fleetBoard(env.DB, from, DAYS);
  return { board, today, from };
}

export default function Fleet({ loaderData }: Route.ComponentProps) {
  const { board, today, from } = loaderData;
  const prev = shift(from, -DAYS);
  const next = shift(from, DAYS);
  const groups = new Map<string, typeof board.types>();
  for (const t of board.types) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  const busiest = board.days.map((_, i) => board.types.reduce((n, t) => n + (t.out[i] ?? 0), 0));
  const fleetSize = board.types.reduce((n, t) => n + t.stock, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">Fleet</h1>
          <p className="text-[14.5px] text-ink-soft">Units out per size, per day, for the next two weeks — rentals and tour bikes on one counter. A number turns amber when a size is fully out and red when more is promised than exists.</p>
        </div>
        <div className="flex items-center gap-1">
          <Link to={`/admin/fleet?from=${prev}`} className="rounded-full bg-white/8 px-4 py-[7px] text-[14px] font-semibold text-ink-soft hover:bg-white/14">
            ‹ Earlier
          </Link>
          <Link to="/admin/fleet" className={cx("rounded-full px-4 py-[7px] text-[14px] font-semibold", from === today ? "bg-white text-night" : "bg-white/8 text-ink-soft hover:bg-white/14")}>
            Today
          </Link>
          <Link to={`/admin/fleet?from=${next}`} className="rounded-full bg-white/8 px-4 py-[7px] text-[14px] font-semibold text-ink-soft hover:bg-white/14">
            Later ›
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card bg-card">
        <table className="w-full min-w-[1040px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[.06em] text-ink-mute">
              <th className="sticky left-0 z-10 bg-card px-4 py-3 font-semibold">Bike</th>
              <th className="px-2 py-3 text-right font-semibold">Units</th>
              {board.days.map((d, i) => (
                <th key={d.date} className={cx("px-1 py-2 text-center font-semibold", d.date === today && "text-ink")}>
                  <div>{fmtWeekday(d.start).slice(0, 3)}</div>
                  <div className="num text-[12px] normal-case tracking-normal">{fmtDay(d.start).replace(/^\w+ /, "")}</div>
                  <div className={cx("num mt-[2px] text-[10.5px] normal-case tracking-normal", busiest[i] ? "text-ink-soft" : "text-ink-dim")}>{busiest[i]} out</div>
                  {d.departures > 0 && <div className="num text-[10.5px] normal-case tracking-normal text-brand-bright">{d.departures} {d.departures === 1 ? "tour" : "tours"}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([category, list]) => (
              <Group key={category} label={CATEGORY_LABEL[category as BikeCategory] ?? category} rows={list} today={today} days={board.days.map((d) => d.date)} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-ink-mute">
        {fleetSize} bikes in the fleet. A day counts a booking that overlaps it at all, so a bike collected at 17:00 and one returned at 09:00 both count on that day — which is also how the availability guard counts them.
      </p>
    </div>
  );
}

function Group({ label, rows, today, days }: { label: string; rows: Array<{ id: string; name: string; sizeLabel: string | null; stock: number; listed: boolean; out: number[] }>; today: string; days: string[] }) {
  return (
    <>
      <tr className="border-t border-white/8 bg-white/[.03]">
        <td colSpan={2 + days.length} className="px-4 py-[6px] text-[11px] font-bold uppercase tracking-[.08em] text-ink-mute">
          {label}
        </td>
      </tr>
      {rows.map((t) => (
        <tr key={t.id} className={cx("border-t border-white/6", !t.listed && "opacity-60")}>
          <td className="sticky left-0 z-10 max-w-[260px] truncate bg-card px-4 py-[6px] font-semibold">
            {t.name}
            {t.sizeLabel && <span className="ml-2 font-normal text-ink-mute">{t.sizeLabel}</span>}
          </td>
          <td className="num px-2 py-[6px] text-right text-ink-soft">{t.stock}</td>
          {t.out.map((n, i) => (
            <td key={days[i]} className={cx("num px-1 py-[6px] text-center", days[i] === today && "bg-white/[.03]")}>
              <span className={cx("inline-block min-w-[26px] rounded-md px-1 py-[2px]", n === 0 ? "text-ink-dim" : n > t.stock ? "bg-danger/18 font-bold text-danger" : n === t.stock ? "bg-warn/16 font-semibold text-warn" : "bg-brand/14 text-ink")}>{n}</span>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function shift(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
