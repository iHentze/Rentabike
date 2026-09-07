import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/choose";
import { cloudflareContext } from "~/context";
import { Footer, Header, Shell, TripSummary } from "~/components/site";
import { Card, Lbl, Price, cx } from "~/components/ui";
import { BikeImage } from "~/components/bike-card";
import { Check, Star, Wind } from "~/components/icons";
import { readTrip, tripDays, tripHref } from "~/lib/trip";
import { basketHeaders, readBasket, ridersOn } from "~/lib/basket";
import { listBikes, ridable, type CatalogueBike } from "~/lib/catalogue/bikes";
import type { BikeCategory } from "~/db/schema";
import { formatDKKCode } from "~/lib/money";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Which bike suits you — Rent a Bike & Outdoor" }];
}

type Terrain = "town" | "villages" | "hills";
type Effort = "all" | "some" | "little";

const TERRAIN: Array<{ id: Terrain; title: string; text: string }> = [
  { id: "town", title: "Around Tórshavn", text: "Harbour, old town, the cafés. Mostly flat, short hops, back before dinner." },
  { id: "villages", title: "Out to the villages", text: "Kirkjubøur and the coast roads. Rolling, a few real climbs, 30–50 km in a day." },
  { id: "hills", title: "Up into the hills", text: "Norðadalsskarð, Núgvan, the grass tracks. Proper ascent and loose ground." },
];
const EFFORT: Array<{ id: Effort; title: string; text: string }> = [
  { id: "all", title: "All of it", text: "I ride at home and I want the climbs." },
  { id: "some", title: "Some help on the hills", text: "Fit enough, but I'm on holiday." },
  { id: "little", title: "As little as possible", text: "I want to look at the view, not the tarmac." },
];

/** Category order for each answer pair — first that has bikes free wins. */
const PREFER: Record<Terrain, Record<Effort, BikeCategory[]>> = {
  town: { little: ["ebike", "road", "gravel"], some: ["ebike", "gravel", "road"], all: ["road", "gravel", "ebike"] },
  villages: { little: ["ebike", "gravel"], some: ["ebike", "gravel", "road"], all: ["gravel", "road", "ebike"] },
  hills: { little: ["ebike", "mountain"], some: ["ebike", "mountain", "gravel"], all: ["mountain", "gravel", "ebike"] },
};

const REASONS: Record<BikeCategory, Record<Terrain, string[]>> = {
  ebike: {
    town: ["The motor flattens the hill up from the harbour", "Battery covers roughly 80 km — more than a day out here", "The one people pick again when they come back"],
    villages: ["Handles the coast road and the pass to Kirkjubøur without the sweat", "Battery covers roughly 80 km — more than a day out here", "A headwind on the coast road stops mattering"],
    hills: ["Motor and wide tyres for Norðadalsskarð and the grass tracks", "You arrive at the saddle with legs left for the view", "Battery covers roughly 80 km — more than a day out here"],
  },
  gravel: {
    town: ["Quick on tarmac, comfortable over cobbles", "Drop bars for the exposed stretches along the water", "Light enough to carry up the old-town steps"],
    villages: ["Handles the coast-road tarmac and the gravel stretch to Kirkjubøur", "Geared for the pass — 190 m, paved throughout", "Fast enough to make the 50 km day feel short"],
    hills: ["Wide tyres for the loose ground on the plateau tracks", "Lower gears than a road bike for the long climb", "Still quick on the tarmac back down"],
  },
  road: {
    town: ["Fastest thing on the coast road", "Paved the whole way round the capital", "Light and quick — the sightseeing loop in an hour"],
    villages: ["The Kirkjubøur road is paved from door to door", "Built for exactly this: rolling tarmac and long views", "Clip-in pedals available if you ride at home"],
    hills: ["Paved to the top of Norðadalsskarð — a proper road climb", "Fast descent home", "Skip the grass tracks; this one is for the tarmac"],
  },
  mountain: {
    town: ["Comfortable and upright for a slow look around", "Fat tyres soak up the cobbles", "Nothing to worry about on the harbour paths"],
    villages: ["Happy on the gravel stretches and farm tracks", "Suspension takes the rough patches out of the day", "Lower gears for the pass"],
    hills: ["Knobbly tyres and suspension for grass tracks and loose ground", "The bike our guides ride on the Sunday tours", "Built to be ridden hard and washed afterwards"],
  },
  extra: { town: [], villages: [], hills: [] },
};

