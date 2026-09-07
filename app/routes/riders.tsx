import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/riders";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell, TripSummary } from "~/components/site";
import { Card, Lbl, PillLink, Price, Tag, cx } from "~/components/ui";
import { BikeImage, riderRange } from "~/components/bike-card";
import { SummaryRail } from "~/components/summary-rail";
import { Check, Info, Minus, Plus } from "~/components/icons";
import { readTrip, tripDays, tripHref, MAX_RIDERS } from "~/lib/trip";
import { basketHeaders, nextRiderWithoutBike, readBasket, riderLabel, ridersOn } from "~/lib/basket";
import { fitsRider, getAddonsById, listBikes, ridable } from "~/lib/catalogue/bikes";
import { priceBasket } from "~/lib/quote-basket";
import { fmtDays, fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export function meta(_: Route.MetaArgs) {
  return [{ title: "A bike for each rider — Rent a Bike & Outdoor" }];
}

const HELMET = "addon-helmet-for-rent";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const trip = readTrip(url.searchParams);
  const [bikes, basket] = await Promise.all([listBikes(env.DB, trip), readBasket(request, trip)]);
  const fleet = ridable(bikes);

  const rParam = Number.parseInt(url.searchParams.get("r") ?? "", 10);
  const firstOpen = nextRiderWithoutBike(basket);
  const current = Number.isFinite(rParam) && rParam >= 1 && rParam <= basket.riders.length ? rParam - 1 : firstOpen >= 0 ? firstOpen : 0;
  const rider = basket.riders[current]!;
  const showAll = url.searchParams.get("all") === "1";

  // Bikes for this rider: those that fit their height (or all, on request). Free ones first,
  // then frames whose stated range covers the rider, then frames that state no range at all.
  const hasRange = (b: { riderMinCm: number | null; riderMaxCm: number | null }) => b.riderMinCm != null && b.riderMaxCm != null;
  const candidates = fleet
    .filter((b) => showAll || fitsRider(b, rider.heightCm))
    .map((b) => ({ ...b, freeForRider: b.free - ridersOn(basket, b.id) + (rider.bikeTypeId === b.id ? 1 : 0), ranged: hasRange(b) && fitsRider(b, rider.heightCm) }))
    .sort(
      (a, b) =>
        Number(b.freeForRider > 0) - Number(a.freeForRider > 0) ||
        Number(b.ranged) - Number(a.ranged) ||
        a.rateMinor - b.rateMinor ||
        a.name.localeCompare(b.name),
    );

  // Add-ons offered: the union of the chosen bikes' allowlists, helmet first.
  const chosenBikes = basket.riders.map((r) => (r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) : undefined)).filter((b) => b !== undefined);
  const addonIds = new Set<string>(chosenBikes.flatMap((b) => b.addonIds));
  if (chosenBikes.length === 0) addonIds.add(HELMET);
  for (const id of Object.keys(basket.addons)) addonIds.add(id);
  const addons = [...(await getAddonsById(env.DB, [...addonIds])).values()].sort((a, b) => (a.id === HELMET ? -1 : b.id === HELMET ? 1 : a.priceMinor - b.priceMinor));

  const priced = await priceBasket(env.DB, trip, basket);
  const days = tripDays(trip);

  return {
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit },
    days,
    current,
    showAll,
    riders: basket.riders.map((r, i) => {
      const bike = r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) : undefined;
      return { label: riderLabel(basket, i), name: r.name ?? "", heightCm: r.heightCm ?? null, bikeName: bike?.name ?? null, bikeSize: bike?.sizeLabel ?? null, rateMinor: bike?.rateMinor ?? null, perDay: bike?.perDay ?? true, totalMinor: priced.riderTotals[i] ?? null };
    }),
    candidates: candidates.map((b) => ({ id: b.id, slug: b.slug, name: b.name, category: b.category, image: b.image, sizeLabel: b.sizeLabel, riderMinCm: b.riderMinCm, riderMaxCm: b.riderMaxCm, free: b.freeForRider, rateMinor: b.rateMinor, perDay: b.perDay, mine: rider.bikeTypeId === b.id, ranged: b.ranged })),
    addons: addons.map((a) => ({ id: a.id, name: a.name, priceMinor: a.priceMinor, unit: a.unit, qty: basket.addons[a.id] ?? 0 })),
    extras: Object.entries(basket.extras).map(([id, qty]) => ({ id, name: bikes.find((b) => b.id === id)?.name ?? id, qty, totalMinor: (bikes.find((b) => b.id === id)?.tripMinor ?? 0) * qty })),
    fees: priced.quote?.lines.filter((l) => l.kind === "fee").map((l) => ({ label: l.label, totalMinor: l.lineTotalMinor })) ?? [],
    addonLines: priced.quote?.lines.filter((l) => l.kind === "addon").map((l) => ({ label: `${l.label}${l.qty > 1 ? ` ×${l.qty}` : ""}`, totalMinor: l.lineTotalMinor })) ?? [],
    totalMinor: priced.quote?.totalMinor ?? 0,
    allAssigned: nextRiderWithoutBike(basket) < 0,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const trip = readTrip(url.searchParams);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const r = Number.parseInt(String(form.get("r") ?? ""), 10);
  const basket = await readBasket(request, trip);
  const rider = Number.isFinite(r) ? basket.riders[r] : undefined;
  let next = r;

  if (intent === "rider" && rider) {
    const name = String(form.get("name") ?? "").trim().slice(0, 60);
    const height = Number.parseInt(String(form.get("heightCm") ?? ""), 10);
    rider.name = name || undefined;
    rider.heightCm = Number.isFinite(height) && height >= 80 && height <= 230 ? height : undefined;
    // A new height can make the chosen bike a bad fit; drop it so the list re-decides.
    if (rider.bikeTypeId) {
      const bike = (await listBikes(env.DB, trip)).find((b) => b.id === rider.bikeTypeId);
      if (bike && !fitsRider(bike, rider.heightCm)) delete rider.bikeTypeId;
    }
  } else if (intent === "give" && rider) {
    const bikeId = String(form.get("bike") ?? "");
    const bike = (await listBikes(env.DB, trip)).find((b) => b.id === bikeId);
    if (bike && bike.category !== "extra") {
      const others = ridersOn(basket, bike.id) - (rider.bikeTypeId === bike.id ? 1 : 0);
      if (others < bike.free) rider.bikeTypeId = bike.id;
    }
    const open = nextRiderWithoutBike(basket);
    next = open >= 0 ? open : r;
  } else if (intent === "unassign" && rider) {
    delete rider.bikeTypeId;
  } else if (intent === "addon") {
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

  const back = new URLSearchParams(url.searchParams);
  if (Number.isFinite(next)) back.set("r", String(next + 1));
  return redirect(`/riders?${back}`, { headers: await basketHeaders(basket) });
}

