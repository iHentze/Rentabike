import { useEffect, useRef, useState } from "react";
import { Form, Link, data, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/riders";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell, TripSummary } from "~/components/site";
import { Card, Lbl, PillLink, Price, Tag, cx } from "~/components/ui";
import { Availability, BikeImage, riderRange } from "~/components/bike-card";
import { SummaryRail } from "~/components/summary-rail";
import { FunnelSteps } from "~/components/funnel-steps";
import { Check, Info, Star } from "~/components/icons";
import { AddonsPanel, HELMET_ID } from "~/components/addons-panel";
import { AddonCard } from "~/components/addon-card";
import { tripDays, tripHref, MAX_RIDERS } from "~/lib/trip";
import { resolveTrip } from "~/lib/tour-trip";
import { assignBike, basketHeaders, nextStep, readBasket, riderLabel, riderReady, ridersOn, stepHref, unassignBike, type Basket } from "~/lib/basket";
import { CATEGORY_LABEL, CATEGORY_ORDER, fitsRider, getAddonsById, listBikes, ridable, type CatalogueAddon } from "~/lib/catalogue/bikes";
import { adviseCategories, CATEGORY_NOUN } from "~/lib/catalogue/advice";
import { BIKE_CATEGORIES, type BikeCategory } from "~/db/schema";
import { priceBasket } from "~/lib/quote-basket";
import { fmtDays, fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";
import { imageSrc } from "~/lib/catalogue/images";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.step === "extras" ? `Extras for ${loaderData.riders[loaderData.current]?.label ?? "the rider"} — Rent a Bike & Outdoor` : "A bike for each rider — Rent a Bike & Outdoor" }];
}

const HELMET = HELMET_ID;
/** How many of one per-bike item a single rider can take. One head, one helmet. */
const MAX_PER_RIDER = 5;

const byHelmetThenPrice = (a: CatalogueAddon, b: CatalogueAddon) => (a.id === HELMET ? -1 : b.id === HELMET ? 1 : a.priceMinor - b.priceMinor || a.name.localeCompare(b.name));

