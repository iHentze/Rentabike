import { Link } from "react-router";
import type { Route } from "./+types/home";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, Lbl, PillLink, Price, Row, Tag, cx } from "~/components/ui";
import { Bag, Bolt, CardIcon, Chevron, Child, Gravel, Mountain, Pin, Road, Shield } from "~/components/icons";
import { OPENING_TIMES, readTrip, tripDays, tripHref, type Trip } from "~/lib/trip";
import { faroeParts, fmtDuration } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";
import { listBikes, ridable, summariseCategories } from "~/lib/catalogue/bikes";
import { listTours } from "~/lib/tours/catalogue";
import { listLocations } from "~/lib/booking/lookup";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Rent a Bike & Outdoor — Tórshavn, Faroe Islands" },
    { name: "description", content: "Road, gravel, mountain and electric bikes from Sverrisgøta 20 in Tórshavn, plus guided rides, hikes and trail runs every week." },
  ];
}

// The tours the home page leads with, in the order of their weekly slot.
const FEATURED = ["viewpoint-nordadalsskard", "city-sightseeing-ebike", "historical-kirkjubour", "adventure-mtb-light"];

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const trip = readTrip(new URL(request.url).searchParams);
  const [bikes, tours, locations] = await Promise.all([listBikes(env.DB, trip), listTours(env.DB), listLocations(env.DB)]);
  const fleet = ridable(bikes);
  const priced = fleet.filter((b) => b.free > 0);
  return {
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, pickupLocationId: trip.pickupLocationId, dropoffLocationId: trip.dropoffLocationId },
    locations: locations.map((l) => ({ id: l.id, name: l.name, pickupFeeMinor: l.pickupFeeMinor, dropoffFeeMinor: l.dropoffFeeMinor, isDefault: l.isDefault })),
    days: tripDays(trip),
    fleetUnits: fleet.reduce((n, b) => n + b.stock, 0),
    freeUnits: fleet.reduce((n, b) => n + b.free, 0),
    fromMinor: priced.length ? Math.min(...priced.map((b) => b.rateMinor)) : null,
    categories: summariseCategories(bikes),
    tours: FEATURED.map((slug) => tours.find((t) => t.slug === slug)).filter((t) => t !== undefined),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { trip: t, locations, days, fleetUnits, freeUnits, fromMinor, categories, tours } = loaderData;
  const trip: Trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, pickupLocationId: t.pickupLocationId, dropoffLocationId: t.dropoffLocationId };
  const defaultLoc = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "";
  const pickupId = t.pickupLocationId ?? defaultLoc;
  const dropoffId = t.dropoffLocationId ?? pickupId;
  const start = faroeParts(trip.startAt);
  const end = faroeParts(trip.endAt);

  return (
    <>
      <Header />

      {/* hero: real customers on real bikes */}
      <section className="relative overflow-hidden">
        <img
          src="/images/tour-nordadalsskard.jpg"
          alt="Guests riding to Norðadalsskarð past the wind turbines"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: "50% 62%" }}
          fetchPriority="high"
        />
        <div className="absolute inset-x-0 bottom-0 h-[78%] bg-[linear-gradient(180deg,rgba(7,14,21,0)_0%,rgba(7,14,21,.42)_34%,rgba(7,14,21,.90)_74%,#070E15_100%)]" />
        <Shell className="relative flex min-h-[560px] flex-col justify-between px-5 pb-[30px] pt-11 md:min-h-[620px] md:px-8">
          <div className="flex max-w-[660px] flex-col gap-[18px]">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-ground/50 px-4 py-2 text-[12.5px] font-bold tracking-[.08em]">
              <Pin size={14} strokeWidth={2.2} />
              TÓRSHAVN · SINCE 2015
            </span>
            <h1 className="font-display text-[44px] font-bold leading-[.98] tracking-[-.034em] [text-shadow:0_2px_30px_rgba(7,14,21,.55)] md:text-[68px]">
              Get a bike.
              <br />
              Go and see it properly.
            </h1>
            <p className="max-w-[520px] text-[18px] leading-[1.5] text-white/90 [text-shadow:0_1px_16px_rgba(7,14,21,.6)]">
              {fleetUnits} bikes in Tórshavn — road, gravel, mountain and electric. Out the door in ten minutes, from the shop on Sverrisgøta.
            </p>
          </div>

          {/* booking, in the hero, where it belongs */}
          <form method="get" action="/bikes" className="mt-10 flex flex-col gap-1 rounded-card bg-[rgba(11,20,28,.92)] p-2">
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_1fr_1fr_.5fr]">
            <LocationCell label="Pick up" name="pickup" value={pickupId} locations={locations} fee="pickup" first />
            <LocationCell label="Return to" name="dropoff" value={dropoffId} locations={locations} fee="dropoff" />
            <DateTimeCell label="From" dateName="from" timeName="fromTime" date={start.date} time={start.time} />
            <DateTimeCell label="Until" dateName="to" timeName="toTime" date={end.date} time={end.time} />
            <div className="flex flex-col gap-1 px-[18px] py-[14px] lg:border-l lg:border-white/7">
              <Lbl>Riders</Lbl>
              <select name="riders" defaultValue={trip.riders} className="num -ml-1 bg-transparent text-[16px] font-semibold focus:outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-card">
                    {n}
                  </option>
                ))}
              </select>
            </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-[18px] border-t border-white/7 px-[18px] py-[10px]">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-ok">
                  <span className={cx("size-2 rounded-full", freeUnits > 0 ? "bg-ok" : "bg-danger")} />
                  {freeUnits > 0 ? `${freeUnits} bikes free on those dates` : "Nothing free on those dates"}
                </span>
                <span className="num text-[13px] text-ink-soft">{fromMinor != null ? `from ${formatDKKCode(fromMinor)} / day` : `${days} days`}</span>
                {dropoffId !== pickupId && <span className="num text-[13px] text-warn">different return point · fee applies</span>}
              </div>
              <button type="submit" className="rounded-full bg-white px-7 py-[14px] text-[16px] font-bold whitespace-nowrap text-night hover:bg-ink-pale">
                Choose your bikes
              </button>
            </div>
          </form>
        </Shell>
      </section>

      <Shell className="flex flex-col gap-9 px-5 pb-11 pt-[34px] md:px-8">
        {/* the weekly rhythm — real tours, real days */}
        {tours.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-col gap-[6px]">
                <h2 className="font-display text-[30px] font-bold tracking-[-.022em]">Every week, rain or shine</h2>
                <p className="text-[15.5px] text-ink-soft">Guided rides on fixed days. Small groups, bike included, and we call you the evening before if the weather turns.</p>
              </div>
              <Link to="/tours" className="text-[14px] font-semibold text-brand-bright hover:text-ink">
                All rides ›
              </Link>
            </div>
            <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
              {tours.map((tour) => (
                <Link key={tour.id} to={`/tours/${tour.slug}`} className="group flex flex-col overflow-hidden rounded-card bg-card">
                  <div className="relative h-[150px]">
                    {tour.image && <img src={tour.image} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />}
                    {tour.weekday && <Tag className="absolute left-[11px] top-[11px] px-3 py-[5px] text-[11px] tracking-[.09em]">{tour.weekday}s</Tag>}
                  </div>
                  <div className="flex flex-1 flex-col gap-[9px] px-4 pb-[17px] pt-[15px]">
                    <span className="text-[17px] font-semibold leading-[1.22]">{tour.title}</span>
                    <span className="flex-1 text-[13.5px] leading-[1.45] text-ink-soft">{tour.summary}</span>
                    <div className="flex items-baseline justify-between pt-[3px]">
                      <Price minor={tour.priceMinor} size="sm" />
                      <span className="text-[13px] text-ink-mute">
                        {fmtDuration(tour.durationMin)}
                        {tour.nextSeatsLeft != null && ` · ${tour.nextSeatsLeft} left`}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* the fleet */}
        <section className="flex flex-col gap-[14px]">
          <div className="flex items-baseline justify-between">
            <Lbl>The fleet · {fleetUnits} bikes</Lbl>
            <Link to={tripHref("/bikes", trip)} className="text-[14px] font-semibold text-brand-bright hover:text-ink">
              {freeUnits} free on your days ›
            </Link>
          </div>
          <Card className="p-2">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <Link key={c.category} to={tripHref("/bikes", trip, { cat: c.category })} className="flex items-center gap-[14px] rounded-field px-4 py-[15px] hover:bg-white/4">
                  <div className={cx("flex size-[46px] shrink-0 items-center justify-center rounded-full", c.category === "road" ? "bg-white/7 text-ink-soft" : "bg-brand/22 text-brand-bright")}>
                    {c.category === "ebike" && <Bolt size={22} />}
                    {c.category === "mountain" && <Mountain size={22} />}
                    {c.category === "gravel" && <Gravel size={22} />}
                    {c.category === "road" && <Road size={22} />}
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[15.5px] font-semibold">{c.label}</span>
                    <span className="num text-[13px] text-ink-mute">
                      {c.free} free{c.fromMinor != null && ` · from ${Math.round(c.fromMinor / 100)}`}
                    </span>
                  </div>
                </Link>
              ))}
              <Link to={tripHref("/bikes", trip, { cat: "extra" })} className="flex items-center gap-[14px] rounded-field px-4 py-[15px] hover:bg-white/4">
                <div className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-white/7 text-ink-soft">
                  <Child size={22} />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[15.5px] font-semibold">Children &amp; trailers</span>
                  <span className="text-[13px] text-ink-mute">Seats, tag-alongs, kids' bikes</span>
                </div>
              </Link>
              <Link to={`${tripHref("/bikes", trip)}#accessories`} className="flex items-center gap-[14px] rounded-field px-4 py-[15px] hover:bg-white/4">
                <div className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-ok/16 text-ok">
                  <Bag size={22} />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[15.5px] font-semibold">Helmet, bags, pedals</span>
                  <span className="num text-[13px] text-ink-mute">Helmet 50 · pedals 100 · own bike welcome</span>
                </div>
              </Link>
            </div>
          </Card>
        </section>

        {/* the other half of the business */}
        <Card className="flex flex-col items-start gap-[26px] px-7 py-[26px] md:flex-row md:items-center">
          <div className="flex flex-1 flex-col gap-2">
            <Lbl>&amp; Outdoor</Lbl>
            <h2 className="font-display text-[24px] font-bold tracking-[-.018em]">We guide on foot too</h2>
            <p className="max-w-[66ch] text-[15px] leading-[1.5] text-ink-soft">
              Four hikes and a trail run, on the same routes we ride — the Pilgrims' Path to Kirkjubøur, the Skyline Summit of Streymoy at Núgvan, the Clifftop on Sandoy, and the Westward Journey out to Fyri Vestan.
            </p>
          </div>
          <PillLink to="/tours#hiking" tone="ghost" size="md" className="px-6 py-[14px]">
            See hikes &amp; trail runs
          </PillLink>
        </Card>

        {/* practical */}
        <Card className="px-2 py-[6px]">
          <Row icon={<Pin size={20} />} title={`${SHOP.address}, open ${SHOP.hours} daily`} sub="Sverrisgøta 20 and Við Gjónna campsite. Drop off at either." right={<Chevron size={17} className="text-ink-dim" />} />
          <div className="hairline mx-[14px]" />
          <Row icon={<Shield size={20} />} iconTone="ok" title="If the weather cancels a ride, you get everything back" sub="We check the forecast the evening before and call you by 20:00." right={<Chevron size={17} className="text-ink-dim" />} />
          <div className="hairline mx-[14px]" />
          <Row icon={<CardIcon size={20} />} title="Pay now, or when you collect" sub="Pay by card now, or settle up at the shop when you collect." right={<Chevron size={17} className="text-ink-dim" />} />
        </Card>
      </Shell>

      <Footer />
    </>
  );
}

