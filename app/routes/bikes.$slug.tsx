import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/bikes.$slug";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell, TripStrip } from "~/components/site";
import { Amount, Card, PillLink, Price, Tag, cx } from "~/components/ui";
import { Availability, BikeImage, riderRange } from "~/components/bike-card";
import { Check, Chevron } from "~/components/icons";
import { samePage, tripDays, tripHref } from "~/lib/trip";
import { resolveTrip } from "~/lib/tour-trip";
import { applyIntent, basketHeaders, nextRiderWithoutBike, readBasket, ridersOn } from "~/lib/basket";
import { ADDON_UNIT_LABEL, CATEGORY_LABEL, getAddonsById, getBike } from "~/lib/catalogue/bikes";
import { fmtDays } from "~/lib/format";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.bike.name} — Rent a Bike & Outdoor` : "Bike — Rent a Bike & Outdoor" }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip, tour } = await resolveTrip(env.DB, url.searchParams);
  const bike = await getBike(env.DB, params.slug, trip);
  if (!bike) throw new Response("Not found", { status: 404 });
  const [addons, basket] = await Promise.all([getAddonsById(env.DB, bike.addonIds), readBasket(request, trip)]);
  return {
    tour: tour ? { title: tour.title, slug: tour.slug } : null,
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, tourDepartureId: trip.tourDepartureId },
    days: tripDays(trip),
    bike,
    addons: [...addons.values()],
    inBasket: bike.category === "extra" ? (basket.extras[bike.id] ?? 0) : ridersOn(basket, bike.id),
    nextRider: nextRiderWithoutBike(basket),
  };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const { trip } = await resolveTrip(env.DB, url.searchParams);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const [bike, basket] = await Promise.all([getBike(env.DB, params.slug, trip), readBasket(request, trip)]);
  if (bike) applyIntent(basket, bike, intent);
  const next = String(form.get("next") ?? "");
  return redirect(next || samePage(url), { headers: await basketHeaders(basket) });
}

export default function BikeDetail({ loaderData }: Route.ComponentProps) {
  const { tour, trip: t, days, bike, addons, inBasket, nextRider } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, tourDepartureId: t.tourDepartureId };
  const isExtra = bike.category === "extra";
  const canAdd = bike.free > 0 && (isExtra ? inBasket < bike.free : nextRider >= 0 && inBasket < bike.free);
  const here = tripHref(`/bikes/${bike.slug}`, trip);

  return (
    <>
      <Header />
      <TripStrip trip={trip} tour={tour} />

      <Shell className="px-5 pb-12 pt-[26px] md:px-8">
        <Link to={tripHref("/bikes", trip)} className="inline-flex items-center gap-1 text-[14px] font-semibold text-brand-bright hover:text-ink">
          <Chevron size={15} className="rotate-180" /> All bikes
        </Link>

        <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="flex flex-col gap-7">
            <Card className="overflow-hidden">
              <div className="relative h-[280px] bg-white/5 md:h-[380px]">
                <BikeImage bike={bike} className="object-contain p-6" />
                <Tag tone="dark" className="absolute left-4 top-4">
                  {CATEGORY_LABEL[bike.category]}
                </Tag>
              </div>
            </Card>

            <div className="flex flex-col gap-3">
              <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-[-.026em] md:text-[44px]">{bike.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px] text-ink-mute">
                {bike.model && <span>{bike.model}</span>}
                {riderRange(bike) && <span>{riderRange(bike)}</span>}
                <span className="num">{bike.stock} in the fleet</span>
              </div>
            </div>

            {bike.description && (
              <div className="flex flex-col gap-3">
                <h2 className="text-[22px] font-semibold tracking-[-.014em]">About this {isExtra ? "item" : "bike"}</h2>
                {bike.description.split(/\n+/).map((para, i) => (
                  <p key={i} className="max-w-[64ch] text-[16px] leading-[1.6] text-ink-pale">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* the rate ladder — the real one, per product */}
            <div className="flex flex-col gap-3">
              <h2 className="text-[22px] font-semibold tracking-[-.014em]">What it costs</h2>
              <Card className="px-2 py-[6px]">
                {bike.tiers.map((tier, i) => {
                  const active = tier.priceMinor === bike.rateMinor && tier.perDay === bike.perDay && days >= tier.minDays && Math.ceil(days) <= tier.maxDays;
                  return (
                    <div key={i}>
                      {i > 0 && <div className="hairline mx-[14px]" />}
                      <div className={cx("flex items-center justify-between px-[14px] py-[13px]", active && "rounded-field bg-brand/14")}>
                        <span className={cx("num text-[15px]", active ? "font-semibold" : "text-ink-soft")}>
                          {tier.minDays === tier.maxDays ? `${tier.minDays} day` : `${tier.minDays}–${tier.maxDays} days`}
                          {active && <span className="ml-2 text-[12.5px] font-semibold text-brand-bright">your dates</span>}
                        </span>
                        <span className="num text-[15px] font-semibold">
                          DKK <Amount minor={tier.priceMinor} /> <span className="text-[12.5px] font-normal text-ink-mute">{tier.perDay ? "/ day" : "for the period"}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
              <span className="text-[13px] text-ink-mute">The same rate applies to every day of the rental — an 8-day booking is 8 × the 7–13 day rate. Half days count as half.</span>
            </div>

            {addons.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-[22px] font-semibold tracking-[-.014em]">Goes with it</h2>
                <Card className="px-2 py-[6px]">
                  {addons.map((a, i) => (
                    <div key={a.id}>
                      {i > 0 && <div className="hairline mx-[14px]" />}
                      <div className="flex items-center justify-between gap-4 px-[14px] py-[12px]">
                        <span className="text-[15px]">
                          {a.name}
                          {a.isSale && <span className="ml-2 text-[12px] font-semibold uppercase tracking-[.05em] text-ink-mute">to keep</span>}
                        </span>
                        <span className="num shrink-0 text-[14px] text-ink-soft">
                          DKK <Amount minor={a.priceMinor} /> <span className="text-[12.5px] text-ink-mute">{ADDON_UNIT_LABEL[a.unit]}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </Card>
                <span className="text-[13px] text-ink-mute">Pick these on the next step, per rider.</span>
              </div>
            )}
          </div>

          {/* booking rail */}
          <Card className="flex flex-col gap-[18px] p-5 lg:sticky lg:top-6">
            <div className="flex items-baseline justify-between">
              <Price minor={bike.rateMinor} per={bike.perDay ? "/ day" : "for the period"} size="xl" />
              <Availability free={bike.free} />
            </div>
            <div className="flex flex-col gap-2 border-t border-white/6 pt-4 text-[14.5px]">
              <div className="flex justify-between">
                <span className="text-ink-soft">Your dates</span>
                <span className="num font-semibold">{fmtDays(days)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">This {isExtra ? "item" : "bike"} for the trip</span>
                <span className="num font-semibold">
                  DKK <Amount minor={bike.tripMinor} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Collect at</span>
                <span className="font-semibold">{SHOP.address}</span>
              </div>
            </div>

            {inBasket > 0 && (
              <div className="flex items-center gap-2 rounded-field bg-ok/12 px-4 py-3 text-[14px] font-semibold text-ok">
                <Check size={15} /> {isExtra ? `${inBasket} in your basket` : inBasket === 1 ? "In your basket" : `${inBasket} riders on this bike`}
              </div>
            )}

            <Form method="post" action={here} className="flex flex-col gap-[10px]">
              <input type="hidden" name="next" value={tripHref("/bikes", trip)} />
              {canAdd ? (
                <button name="intent" value="add" className="w-full rounded-full bg-white px-6 py-[15px] text-[16px] font-bold text-night hover:bg-ink-pale">
                  {isExtra ? "Add to booking" : nextRider >= 0 ? `Add for rider ${nextRider + 1}` : "Add"}
                </button>
              ) : bike.free <= 0 ? (
                <PillLink to={tripHref("/", trip)} tone="ghost" block>
                  Try other dates
                </PillLink>
              ) : (
                <PillLink to={tripHref("/checkout", trip)} tone="primary" block>
                  Continue to checkout
                </PillLink>
              )}
              {inBasket > 0 && (
                <button name="intent" value="remove" className="text-[13.5px] font-semibold text-ink-mute hover:text-ink">
                  Remove one
                </button>
              )}
            </Form>
            <span className="text-center text-[13px] leading-[1.5] text-ink-mute">Nothing is charged yet. Bikes are held for you when you finish the booking.</span>
          </Card>
        </div>
      </Shell>

      <Footer />
    </>
  );
}