export default function Riders({ loaderData }: Route.ComponentProps) {
  const { trip: t, days, current, showAll, riders, candidates, addons, extras, fees, addonLines, totalMinor, allAssigned } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit };
  const me = riders[current]!;
  const here = tripHref("/riders", trip, { r: current + 1, all: showAll ? 1 : undefined });
  const fits = candidates.filter((c) => c.free > 0);
  const helmets = addons.find((a) => a.id === HELMET);

  return (
    <>
      <Header variant="funnel" right={<TripSummary trip={trip} />} />

      {/* rider tabs */}
      <div className="border-t border-white/5 bg-header">
        <Shell className="flex items-stretch overflow-x-auto px-5 md:px-8">
          {riders.map((r, i) => {
            const active = i === current;
            const done = Boolean(r.bikeName);
            return (
              <Link key={i} to={tripHref("/riders", trip, { r: i + 1 })} className={cx("flex shrink-0 items-center gap-3 py-[15px] pr-[22px]", i > 0 && "pl-[22px]", active && "border-b-2 border-brand")}>
                <div className={cx("flex size-8 shrink-0 items-center justify-center rounded-full", done ? "bg-ok text-ok-ink" : active ? "border-2 border-brand text-brand-bright" : "border-2 border-ink-dim text-ink-dim")}>
                  {done ? <Check size={16} strokeWidth={3} /> : <span className="text-[13.5px] font-bold">{i + 1}</span>}
                </div>
                <div className="flex flex-col gap-[1px]">
                  <span className="text-[14.5px] font-semibold">
                    Rider {i + 1}
                    {r.name && ` · ${r.name}`}
                  </span>
                  <span className={cx("text-[12.5px]", done ? "text-ok" : "text-ink-mute")}>{done ? `${r.bikeName}${r.bikeSize ? ` · ${r.bikeSize}` : ""}` : active ? "Choosing now" : "Not chosen yet"}</span>
                </div>
              </Link>
            );
          })}
          {trip.riders < MAX_RIDERS && (
            <Link to={tripHref("/riders", trip, { riders: trip.riders + 1, r: trip.riders + 1 })} className="ml-auto flex shrink-0 items-center pl-6 text-[14px] font-semibold text-brand-bright hover:text-ink">
              + Add a rider
            </Link>
          )}
        </Shell>
      </div>

      <Shell className="grid gap-7 px-5 pb-12 pt-[26px] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start md:px-8">
        <div className="flex flex-col gap-5">
          {/* height */}
          <Card className="flex flex-col gap-[17px] p-[22px]">
            <Form method="post" action={here} className="flex flex-col gap-[17px]">
              <input type="hidden" name="intent" value="rider" />
              <input type="hidden" name="r" value={current} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[19px] font-semibold tracking-[-.012em]">{me.name ? `How tall is ${me.name}?` : `Who is rider ${current + 1}, and how tall?`}</h2>
                <span className="text-[14px] text-ink-mute">We'll pick the frame</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                <label className="flex flex-col gap-[7px]">
                  <Lbl>Name (optional)</Lbl>
                  <input name="name" defaultValue={me.name} placeholder={`Rider ${current + 1}`} className="rounded-field bg-white/7 px-[15px] py-[12px] text-[15.5px] placeholder:text-ink-dim focus:outline-2 focus:outline-brand-bright" />
                </label>
                <label className="flex flex-col gap-[7px]">
                  <Lbl>Height</Lbl>
                  <div className="flex items-center rounded-field bg-white/7 px-[15px] focus-within:outline-2 focus-within:outline-brand-bright">
                    <input name="heightCm" type="number" min={80} max={230} defaultValue={me.heightCm ?? ""} placeholder="175" className="num w-full bg-transparent py-[12px] text-[15.5px] placeholder:text-ink-dim focus:outline-none" />
                    <span className="text-[14px] text-ink-mute">cm</span>
                  </div>
                </label>
                <button className="self-end rounded-full bg-white/9 px-6 py-[12px] text-[15px] font-semibold hover:bg-white/14">Save</button>
              </div>
            </Form>
            <div className="flex gap-[11px] rounded-field bg-white/5 px-[15px] py-[13px]">
              <Info size={17} className="mt-[2px] shrink-0 text-brand-bright" />
              <span className="text-[14px] leading-[1.55] text-ink-soft">Between two sizes? Take the smaller one — you'll be more comfortable on the descents. We adjust the seat post at pickup either way, and you can swap the bike in the first hour if it's wrong.</span>
            </div>
          </Card>

          {/* bikes */}
          <div className="flex flex-col gap-[14px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[19px] font-semibold tracking-[-.012em]">
                {me.heightCm && !showAll ? `Free for ${me.heightCm} cm on your dates` : "Free on your dates"}
                <span className="ml-2 text-[14px] font-normal text-ink-mute">{fits.length} bikes</span>
              </h2>
              {me.heightCm && (
                <Link to={tripHref("/riders", trip, { r: current + 1, all: showAll ? undefined : 1 })} className="text-[14px] font-semibold text-brand-bright hover:text-ink">
                  {showAll ? "Only my size" : "Show other sizes"}
                </Link>
              )}
            </div>
            {!me.heightCm && <p className="-mt-2 text-[14px] text-ink-mute">Add a height above and we'll narrow this to the frames that fit.</p>}
            <div className="grid gap-[14px] md:grid-cols-2">
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
                          {[b.sizeLabel ? `Size ${b.sizeLabel}` : null, b.category === "ebike" ? "motor" : "no motor", gone ? null : `${b.free} free`].filter(Boolean).join(" · ")}
                        </span>
                        {gone ? <span className="text-[12.5px] text-danger">All out on your dates</span> : riderRange(b) && <span className="text-[12.5px] text-ink-mute">{riderRange(b)}</span>}
                      </div>
                    </div>
                    <div className={cx("flex items-center justify-between px-[15px] py-3", !gone && "bg-white/4")}>
                      {gone ? (
                        <span className="text-[13px] text-ink-dim">Try other dates</span>
                      ) : (
                        <Price minor={b.rateMinor} per={b.perDay ? "/day" : "period"} size="sm" />
                      )}
                      {!gone && (
                        <Form method="post" action={here}>
                          <input type="hidden" name="intent" value={b.mine ? "unassign" : "give"} />
                          <input type="hidden" name="r" value={current} />
                          <input type="hidden" name="bike" value={b.id} />
                          <button className={cx("rounded-full px-[18px] py-[9px] text-[14px] font-bold", b.mine ? "bg-white/10 text-ink hover:bg-white/14" : "bg-white text-night hover:bg-ink-pale")}>
                            {b.mine ? "Chosen — change" : `Give to ${me.name || `rider ${current + 1}`}`}
                          </button>
                        </Form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {candidates.length === 0 && <Card className="p-6 text-[15px] text-ink-soft">Nothing in the fleet fits {me.heightCm} cm on these dates. Try "Show other sizes" — we can often adjust a frame.</Card>}
          </div>

          {/* extras */}
          <Card className="flex flex-col gap-[15px] px-[22px] py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[19px] font-semibold tracking-[-.012em]">Anything else{riders.length > 1 ? ` for the ${riders.length} of you` : ""}?</h2>
              {helmets && <span className="num text-[13.5px] font-semibold text-ok">Helmet {formatDKKCode(helmets.priceMinor)} per bike</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {addons.map((a) => (
                <div key={a.id} className={cx("flex items-center gap-3 rounded-field px-[15px] py-[14px]", a.qty > 0 ? "bg-brand/18 shadow-[inset_0_0_0_1.5px_#0A78D6]" : "bg-white/5")}>
                  <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                    <span className="truncate text-[14.5px] font-semibold">{a.name}</span>
                    <span className={cx("num text-[12.5px]", a.qty > 0 ? "font-semibold text-brand-bright" : "text-ink-mute")}>
                      {formatDKKCode(a.priceMinor)} {a.unit === "per_booking" ? "per booking" : a.unit === "per_bike_per_day" ? "per bike per day" : "per bike"}
                      {a.qty > 0 && ` · ${a.qty} added`}
                    </span>
                  </div>
                  <Form method="post" action={here} className="flex shrink-0 items-center gap-1">
                    <input type="hidden" name="intent" value="addon" />
                    <input type="hidden" name="addon" value={a.id} />
                    <input type="hidden" name="r" value={current} />
                    <button name="delta" value="-1" aria-label={`Remove ${a.name}`} disabled={a.qty === 0} className="flex size-8 items-center justify-center rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30">
                      <Minus size={13} />
                    </button>
                    <button name="delta" value="1" aria-label={`Add ${a.name}`} disabled={a.unit === "per_booking" && a.qty > 0} className="flex size-8 items-center justify-center rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30">
                      <Plus size={13} />
                    </button>
                  </Form>
                </div>
              ))}
            </div>
            <span className="text-[13px] text-ink-mute">
              Child seats, trailers and pedals for your own bike are on the{" "}
              <Link to={tripHref("/bikes", trip, { cat: "extra" })} className="font-semibold text-brand-bright hover:text-ink">
                extras list
              </Link>
              .
            </span>
          </Card>
        </div>

        {/* summary */}
        <div className="flex flex-col gap-[14px] lg:sticky lg:top-6">
          <SummaryRail
            title={riders.length === 1 ? "Your bike" : `Your ${riders.length === 2 ? "two" : riders.length} bikes`}
            days={days}
            riders={riders.map((r) => ({ label: r.label, heightCm: r.heightCm ?? undefined, bikeName: r.bikeName, detail: r.bikeName && r.rateMinor != null ? (r.perDay ? `${days} × ${formatDKKCode(r.rateMinor)}` : formatDKKCode(r.rateMinor)) : null, totalMinor: r.totalMinor }))}
            lines={[...extras.map((e) => ({ label: `${e.name} ×${e.qty}`, totalMinor: e.totalMinor })), ...addonLines, ...fees]}
            totalMinor={totalMinor}
            totalNote={allAssigned ? "Priced on our server, not your browser" : `${riders.filter((r) => !r.bikeName).length === 1 ? "One bike" : `${riders.filter((r) => !r.bikeName).length} bikes`} still to pick`}
            footer={
              <span>
                Collect at {SHOP.address}, {fmtLongDay(trip.startAt)} {fmtTime(trip.startAt)}. Ten minutes to fit {riders.length === 1 ? "the bike" : "the bikes"}.
              </span>
            }
          >
            {allAssigned ? (
              <PillLink to={tripHref("/checkout", trip)} tone="primary" size="lg" block>
                Continue to checkout
              </PillLink>
            ) : (
              <span className="rounded-full bg-white/7 px-4 py-[15px] text-center text-[15.5px] font-bold text-ink-dim">
                Pick {riders.find((r) => !r.bikeName)?.label ?? "a"}'s bike to continue
              </span>
            )}
          </SummaryRail>
          <span className="px-1 text-[13px] text-ink-mute">
            {fmtDays(days)} · prefer to browse everything?{" "}
            <Link to={tripHref("/bikes", trip)} className="font-semibold text-brand-bright hover:text-ink">
              All bikes
            </Link>
          </span>
        </div>
      </Shell>

      <Footer />
    </>
  );
}

