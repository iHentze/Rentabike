/**
 * A booking taken at the counter — a walk-in, or a phone call. The same
 * price engine and the same availability guard as the public site; the only
 * differences are who types (staff), that the booking is confirmed at once,
 * and that the money can be taken in cash or on the terminal on the spot.
 *
 * Two buttons: "Price it" shows the quote without booking anything, so the
 * customer can hear the number first; "Book" holds the bikes and confirms.
 * Everything is a plain form — the counter's tablet has no need of scripts.
 */
import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/new";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { Flash } from "~/components/admin";
import { Card, cx } from "~/components/ui";
import { HELMET_ID } from "~/components/addons-panel";
import { MAX_RIDERS, OPENING_TIMES, readTrip, tripDays, type Trip } from "~/lib/trip";
import { faroeParts, fmtDayTime, fmtDays } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";
import { CATEGORY_LABEL, CATEGORY_ORDER, fitsRider, getAddonsById, listBikes, type CatalogueBike } from "~/lib/catalogue/bikes";
import { listLocations } from "~/lib/booking/lookup";
import { priceBasket } from "~/lib/quote-basket";
import { reserveBooking } from "~/lib/booking/reserve";
import { transition } from "~/lib/booking/lifecycle";
import { originOf, sendConfirmation } from "~/lib/email/send";
import type { Basket } from "~/lib/basket";

const FIELD = "w-full rounded-field bg-white/10 px-[13px] py-[9px] text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";
const LABEL = "flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute";
const QTY = "w-[72px] shrink-0 rounded-field bg-white/10 px-[13px] py-[9px] text-right text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] focus:outline-2 focus:outline-brand-bright";

type Pay = "shop" | "cash" | "card";

/** What the form said, echoed back so nothing is retyped after "Price it" or a sold-out bike. */
interface Draft {
  name: string;
  email: string;
  phone: string;
  riders: Array<{ name: string; heightCm: number | null; bikeTypeId: string; helmet: boolean }>;
  extras: Record<string, number>;
  pickup: string;
  dropoff: string;
  notes: string;
  pay: Pay;
}

function emptyDraft(riders: number, pickup: string): Draft {
  return { name: "", email: "", phone: "", riders: Array.from({ length: riders }, () => ({ name: "", heightCm: null, bikeTypeId: "", helmet: false })), extras: {}, pickup, dropoff: pickup, notes: "", pay: "shop" };
}

function readDraft(form: FormData, riders: number, pickup: string): Draft {
  const d = emptyDraft(riders, pickup);
  d.name = String(form.get("name") ?? "").trim().slice(0, 80);
  d.email = String(form.get("email") ?? "").trim().slice(0, 120);
  d.phone = String(form.get("phone") ?? "").trim().slice(0, 40);
  d.riders = d.riders.map((_, i) => {
    const h = Number.parseInt(String(form.get(`r${i}.height`) ?? ""), 10);
    return {
      name: String(form.get(`r${i}.name`) ?? "").trim().slice(0, 60),
      heightCm: Number.isFinite(h) && h >= 80 && h <= 230 ? h : null,
      bikeTypeId: String(form.get(`r${i}.bike`) ?? ""),
      helmet: form.get(`r${i}.helmet`) === "on",
    };
  });
  for (const [k, v] of form.entries()) {
    if (k.startsWith("x.")) {
      const n = Number.parseInt(String(v), 10);
      if (Number.isInteger(n) && n > 0) d.extras[k.slice(2)] = Math.min(20, n);
    }
  }
  d.pickup = String(form.get("pickup") ?? "") || pickup;
  d.dropoff = String(form.get("dropoff") ?? "") || d.pickup;
  d.notes = String(form.get("notes") ?? "").trim().slice(0, 500);
  const pay = String(form.get("pay") ?? "shop");
  d.pay = pay === "cash" || pay === "card" ? pay : "shop";
  return d;
}