function pick(bikes: CatalogueBike[], cats: BikeCategory[], riders: number): { best: CatalogueBike | null; alternatives: CatalogueBike[] } {
  const bestOf = (c: BikeCategory) =>
    bikes
      .filter((b) => b.category === c && b.free > 0)
      // Enough for the whole party first, then the cheapest.
      .sort((a, b) => Number(b.free >= riders) - Number(a.free >= riders) || a.rateMinor - b.rateMinor || b.free - a.free)[0] ?? null;
  const picks = cats.map(bestOf).filter((b): b is CatalogueBike => b !== null);
  return { best: picks[0] ?? null, alternatives: picks.slice(1, 3) };
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const trip = readTrip(url.searchParams);
  const terrain = (TERRAIN.find((t) => t.id === url.searchParams.get("t"))?.id ?? null) as Terrain | null;
  const effort = (EFFORT.find((e) => e.id === url.searchParams.get("e"))?.id ?? null) as Effort | null;
  const bikes = ridable(await listBikes(env.DB, trip));
  const days = tripDays(trip);
  const cats = terrain && effort ? PREFER[terrain][effort] : terrain ? PREFER[terrain].some : effort ? PREFER.villages[effort] : [];
  const { best, alternatives } = cats.length ? pick(bikes, cats, trip.riders) : { best: null, alternatives: [] };
  const slim = (b: CatalogueBike) => ({ id: b.id, slug: b.slug, name: b.name, category: b.category, image: b.image, rateMinor: b.rateMinor, perDay: b.perDay, tripMinor: b.tripMinor, free: b.free, sizeLabel: b.sizeLabel });
  return {
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, pickupLocationId: trip.pickupLocationId, dropoffLocationId: trip.dropoffLocationId },
    days,
    terrain,
    effort,
    fleetFree: bikes.reduce((n, b) => n + b.free, 0),
    best: best ? { ...slim(best), reasons: REASONS[best.category][terrain ?? "villages"] } : null,
    alternatives: alternatives.map(slim),
  };
}

/** "Use this for both riders": everyone who still needs a bike gets this one, as far as stock allows. */
export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const trip = readTrip(url.searchParams);
  const form = await request.formData();
  const bikeId = String(form.get("bike") ?? "");
  const basket = await readBasket(request, trip);
  const bike = (await listBikes(env.DB, trip)).find((b) => b.id === bikeId);
  if (bike && bike.category !== "extra") {
    for (const r of basket.riders) {
      if (!r.bikeTypeId && ridersOn(basket, bike.id) < bike.free) r.bikeTypeId = bike.id;
    }
  }
  return redirect(tripHref("/riders", trip), { headers: await basketHeaders(basket) });
}

