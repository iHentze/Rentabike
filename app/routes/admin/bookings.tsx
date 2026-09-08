import { Form } from "react-router";
import type { Route } from "./+types/bookings";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { listBookings } from "~/lib/admin/queries";
import { BookingTable } from "~/components/admin";
import { cx } from "~/components/ui";

const FIELD = "rounded-field bg-white/10 px-[13px] py-[9px] text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const sp = new URL(request.url).searchParams;
  const filter = {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    day: sp.get("day") || undefined,
    when: (sp.get("when") as "upcoming" | "past" | "all" | null) ?? undefined,
  };
  const rows = await listBookings(env.DB, filter);
  return { rows, filter };
}

export default function Bookings({ loaderData }: Route.ComponentProps) {
  const { rows, filter } = loaderData;
  const when = filter.when ?? (filter.q || filter.day || (filter.status && filter.status !== "all") ? "all" : "upcoming");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">Bookings</h1>
      <Form method="get" className="flex flex-wrap items-end gap-3 rounded-card bg-card p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] uppercase tracking-[.06em] text-ink-mute">
          Search
          <input name="q" defaultValue={filter.q ?? ""} placeholder="Code, name, email or phone" className={cx(FIELD, "normal-case tracking-normal")} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] uppercase tracking-[.06em] text-ink-mute">
          Status
          <select name="status" defaultValue={filter.status ?? "all"} className={cx(FIELD, "normal-case tracking-normal")}>
            <option value="all">Any</option>
            {["held", "confirmed", "picked_up", "returned", "cancelled", "expired", "no_show"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] uppercase tracking-[.06em] text-ink-mute">
          Active on
          <input name="day" type="date" defaultValue={filter.day ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] uppercase tracking-[.06em] text-ink-mute">
          When
          <select name="when" defaultValue={when} className={cx(FIELD, "normal-case tracking-normal")}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className="rounded-full bg-white px-5 py-[9px] text-[14px] font-bold text-night hover:bg-ink-pale">Find</button>
      </Form>
      <BookingTable rows={rows} empty="Nothing matches." />
      {rows.length >= 200 && <p className="text-[13px] text-ink-mute">Showing the first 200. Narrow the search to see the rest.</p>}
    </div>
  );
}