function basketFrom(d: Draft): Basket {
  return {
    riders: d.riders.map((r) => ({ name: r.name || undefined, heightCm: r.heightCm ?? undefined, bikeTypeId: r.bikeTypeId || undefined, addons: (r.helmet ? { [HELMET_ID]: 1 } : {}) as Record<string, number> })),
    extras: d.extras,
    addons: {},
    pickupLocationId: d.pickup,
    dropoffLocationId: d.dropoff,
  };
}

/** The counter's default trip: today from the next half hour the shop is open, back tomorrow at five. */
function counterTrip(params: URLSearchParams, now: number): Trip {
  if (params.has("from")) return readTrip(params, now);
  const p = faroeParts(now);
  const next = OPENING_TIMES.find((t) => t > p.time) ?? OPENING_TIMES[OPENING_TIMES.length - 1]!;
  const q = new URLSearchParams(params);
  q.set("from", p.date);
  q.set("fromTime", next);
  return readTrip(q, now);
}

async function load(env: { DB: D1Database }, request: Request) {
  const url = new URL(request.url);
  const trip = counterTrip(url.searchParams, Date.now());
  const [bikes, locations, addons] = await Promise.all([listBikes(env.DB, trip), listLocations(env.DB), getAddonsById(env.DB, [HELMET_ID])]);
  const shop = locations.find((l) => l.isDefault) ?? locations[0];
  return { url, trip, bikes, locations, helmet: addons.get(HELMET_ID) ?? null, shop };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const { trip, bikes, locations, helmet, shop } = await load(env, request);
  return view(trip, bikes, locations, helmet, emptyDraft(trip.riders, shop?.id ?? ""), null, null);
}

