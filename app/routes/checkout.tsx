import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/checkout";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell, Steps } from "~/components/site";
import { Card, Lbl, Note, PillLink, cx } from "~/components/ui";
import { BikeImage } from "~/components/bike-card";
import { SummaryRail } from "~/components/summary-rail";
import { FunnelSteps } from "~/components/funnel-steps";
import { CardIcon, Calendar, Check, ChevronDown, Info, Lock, Phone, Pin, Shield, Warning } from "~/components/icons";
import { tripDays, tripHref } from "~/lib/trip";
import { resolveTrip } from "~/lib/tour-trip";
import { basketHeaders, clearBasketHeaders, nextStep, ownBikeOnly, readBasket, riderLabel, ridersOn, type Basket } from "~/lib/basket";
import { fitsRider, getAddonsById, getBikesById, listBikes } from "~/lib/catalogue/bikes";
import { AddonsPanel, HELMET_ID } from "~/components/addons-panel";
import { priceBasket } from "~/lib/quote-basket";
import { listLocations } from "~/lib/booking/lookup";
import { reserveBooking } from "~/lib/booking/reserve";
import { transition } from "~/lib/booking/lifecycle";
import { freeCancellationDeadline } from "~/lib/booking/cancellation";
import { fmtDay, fmtDayTime, fmtLongDay, fmtTime, plural } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Checkout — Rent a Bike & Outdoor" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip, tour } = await resolveTrip(env.DB, url.searchParams);
  const basket = await readBasket(request, trip);
  const [bikes, locations] = await Promise.all([listBikes(env.DB, trip), listLocations(env.DB)]);
  const shop = locations.find((l) => l.isDefault) ?? locations[0];
  if (!basket.pickupLocationId && shop) basket.pickupLocationId = shop.id;
  if (!basket.dropoffLocationId) basket.dropoffLocationId = basket.pickupLocationId;
  if (tour && shop) {
    // Tours leave from and return to the shop; no location fees apply.
    basket.pickupLocationId = shop.id;
    basket.dropoffLocationId = shop.id;
  }
  const priced = await priceBasket(env.DB, trip, basket, tour);

  // Each rider's own extras were settled on their step. Here only what belongs to the whole
  // booking is still open — unless the customer brought their own bike, in which case the
  // helmets and bags they rent have no rider step to live on and are picked here.
  const ownBike = !tour && ownBikeOnly(basket);
  const chosenBikeRows = basket.riders.map((r) => (r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) : undefined)).filter((b) => b !== undefined);
  const addonIds = new Set<string>(ownBike ? [HELMET_ID, ...bikes.flatMap((b) => b.addonIds)] : [...chosenBikeRows.flatMap((b) => b.addonIds), ...Object.keys(basket.addons)]);
  if (tour) addonIds.delete(HELMET_ID);
  const addons = [...(await getAddonsById(env.DB, [...addonIds])).values()]
    .filter((a) => ownBike || a.unit === "per_booking" || basket.addons[a.id])
    .sort((a, b) => (a.id === HELMET_ID ? -1 : b.id === HELMET_ID ? 1 : a.priceMinor - b.priceMinor || a.name.localeCompare(b.name)))
    .map((a) => ({ id: a.id, name: a.name, priceMinor: a.priceMinor, unit: a.unit, isSale: a.isSale, image: a.image, qty: basket.addons[a.id] ?? 0 }));
  const helmetMissing = tour || ownBike ? [] : basket.riders.map((r, i) => ({ r, i })).filter(({ r }) => r.bikeTypeId && !(r.addons[HELMET_ID] ?? 0)).map(({ i }) => ({ r: i, label: riderLabel(basket, i) }));
  const unfinished = nextStep(basket);

  // The recovery panel: a bike went between choosing and paying.
  const lostId = url.searchParams.get("lost");
  const lost = lostId ? bikes.find((b) => b.id === lostId) ?? null : null;
  const lostRider = lostId ? Number.parseInt(url.searchParams.get("for") ?? "", 10) : NaN;
  const riderHeight = Number.isFinite(lostRider) ? basket.riders[lostRider]?.heightCm : undefined;
  const alternatives = lost
    ? bikes
        .filter((b) => b.id !== lost.id && b.category !== "extra" && b.free - ridersOn(basket, b.id) > 0 && fitsRider(b, riderHeight))
        .sort((a, b) => Math.abs(a.rateMinor - lost.rateMinor) - Math.abs(b.rateMinor - lost.rateMinor) || Number(a.category !== lost.category) - Number(b.category !== lost.category))
        .slice(0, 2)
        .map((b) => ({ id: b.id, name: b.name, category: b.category, image: b.image, sizeLabel: b.sizeLabel, rateMinor: b.rateMinor, perDay: b.perDay, tripMinor: b.tripMinor, deltaMinor: b.tripMinor - lost.tripMinor, free: b.free }))
    : [];

  return {
    tour: tour ? { title: tour.title, slug: tour.slug, requiresBike: tour.requiresBike, priceMinor: tour.priceMinor, seatsLeft: tour.seatsLeft, bookable: tour.bookable } : null,
    seatLine: priced.quote?.lines.find((l) => l.kind === "tour_seat") ?? null,
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, tourDepartureId: trip.tourDepartureId },
    days: tripDays(trip),
    deadline: freeCancellationDeadline(trip.startAt).getTime(),
    locations: locations.map((l) => ({ id: l.id, name: l.name, dropoffFeeMinor: l.dropoffFeeMinor, pickupFeeMinor: l.pickupFeeMinor, note: l.note })),
    pickupId: basket.pickupLocationId ?? null,
    dropoffId: basket.dropoffLocationId ?? null,
    autoSwap: basket.autoSwap ?? false,
    riders: basket.riders.map((r, i) => {
      const bike = r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) : undefined;
      return {
        label: riderLabel(basket, i),
        heightCm: r.heightCm ?? null,
        bikeName: bike?.name ?? null,
        size: bike?.sizeLabel ?? null,
        range: bike && bike.riderMinCm != null ? `rider ${bike.riderMinCm}–${bike.riderMaxCm} cm` : null,
        rateMinor: bike?.rateMinor ?? null,
        perDay: bike?.perDay ?? true,
        totalMinor: priced.riderTotals[i] ?? null,
        lost: Boolean(lost) && i === lostRider,
        extras: priced.riderExtras[i]!.map((l) => ({ label: `${l.label.replace(/\s+for rent\b.*$/i, "")}${l.qty > 1 ? ` ×${l.qty}` : ""}`, totalMinor: l.totalMinor, included: Boolean(tour) && l.addonId === HELMET_ID })),
        extrasDone: Boolean(r.extrasDone),
      };
    }),
    extras: Object.entries(basket.extras).map(([id, qty]) => ({ label: `${bikes.find((b) => b.id === id)?.name ?? id} ×${qty}`, totalMinor: (bikes.find((b) => b.id === id)?.tripMinor ?? 0) * qty })),
    addonLines: priced.bookingAddonLines.map((l) => ({ label: `${l.label}${l.qty > 1 ? ` ×${l.qty}` : ""}`, totalMinor: l.totalMinor })),
    helmetMissing,
    unfinished,
    fees: priced.quote?.lines.filter((l) => l.kind === "fee").map((l) => ({ label: l.label, totalMinor: l.lineTotalMinor })) ?? [],
    totalMinor: priced.quote?.totalMinor ?? 0,
    addons,
    ownBike,
    ready: basket.riders.length > 0 && (tour && !tour.requiresBike ? tour.bookable && trip.riders <= tour.seatsLeft : ownBike || basket.riders.every((r) => r.bikeTypeId)) && priced.quote !== null && (!tour || (tour.bookable && trip.riders <= tour.seatsLeft)),
    lost: lost ? { id: lost.id, name: lost.name, rider: Number.isFinite(lostRider) ? lostRider : null, riderLabel: Number.isFinite(lostRider) ? riderLabel(basket, lostRider) : null, tripMinor: lost.tripMinor } : null,
    alternatives,
    error: url.searchParams.get("error"),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip, tour } = await resolveTrip(env.DB, url.searchParams);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "book");
  const basket = await readBasket(request, trip);
  const back = (extra: Record<string, string | number | undefined> = {}) => tripHref("/checkout", trip, extra);

  if (intent === "addon") {
    const id = String(form.get("addon") ?? "");
    const delta = Number.parseInt(String(form.get("delta") ?? "0"), 10);
    const n = (basket.addons[id] ?? 0) + (Number.isFinite(delta) ? delta : 0);
    if (n <= 0) delete basket.addons[id];
    else basket.addons[id] = Math.min(20, n);
    return redirect(back(), { headers: await basketHeaders(basket) });
  }
  if (intent === "give") {
    // Recovery: put the rider who lost their bike on the chosen replacement.
    const r = Number.parseInt(String(form.get("r") ?? ""), 10);
    const bikeId = String(form.get("bike") ?? "");
    const bike = (await getBikesById(env.DB, [bikeId], trip)).get(bikeId);
    if (bike && Number.isFinite(r) && basket.riders[r] && ridersOn(basket, bike.id) < bike.free) basket.riders[r]!.bikeTypeId = bike.id;
    return redirect(back(), { headers: await basketHeaders(basket) });
  }
  if (intent === "drop") {
    const r = Number.parseInt(String(form.get("r") ?? ""), 10);
    if (Number.isFinite(r) && basket.riders.length > 1) basket.riders.splice(r, 1);
    return redirect(tripHref("/checkout", { ...trip, riders: basket.riders.length }), { headers: await basketHeaders(basket) });
  }
  if (intent === "locations") {
    basket.pickupLocationId = String(form.get("pickup") ?? "") || undefined;
    basket.dropoffLocationId = String(form.get("dropoff") ?? "") || undefined;
    basket.autoSwap = form.get("autoSwap") === "on";
    return redirect(back(), { headers: await basketHeaders(basket) });
  }

  // --- book ------------------------------------------------------------------
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 500);
  basket.pickupLocationId = String(form.get("pickup") ?? "") || basket.pickupLocationId;
  basket.dropoffLocationId = String(form.get("dropoff") ?? "") || basket.dropoffLocationId;
  basket.autoSwap = form.get("autoSwap") === "on";
  const headers = await basketHeaders(basket);

  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return redirect(back({ error: "details" }), { headers });
  const needBikes = (!tour || tour.requiresBike) && !(!tour && ownBikeOnly(basket));
  if (basket.riders.length === 0 || (needBikes && basket.riders.some((r) => !r.bikeTypeId))) return redirect(back({ error: "bikes" }), { headers });
  if (tour && (!tour.bookable || trip.riders > tour.seatsLeft)) return redirect(back({ error: "seats" }), { headers });

  const attempt = async (b: Basket) => {
    const priced = await priceBasket(env.DB, trip, b, tour);
    if (!priced.quote) return { ok: false as const, reason: "sold_out" as const, unavailable: [] as string[] };
    return reserveBooking(env.DB, {
      quote: priced.quote,
      kind: tour ? "tour" : "rental",
      startAt: trip.startAt,
      endAt: trip.endAt,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || undefined,
      pickupLocationId: b.pickupLocationId,
      dropoffLocationId: b.dropoffLocationId,
      channel: "web",
      notes: notes || undefined,
      tourDepartureId: tour?.departureId,
      seats: tour ? trip.riders : undefined,
      holdTtlMinutes: Number(env.HOLD_TTL_MINUTES) || undefined,
    });
  };

  let result = await attempt(basket);
  let swapped: string[] = [];

  if (!result.ok) {
    // Which rider lost their bike? Labels are bike names; find the first rider on one of them.
    const lostNames = new Set(result.unavailable);
    const bikes = await getBikesById(env.DB, basket.riders.map((r) => r.bikeTypeId!).concat(Object.keys(basket.extras)), trip);
    const lostIdx = basket.riders.findIndex((r) => r.bikeTypeId && lostNames.has(bikes.get(r.bikeTypeId)?.name ?? ""));
    const lostBike = lostIdx >= 0 ? bikes.get(basket.riders[lostIdx]!.bikeTypeId!) : undefined;

    if (basket.autoSwap && lostBike && lostIdx >= 0) {
      // "Put me on the closest one at the same price or less, and tell me."
      const all = await listBikes(env.DB, trip);
      const rider = basket.riders[lostIdx]!;
      const alt = all
        .filter((b) => b.id !== lostBike.id && b.category !== "extra" && b.free - ridersOn(basket, b.id) > 0 && fitsRider(b, rider.heightCm) && b.tripMinor <= lostBike.tripMinor)
        .sort((a, b) => Number(a.category !== lostBike.category) - Number(b.category !== lostBike.category) || b.tripMinor - a.tripMinor)[0];
      if (alt) {
        rider.bikeTypeId = alt.id;
        swapped = [lostBike.name, alt.name];
        result = await attempt(basket);
      }
    }
    if (!result.ok) {
      if (lostIdx >= 0) delete basket.riders[lostIdx]!.bikeTypeId;
      return redirect(back({ lost: lostBike?.id, for: lostIdx >= 0 ? lostIdx : undefined }), { headers: await basketHeaders(basket) });
    }
  }

  // Pay at the shop: nothing to authorise, so the hold becomes a confirmed booking now.
  await transition(env.DB, { bookingId: result.bookingId, from: "held", to: "confirmed", actor: "customer", note: "pay on collection" });
  const q = new URLSearchParams();
  if (swapped.length) q.set("swapped", swapped.join("→"));
  return redirect(`/booked/${result.code}${q.size ? `?${q}` : ""}`, { headers: await clearBasketHeaders() });
}