/**
 * One rider at a time: first their bike, then their extras, then the next
 * rider. `r` picks the rider, `step` the phase; without them the page opens on
 * whatever the basket still needs. The helmet is asked by name, yes or no,
 * before anyone can go on — it is the upsell that matters most, and the one a
 * shared "anything else?" panel lets people scroll past.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip, tour } = await resolveTrip(env.DB, url.searchParams);
  const [bikes, basket] = await Promise.all([listBikes(env.DB, trip), readBasket(request, trip)]);
  const fleet = tour ? ridable(bikes).filter((b) => tour.allowedBikeTypeIds.includes(b.id)) : ridable(bikes);

  const rParam = Number.parseInt(url.searchParams.get("r") ?? "", 10);
  const auto = nextStep(basket);
  const current = Number.isFinite(rParam) && rParam >= 1 && rParam <= basket.riders.length ? rParam - 1 : auto ? auto.rider : 0;
  const rider = basket.riders[current]!;
  const myBike = rider.bikeTypeId ? bikes.find((b) => b.id === rider.bikeTypeId) : undefined;
  // Height comes before the bike: a rider who arrived with a bike from the chooser or the
  // catalogue but no height is still on the bike step, form first, until it is in.
  const ready = riderReady(rider);
  // The helmet is a yes-or-no by name; the extras step is not done until it has one.
  const helmetOffered = Boolean(myBike?.addonIds.includes(HELMET)) && !tour;
  const helmetAnswered = (rider.addons[HELMET] ?? 0) > 0 || rider.helmetDeclined === true;
  const step: "bike" | "extras" = url.searchParams.get("step") === "bike" || !myBike || !ready ? "bike" : "extras";
  const showAll = url.searchParams.get("all") === "1";

  // The type the list opens on: `cat` in the URL (a chip, a home-page tile, the chooser), else what the
  // basket remembers — the chooser's advice or the previous rider's bike. "all" is every type.
  const catParam = url.searchParams.get("cat");
  const isCat = (v: string | null): v is BikeCategory => v !== null && (BIKE_CATEGORIES as readonly string[]).includes(v) && v !== "extra";
  const category: BikeCategory | null = catParam === "all" ? null : isCat(catParam) ? catParam : (basket.preferredCategory ?? null);

  // Bikes for this rider: those that fit their height (or all, on request). Free ones first,
  // then frames whose stated range covers the rider, then frames that state no range at all.
  const hasRange = (b: { riderMinCm: number | null; riderMaxCm: number | null }) => b.riderMinCm != null && b.riderMaxCm != null;
  const fitting = fleet
    .filter((b) => showAll || fitsRider(b, rider.heightCm))
    .map((b) => ({ ...b, freeForRider: b.free - ridersOn(basket, b.id) + (rider.bikeTypeId === b.id ? 1 : 0), ranged: hasRange(b) && fitsRider(b, rider.heightCm) }))
    .sort(
      (a, b) =>
        Number(b.freeForRider > 0) - Number(a.freeForRider > 0) ||
        Number(b.ranged) - Number(a.ranged) ||
        a.rateMinor - b.rateMinor ||
        a.name.localeCompare(b.name),
    );
  // One chip per type, counted for this rider's height and dates. The rider's own bike always shows.
  const chips = CATEGORY_ORDER.filter((c) => c !== "extra").map((c) => ({ category: c, label: CATEGORY_LABEL[c], free: fitting.filter((b) => b.category === c && b.freeForRider > 0).length }));
  const candidates = category ? fitting.filter((b) => b.category === category || b.id === rider.bikeTypeId) : fitting;
  // What the chooser said, if it said anything and it still holds for this type.
  const advised = basket.advice ? adviseCategories(fleet, basket.advice.terrain, basket.advice.effort)[0] : undefined;
  const advice = advised && advised.category === category ? { noun: CATEGORY_NOUN[advised.category], reason: advised.reasons[0] ?? "" } : null;

  // This rider's extras: what their bike takes, helmet first, nothing that belongs to the whole booking.
  const chosen = basket.riders.map((r) => (r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) : undefined)).filter((b) => b !== undefined);
  const wanted = new Set<string>([...(myBike?.addonIds ?? []), ...Object.keys(rider.addons), ...chosen.flatMap((b) => b.addonIds), ...Object.keys(basket.addons)]);
  const catalogue = await getAddonsById(env.DB, [...wanted]);
  const mine = [...catalogue.values()]
    .filter((a) => a.unit !== "per_booking" && (myBike?.addonIds.includes(a.id) || rider.addons[a.id]))
    .filter((a) => !(tour && a.id === HELMET))
    .sort(byHelmetThenPrice);
  // Things for the whole booking are asked once, after the last rider: what any chosen bike allows, per booking.
  const isLast = current === basket.riders.length - 1;
  const forEveryone = [...catalogue.values()].filter((a) => a.unit === "per_booking" && (chosen.some((b) => b.addonIds.includes(a.id)) || basket.addons[a.id])).sort(byHelmetThenPrice);

  const priced = await priceBasket(env.DB, trip, basket, tour);
  const days = tripDays(trip);
  const labels = basket.riders.map((_, i) => riderLabel(basket, i));
  const summary = (r: Basket["riders"][number]) => Object.keys(r.addons).map((id) => shortName(catalogue.get(id)?.name ?? id));

  // "Same as Jóhanna": the first earlier rider with extras this bike can take.
  const copyIdx = basket.riders.findIndex((r, i) => i < current && r.bikeTypeId && Object.keys(r.addons).some((id) => myBike?.addonIds.includes(id)));
  const copyFrom =
    copyIdx >= 0
      ? {
          r: copyIdx,
          label: labels[copyIdx]!,
          items: Object.keys(basket.riders[copyIdx]!.addons).filter((id) => myBike?.addonIds.includes(id)).map((id) => shortName(catalogue.get(id)?.name ?? id)),
          totalMinor: priced.riderExtras[copyIdx]!.filter((l) => myBike?.addonIds.includes(l.addonId)).reduce((n, l) => n + l.totalMinor, 0),
        }
      : null;

  // Where "Done" goes: the next rider's bike, their extras, or checkout.
  const afterMe = nextStep({ ...basket, riders: basket.riders.map((r, i) => (i === current ? { ...r, extrasDone: true } : r)) });

  return {
    tour: tour ? { title: tour.title, slug: tour.slug, priceMinor: tour.priceMinor } : null,
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, tourDepartureId: trip.tourDepartureId },
    days,
    current,
    step,
    ready,
    helmetOffered,
    helmetAnswered,
    showAll,
    category,
    chips,
    advice,
    isLast,
    riders: basket.riders.map((r, i) => {
      const bike = r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) : undefined;
      return {
        label: labels[i]!,
        name: r.name ?? "",
        heightCm: r.heightCm ?? null,
        bikeName: bike?.name ?? null,
        bikeDone: Boolean(bike) && riderReady(r),
        bikeModel: bike?.model ?? null,
        bikeSize: bike?.sizeLabel ?? null,
        rateMinor: bike?.rateMinor ?? null,
        perDay: bike?.perDay ?? true,
        totalMinor: priced.riderTotals[i] ?? null,
        extrasDone: Boolean(r.extrasDone),
        extras: priced.riderExtras[i]!.map((l) => ({ label: `${shortName(l.label)}${l.qty > 1 ? ` ×${l.qty}` : ""}`, totalMinor: l.totalMinor, included: Boolean(tour) && l.addonId === HELMET })),
        summary: summary(r),
        hasHelmet: (r.addons[HELMET] ?? 0) > 0,
        helmetDeclined: r.helmetDeclined === true,
      };
    }),
    candidates: candidates.map((b) => ({ id: b.id, slug: b.slug, name: b.name, category: b.category, image: b.image, sizeLabel: b.sizeLabel, riderMinCm: b.riderMinCm, riderMaxCm: b.riderMaxCm, free: b.freeForRider, rateMinor: b.rateMinor, perDay: b.perDay, mine: rider.bikeTypeId === b.id, ranged: b.ranged })),
    mine: mine.map((a) => ({ id: a.id, name: a.name, priceMinor: a.priceMinor, unit: a.unit, isSale: a.isSale, image: a.image, qty: rider.addons[a.id] ?? 0 })),
    forEveryone: forEveryone.map((a) => ({ id: a.id, name: a.name, priceMinor: a.priceMinor, unit: a.unit, isSale: a.isSale, image: a.image, qty: basket.addons[a.id] ?? 0 })),
    copyFrom,
    after: afterMe ? { ...afterMe, label: labels[afterMe.rider]! } : null,
    extras: Object.entries(basket.extras).map(([id, qty]) => ({ id, name: bikes.find((b) => b.id === id)?.name ?? id, qty, totalMinor: (bikes.find((b) => b.id === id)?.tripMinor ?? 0) * qty })),
    fees: priced.quote?.lines.filter((l) => l.kind === "fee").map((l) => ({ label: l.label, totalMinor: l.lineTotalMinor })) ?? [],
    bookingLines: priced.bookingAddonLines.map((l) => ({ label: `${l.label}${l.qty > 1 ? ` ×${l.qty}` : ""}`, totalMinor: l.totalMinor })),
    seatLine: priced.quote?.lines.find((l) => l.kind === "tour_seat") ?? null,
    totalMinor: priced.quote?.totalMinor ?? 0,
    allDone: nextStep(basket) === null,
  };
}

/** "Pedals for MTB (SPD) for rent" → "Pedals for MTB (SPD)"; the shop's names carry their own small print. */
function shortName(name: string): string {
  return name.replace(/\s+for (rent|sale)\b.*$/i, "").replace(/\.\s*Max device.*$/i, "").trim();
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip, tour } = await resolveTrip(env.DB, url.searchParams);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const r = Number.parseInt(String(form.get("r") ?? ""), 10);
  const basket = await readBasket(request, trip);
  const rider = Number.isFinite(r) ? basket.riders[r] : undefined;
  let next: { rider: number; step: "bike" | "extras" } | "checkout" = { rider: Number.isFinite(r) ? r : 0, step: form.get("step") === "extras" ? "extras" : "bike" };

  if (intent === "rider" && rider) {
    const name = String(form.get("name") ?? "").trim().slice(0, 60);
    const height = Number.parseInt(String(form.get("heightCm") ?? ""), 10);
    rider.name = name || undefined;
    rider.heightCm = Number.isFinite(height) && height >= 80 && height <= 230 ? height : undefined;
    // A new height can make the chosen bike a bad fit; drop it so the list re-decides.
    if (rider.bikeTypeId) {
      const bike = (await listBikes(env.DB, trip)).find((b) => b.id === rider.bikeTypeId);
      if (bike && !fitsRider(bike, rider.heightCm)) unassignBike(rider);
    }
  } else if (intent === "give" && rider) {
    const bikeId = String(form.get("bike") ?? "");
    const bike = (await listBikes(env.DB, trip)).find((b) => b.id === bikeId);
    if (!riderReady(rider)) {
      // The button is disabled without a name and height; this is the no-JS and stale-tab path.
      next = { rider: r, step: "bike" };
    } else if (bike && bike.category !== "extra" && (!tour || tour.allowedBikeTypeIds.includes(bike.id))) {
      const others = ridersOn(basket, bike.id) - (rider.bikeTypeId === bike.id ? 1 : 0);
      if (others < bike.free) {
        assignBike(rider, bike);
        basket.preferredCategory = bike.category;
        next = { rider: r, step: "extras" };
      }
    }
  } else if (intent === "unassign" && rider) {
    unassignBike(rider);
    next = { rider: r, step: "bike" };
  } else if ((intent === "helmet" || intent === "raddon") && rider?.bikeTypeId) {
    // A rider's own extra: only what their bike takes, never a per-booking item.
    const id = intent === "helmet" ? HELMET : String(form.get("addon") ?? "");
    const bike = (await listBikes(env.DB, trip)).find((b) => b.id === rider.bikeTypeId);
    const addon = (await getAddonsById(env.DB, [id])).get(id);
    if (bike && addon && addon.unit !== "per_booking" && bike.addonIds.includes(id)) {
      const delta = intent === "helmet" ? (form.get("value") === "yes" ? 1 - (rider.addons[id] ?? 0) : -(rider.addons[id] ?? 0)) : Number.parseInt(String(form.get("delta") ?? "0"), 10);
      const n = (rider.addons[id] ?? 0) + (Number.isFinite(delta) ? delta : 0);
      if (n <= 0) delete rider.addons[id];
      else rider.addons[id] = Math.min(id === HELMET ? 1 : MAX_PER_RIDER, n);
      // "No" must leave a mark, or the question looks unanswered and the radio stays empty.
      if (intent === "helmet") rider.helmetDeclined = form.get("value") !== "yes";
    }
    next = { rider: r, step: "extras" };
  } else if (intent === "copy" && rider?.bikeTypeId) {
    const from = basket.riders[Number.parseInt(String(form.get("from") ?? ""), 10)];
    const bike = (await listBikes(env.DB, trip)).find((b) => b.id === rider.bikeTypeId);
    if (from && bike) for (const [id, qty] of Object.entries(from.addons)) if (bike.addonIds.includes(id)) rider.addons[id] = qty;
    next = { rider: r, step: "extras" };
  } else if (intent === "done" && rider) {
    const bike = rider.bikeTypeId ? (await listBikes(env.DB, trip)).find((b) => b.id === rider.bikeTypeId) : undefined;
    const helmetOpen = Boolean(bike?.addonIds.includes(HELMET)) && !tour && !(rider.addons[HELMET] ?? 0) && !rider.helmetDeclined;
    if (helmetOpen) {
      // The button is disabled until the helmet has a yes or a no; this is the no-JS and stale-tab path.
      next = { rider: r, step: "extras" };
    } else {
      rider.extrasDone = true;
      next = nextStep(basket) ?? "checkout";
    }
  } else if (intent === "addon") {
    // Something for the whole booking: a car carrier, bag storage.
    const id = String(form.get("addon") ?? "");
    const delta = Number.parseInt(String(form.get("delta") ?? "0"), 10);
    const n = (basket.addons[id] ?? 0) + (Number.isFinite(delta) ? delta : 0);
    if (n <= 0) delete basket.addons[id];
    else basket.addons[id] = Math.min(20, n);
  } else if (intent === "extra") {
    const id = String(form.get("bike") ?? "");
    const delta = Number.parseInt(String(form.get("delta") ?? "0"), 10);
    const n = (basket.extras[id] ?? 0) + (Number.isFinite(delta) ? delta : 0);
    if (n <= 0) delete basket.extras[id];
    else basket.extras[id] = Math.min(20, n);
  }

  const headers = await basketHeaders(basket);
  // Name and height save as they are typed; answering in place keeps the list where the customer is looking.
  if (intent === "rider") return data(null, { headers });
  if (next === "checkout") return redirect(tripHref("/checkout", trip), { headers });
  const back = new URLSearchParams(url.searchParams);
  back.set("r", String(next.rider + 1));
  back.set("step", next.step);
  return redirect(`/riders?${back}`, { headers });
}