function view(trip: Trip, bikes: CatalogueBike[], locations: Awaited<ReturnType<typeof listLocations>>, helmet: { priceMinor: number } | null, draft: Draft, quote: { lines: Array<{ label: string; qty: number; totalMinor: number }>; totalMinor: number } | null, flash: { ok: boolean; message: string } | null) {
  const s = faroeParts(trip.startAt);
  const e = faroeParts(trip.endAt);
  return {
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, from: s.date, fromTime: s.time, to: e.date, toTime: e.time },
    days: tripDays(trip),
    bikes: bikes
      .filter((b) => b.category !== "extra")
      .map((b) => ({ id: b.id, name: b.name, category: b.category, sizeLabel: b.sizeLabel, riderMinCm: b.riderMinCm, riderMaxCm: b.riderMaxCm, free: b.free, rateMinor: b.rateMinor, perDay: b.perDay, helmet: b.addonIds.includes(HELMET_ID) })),
    extras: bikes.filter((b) => b.category === "extra").map((b) => ({ id: b.id, name: b.name, free: b.free, rateMinor: b.rateMinor, perDay: b.perDay })),
    locations: locations.map((l) => ({ id: l.id, name: l.name, pickupFeeMinor: l.pickupFeeMinor, dropoffFeeMinor: l.dropoffFeeMinor })),
    helmetMinor: helmet?.priceMinor ?? null,
    draft,
    quote,
    flash,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const { trip, bikes, locations, helmet, shop } = await load(env, request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "quote");
  const draft = readDraft(form, trip.riders, shop?.id ?? "");
  const fail = (message: string, quote: ReturnType<typeof view>["quote"] = null) => view(trip, bikes, locations, helmet, draft, quote, { ok: false, message });

  // Every rider needs a bike; the guard below decides whether it is still free.
  const missing = draft.riders.map((r, i) => (r.bikeTypeId ? null : i + 1)).filter((n): n is number => n !== null);
  if (missing.length) return fail(`Pick a bike for rider ${missing.join(", ")}.`);
  const basket = basketFrom(draft);
  const priced = await priceBasket(env.DB, trip, basket);
  if (!priced.quote) return fail("Something in there can't be priced on these dates — check the bikes and the extras.");
  const quote = { lines: priced.quote.lines.map((l) => ({ label: l.label, qty: l.qty, totalMinor: l.lineTotalMinor })), totalMinor: priced.quote.totalMinor };
  if (intent !== "book") return view(trip, bikes, locations, helmet, draft, quote, null);

  if (draft.name.length < 2) return fail("A name for the booking, please.", quote);
  if (draft.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) return fail("That email doesn't look right — leave it blank if they have none.", quote);

  const now = Date.now();
  const result = await reserveBooking(env.DB, {
    quote: priced.quote,
    kind: "rental",
    startAt: trip.startAt,
    endAt: trip.endAt,
    customerName: draft.name,
    customerEmail: draft.email,
    customerPhone: draft.phone || undefined,
    pickupLocationId: draft.pickup || undefined,
    dropoffLocationId: draft.dropoff || undefined,
    channel: "counter",
    notes: draft.notes || undefined,
    now,
  });
  if (!result.ok) return fail(`Gone while you typed: ${result.unavailable.join(", ")}. Pick another.`, quote);

  // Confirmed at once — the customer is standing here, or on the phone.
  await transition(env.DB, { bookingId: result.bookingId, from: "held", to: "confirmed", actor: staff.actor, note: draft.pay === "shop" ? "booked at the counter, pays on collection" : `booked at the counter, paid by ${draft.pay}`, now });
  if (draft.pay !== "shop" && result.totalMinor > 0) {
    // Money taken on the spot: a captured payment row of its own, and the booking's paid total.
    await env.DB.batch([
      env.DB
        .prepare(`INSERT INTO payments (id, booking_id, provider, status, amount_minor, captured_minor, currency, created_at, updated_at) VALUES (?1, ?2, ?3, 'captured', ?4, ?4, 'DKK', ?5, ?5)`)
        .bind(crypto.randomUUID(), result.bookingId, draft.pay === "cash" ? "cash" : "terminal", result.totalMinor, now),
      env.DB.prepare(`UPDATE bookings SET paid_minor = ?2, updated_at = ?3 WHERE id = ?1`).bind(result.bookingId, result.totalMinor, now),
      env.DB
        .prepare(`INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at) VALUES (?1,'payment',?2,NULL,'captured',?3,?4,?5)`)
        .bind(crypto.randomUUID(), result.bookingId, staff.actor, `${formatDKKCode(result.totalMinor)} taken at the counter by ${draft.pay}`, now),
    ]);
  }
  if (draft.email) ctx.waitUntil(sendConfirmation(env, result.bookingId, originOf(request)));
  return redirect(`/admin/bookings/${result.bookingId}?new=${result.code}`);
}

