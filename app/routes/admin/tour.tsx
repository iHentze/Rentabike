/**
 * One tour: whether it is on the site, and its weekly slot — the season,
 * the weekdays, the time, seats, price, minimum and cutoff. Departures grow
 * from the slot on their own; ones already booked never change.
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/tour";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { Flash } from "~/components/admin";
import { Card, cx } from "~/components/ui";
import { getTourAdmin, saveSchedule, setTourPublished } from "~/lib/admin/catalogue";
import { WEEKDAY_BITS } from "~/lib/tours/departures";
import { TOUR_CATEGORY_LABEL } from "~/lib/tours/catalogue";
import type { TourCategory } from "~/db/schema";
import { fmtDuration } from "~/lib/format";
import { plural } from "~/lib/format";

const FIELD = "w-full rounded-field bg-white/10 px-[13px] py-[9px] text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";
const LABEL = "flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const tour = await getTourAdmin(env.DB, params.id);
  if (!tour) throw new Response("Not found", { status: 404 });
  return { tour };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "publish" || intent === "unpublish") {
    const err = await setTourPublished(env.DB, params.id, intent === "publish", staff.actor);
    return { ok: !err, message: err ?? (intent === "publish" ? "On the site. Departures for the season are being generated." : "Taken off the site. Existing bookings stand.") };
  }
  if (intent === "schedule") {
    const num = (k: string) => Number.parseInt(String(form.get(k) ?? "").trim() || "NaN", 10);
    let mask = 0;
    for (const v of form.getAll("wd")) {
      const i = Number.parseInt(String(v), 10);
      if (i >= 0 && i < 7) mask |= WEEKDAY_BITS[i]!;
    }
    const priv = String(form.get("privatePrice") ?? "").trim();
    const err = await saveSchedule(
      env.DB,
      params.id,
      {
        seasonStart: String(form.get("seasonStart") ?? ""),
        seasonEnd: String(form.get("seasonEnd") ?? ""),
        weekdayMask: mask,
        startTime: String(form.get("startTime") ?? "").trim(),
        capacity: num("capacity"),
        priceMinor: num("price") * 100,
        privatePriceMinor: priv === "" ? null : Number.parseInt(priv, 10) * 100,
        minParticipants: num("min"),
        bookingCutoffHours: num("cutoff"),
        applyAhead: form.get("applyAhead") === "on",
      },
      staff.actor,
    );
    return { ok: !err, message: err ?? "Slot saved. Departures ahead are growing from it." };
  }
  return { ok: false, message: "Unknown action." };
}

export default function Tour({ loaderData, actionData }: Route.ComponentProps) {
  const { tour } = loaderData;
  const s = tour.schedule;
  const errors = tour.problems.filter((p) => p.severity === "error");
  const warnings = tour.problems.filter((p) => p.severity === "warning");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/admin/tours" className="text-[14px] font-semibold text-brand-bright hover:text-ink">
          ← Tours
        </Link>
        <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">{tour.title}</h1>
        <span className="rounded-full bg-white/8 px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-ink-soft">{TOUR_CATEGORY_LABEL[tour.category as TourCategory] ?? tour.category}</span>
        <span className={cx("rounded-full px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em]", tour.published ? "bg-ok/16 text-ok" : "bg-warn/16 text-warn")}>{tour.published ? "on the site" : "not on the site"}</span>
        <Link to={`/tours/${tour.slug}`} className="text-[13.5px] text-ink-mute hover:text-ink">
          See it on the site ›
        </Link>
      </div>
      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <Form method="post">
          <Card className="flex flex-col gap-4 p-5">
            <input type="hidden" name="intent" value="schedule" />
            <div className="flex flex-col gap-1">
              <h2 className="text-[16px] font-semibold">The weekly slot</h2>
              <p className="text-[13.5px] text-ink-soft">
                {fmtDuration(tour.durationMin)} long{tour.requiresBike ? ", bike included" : ", on foot"}. Departures are generated from this slot a year ahead; {plural(tour.ahead, "departure")} ahead now, {tour.aheadBooked} with bookings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>
                Season from
                <input name="seasonStart" type="date" required defaultValue={s?.seasonStart ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <label className={LABEL}>
                Season to
                <input name="seasonEnd" type="date" required defaultValue={s?.seasonEnd ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <fieldset className="flex flex-col gap-2 sm:col-span-2">
                <legend className="mb-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">Runs on</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {WEEKDAYS.map((w, i) => (
                    <label key={w} className="flex items-center gap-2 text-[14px]">
                      <input type="checkbox" name="wd" value={i} defaultChecked={s ? (s.weekdayMask & WEEKDAY_BITS[i]!) !== 0 : false} className="size-4 accent-brand" />
                      {w}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={LABEL}>
                Leaves at
                <input name="startTime" required pattern="[0-2][0-9]:[0-5][0-9]" placeholder="10:15" defaultValue={s?.startTime ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <label className={LABEL}>
                Seats
                <input name="capacity" type="number" min={1} max={99} required defaultValue={s?.capacity ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <label className={LABEL}>
                Price per person, DKK
                <input name="price" type="number" min={0} required defaultValue={s ? Math.round(s.priceMinor / 100) : ""} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <label className={LABEL}>
                Private, per person, DKK <span className="normal-case tracking-normal text-ink-dim">(blank = not offered)</span>
                <input name="privatePrice" type="number" min={0} defaultValue={s?.privatePriceMinor != null ? Math.round(s.privatePriceMinor / 100) : ""} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <label className={LABEL}>
                Minimum to run
                <input name="min" type="number" min={0} max={99} required defaultValue={s?.minParticipants ?? 0} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
              <label className={LABEL}>
                Booking closes, hours before
                <input name="cutoff" type="number" min={0} max={168} required defaultValue={s?.bookingCutoffHours ?? 12} className={cx(FIELD, "num normal-case tracking-normal")} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-[14px]">
              <input type="checkbox" name="applyAhead" className="mt-[3px] size-4 accent-brand" />
              <span>
                Also apply the seats and price to departures ahead that nobody has booked yet. <span className="text-ink-mute">Booked ones keep their price — a sold seat is a promise.</span>
              </span>
            </label>
            <div className="flex justify-end">
              <button className="rounded-full bg-white px-5 py-[9px] text-[14px] font-bold text-night hover:bg-ink-pale">Save slot</button>
            </div>
          </Card>
        </Form>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-[16px] font-semibold">On the site</h2>
            {errors.length > 0 && (
              <ul className="flex flex-col gap-1 text-[13.5px] text-danger">
                {errors.map((p) => (
                  <li key={p.code}>· {p.message}</li>
                ))}
              </ul>
            )}
            {warnings.length > 0 && (
              <ul className="flex flex-col gap-1 text-[13.5px] text-warn-soft">
                {warnings.map((p) => (
                  <li key={p.code}>· {p.message}</li>
                ))}
              </ul>
            )}
            {errors.length === 0 && warnings.length === 0 && <span className="text-[13.5px] text-ok">Everything a published tour needs is in place.</span>}
            <Form method="post">
              <input type="hidden" name="intent" value={tour.published ? "unpublish" : "publish"} />
              <button disabled={!tour.published && errors.length > 0} className={cx("w-full rounded-full px-4 py-[10px] text-[14px] font-bold", tour.published ? "bg-white/10 text-ink hover:bg-white/16" : "bg-white text-night hover:bg-ink-pale disabled:cursor-not-allowed disabled:opacity-40")}>
                {tour.published ? "Take off the site" : "Publish"}
              </button>
            </Form>
            <span className="text-[12.5px] text-ink-mute">Taking a tour off the site stops new bookings. Departures with bookings keep running; cancel them on the tours desk if they should not.</span>
          </Card>
          <Card className="flex flex-col gap-2 p-4 text-[13.5px] text-ink-soft">
            <span className="lbl">The words</span>
            <p>{tour.summary}</p>
            <span className="text-[12.5px] text-ink-dim">Titles, descriptions, legs and inclusions are still edited in the catalogue file; ask for that screen when the copy settles.</span>
          </Card>
        </div>
      </div>
    </div>
  );
}