export default function Choose({ loaderData }: Route.ComponentProps) {
  const { trip: t, days, terrain, effort, fleetFree, best, alternatives } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, pickupLocationId: t.pickupLocationId, dropoffLocationId: t.dropoffLocationId };
  const href = (extra: Record<string, string | undefined>) => tripHref("/choose", trip, { t: terrain ?? undefined, e: effort ?? undefined, ...extra });
  const here = tripHref("/choose", trip, { t: terrain ?? undefined, e: effort ?? undefined });

  return (
    <>
      <Header variant="funnel" right={<TripSummary trip={trip} />} />
      <Shell className="grid gap-10 px-5 pb-12 pt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start md:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-[11px]">
            <h1 className="font-display text-[36px] font-bold leading-[1.03] tracking-[-.028em] md:text-[44px]">Where are you actually going?</h1>
            <p className="max-w-[58ch] text-[17px] leading-[1.55] text-ink-soft">Two questions and we'll put the right bike under you. Ignore all of it and browse the lot instead — the link is at the bottom.</p>
          </div>

          <Question label="One" title="The riding you have in mind">
            {TERRAIN.map((o) => (
              <Option key={o.id} to={href({ t: o.id })} on={terrain === o.id} title={o.title} text={o.text} />
            ))}
          </Question>

          <Question label="Two" title="How much work do you want to do?">
            {EFFORT.map((o) => (
              <Option key={o.id} to={href({ e: o.id })} on={effort === o.id} title={o.title} text={o.text} compact />
            ))}
          </Question>

          <Card className="flex gap-[14px] bg-warn/10 px-5 py-[18px]">
            <Wind size={21} className="mt-[2px] shrink-0 text-warn" />
            <div className="flex flex-col gap-1">
              <span className="text-[15.5px] font-semibold text-warn-ink">Be honest with yourself about the wind</span>
              <span className="text-[14.5px] leading-[1.5] text-warn-soft">It blows hard here most days, and a headwind on the coast road is worth about two extra hills. Nearly everyone who hesitates between a normal bike and an e-bike is happier on the e-bike.</span>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-[18px]">
            <Link to={tripHref("/bikes", trip)} className="border-b border-brand-bright/40 pb-[2px] text-[15px] font-semibold text-brand-bright hover:text-ink">
              Skip this — show me all {fleetFree} bikes
            </Link>
            <span className="text-[14px] text-ink-mute">You can change bikes right up to checkout.</span>
          </div>
        </div>

        {/* recommendation */}
        <Card className="overflow-hidden lg:sticky lg:top-6">
          <div className="flex items-center gap-[9px] bg-white/5 px-[18px] py-[15px]">
            <Star size={17} className="text-brand-bright" />
            <span className="text-[14px] font-semibold">What we'd put you on</span>
          </div>
          <div className="flex flex-col gap-4 p-[18px]">
            {best ? (
              <>
                <div className="h-[140px] overflow-hidden rounded-field bg-white/5">
                  <BikeImage bike={best} className="object-contain p-4" />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <Lbl className="text-brand-bright">Best match{!terrain || !effort ? " so far" : ""}</Lbl>
                  <h3 className="text-[22px] font-semibold leading-[1.2] tracking-[-.014em]">{best.name}</h3>
                </div>
                <div className="flex flex-col gap-[10px]">
                  {best.reasons.map((r) => (
                    <div key={r} className="flex items-start gap-[10px]">
                      <Check size={17} className="mt-[3px] shrink-0 text-ok" />
                      <span className="text-[14.5px] leading-[1.5] text-ink-pale">{r}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline justify-between border-t border-white/6 pt-[15px]">
                  <div className="flex flex-col gap-[3px]">
                    <Price minor={best.rateMinor} size="lg" />
                    <span className="num text-[13px] text-ink-mute">
                      {best.perDay ? `per day · ${days} days = ${formatDKKCode(best.tripMinor).replace("DKK ", "")}` : "for the period"}
                    </span>
                  </div>
                  <span className={cx("text-[13px] font-semibold", best.free >= trip.riders ? "text-ok" : "text-warn")}>
                    {best.free >= trip.riders ? `${best.free} free` : `Only ${best.free} left`}
                  </span>
                </div>
                <Form method="post" action={here}>
                  <input type="hidden" name="bike" value={best.id} />
                  <button className="w-full rounded-full bg-white px-4 py-[15px] text-[16px] font-bold text-night hover:bg-ink-pale">
                    {trip.riders === 1 ? "Use this one" : trip.riders === 2 ? "Use this for both riders" : `Use this for all ${trip.riders} riders`}
                  </button>
                </Form>
                {alternatives.length > 0 && (
                  <div className="flex flex-col gap-[11px] border-t border-white/6 pt-[15px]">
                    <Lbl>Also fine for this</Lbl>
                    {alternatives.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3">
                        <Link to={tripHref(`/bikes/${a.slug}`, trip)} className="min-w-0 truncate text-[14.5px] hover:text-brand-bright">
                          {a.name}
                        </Link>
                        <span className="num shrink-0 text-[14px] text-ink-mute">
                          {Math.round(a.rateMinor / 100)} · {a.category === "ebike" ? "motor" : "no motor"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[14.5px] leading-[1.55] text-ink-soft">Answer the two questions and the recommendation appears here — with the price for your dates and what's actually free.</p>
            )}
          </div>
        </Card>
      </Shell>
      <Footer />
    </>
  );
}

function Question({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-baseline gap-[11px]">
        <Lbl>{label}</Lbl>
        <h2 className="text-[20px] font-semibold tracking-[-.012em]">{title}</h2>
      </div>
      <div className="grid gap-[13px] md:grid-cols-3">{children}</div>
    </div>
  );
}

function Option({ to, on, title, text, compact }: { to: string; on: boolean; title: string; text: string; compact?: boolean }) {
  return (
    <Link to={to} preventScrollReset className={cx("relative flex flex-col gap-[6px] rounded-card p-[18px] transition-colors", on ? "bg-brand/16 shadow-[inset_0_0_0_2px_#0A78D6]" : "bg-card hover:bg-white/6")}>
      {on && (
        <span className="absolute right-[15px] top-[15px] flex size-6 items-center justify-center rounded-full bg-brand">
          <Check size={13} strokeWidth={3.4} />
        </span>
      )}
      <span className={cx("font-semibold", compact ? "text-[15.5px]" : "text-[16.5px]")}>{title}</span>
      <span className={cx("leading-[1.5]", compact ? "text-[13.5px]" : "text-[14px]", on ? "text-ink-pale" : "text-ink-soft")}>{text}</span>
    </Link>
  );
}
