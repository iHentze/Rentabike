import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/choose";
import { cloudflareContext } from "~/context";
import { Footer, Header, Shell, TripSummary } from "~/components/site";
import { Card, Lbl, Price, cx } from "~/components/ui";
import { Bolt, Check, Gravel, Mountain, Road, Star, Wind } from "~/components/icons";
import { readTrip, tripDays, tripHref } from "~/lib/trip";
import { basketHeaders, readBasket } from "~/lib/basket";
import { CATEGORY_LABEL, listBikes, ridable } from "~/lib/catalogue/bikes";
import { adviseCategories, CATEGORY_NOUN, EFFORT, isEffort, isTerrain, TERRAIN } from "~/lib/catalogue/advice";
import { BIKE_CATEGORIES, type BikeCategory } from "~/db/schema";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Which bike suits you — Rent a Bike & Outdoor" }];
}

/**
 * Two questions, an answer in bike TYPES. The frame comes later: the riders
 * step sizes it to each rider's height, one rider at a time. What this page
 * decides is which type the riders step opens on, and why.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const trip = readTrip(url.searchParams);
  const t = url.searchParams.get("t");
  const e = url.searchParams.get("e");
  const terrain = isTerrain(t) ? t : null;
  const effort = isEffort(e) ? e : null;
  const bikes = ridable(await listBikes(env.DB, trip));
  const advice = adviseCategories(bikes, terrain, effort);
  return {
    trip: { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime(), riders: trip.riders, explicit: trip.explicit, pickupLocationId: trip.pickupLocationId, dropoffLocationId: trip.dropoffLocationId },
    days: tripDays(trip),
    terrain,
    effort,
    fleetFree: bikes.reduce((n, b) => n + b.free, 0),
    best: advice[0] ?? null,
    alternatives: advice.slice(1, 3),
  };
}

/** "E-bikes it is": remember the type and the answers, then on to the riders — nothing is assigned yet. */
export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const trip = readTrip(url.searchParams);
  const form = await request.formData();
  const cat = String(form.get("cat") ?? "");
  const t = url.searchParams.get("t");
  const e = url.searchParams.get("e");
  const basket = await readBasket(request, trip);
  const category = (BIKE_CATEGORIES as readonly string[]).includes(cat) && cat !== "extra" ? (cat as BikeCategory) : undefined;
  if (category) {
    basket.preferredCategory = category;
    basket.advice = isTerrain(t) && isEffort(e) ? { terrain: t, effort: e } : undefined;
  }
  return redirect(tripHref("/riders", trip, { cat: category }), { headers: await basketHeaders(basket) });
}

const ICON: Record<BikeCategory, typeof Bolt> = { ebike: Bolt, mountain: Mountain, gravel: Gravel, road: Road, extra: Bolt };

export default function Choose({ loaderData }: Route.ComponentProps) {
  const { trip: t, days, terrain, effort, fleetFree, best, alternatives } = loaderData;
  const trip = { startAt: new Date(t.startAt), endAt: new Date(t.endAt), riders: t.riders, explicit: t.explicit, pickupLocationId: t.pickupLocationId, dropoffLocationId: t.dropoffLocationId };
  const href = (extra: Record<string, string | undefined>) => tripHref("/choose", trip, { t: terrain ?? undefined, e: effort ?? undefined, ...extra });
  const here = tripHref("/choose", trip, { t: terrain ?? undefined, e: effort ?? undefined });
  const answered = Boolean(terrain && effort);
  const Icon = best ? ICON[best.category] : Star;

  return (
    <>
      <Header variant="funnel" right={<TripSummary trip={trip} />} />
      <Shell className="grid gap-10 px-5 pb-12 pt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start md:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-[11px]">
            <h1 className="font-display text-[36px] font-bold leading-[1.03] tracking-[-.028em] md:text-[44px]">Where are you actually going?</h1>
            <p className="max-w-[58ch] text-[17px] leading-[1.55] text-ink-soft">Two questions and we'll tell you which type of bike to take. The frame is sized to each rider on the next step. Ignore all of it and browse the lot instead — the link is at the bottom.</p>
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
            <Link to={tripHref("/riders", trip, { cat: "all" })} className="border-b border-brand-bright/40 pb-[2px] text-[15px] font-semibold text-brand-bright hover:text-ink">
              Skip this — show me all {fleetFree} bikes
            </Link>
            <span className="text-[14px] text-ink-mute">You can change type and bike right up to checkout.</span>
          </div>
        </div>

        {/* recommendation: a type, with reasons and what the fleet has of it */}
        <Card className="overflow-hidden lg:sticky lg:top-6">
          <div className="flex items-center gap-[9px] bg-white/5 px-[18px] py-[15px]">
            <Star size={17} className="text-brand-bright" />
            <span className="text-[14px] font-semibold">What we'd put you on</span>
          </div>
          <div className="flex flex-col gap-4 p-[18px]">
            {best ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex size-[64px] shrink-0 items-center justify-center rounded-full bg-brand/22 text-brand-bright">
                    <Icon size={30} />
                  </div>
                  <div className="flex flex-col gap-[4px]">
                    <Lbl className="text-brand-bright">Best match{answered ? "" : " so far"}</Lbl>
                    <h3 className="text-[24px] font-semibold leading-[1.15] tracking-[-.016em]">{capitalise(CATEGORY_NOUN[best.category])}</h3>
                  </div>
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
                    {best.fromMinor != null ? (
                      <span className="inline-flex items-baseline gap-[6px]">
                        <span className="text-[13px] text-ink-mute">from</span>
                        <Price minor={best.fromMinor} per="/day" size="lg" />
                      </span>
                    ) : (
                      <span className="text-[15px] text-ink-soft">Included</span>
                    )}
                    <span className="num text-[13px] text-ink-mute">{days} {days === 1 ? "day" : "days"} · the frame is sized to each rider next</span>
                  </div>
                  <span className={cx("text-[13px] font-semibold", best.free >= trip.riders ? "text-ok" : "text-warn")}>
                    {best.free} free · {best.sizes} {best.sizes === 1 ? "size" : "sizes"}
                  </span>
                </div>
                <Form method="post" action={here}>
                  <input type="hidden" name="cat" value={best.category} />
                  <button className="w-full rounded-full bg-white px-4 py-[15px] text-[16px] font-bold text-night hover:bg-ink-pale">
                    {trip.riders === 1 ? `${capitalise(CATEGORY_NOUN[best.category])} — now your height →` : `${CATEGORY_LABEL[best.category]} it is — now the riders →`}
                  </button>
                </Form>
                {alternatives.length > 0 && (
                  <div className="flex flex-col gap-[11px] border-t border-white/6 pt-[15px]">
                    <Lbl>Also fine for this</Lbl>
                    {alternatives.map((a) => (
                      <Form key={a.category} method="post" action={here} className="flex items-center justify-between gap-3">
                        <input type="hidden" name="cat" value={a.category} />
                        <button className="min-w-0 truncate text-left text-[14.5px] font-semibold text-ink hover:text-brand-bright">{capitalise(CATEGORY_NOUN[a.category])} ›</button>
                        <span className="num shrink-0 text-[14px] text-ink-mute">
                          {a.fromMinor != null ? `from ${Math.round(a.fromMinor / 100)} · ` : ""}
                          {a.free} free
                        </span>
                      </Form>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[14.5px] leading-[1.55] text-ink-soft">Answer the two questions and the recommendation appears here — the type of bike, why, and what's free on your dates.</p>
            )}
          </div>
        </Card>
      </Shell>
      <Footer />
    </>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
