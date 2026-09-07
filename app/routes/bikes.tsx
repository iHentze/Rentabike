import { Form, redirect } from "react-router";
import type { Route } from "./+types/bikes";
import { cloudflareContext } from "~/context";
import { Footer, Header, Shell, TripStrip } from "~/components/site";
import { Card, Lbl, PillLink, cx } from "~/components/ui";
import { BikeCard } from "~/components/bike-card";
import { tripHref, tripParams } from "~/lib/trip";
import { resolveTrip } from "~/lib/tour-trip";
import { applyIntent, basketHeaders, nextRiderWithoutBike, readBasket, ridersOn } from "~/lib/basket";
import { CATEGORY_LABEL, CATEGORY_ORDER, fitsRider, listBikes } from "~/lib/catalogue/bikes";
import type { BikeCategory } from "~/db/schema";
import { fmtDays } from "~/lib/format";
import { tripDays } from "~/lib/trip";
import { Amount } from "~/components/ui";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Rent a bike — Rent a Bike & Outdoor, Tórshavn" }];
}

const CATS = new Set<string>(CATEGORY_ORDER);

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip, tour } = await resolveTrip(env.DB, url.searchParams);
  const [all, basket] = await Promise.all([listBikes(env.DB, trip), readBasket(request, trip)]);
  const bikes = tour ? all.filter((b) => tour.allowedBikeTypeIds.includes(b.id) || b.category === "extra") : all;

  const cats = url.searchParams.getAll("cat").filter((c) => CATS.has(c)) as BikeCategory[];
  const heightRaw = Number.parseInt(url.searchParams.get("height") ?? "", 10);
  const height = Number.isFinite(heightRaw) && heightRaw >= 100 && heightRaw <= 220 ? heightRaw : null;

  const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<BikeCategory, number>;
  for (const b of bikes) if (b.free > 0) counts[b.category]++;

  let shown = bikes.filter((b) => (cats.length === 0 || cats.includes(b.category)) && fitsRider(b, height));
  // Bikes before extras, free before sold out, then cheapest — the sold-out ones stay visible, at the end.
  shown = shown.sort(
    (a, b) =>
      Number(a.category === "extra") - Number(b.category === "extra") ||
      Number(b.free > 0) - Number(a.free > 0) ||
      a.rateMinor - b.rateMinor ||
      a.name.localeCompare(b.name),
  );

  const chosen = basket.riders.map((r, i) => ({ i, bike: r.bikeTypeId ? bikes.find((b) => b.id === r.bikeTypeId) ?? null : null }));
  const extras = Object.entries(basket.extras).map(([id, qty]) => ({ bike: bikes.find((b) => b.id === id) ?? null, qty }));
  const soFar = chosen.reduce((n, c) => n + (c.bike?.tripMinor ?? 0), 0) + extras.reduce((n, e) => n + (e.bike ? e.bike.tripMinor * e.qty : 0), 0);

  return {
    here: url.pathname + url.search,
    tour: tour ? { title: tour.title, slug: tour.slug } : null,
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, tourDepartureId: trip.tourDepartureId },
    days: tripDays(trip),
    bikes: shown,
    freeTotal: bikes.filter((b) => b.category !== "extra").reduce((n, b) => n + b.free, 0),
    counts,
    cats,
    height,
    inBasket: Object.fromEntries(bikes.map((b) => [b.id, b.category === "extra" ? (basket.extras[b.id] ?? 0) : ridersOn(basket, b.id)])),
    chosen: chosen.map((c) => ({ i: c.i, name: c.bike?.name ?? null, tripMinor: c.bike?.tripMinor ?? 0 })),
    extras: extras.filter((e) => e.bike).map((e) => ({ name: e.bike!.name, qty: e.qty })),
    nextRider: nextRiderWithoutBike(basket),
    soFar,
  };
}

/** Add / remove a bike. Riders' bikes fill the first empty seat; extras just count. */
export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip } = await resolveTrip(env.DB, url.searchParams);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const bikeId = String(form.get("bike") ?? "");
  const basket = await readBasket(request, trip);

  const bike = (await listBikes(env.DB, trip)).find((b) => b.id === bikeId);
  if (bike) applyIntent(basket, bike, intent);
  return redirect(url.pathname + url.search, { headers: await basketHeaders(basket) });
}