/** Where the bikes are collected or returned. The campsite carries a fee; it says so in the option. */
function LocationCell({ label, name, value, locations, fee, first }: { label: string; name: string; value: string; locations: Array<{ id: string; name: string; pickupFeeMinor: number; dropoffFeeMinor: number }>; fee: "pickup" | "dropoff"; first?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-1 px-[18px] py-[14px]", !first && "lg:border-l lg:border-white/7")}>
      <Lbl>{label}</Lbl>
      <select name={name} defaultValue={value} className="-ml-1 max-w-full bg-transparent text-[16px] font-semibold focus:outline-none">
        {locations.map((l) => {
          const f = fee === "pickup" ? l.pickupFeeMinor : l.dropoffFeeMinor;
          return (
            <option key={l.id} value={l.id} className="bg-card">
              {l.name}
              {f > 0 ? ` · +${formatDKKCode(f)}` : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

/** One cell of the booking bar: a date and a time, both native controls styled into the design. */
function DateTimeCell({ label, dateName, timeName, date, time }: { label: string; dateName: string; timeName: string; date: string; time: string }) {
  return (
    <div className="flex flex-col gap-1 px-[18px] py-[14px] lg:border-l lg:border-white/7">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2 text-[16px] font-semibold">
        <input type="date" name={dateName} defaultValue={date} required className="num bg-transparent focus:outline-none [color-scheme:dark]" />
        <span className="text-ink-mute">·</span>
        <select name={timeName} defaultValue={time} className="num bg-transparent focus:outline-none">
          {OPENING_TIMES.map((t) => (
            <option key={t} value={t} className="bg-card">
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