export default function Riders({ loaderData }: Route.ComponentProps) {
  const { tour, trip: t, days, current, step, ready, helmetOffered, helmetAnswered, showAll, category, chips, advice, isLast, riders, candidates, mine, forEveryone, copyFrom, after, extras, fees, bookingLines, seatLine, totalMinor, allDone } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, tourDepartureId: t.tourDepartureId };
  const me = riders[current]!;
  const first = me.name || `rider ${current + 1}`;
  const cat = category ?? "all";
  const here = tripHref("/riders", trip, { r: current + 1, step, all: showAll ? 1 : undefined, cat });
  const fits = candidates.filter((c) => c.free > 0);
  const helmet = mine.find((a) => a.id === HELMET);
  const rest = mine.filter((a) => a.id !== HELMET);
  const hidden = { r: current, step };

  return (
    <>
      <Header variant="funnel" right={<TripSummary trip={trip} tour={tour} />} />

      <FunnelSteps
        trip={trip}
        tour={tour}
        riders={riders.map((r) => ({ label: r.label, bikeDone: r.bikeDone, extrasDone: r.bikeDone && r.extrasDone }))}
        position={{ at: "rider", i: current, step }}
        canCheckout={allDone}
        addRiderHref={trip.riders < MAX_RIDERS ? tripHref("/riders", trip, { riders: trip.riders + 1, r: trip.riders + 1 }) : undefined}
      />

      <Shell className="grid gap-7 px-5 pb-12 pt-[22px] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start md:px-8">
        <div className="flex flex-col gap-5">
          {/* where we are, in words: step n of m, what this screen is for, what follows */}
          <div className="flex flex-col gap-[6px]">
            <Lbl>
              Step {2 + current * 2 + (step === "extras" ? 1 : 0)} of {riders.length * 2 + 2} · {first}
            </Lbl>
            <h1 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-.024em] md:text-[36px]">{step === "bike" ? `A bike for ${first}` : `Extras for ${first}`}</h1>
            <span className="text-[14.5px] text-ink-soft">
              {step === "bike"
                ? `Then ${first}'s extras, then ${current < riders.length - 1 ? `${riders[current + 1]!.label}'s bike` : "checkout"}.`
                : after
                  ? `Then ${after.label}'s ${after.step === "bike" ? "bike" : "extras"}, then checkout.`
                  : "Then checkout."}
            </span>
          </div>
          {step === "bike" ? (
            <>
              {/* height */}
              <Card className="flex flex-col gap-[17px] p-[22px]">
                <RiderForm key={current} here={here} current={current} name={me.name} heightCm={me.heightCm ?? null} />
              </Card>

              {/* bikes */}
              <div className="flex flex-col gap-[14px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[19px] font-semibold tracking-[-.012em]">
                    {category ? `${CATEGORY_LABEL[category]}${category === "ebike" ? "" : " bikes"} free` : "Free"}
                    {me.heightCm && !showAll ? ` for ${me.heightCm} cm on your dates` : " on your dates"}
                    <span className="ml-2 text-[14px] font-normal text-ink-mute">{fits.length} {fits.length === 1 ? "bike" : "bikes"}</span>
                  </h2>
                  {me.heightCm && (
                    <Link to={tripHref("/riders", trip, { r: current + 1, step: "bike", all: showAll ? undefined : 1, cat })} className="text-[14px] font-semibold text-brand-bright hover:text-ink">
                      {showAll ? "Only my size" : "Show other sizes"}
                    </Link>
                  )}
                </div>
                {/* the type: one tap, and it sticks for the next rider */}
                {ready && (
                  <div className="flex flex-wrap items-center gap-2">
                    {chips.map((c) => {
                      const on = category === c.category;
                      return (
                        <Link
                          key={c.category}
                          to={tripHref("/riders", trip, { r: current + 1, step: "bike", all: showAll ? 1 : undefined, cat: on ? "all" : c.category })}
                          preventScrollReset
                          aria-pressed={on}
                          className={cx("inline-flex items-center gap-2 rounded-full px-4 py-[9px] text-[14px] font-semibold transition-colors", on ? "bg-brand text-ink" : c.free > 0 ? "bg-white/8 text-ink hover:bg-white/14" : "bg-white/4 text-ink-dim")}
                        >
                          {c.label}
                          <span className={cx("num text-[12.5px]", on ? "text-ink/80" : "text-ink-mute")}>{c.free}</span>
                        </Link>
                      );
                    })}
                    {category && (
                      <Link to={tripHref("/riders", trip, { r: current + 1, step: "bike", all: showAll ? 1 : undefined, cat: "all" })} preventScrollReset className="px-2 text-[13.5px] font-semibold text-brand-bright hover:text-ink">
                        All types
                      </Link>
                    )}
                  </div>
                )}
                {ready && advice && (
                  <span className="flex gap-[10px] text-[14px] leading-[1.5] text-ink-soft">
                    <Star size={16} className="mt-[3px] shrink-0 text-brand-bright" />
                    <span>
                      We'd put {first} on {advice.noun}: {advice.reason.charAt(0).toLowerCase() + advice.reason.slice(1)}.
                    </span>
                  </span>
                )}
                {!ready && (
                  <Card className="flex flex-col gap-2 bg-brand/12 px-5 py-[18px]">
                    <span className="text-[15.5px] font-semibold">How tall is {first}? Then the bikes appear.</span>
                    <span className="text-[14px] leading-[1.5] text-ink-soft">
                      Slide or type the height above and we show the {fits.length} free bikes in frames that fit.
                      {me.bikeName && ` ${first} has the ${me.bikeName} from before — we check it fits as soon as the height is in.`}
                    </span>
                  </Card>
                )}
                {ready && <div className="grid gap-[14px] md:grid-cols-2">
                  {candidates.map((b, idx) => {
                    const gone = b.free <= 0;
                    const recommended = !gone && idx === 0 && b.ranged && !showAll;
                    return (
                      <div key={b.id} className={cx("overflow-hidden rounded-card bg-card", b.mine && "shadow-[inset_0_0_0_2px_#0A78D6]", gone && "bg-white/3")}>
                        <div className="flex">
                          <div className={cx("h-[108px] w-[130px] shrink-0 overflow-hidden", gone ? "opacity-40" : "bg-brand/18")}>
                            <BikeImage bike={b} />
                          </div>
                          <div className="flex min-w-0 flex-col justify-center gap-[5px] px-[15px] py-[13px]">
                            {recommended && <Tag className="self-start">Recommended</Tag>}
                            <span className={cx("text-[16px] font-semibold leading-[1.22]", gone && "text-ink-dim")}>{b.name}</span>
                            <span className={cx("text-[13px]", gone ? "text-ink-dim" : "text-ink-mute")}>
                              {[b.sizeLabel ? `Size ${b.sizeLabel}` : null, b.category === "ebike" ? "motor" : "no motor"].filter(Boolean).join(" · ")}
                              {!gone && <Availability free={b.free} className="ml-2" />}
                            </span>
                            {gone ? <span className="text-[12.5px] text-danger">All out on your dates</span> : b.mine ? <span className="text-[12.5px] font-semibold text-ok">{first}'s bike</span> : riderRange(b) && <span className="text-[12.5px] text-ink-mute">{riderRange(b)}</span>}
                          </div>
                        </div>
                        <div className={cx("flex items-center justify-between px-[15px] py-3", !gone && "bg-white/4")}>
                          {gone ? (
                            <span className="text-[13px] text-ink-dim">{tour ? "None left that day" : "Try other dates"}</span>
                          ) : tour ? (
                            <span className="text-[14px] font-semibold text-ok">Included in the tour</span>
                          ) : (
                            <Price minor={b.rateMinor} per={b.perDay ? "/day" : "period"} size="sm" />
                          )}
                          {!gone && (
                            <Form method="post" action={here}>
                              <input type="hidden" name="intent" value={b.mine ? "unassign" : "give"} />
                              <input type="hidden" name="r" value={current} />
                              <input type="hidden" name="bike" value={b.id} />
                              <button
                                disabled={!ready && !b.mine}
                                title={!ready && !b.mine ? "Add a height first" : undefined}
                                className={cx("rounded-full px-[18px] py-[9px] text-[14px] font-bold", b.mine ? "bg-ok text-ok-ink hover:bg-ok/90" : ready ? "bg-white text-night hover:bg-ink-pale" : "cursor-not-allowed bg-white/7 text-ink-dim")}
                              >
                                {b.mine ? "Chosen ✓" : `Give to ${first}`}
                              </button>
                            </Form>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>}
                {ready && candidates.length === 0 && (
                  <Card className="p-6 text-[15px] text-ink-soft">
                    {category ? `No ${CATEGORY_LABEL[category].toLowerCase()} fits ${me.heightCm} cm on these dates — tap another type above, or "Show other sizes"; we can often adjust a frame.` : `Nothing in the fleet fits ${me.heightCm} cm on these dates. Try "Show other sizes" — we can often adjust a frame.`}
                  </Card>
                )}
              </div>
            </>
          ) : (
            <>
              {/* the bike this is for, and the way back to change it */}
              <div className="flex flex-wrap items-center gap-2 px-[2px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-ok/12 px-[15px] py-[9px] text-[13.5px] font-semibold text-ok">
                  <Check size={14} strokeWidth={3.2} /> Bike · {me.bikeName}
                  {me.bikeSize && `, ${me.bikeSize}`}
                  <Link to={tripHref("/riders", trip, { r: current + 1, step: "bike" })} className="ml-1 text-[13px] text-brand-bright hover:text-ink">
                    Change
                  </Link>
                </span>
              </div>

              {copyFrom && (
                <Card className="flex flex-col gap-3 bg-brand/12 px-[18px] py-[15px] sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="text-[15.5px] font-semibold">Same as {copyFrom.label}?</span>
                    <span className="num text-[13.5px] text-ink-soft">
                      {copyFrom.items.join(", ")} — {formatDKKCode(copyFrom.totalMinor)}, one tap.
                    </span>
                  </div>
                  <Form method="post" action={here} preventScrollReset>
                    <input type="hidden" name="intent" value="copy" />
                    <input type="hidden" name="r" value={current} />
                    <input type="hidden" name="step" value="extras" />
                    <input type="hidden" name="from" value={copyFrom.r} />
                    <button className="shrink-0 rounded-full bg-white/10 px-[18px] py-[10px] text-[14px] font-semibold hover:bg-white/14">Copy {copyFrom.label}'s extras</button>
                  </Form>
                </Card>
              )}

              {/* the helmet, by name, before anything else */}
              {helmet && !tour && (
                <Card className={cx("flex flex-col gap-4 p-[22px]", helmet.qty > 0 ? "shadow-[inset_0_0_0_1.5px_rgba(46,212,122,.55)]" : me.helmetDeclined ? "shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.14)]" : "bg-[linear-gradient(rgba(255,176,32,.07),rgba(255,176,32,.07))] shadow-[inset_0_0_0_1.5px_rgba(255,176,32,.55)]")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-4">
                      {helmet.image && (
                        <span className="relative hidden h-[64px] w-[88px] shrink-0 overflow-hidden rounded-plaque bg-white p-1 sm:block">
                          <img src={imageSrc(helmet.image) ?? undefined} alt="" className="absolute inset-0 size-full object-scale-down p-[inherit]" />
                        </span>
                      )}
                      <h2 className="text-[20px] font-semibold tracking-[-.014em]">Does {first} want a helmet?</h2>
                    </span>
                    {helmet.qty > 0 ? (
                      <span className="rounded-full bg-ok/16 px-3 py-[5px] text-[12px] font-bold tracking-[.04em] text-ok">HELMET ADDED</span>
                    ) : me.helmetDeclined ? (
                      <span className="rounded-full bg-white/10 px-3 py-[5px] text-[12px] font-bold tracking-[.04em] text-ink-soft">BRINGING THEIR OWN</span>
                    ) : (
                      <span className="rounded-full bg-warn/16 px-3 py-[5px] text-[12px] font-bold tracking-[.04em] text-warn">NOT INCLUDED WITH RENTALS</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                    <Form method="post" action={here} preventScrollReset>
                      <input type="hidden" name="intent" value="helmet" />
                      <input type="hidden" name="r" value={current} />
                      <input type="hidden" name="step" value="extras" />
                      <button name="value" value="yes" className={cx("flex w-full items-center gap-[13px] rounded-[16px] px-[17px] py-[15px] text-left", helmet.qty > 0 ? "bg-brand/18 shadow-[inset_0_0_0_2px_#0A78D6]" : "bg-white/5 hover:bg-white/8")}>
                        <Radio on={helmet.qty > 0} />
                        <span className="flex flex-col gap-[2px]">
                          <span className="text-[15.5px] font-semibold">Yes — add a helmet</span>
                          <span className="num text-[13px] text-ink-soft">{formatDKKCode(helmet.priceMinor)} for the whole rental · we size it at pickup</span>
                        </span>
                      </button>
                    </Form>
                    <Form method="post" action={here} preventScrollReset>
                      <input type="hidden" name="intent" value="helmet" />
                      <input type="hidden" name="r" value={current} />
                      <input type="hidden" name="step" value="extras" />
                      <button name="value" value="no" className={cx("flex w-full items-center gap-[13px] rounded-[16px] px-[17px] py-[15px] text-left", helmet.qty === 0 && me.helmetDeclined ? "bg-white/8 shadow-[inset_0_0_0_2px_rgba(255,255,255,.35)]" : "bg-white/5 hover:bg-white/8")}>
                        <Radio on={helmet.qty === 0 && me.helmetDeclined} />
                        <span className="flex flex-col gap-[2px]">
                          <span className="text-[15.5px] font-semibold">No — {first} brings their own</span>
                          <span className="text-[13px] text-ink-mute">Fine. Bring it to the shop, we check the fit.</span>
                        </span>
                      </button>
                    </Form>
                  </div>
                  <span className="text-[13.5px] leading-[1.5] text-warn-soft">Helmets are included on guided rides but not on rentals — which is why we ask every rider, by name, before checkout.</span>
                </Card>
              )}
              {tour && <span className="px-1 text-[14px] font-semibold text-ok">Helmets are included on every guided ride — nothing to add for {first}'s head.</span>}

              {/* what this bike takes */}
              <Card className="flex flex-col gap-[15px] p-[22px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[19px] font-semibold tracking-[-.012em]">Anything for the {me.bikeModel ?? me.bikeName}?</h2>
                  <span className="text-[13.5px] text-ink-mute">Only what fits this bike · prices for the whole rental</span>
                </div>
                {rest.length > 0 ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] md:grid-cols-2">
                    {rest.map((a) => (
                      <AddonCard key={a.id} addon={a} action={here} intent="raddon" hidden={{ r: current, step: "extras" }} forLabel={first} max={MAX_PER_RIDER} />
                    ))}
                  </div>
                ) : (
                  <span className="text-[14px] text-ink-mute">Nothing extra fits this one — it comes complete.</span>
                )}
                <span className="text-[13.5px] leading-[1.5] text-ink-mute">
                  Flat pedals are on the bike already. Child seats and pedals for your own bike are on the{" "}
                  <Link to={tripHref("/bikes", trip, { cat: "extra" })} className="font-semibold text-brand-bright hover:text-ink">
                    extras list
                  </Link>
                  .
                </span>
              </Card>

              {/* for the whole booking: asked once, after the last rider */}
              {isLast && forEveryone.length > 0 ? (
                <Card className="px-[22px] py-5">
                  <AddonsPanel addons={forEveryone} action={here} riders={riders.length} heading={riders.length > 1 ? `And for the ${riders.length === 2 ? "two" : riders.length} of you?` : "And for the booking?"} hidden={hidden} />
                  <span className="mt-3 block text-[13.5px] text-ink-mute">Asked once, not per rider. Driving to the start of a ride? A carrier takes the bikes on the car. Leave the big luggage with us and ride light.</span>
                </Card>
              ) : (
                !isLast && (
                  <span className="flex gap-[11px] px-1 text-[14px] leading-[1.55] text-ink-soft">
                    <Info size={17} className="mt-[2px] shrink-0 text-brand-bright" />
                    <span>A bike carrier for the car, or bag storage while you ride, is for the whole booking, not one rider — we ask once, after {riders[riders.length - 1]!.label}'s extras.</span>
                  </span>
                )
              )}
            </>
          )}
        </div>

        {/* summary */}
        <div className="flex flex-col gap-[14px] lg:sticky lg:top-6">
          <SummaryRail
            title={tour ? "Your tour" : riders.length === 1 ? "Your bike" : `Your ${riders.length === 2 ? "two" : riders.length} bikes`}
            days={days}
            riders={riders.map((r) => ({
              label: r.label,
              heightCm: r.heightCm ?? undefined,
              bikeName: r.bikeName,
              included: Boolean(tour),
              detail: tour ? (r.bikeName ? "Bike and helmet" : null) : r.bikeName && r.rateMinor != null ? (r.perDay ? `${days} × ${formatDKKCode(r.rateMinor)}` : formatDKKCode(r.rateMinor)) : null,
              totalMinor: r.totalMinor,
              extras: r.extras,
            }))}
            lines={[...(seatLine ? [{ label: `${seatLine.qty} × ${formatDKKCode(seatLine.unitPriceMinor)} · ${seatLine.label}`, totalMinor: seatLine.lineTotalMinor }] : []), ...extras.map((e) => ({ label: `${e.name} ×${e.qty}`, totalMinor: e.totalMinor })), ...bookingLines, ...fees]}
            totalMinor={totalMinor}
            totalNote={allDone ? "Priced on our server, not your browser" : step === "extras" ? `${first} now${after ? ` · ${after.label} next` : " · checkout next"}` : me.bikeName ? "Bike chosen · extras next" : `${riders.filter((r) => !r.bikeName).length === 1 ? "One bike" : `${riders.filter((r) => !r.bikeName).length} bikes`} still to pick`}
            footer={
              <span>
                {tour ? "Meet" : "Collect"} at {SHOP.address}, {fmtLongDay(trip.startAt)} {fmtTime(trip.startAt)}. Ten minutes to fit {riders.length === 1 ? "the bike" : "the bikes"}.
              </span>
            }
          >
            {step === "extras" ? (
              <Form method="post" action={here} className="flex flex-col gap-3">
                <input type="hidden" name="intent" value="done" />
                <input type="hidden" name="r" value={current} />
                <input type="hidden" name="step" value="extras" />
                {helmetOffered && !helmetAnswered ? (
                  <span className="rounded-full bg-white/7 px-4 py-[15px] text-center text-[15.5px] font-bold text-ink-dim">Helmet: yes or no, then continue</span>
                ) : (
                  <button className="w-full rounded-full bg-white px-4 py-[15px] text-[15.5px] font-bold text-night hover:bg-ink-pale">
                    {after ? `Done — now ${after.label}'s ${after.step === "bike" ? "bike" : "extras"} →` : "Continue to checkout"}
                  </button>
                )}
                {me.summary.length === 0 && (!helmetOffered || helmetAnswered) && <button className="text-[13.5px] font-semibold text-brand-bright hover:text-ink">{first} needs nothing else</button>}
              </Form>
            ) : me.bikeName && ready ? (
              <PillLink to={tripHref("/riders", trip, { r: current + 1, step: "extras" })} tone="primary" size="lg" block>
                Next: {first}'s extras →
              </PillLink>
            ) : (
              <span className="rounded-full bg-white/7 px-4 py-[15px] text-center text-[15.5px] font-bold text-ink-dim">{!ready ? `${first}'s height to continue` : `Pick ${first}'s bike to continue`}</span>
            )}
            {step === "bike" && <span className="text-center text-[13px] leading-[1.5] text-ink-mute">One rider at a time — a bike, then the extras that fit it, then the next rider.</span>}
          </SummaryRail>
          <span className="px-1 text-[13px] text-ink-mute">
            {fmtDays(days)} · prefer to browse everything?{" "}
            <Link to={tripHref("/bikes", trip)} className="font-semibold text-brand-bright hover:text-ink">
              All bikes
            </Link>
            {allDone && (
              <>
                {" · "}
                <Link to={tripHref("/checkout", trip)} className="font-semibold text-brand-bright hover:text-ink">
                  Checkout
                </Link>
              </>
            )}
          </span>
        </div>
      </Shell>

      <Footer />
    </>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={cx("flex size-[21px] shrink-0 items-center justify-center rounded-full border-2", on ? "border-brand" : "border-ink-dim")}>
      {on && <span className="size-[10px] rounded-full bg-brand" />}
    </span>
  );
}

/**
 * Who the rider is and how tall. No Save button: the form posts itself a
 * moment after the slider settles or the name loses focus, and the list
 * below narrows in place. Without JavaScript the same form posts on Enter.
 */
function RiderForm({ here, current, name, heightCm }: { here: string; current: number; name?: string; heightCm: number | null }) {
  const fetcher = useFetcher();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only post what changed: a blur after a save must not post again, because a
  // stale rider save racing a "Give to rider" click would overwrite the basket.
  const sent = useRef(`${name ?? ""}|${heightCm ?? ""}`);
  const submit = (delayMs = 0) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!form.current) return;
      const fd = new FormData(form.current);
      const key = `${String(fd.get("name") ?? "").trim()}|${String(fd.get("heightCm") ?? "")}`;
      if (key === sent.current) return;
      sent.current = key;
      fetcher.submit(form.current);
    }, delayMs);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const busy = fetcher.state !== "idle";
  return (
    <fetcher.Form ref={form} method="post" action={here} className="flex flex-col gap-[17px]">
      <input type="hidden" name="intent" value="rider" />
      <input type="hidden" name="r" value={current} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[19px] font-semibold tracking-[-.012em]">{name ? `How tall is ${name}?` : `Who is rider ${current + 1}, and how tall?`}</h2>
        <span className={cx("text-[14px] text-ink-mute transition-opacity", busy && "opacity-60")}>{busy ? "Updating the list…" : "The height picks the frame"}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[7px]">
          <Lbl>Name (optional)</Lbl>
          <input
            name="name"
            defaultValue={name}
            placeholder={`Rider ${current + 1}`}
            autoComplete="off"
            onBlur={() => submit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="rounded-field bg-white/10 px-[15px] py-[12px] text-[15.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright"
          />
        </label>
        <HeightField value={heightCm} onChange={submit} />
        <noscript>
          <button className="rounded-full bg-white/12 px-6 py-[12px] text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] hover:bg-white/16">Save</button>
        </noscript>
      </div>
    </fetcher.Form>
  );
}

/**
 * The height picker from the canvas: a slider for the thumb, a number box for
 * the keyboard, one value between them. The number box is what the form posts.
 * `onChange(delayMs)` asks the form to post once the value has settled.
 */
function HeightField({ value, onChange }: { value: number | null; onChange: (delayMs?: number) => void }) {
  const [cm, setCm] = useState<number | "">(value ?? "");
  const shown = typeof cm === "number" ? Math.min(205, Math.max(140, cm)) : 172;
  return (
    <div className="flex flex-col gap-[7px] sm:col-span-2">
      <Lbl>Height</Lbl>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center">
        <div className="flex flex-col gap-[6px] px-1 pt-2">
          <input
            type="range"
            min={140}
            max={205}
            step={1}
            value={shown}
            onChange={(e) => {
              setCm(Number(e.target.value));
              onChange(450);
            }}
            // A tap on the thumb without a drag fires no change; take the value it is resting on.
            onPointerUp={(e) => {
              if (typeof cm !== "number") {
                setCm(Number(e.currentTarget.value));
                onChange(0);
              }
            }}
            aria-label="Height in centimetres"
            className="h-2 w-full cursor-pointer accent-brand"
          />
          <div className="num flex items-baseline justify-between text-[12.5px] text-ink-mute">
            <span>140 cm</span>
            <span className={cx("text-[15px] font-bold", typeof cm === "number" ? "text-ink" : "text-ink-mute")}>{typeof cm === "number" ? `${cm} cm` : "slide or type"}</span>
            <span>205 cm</span>
          </div>
        </div>
        <div className="flex items-center rounded-field bg-white/10 px-[15px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] focus-within:outline-2 focus-within:outline-brand-bright">
          <input
            name="heightCm"
            type="number"
            min={80}
            max={230}
            value={cm}
            onChange={(e) => {
              setCm(e.target.value === "" ? "" : Number(e.target.value));
              onChange(700);
            }}
            onBlur={() => onChange()}
            placeholder="175"
            className="num w-full bg-transparent py-[12px] text-[15.5px] placeholder:text-ink-mute focus:outline-none"
          />
          <span className="text-[14px] text-ink-mute">cm</span>
        </div>
      </div>
    </div>
  );
}