export default function Bikes({ loaderData }: Route.ComponentProps) {
  const { here, tour, trip: t, days, bikes, freeTotal, counts, cats, height, inBasket, chosen, extras, nextRider, soFar } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, tourDepartureId: t.tourDepartureId };
  const params = tripParams(trip);
  const allAssigned = nextRider < 0;
  const anyChosen = chosen.some((c) => c.name) || extras.length > 0;

  return (
    <>
      <Header />
      <TripStrip trip={trip} tour={tour} />

      <Shell className="grid gap-7 px-5 pb-10 pt-[26px] md:grid-cols-[226px_minmax(0,1fr)] md:px-8">
        {/* filters */}
        <Form method="get" action="/bikes" className="flex flex-col gap-[22px] self-start rounded-card bg-card p-[18px]">
          {[...params.entries()].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex flex-col gap-3">
            <Lbl>Category</Lbl>
            <div className="flex flex-col gap-[11px]">
              {CATEGORY_ORDER.map((c) => {
                const on = cats.includes(c);
                return (
                  <label key={c} className="flex cursor-pointer items-center gap-[11px]">
                    <input type="checkbox" name="cat" value={c} defaultChecked={on} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="peer sr-only" />
                    <span className={cx("flex size-[18px] items-center justify-center rounded-[5px]", on ? "bg-brand" : "shadow-[inset_0_0_0_1.5px_#2C3A46]")}>
                      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>}
                    </span>
                    <span className={cx("text-[14.5px]", on ? "font-semibold" : "text-ink-soft")}>{CATEGORY_LABEL[c]}</span>
                    <span className="num ml-auto text-[13px] text-ink-mute">{counts[c]}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/6 pt-5">
            <Lbl>Rider height</Lbl>
            <div className="flex items-center gap-2">
              <input type="number" name="height" min={100} max={220} placeholder="cm" defaultValue={height ?? ""} className="num w-full rounded-field bg-white/7 px-[13px] py-[9px] text-[15px] focus:outline-2 focus:outline-brand-bright" />
              <button className="rounded-full bg-white/9 px-4 py-[9px] text-[13.5px] font-semibold hover:bg-white/14">Fit</button>
            </div>
            <span className="text-[12.5px] leading-[1.5] text-ink-mute">Every frame lists the rider height it suits. Between two sizes, take the smaller.</span>
          </div>
          <div className="flex flex-col gap-2 border-t border-white/6 pt-5">
            <Lbl>Per day</Lbl>
            <span className="num text-[13px] text-ink-mute">DKK {Math.min(...bikes.map((b) => b.rateMinor / 100), 0) || 0}–{Math.max(...bikes.map((b) => (b.perDay ? b.rateMinor / 100 : 0)), 0)}</span>
          </div>
        </Form>

        {/* results */}
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-display text-[28px] font-bold tracking-[-.022em]">
              {tour ? `${freeTotal} bikes free for ${tour.title}` : `${freeTotal} bikes free on your dates`}
            </h1>
            <span className="text-[14.5px] text-ink-mute">Sorted by price · {fmtDays(days)}</span>
          </div>
          {bikes.length === 0 ? (
            <Card className="p-8 text-[15px] text-ink-soft">Nothing matches those filters. Clear a category or the height and try again.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {bikes.map((b) => (
                <BikeCard key={b.id} bike={b} inBasket={inBasket[b.id] ?? 0} href={tripHref(`/bikes/${b.slug}`, trip)} action={here} disabled={b.category !== "extra" && allAssigned && !(inBasket[b.id] ?? 0)} />
              ))}
            </div>
          )}
        </div>
      </Shell>

      {/* cart bar */}
      <div className="sticky bottom-0 border-t border-white/6 bg-header">
        <Shell className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-[14px]">
            <div className={cx("flex size-[38px] items-center justify-center rounded-full", anyChosen ? "bg-brand" : "bg-white/8")}>
              <span className="num text-[15px] font-bold">{chosen.filter((c) => c.name).length}</span>
            </div>
            <div className="flex flex-col gap-[1px]">
              {anyChosen ? (
                <>
                  <span className="text-[15px] font-semibold">
                    {[...chosen.filter((c) => c.name).map((c) => c.name), ...extras.map((e) => `${e.qty} × ${e.name}`)].join(" · ")}
                  </span>
                  <span className="num text-[13px] text-ink-mute">
                    {fmtDays(days)} · DKK <Amount minor={soFar} className="font-normal" />
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[15px] font-semibold">Nothing chosen yet</span>
                  <span className="text-[13px] text-ink-mute">Add a bike for each rider, or answer two questions and we'll suggest one.</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5">
            {!allAssigned && <span className="text-[14px] text-warn">Rider {nextRider + 1} still needs a bike</span>}
            {anyChosen ? (
              <PillLink to={tripHref(allAssigned ? "/checkout" : "/riders", trip)} tone="primary" size="md" className="px-7 py-[14px] text-[15.5px]">
                {allAssigned ? "Continue to checkout" : "Sort out the riders"}
              </PillLink>
            ) : (
              <PillLink to={tripHref("/choose", trip)} tone="ghost" size="md">
                Help me choose
              </PillLink>
            )}
          </div>
        </Shell>
      </div>

      <Footer />
    </>
  );
}