export default function Checkout({ loaderData }: Route.ComponentProps) {
  const { tour, seatLine, trip: t, days, deadline, locations, pickupId, dropoffId, autoSwap, riders, extras, addonLines, fees, totalMinor, ready, lost, alternatives, error, addons, ownBike, helmetMissing, unfinished } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, tourDepartureId: t.tourDepartureId };
  const here = tripHref("/checkout", trip);
  const dropoff = locations.find((l) => l.id === dropoffId);
  const pickup = locations.find((l) => l.id === pickupId);
  const differentReturn = dropoffId && dropoffId !== pickupId;

  return (
    <>
      <Header
        variant="funnel"
        right={
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ok">
            <Lock size={15} /> Secure checkout
          </span>
        }
      />
      {ownBike || (tour && !tour.requiresBike) ? (
        <Steps current={3} />
      ) : (
        <FunnelSteps trip={trip} tour={tour} riders={riders.map((r) => ({ label: r.label, bikeDone: Boolean(r.bikeName), extrasDone: Boolean(r.bikeName) && r.extrasDone }))} position={{ at: "checkout" }} canCheckout />
      )}

      <Shell className="grid gap-7 px-5 pb-12 pt-7 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start md:px-8">
        <div className="flex flex-col gap-[18px]">
          {lost && (
            <>
              <Card className="flex gap-4 bg-warn/10 px-[26px] py-6">
                <div className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-warn/18 text-warn">
                  <Warning size={24} />
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="font-display text-[26px] font-bold leading-[1.15] tracking-[-.022em]">Someone took the last {lost.name} while you were typing</h1>
                  <p className="max-w-[64ch] text-[16px] leading-[1.55] text-warn-soft">
                    It happens on busy weekends. Nothing has been charged and the rest of your booking is untouched. Pick a replacement{lost.riderLabel ? ` for ${lost.riderLabel}` : ""} below and carry on.
                  </p>
                </div>
              </Card>
              {alternatives.length > 0 && (
                <div className="flex flex-col gap-[14px]">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[19px] font-semibold tracking-[-.012em]">Free right now{riders[lost.rider ?? -1]?.heightCm ? ` for ${riders[lost.rider ?? -1]?.heightCm} cm` : ""}</h2>
                    <span className="text-[14px] text-ink-mute">Same dates, same total unless it says otherwise</span>
                  </div>
                  {alternatives.map((a, i) => (
                    <Card key={a.id} className={cx("flex flex-col gap-4 p-4 sm:flex-row sm:items-center", i === 0 && "shadow-[inset_0_0_0_2px_#0A78D6]")}>
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-field bg-brand/18">
                        <BikeImage bike={a} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                        <div className="flex items-center gap-[10px]">
                          {i === 0 ? <span className="rounded-full bg-ok px-[10px] py-[3px] text-[10.5px] font-bold uppercase tracking-[.06em] text-ok-ink">Closest match</span> : <span className="rounded-full bg-brand/28 px-[10px] py-[3px] text-[10.5px] font-bold uppercase tracking-[.06em] text-[#8FC4E8]">Alternative</span>}
                          <span className={cx("num text-[13px] font-semibold", a.deltaMinor === 0 ? "text-ok" : a.deltaMinor > 0 ? "text-warn" : "text-ok")}>
                            {a.deltaMinor === 0 ? "Same price" : a.deltaMinor > 0 ? `+${formatDKKCode(a.deltaMinor)} for the ${days} days` : `${formatDKKCode(a.deltaMinor)} for the ${days} days`}
                          </span>
                        </div>
                        <span className="text-[17.5px] font-semibold">{a.name}</span>
                        <span className="text-[13.5px] text-ink-mute">{[a.sizeLabel ? `Size ${a.sizeLabel}` : null, a.category === "ebike" ? "motor" : "no motor", `${a.free} free`].filter(Boolean).join(" · ")}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-[9px]">
                        <span className="num font-display text-[21px] font-bold">
                          {formatDKKCode(a.rateMinor)} <span className="text-[12.5px] font-normal text-ink-mute">{a.perDay ? "/day" : "period"}</span>
                        </span>
                        <Form method="post" action={here}>
                          <input type="hidden" name="intent" value="give" />
                          <input type="hidden" name="r" value={lost.rider ?? ""} />
                          <input type="hidden" name="bike" value={a.id} />
                          <button className={cx("rounded-full px-[22px] py-[11px] text-[14.5px] font-bold", i === 0 ? "bg-white text-night hover:bg-ink-pale" : "bg-white/10 hover:bg-white/14")}>Use this one</button>
                        </Form>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              <Card className="px-2 py-[6px]">
                <div className="px-[14px] py-[13px]">
                  <Lbl>Or, if neither suits</Lbl>
                </div>
                <Link to={tripHref("/", trip)} className="flex items-center gap-[14px] border-t border-white/5 px-[14px] py-[13px] hover:bg-white/3">
                  <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-white/6 text-brand-bright"><Calendar size={18} /></div>
                  <span className="flex-1 text-[15px]">Shift the whole booking to other dates</span>
                </Link>
                {riders.length > 1 && lost.rider != null && (
                  <Form method="post" action={here} className="border-t border-white/5">
                    <input type="hidden" name="intent" value="drop" />
                    <input type="hidden" name="r" value={lost.rider} />
                    <button className="flex w-full items-center gap-[14px] px-[14px] py-[13px] text-left hover:bg-white/3">
                      <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-white/6 text-brand-bright"><Check size={18} strokeWidth={2} /></div>
                      <span className="flex-1 text-[15px]">Book the other {riders.length - 1 === 1 ? "bike" : "bikes"} only, and sort {lost.riderLabel}'s at the shop</span>
                    </button>
                  </Form>
                )}
                <a href={SHOP.phoneHref} className="flex items-center gap-[14px] border-t border-white/5 px-[14px] py-[13px] hover:bg-white/3">
                  <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-white/6 text-brand-bright"><Phone size={18} /></div>
                  <span className="flex-1 text-[15px]">
                    Call us on <strong className="font-semibold">{SHOP.phone}</strong> — we often have something not listed
                  </span>
                </a>
              </Card>
            </>
          )}

          {error === "details" && <Note icon={<Warning size={17} />}>We need a name and a working email address — that's where the confirmation and pickup code go.</Note>}
          {error === "seats" && <Note icon={<Warning size={17} />}>That departure can't take {trip.riders} more — pick another date on the tour page.</Note>}
          {error === "bikes" && (
            <Note icon={<Warning size={17} />}>
              Every rider needs a bike before we can hold them.{" "}
              <Link to={tripHref("/riders", trip)} className="font-semibold text-brand-bright">Back to the riders</Link>
            </Note>
          )}

          {ownBike ? (
            <Card className="px-[22px] py-5">
              <AddonsPanel addons={addons} action={here} riders={trip.riders} heading="Helmets and accessories for your own bike" />
              <p className="mt-4 text-[13.5px] text-ink-mute">No rental bike in this booking — that's fine. Everything here is fitted at the shop when you collect.</p>
            </Card>
          ) : (
            !(tour && !tour.requiresBike) && (
              <Card className="flex flex-col gap-4 p-[22px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[20px] font-semibold tracking-[-.014em]">{riders.length === 1 ? "Your extras" : "Each rider's extras"}</h2>
                  <span className="text-[13.5px] text-ink-mute">Settled per rider · change any of them</span>
                </div>
                <div className="flex flex-col gap-[10px]">
                  {riders.map((r, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 border-t border-white/6 pt-[10px] first:border-t-0 first:pt-0">
                      <div className="flex min-w-0 flex-col gap-[2px]">
                        <span className="text-[14.5px] font-semibold">
                          {r.label}
                          {r.bikeName && <span className="font-normal text-ink-mute"> · {r.bikeName}</span>}
                        </span>
                        <span className={cx("text-[13.5px]", r.extras.length ? "text-ink-soft" : tour ? "text-ok" : "text-ink-mute")}>
                          {r.extras.length ? r.extras.map((e) => e.label).join(", ") : tour ? "Helmet included" : r.extrasDone ? "Nothing extra" : "Not asked yet"}
                        </span>
                      </div>
                      <Link to={tripHref("/riders", trip, { r: i + 1, step: r.bikeName ? "extras" : "bike" })} className="shrink-0 text-[13.5px] font-semibold text-brand-bright hover:text-ink">
                        {r.bikeName ? "Change" : "Pick a bike"}
                      </Link>
                    </div>
                  ))}
                </div>
                {helmetMissing.length > 0 && (
                  <Note icon={<Warning size={17} />}>
                    {helmetMissing.map((h) => h.label).join(" and ")} {helmetMissing.length === 1 ? "has" : "have"} no helmet. Helmets are not included with rentals — DKK 50 each.{" "}
                    <Link to={tripHref("/riders", trip, { r: helmetMissing[0]!.r + 1, step: "extras" })} className="font-semibold text-brand-bright">
                      Add one
                    </Link>
                  </Note>
                )}
                {addons.length > 0 && (
                  <div className="border-t border-white/6 pt-4">
                    <AddonsPanel addons={addons} action={here} riders={trip.riders} heading={riders.length > 1 ? `For the ${riders.length === 2 ? "two" : riders.length} of you` : "For the booking"} />
                  </div>
                )}
              </Card>
            )
          )}

          <Form method="post" action={here} id="checkout" className="flex flex-col gap-[18px]">
            <Card className="flex flex-col gap-4 p-[22px]">
              <h2 className="text-[20px] font-semibold tracking-[-.014em]">Who's booking?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-[7px]">
                  <Lbl>Full name</Lbl>
                  <input name="name" required minLength={2} autoComplete="name" className="rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[15.5px] focus:outline-2 focus:outline-brand-bright" />
                </label>
                <label className="flex flex-col gap-[7px]">
                  <Lbl>Phone</Lbl>
                  <input name="phone" type="tel" autoComplete="tel" placeholder="+298" className="num rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[15.5px] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright" />
                </label>
                <label className="flex flex-col gap-[7px] sm:col-span-2">
                  <Lbl>Email — confirmation and pickup code go here</Lbl>
                  <input name="email" type="email" required autoComplete="email" className="rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[15.5px] focus:outline-2 focus:outline-brand-bright" />
                </label>
                <label className="flex flex-col gap-[7px] sm:col-span-2">
                  <Lbl>Anything we should know? (optional)</Lbl>
                  <textarea name="notes" rows={2} placeholder="Clip-in pedals, a child seat, arriving by ferry…" className="rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[15.5px] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright" />
                </label>
              </div>
            </Card>

            {tour ? (
              <Card className="flex items-center gap-[14px] px-[22px] py-5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand-bright"><Calendar size={21} /></div>
                <div className="flex flex-col gap-1">
                  <span className="text-[16px] font-semibold">{tour.title} · {fmtLongDay(trip.startAt)} {fmtTime(trip.startAt)}</span>
                  <span className="text-[14.5px] leading-[1.5] text-ink-soft">Meet at {SHOP.address} ten minutes before. {tour.requiresBike ? "Bikes and helmets are fitted at the shop." : "We drive from the shop and bring you back."}</span>
                </div>
              </Card>
            ) : (
            <Card className="flex flex-col gap-4 p-[22px]">
              <h2 className="text-[20px] font-semibold tracking-[-.014em]">Pickup and drop-off</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-[7px]">
                  <Lbl>Collect from</Lbl>
                  <div className="relative">
                    <select name="pickup" defaultValue={pickupId ?? ""} onChange={() => document.getElementById("update-locations")?.click()} className="w-full appearance-none rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] pr-10 text-[15.5px] focus:outline-2 focus:outline-brand-bright">
                      {locations.map((l) => (
                        <option key={l.id} value={l.id} className="bg-card">
                          {l.name} · {fmtTime(trip.startAt)}{l.pickupFeeMinor > 0 ? ` · +${formatDKKCode(l.pickupFeeMinor)}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-mute" />
                  </div>
                </label>
                <label className="flex flex-col gap-[7px]">
                  <Lbl>Return to</Lbl>
                  <div className="relative">
                    <select name="dropoff" defaultValue={dropoffId ?? ""} onChange={() => document.getElementById("update-locations")?.click()} className="w-full appearance-none rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] pr-10 text-[15.5px] focus:outline-2 focus:outline-brand-bright">
                      {locations.map((l) => (
                        <option key={l.id} value={l.id} className="bg-card">
                          {l.name} · {fmtTime(trip.endAt)}{l.dropoffFeeMinor > 0 ? ` · +${formatDKKCode(l.dropoffFeeMinor)}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-mute" />
                  </div>
                </label>
              </div>
              {pickup?.note && <Note icon={<Pin size={17} />}>{pickup.note}</Note>}
              {differentReturn && dropoff && dropoff.dropoffFeeMinor > 0 ? (
                <Note icon={<Warning size={17} />}>Returning to a different place adds a {formatDKKCode(dropoff.dropoffFeeMinor)} drop-off fee. It's in the total on the right.</Note>
              ) : (
                <span className="text-[13.5px] text-ink-mute">Return somewhere else and the total on the right follows.</span>
              )}
              <button id="update-locations" name="intent" value="locations" formNoValidate className="self-start rounded-full bg-white/9 px-5 py-[9px] text-[13.5px] font-semibold hover:bg-white/14">
                Update
              </button>
            </Card>
            )}

            <Card className="flex items-center gap-[14px] px-[22px] py-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok/16 text-ok"><Shield size={21} /></div>
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold">Free cancellation until {fmtTime(deadline)} on {fmtLongDay(deadline)}</span>
                <span className="text-[14.5px] leading-[1.5] text-ink-soft">Cancel any time before then and you owe nothing. After that the booking is charged in full, because we've turned other people away. If the weather cancels a guided ride, everything comes back.</span>
              </div>
            </Card>

            <Card className="flex flex-col gap-[15px] p-[22px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[20px] font-semibold tracking-[-.014em]">How would you like to pay?</h2>
                <span className="inline-flex items-center gap-[6px] text-[13px] font-semibold text-ok"><Check size={14} /> Card details never touch our servers</span>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-[16px] bg-brand/14 p-4 shadow-[inset_0_0_0_2px_#0A78D6]">
                <input type="radio" name="pay" value="collect" defaultChecked className="size-[18px] accent-brand" />
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[15.5px] font-semibold">Pay when you collect</span>
                  <span className="text-[13.5px] text-ink-soft">Card or cash at {SHOP.address}. We hold the bikes for you now.</span>
                </div>
              </label>
              <div className="flex items-center gap-3 rounded-[16px] bg-white/5 p-4 opacity-70">
                <div className="size-[18px] rounded-full border-2 border-ink-dim" />
                <div className="flex flex-col gap-[2px]">
                  <span className="inline-flex items-center gap-2 text-[15.5px] font-semibold"><CardIcon size={16} /> Pay now by card</span>
                  <span className="text-[13.5px] text-ink-mute">Visa, Mastercard and Dankort — online payment switches on with the new site.</span>
                </div>
              </div>
            </Card>

            <label className="flex cursor-pointer gap-3 rounded-card bg-card px-[18px] py-4">
              <input type="checkbox" name="autoSwap" defaultChecked={autoSwap} className="mt-[3px] size-[18px] shrink-0 accent-brand" />
              <div className="flex flex-col gap-[3px]">
                <span className="text-[14.5px] font-semibold">Don't let a bike slip away</span>
                <span className="text-[13.5px] leading-[1.5] text-ink-soft">If a bike goes while I'm booking, put me on the closest one at the same price or less, and tell me.</span>
              </div>
            </label>
          </Form>
        </div>

        <div className="flex flex-col gap-[14px] lg:sticky lg:top-6">
          <SummaryRail
            title={tour ? "Your tour" : "Your booking"}
            days={days}
            riders={(tour && !tour.requiresBike) || ownBike ? [] : riders.map((r) => ({ label: r.label, heightCm: r.heightCm ?? undefined, bikeName: r.bikeName, included: Boolean(tour), detail: tour ? (r.bikeName ? "Bike and helmet" : null) : r.bikeName && r.rateMinor != null ? [r.range, r.perDay ? `${days} × ${formatDKKCode(r.rateMinor)}` : formatDKKCode(r.rateMinor)].filter(Boolean).join(" · ") : null, totalMinor: r.totalMinor, lost: r.lost, extras: r.extras }))}
            lines={[...(seatLine ? [{ label: `${seatLine.qty} × ${formatDKKCode(seatLine.unitPriceMinor)} · ${seatLine.label}`, totalMinor: seatLine.lineTotalMinor }] : []), ...extras, ...addonLines, ...fees]}
            totalMinor={totalMinor}
            totalLabel="Total"
            totalNote={ownBike ? "Own bike · helmets and extras only" : "Priced on our server, not your browser"}
          />
          {helmetMissing.length > 0 && (
            <span className="inline-flex items-start gap-[9px] px-1 text-[13px] leading-[1.5] text-warn">
              <Warning size={14} className="mt-[2px] shrink-0" /> {helmetMissing.length === riders.length ? "No helmets in this booking." : `${helmetMissing.map((h) => h.label).join(" and ")} without a helmet.`} DKK 50 each — change it above.
            </span>
          )}
          <div className="flex flex-col gap-1 text-[13.5px] text-ink-soft">
            <span className="font-semibold">{tour ? `${tour.title} · ${fmtDayTime(trip.startAt)}` : `${fmtDayTime(trip.startAt)} → ${fmtDayTime(trip.endAt)}`}</span>
            <span>{tour ? plural(trip.riders, tour.requiresBike ? "rider" : "person", tour.requiresBike ? "riders" : "people") : `${plural(trip.riders, "rider")} · ${days} ${days === 1 ? "day" : "days"}`}</span>
          </div>
          {ready ? (
            <button form="checkout" name="intent" value="book" className="rounded-full bg-white px-6 py-4 text-[16.5px] font-bold text-night hover:bg-ink-pale">
              Book — pay {formatDKKCode(totalMinor)} at the shop
            </button>
          ) : (
            <PillLink to={tour && !tour.requiresBike ? `/tours/${tour.slug}` : tripHref("/riders", trip)} tone="ghost" size="lg" block>
              {tour && !tour.requiresBike ? "That date is not available" : "Finish choosing bikes first"}
            </PillLink>
          )}
          <div className="flex flex-col gap-[9px] px-1">
            <span className="inline-flex items-center gap-[9px] text-[13.5px] font-semibold text-ok"><Check size={15} /> Free cancellation until {fmtDay(deadline)} {fmtTime(deadline)}</span>
            <span className="inline-flex items-center gap-[9px] text-[13.5px] font-semibold text-ok"><Check size={15} /> Bikes held for you the moment you book</span>
            <span className="inline-flex items-start gap-[9px] pt-1 text-[12.5px] leading-[1.5] text-ink-mute"><Info size={14} className="mt-[2px] shrink-0" /> The confirmation email carries a six-letter code. Bring it, and something with your name on it.</span>
          </div>
        </div>
      </Shell>

      <Footer />
    </>
  );
}