export default function NewBooking({ loaderData, actionData }: Route.ComponentProps) {
  const data = actionData ?? loaderData;
  const { trip, days, bikes, extras, locations, helmetMinor, draft, quote, flash } = data;
  const here = `/admin/new?${new URLSearchParams({ from: trip.from, fromTime: trip.fromTime, to: trip.to, toTime: trip.toTime, riders: String(trip.riders) })}`;
  const byCat = CATEGORY_ORDER.filter((c) => c !== "extra").map((c) => ({ c, list: bikes.filter((b) => b.category === c) }));
  const total = quote?.totalMinor ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">New booking</h1>
          <p className="text-[14.5px] text-ink-soft">A walk-in or a phone call. Same prices and the same availability as the site; confirmed the moment you book it.</p>
        </div>
        <Link to="/admin" className="text-[14px] font-semibold text-brand-bright hover:text-ink">
          ← Today
        </Link>
      </div>

      {/* 1. when, and how many — a GET, so the bike list below is for those dates */}
      <Form method="get" action="/admin/new" className="flex flex-wrap items-end gap-3 rounded-card bg-card p-4">
        <label className={LABEL}>
          From
          <input name="from" type="date" defaultValue={trip.from} className={cx(FIELD, "num normal-case tracking-normal")} />
        </label>
        <label className={LABEL}>
          At
          <TimeSelect name="fromTime" value={trip.fromTime} />
        </label>
        <label className={LABEL}>
          Until
          <input name="to" type="date" defaultValue={trip.to} className={cx(FIELD, "num normal-case tracking-normal")} />
        </label>
        <label className={LABEL}>
          At
          <TimeSelect name="toTime" value={trip.toTime} />
        </label>
        <label className={LABEL}>
          Riders
          <select name="riders" defaultValue={String(trip.riders)} className={cx(FIELD, "num normal-case tracking-normal")}>
            {Array.from({ length: MAX_RIDERS }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-full bg-white/10 px-5 py-[9px] text-[14px] font-semibold hover:bg-white/16">Show bikes for these dates</button>
        <span className="num text-[13.5px] text-ink-mute">
          {fmtDayTime(trip.startAt)} → {fmtDayTime(trip.endAt)} · {fmtDays(days)}
        </span>
      </Form>

      {flash && <Flash ok={flash.ok}>{flash.message}</Flash>}

      <Form method="post" action={here} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* 2. who is booking */}
          <Card className="grid gap-3 p-4 sm:grid-cols-3">
            <label className={cx(LABEL, "sm:col-span-1")}>
              Name
              <input name="name" required defaultValue={draft.name} placeholder="Who is booking" className={cx(FIELD, "normal-case tracking-normal")} />
            </label>
            <label className={LABEL}>
              Phone
              <input name="phone" type="tel" defaultValue={draft.phone} placeholder="+298" className={cx(FIELD, "num normal-case tracking-normal")} />
            </label>
            <label className={LABEL}>
              Email <span className="normal-case tracking-normal text-ink-dim">(optional — sends the confirmation)</span>
              <input name="email" type="email" defaultValue={draft.email} placeholder="none is fine" className={cx(FIELD, "normal-case tracking-normal")} />
            </label>
          </Card>

          {/* 3. each rider: height, bike, helmet */}
          {draft.riders.map((r, i) => {
            const fitting = r.heightCm ? bikes.filter((b) => fitsRider(b, r.heightCm)).length : bikes.length;
            return (
              <Card key={i} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[16px] font-semibold">Rider {i + 1}</h2>
                  <span className="num text-[12.5px] text-ink-mute">{r.heightCm ? `${fitting} frames fit ${r.heightCm} cm` : "Height narrows the list once you price it"}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_120px_2fr_auto] sm:items-end">
                  <label className={LABEL}>
                    Name <span className="normal-case tracking-normal text-ink-dim">(optional)</span>
                    <input name={`r${i}.name`} defaultValue={r.name} placeholder={`Rider ${i + 1}`} className={cx(FIELD, "normal-case tracking-normal")} />
                  </label>
                  <label className={LABEL}>
                    Height cm
                    <input name={`r${i}.height`} type="number" min={80} max={230} defaultValue={r.heightCm ?? ""} placeholder="175" className={cx(FIELD, "num normal-case tracking-normal")} />
                  </label>
                  <label className={LABEL}>
                    Bike
                    <select name={`r${i}.bike`} required defaultValue={r.bikeTypeId} className={cx(FIELD, "normal-case tracking-normal")}>
                      <option value="">Choose a bike…</option>
                      {byCat.map(({ c, list }) => (
                        <optgroup key={c} label={CATEGORY_LABEL[c]}>
                          {list.map((b) => {
                            const fits = fitsRider(b, r.heightCm);
                            const gone = b.free <= 0 && b.id !== r.bikeTypeId;
                            return (
                              <option key={b.id} value={b.id} disabled={gone}>
                                {b.name}
                                {b.riderMinCm && b.riderMaxCm ? ` · ${b.riderMinCm}–${b.riderMaxCm} cm` : ""}
                                {` · ${formatDKKCode(b.rateMinor)}${b.perDay ? "/day" : ""}`}
                                {gone ? " · none free" : ` · ${b.free} free`}
                                {r.heightCm && !fits ? " · wrong size" : ""}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pb-[9px] text-[14px]">
                    <input type="checkbox" name={`r${i}.helmet`} defaultChecked={r.helmet} className="size-4 accent-brand" />
                    Helmet{helmetMinor != null && <span className="num text-ink-mute">· {formatDKKCode(helmetMinor)}</span>}
                  </label>
                </div>
              </Card>
            );
          })}

          {/* 4. extras for the booking, and where */}
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-[16px] font-semibold">Extras</h2>
              {extras.length === 0 && <span className="text-[13.5px] text-ink-mute">Nothing extra on these dates.</span>}
              {extras.map((x) => (
                <label key={x.id} className="flex items-center gap-3 text-[14px]">
                  <span className="flex min-w-0 flex-1 flex-col gap-[1px]">
                    <span className="truncate">{x.name}</span>
                    <span className="num text-[12.5px] text-ink-mute">
                      {formatDKKCode(x.rateMinor)}
                      {x.perDay ? "/day" : ""} · {x.free} free
                    </span>
                  </span>
                  <input name={`x.${x.id}`} type="number" min={0} max={Math.max(0, x.free)} defaultValue={draft.extras[x.id] ?? 0} className={cx(QTY, "num")} />
                </label>
              ))}
            </Card>
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-[16px] font-semibold">Where</h2>
              <label className={LABEL}>
                Pick up
                <select name="pickup" defaultValue={draft.pickup} className={cx(FIELD, "normal-case tracking-normal")}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.pickupFeeMinor > 0 ? ` · +${formatDKKCode(l.pickupFeeMinor)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                Return to
                <select name="dropoff" defaultValue={draft.dropoff} className={cx(FIELD, "normal-case tracking-normal")}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.dropoffFeeMinor > 0 ? ` · +${formatDKKCode(l.dropoffFeeMinor)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                Notes <span className="normal-case tracking-normal text-ink-dim">(on the confirmation)</span>
                <textarea name="notes" rows={2} defaultValue={draft.notes} placeholder="Clip-in pedals, a child seat, arriving by ferry…" className={cx(FIELD, "normal-case tracking-normal")} />
              </label>
            </Card>
          </div>
        </div>

        {/* the money, and the two buttons */}
        <Card className="flex flex-col gap-4 p-4 lg:sticky lg:top-4">
          <h2 className="text-[16px] font-semibold">The price</h2>
          {quote ? (
            <div className="flex flex-col gap-[6px] text-[14px]">
              {quote.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 text-ink-soft">
                    {l.qty > 1 ? `${l.qty} × ` : ""}
                    {l.label}
                  </span>
                  <span className="num shrink-0">{formatDKKCode(l.totalMinor)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-white/8 pt-2 text-[17px] font-bold">
                <span>Total</span>
                <span className="num">{formatDKKCode(total ?? 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-[13.5px] text-ink-mute">Pick the bikes and press "Price it". Nothing is held until you book.</p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">Payment</legend>
            {(
              [
                ["shop", "Pays when collecting"],
                ["cash", "Paid now — cash"],
                ["card", "Paid now — card on the terminal"],
              ] as Array<[Pay, string]>
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-[14px]">
                <input type="radio" name="pay" value={v} defaultChecked={draft.pay === v} className="accent-brand" />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <button name="intent" value="quote" className="rounded-full bg-white/10 px-5 py-[11px] text-[14.5px] font-semibold hover:bg-white/16">
              Price it
            </button>
            <button name="intent" value="book" className="rounded-full bg-white px-5 py-[11px] text-[15px] font-bold text-night hover:bg-ink-pale">
              {total != null ? `Book — ${formatDKKCode(total)}` : "Book"}
            </button>
            <span className="text-[12.5px] leading-[1.5] text-ink-mute">Booking holds the bikes and confirms at once. The confirmation email goes out only if there is an email.</span>
          </div>
        </Card>
      </Form>
    </div>
  );
}

function TimeSelect({ name, value }: { name: string; value: string }) {
  return (
    <select name={name} defaultValue={value} className={cx(FIELD, "num normal-case tracking-normal")}>
      {OPENING_TIMES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
