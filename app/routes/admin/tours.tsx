/**
 * The tours desk. The departures ahead, day by day: seats, the guide, and
 * the buttons the weather makes staff press. One departure at a time can be
 * opened to show everyone booked on it. The season on paper sits underneath.
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/tours";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { BookingTable, Flash, Section } from "~/components/admin";
import { Card, cx } from "~/components/ui";
import { bookingsOnDeparture, faroeDay } from "~/lib/admin/queries";
import { cancelDeparture, conflictsByDeparture, listDepartures, listGuides, listTourSchedules, setDepartureCapacity, setDepartureGuide, setDepartureOpen, type DepartureRow } from "~/lib/admin/tours";
import { TOUR_CATEGORY_LABEL } from "~/lib/tours/catalogue";
import { originOf } from "~/lib/email/send";
import { faroeParts, fmtLongDay, fmtTime, plural } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

const FIELD = "rounded-field bg-white/10 px-[11px] py-[7px] text-[13.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] focus:outline-2 focus:outline-brand-bright";
const WINDOWS = [7, 30, 90] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const url = new URL(request.url);
  const now = Date.now();
  const daysRaw = Number.parseInt(url.searchParams.get("days") ?? "", 10);
  const days = (WINDOWS as readonly number[]).includes(daysRaw) ? daysRaw : 30;
  const from = faroeDay(now).start;
  const to = from + days * 86_400_000;
  const open = url.searchParams.get("dep");
  const [departures, guides, conflicts, schedules, onOpen] = await Promise.all([
    listDepartures(env.DB, from, to),
    listGuides(env.DB),
    conflictsByDeparture(env.DB, from, to),
    listTourSchedules(env.DB, now),
    open ? bookingsOnDeparture(env.DB, open) : Promise.resolve([]),
  ]);
  return { now, days, departures, guides, conflicts, schedules, open, onOpen };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const dep = String(form.get("dep") ?? "");
  if (!dep) return { ok: false, message: "Which departure?" };
  switch (intent) {
    case "guide": {
      const guide = String(form.get("guide") ?? "") || null;
      const ok = await setDepartureGuide(env.DB, dep, guide, staff.actor);
      return { ok, message: ok ? (guide ? "Guide set." : "Guide removed.") : "That departure is gone." };
    }
    case "close":
    case "open": {
      const ok = await setDepartureOpen(env.DB, dep, intent === "open", staff.actor);
      return { ok, message: ok ? (intent === "open" ? "Open for booking again." : "Closed to new bookings. Existing ones stand.") : "Couldn't change it — reload and look again." };
    }
    case "capacity": {
      const n = Number.parseInt(String(form.get("capacity") ?? ""), 10);
      const ok = await setDepartureCapacity(env.DB, dep, n, staff.actor);
      return { ok, message: ok ? "Capacity saved." : "Capacity must be a whole number from 1 to 99 and not below the seats already taken." };
    }
    case "cancel": {
      const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || "weather";
      const r = await cancelDeparture(env, ctx, dep, staff.actor, reason, originOf(request));
      if (!r) return { ok: false, message: "Already cancelled, or gone." };
      const tail = r.failed.length ? ` ${r.failed.join(", ")} could not be cancelled — open them and do it by hand.` : "";
      return { ok: r.failed.length === 0, message: `Departure cancelled. ${plural(r.cancelled, "booking")} refunded in full and told why.${tail}` };
    }
  }
  return { ok: false, message: "Unknown action." };
}

export default function Tours({ loaderData, actionData }: Route.ComponentProps) {
  const { now, days, departures, guides, conflicts, schedules, open, onOpen } = loaderData;
  const byDay = new Map<string, DepartureRow[]>();
  for (const d of departures) {
    const key = faroeParts(d.startsAt).date;
    byDay.set(key, [...(byDay.get(key) ?? []), d]);
  }
  const live = departures.filter((d) => d.status !== "cancelled");
  const short = live.filter((d) => d.minParticipants > 0 && d.seatsTaken < d.minParticipants && d.startsAt > now && d.startsAt - now < 3 * 86_400_000);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">Tours</h1>
          <p className="text-[14.5px] text-ink-soft">
            {plural(live.length, "departure")} in the next {days} days · {live.reduce((n, d) => n + d.seatsTaken, 0)} seats sold · {live.reduce((n, d) => n + d.bikes, 0)} bikes out of the fleet for them
          </p>
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <Link key={w} to={`/admin/tours?days=${w}`} className={cx("rounded-full px-4 py-[7px] text-[14px] font-semibold", w === days ? "bg-white text-night" : "bg-white/8 text-ink-soft hover:bg-white/14")}>
              {w} days
            </Link>
          ))}
        </div>
      </div>

      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}

      {short.length > 0 && (
        <Card className="flex flex-col gap-1 bg-warn/10 px-5 py-4">
          <span className="text-[15px] font-semibold text-warn-ink">Under the minimum inside three days</span>
          <span className="text-[13.5px] text-warn-soft">
            {short.map((d) => `${d.tourTitle} ${fmtLongDay(d.startsAt)} (${d.seatsTaken} of ${d.minParticipants})`).join(" · ")}. Run it anyway, or cancel with a reason — everyone is refunded in full.
          </span>
        </Card>
      )}

      {byDay.size === 0 && <p className="text-[14.5px] text-ink-mute">Nothing scheduled in this window. Departures are generated from each tour's weekly slot, below.</p>}

      {[...byDay.entries()].map(([day, list]) => (
        <Section key={day} title={fmtLongDay(list[0]!.startsAt)} count={list.length}>
          <div className="flex flex-col gap-3">
            {list.map((d) => {
              const isOpen = open === d.id;
              const left = d.capacity - d.seatsTaken;
              const cancelled = d.status === "cancelled";
              const past = d.startsAt < now;
              const warn = conflicts[d.id] ?? [];
              return (
                <Card key={d.id} className={cx("flex flex-col gap-3 p-4", cancelled && "opacity-60")}>
                  <div className="grid gap-3 lg:grid-cols-[110px_minmax(0,1fr)_200px_auto] lg:items-center">
                    <div className="flex flex-col">
                      <span className="num text-[18px] font-bold">{fmtTime(d.startsAt)}</span>
                      <span className="num text-[12px] text-ink-mute">→ {fmtTime(d.endsAt)}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-[3px]">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link to={`/tours/${d.tourSlug}`} className="text-[16px] font-semibold hover:text-brand-bright">
                          {d.tourTitle}
                        </Link>
                        <span className="rounded-full bg-white/8 px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-ink-soft">{TOUR_CATEGORY_LABEL[d.category]}</span>
                        {d.isPrivate && <span className="rounded-full bg-brand/20 px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-brand-bright">private</span>}
                        <DepChip status={d.status} />
                      </span>
                      <span className="num text-[13px] text-ink-soft">
                        {d.seatsTaken} of {d.capacity} seats · {plural(d.bookings, "booking")}
                        {d.requiresBike && ` · ${plural(d.bikes, "bike")} from the fleet`}
                        {d.minParticipants > 0 && ` · min ${d.minParticipants}`} · {formatDKKCode(d.priceMinor)} pp
                      </span>
                      {warn.length > 0 && !cancelled && (
                        <span className="text-[13px] font-semibold text-warn">
                          {warn.map((w) => (w.reason === "same_guide" ? "Same guide on two departures at this time" : w.reason === "unstaffed" ? "Two departures at this time, not both staffed" : "MTB tour needs a certified MTB guide")).join(" · ")}
                        </span>
                      )}
                    </div>
                    <Form method="post" className="flex items-center gap-2">
                      <input type="hidden" name="intent" value="guide" />
                      <input type="hidden" name="dep" value={d.id} />
                      <select name="guide" defaultValue={d.guideId ?? ""} disabled={cancelled} aria-label="Guide" className={cx(FIELD, "min-w-0 flex-1")}>
                        <option value="">No guide yet</option>
                        {guides
                          .filter((g) => g.active || g.id === d.guideId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                              {g.mtbCertified ? " · MTB" : ""}
                            </option>
                          ))}
                      </select>
                      <button disabled={cancelled} className="rounded-full bg-white/10 px-3 py-[7px] text-[13px] font-semibold hover:bg-white/16 disabled:opacity-40">
                        Set
                      </button>
                    </Form>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link to={`/admin/tours?days=${days}&dep=${isOpen ? "" : d.id}#dep-${d.id}`} className="rounded-full bg-white/10 px-[14px] py-[7px] text-[13.5px] font-semibold hover:bg-white/16">
                        {isOpen ? "Hide riders" : `Riders (${d.bookings})`}
                      </Link>
                      {!cancelled && !past && (
                        <Form method="post">
                          <input type="hidden" name="intent" value={d.status === "open" ? "close" : "open"} />
                          <input type="hidden" name="dep" value={d.id} />
                          <button className="rounded-full bg-white/10 px-[14px] py-[7px] text-[13.5px] font-semibold hover:bg-white/16">{d.status === "open" ? "Close" : "Reopen"}</button>
                        </Form>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div id={`dep-${d.id}`} className="flex flex-col gap-3 border-t border-white/8 pt-3">
                      <BookingTable rows={onOpen} empty="Nobody on this one yet." />
                      {!cancelled && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <Form method="post" className="flex items-end gap-2">
                            <input type="hidden" name="intent" value="capacity" />
                            <input type="hidden" name="dep" value={d.id} />
                            <label className="flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                              Capacity
                              <input name="capacity" type="number" min={Math.max(1, d.seatsTaken)} max={99} defaultValue={d.capacity} className={cx(FIELD, "num w-[80px]")} />
                            </label>
                            <button className="rounded-full bg-white/10 px-[14px] py-[8px] text-[13.5px] font-semibold hover:bg-white/16">Save</button>
                            <span className="pb-2 text-[12.5px] text-ink-mute">{left > 0 ? `${left} left` : "full"}</span>
                          </Form>
                          <Form
                            method="post"
                            className="flex items-end gap-2"
                            onSubmit={(e) => {
                              if (!window.confirm(`Cancel ${d.tourTitle} on ${fmtLongDay(d.startsAt)}? ${plural(d.bookings, "booking")} will be cancelled, refunded in full and emailed.`)) e.preventDefault();
                            }}
                          >
                            <input type="hidden" name="intent" value="cancel" />
                            <input type="hidden" name="dep" value={d.id} />
                            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                              Reason — goes in the email
                              <input name="reason" placeholder="Gale warning for Saturday" className={cx(FIELD, "normal-case tracking-normal")} />
                            </label>
                            <button className="whitespace-nowrap rounded-full bg-danger/14 px-[14px] py-[8px] text-[13.5px] font-semibold text-danger hover:bg-danger/22">Cancel departure — refund all</button>
                          </Form>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Section>
      ))}

      <Section title="The season on paper" count={schedules.length}>
        <div className="overflow-x-auto rounded-card bg-card">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                <th className="px-4 py-3 font-semibold">Tour</th>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Runs</th>
                <th className="px-3 py-3 font-semibold">Season</th>
                <th className="px-3 py-3 text-right font-semibold">Seats</th>
                <th className="px-3 py-3 text-right font-semibold">Price</th>
                <th className="px-3 py-3 text-right font-semibold">Ahead</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.tourId} className={cx("border-t border-white/6", !s.published && "opacity-60")}>
                  <td className="px-4 py-2 font-semibold">
                    <Link to={`/admin/tours/${s.tourId}`} className="hover:text-brand-bright">
                      {s.title}
                    </Link>
                    {!s.published && <span className="ml-2 text-[11px] font-bold uppercase text-ink-mute">unpublished</span>}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{TOUR_CATEGORY_LABEL[s.category]}</td>
                  <td className="num px-3 py-2 text-ink-soft">{s.startTime ? `${s.weekdays} · ${s.startTime}` : "no weekly slot"}</td>
                  <td className="num px-3 py-2 text-ink-soft">{s.seasonStart ? `${s.seasonStart} → ${s.seasonEnd}` : "—"}</td>
                  <td className="num px-3 py-2 text-right text-ink-soft">{s.capacity ?? "—"}</td>
                  <td className="num px-3 py-2 text-right text-ink-soft">{s.priceMinor != null ? formatDKKCode(s.priceMinor) : "—"}</td>
                  <td className="num px-3 py-2 text-right">{s.ahead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-ink-mute">Departures roll forward from these slots automatically, a year ahead. Open a tour to change its slot, season, seats or price, or to publish it.</p>
      </Section>
    </div>
  );
}

function DepChip({ status }: { status: string }) {
  const tone = status === "open" ? "bg-ok/16 text-ok" : status === "closed" ? "bg-warn/16 text-warn" : status === "cancelled" ? "bg-danger/14 text-danger" : "bg-white/8 text-ink-soft";
  return <span className={cx("rounded-full px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em]", tone)}>{status}</span>;
}
