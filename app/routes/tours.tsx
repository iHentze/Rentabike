import { Link } from "react-router";
import type { Route } from "./+types/tours";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, Lbl, Price, Tag, cx } from "~/components/ui";
import { Check, Shield } from "~/components/icons";
import { TOUR_CATEGORY_LABEL, TOUR_CATEGORY_ORDER, listTours, type TourSummary } from "~/lib/tours/catalogue";
import { fmtDuration } from "~/lib/format";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Guided rides, hikes and trail runs — Rent a Bike & Outdoor" },
    { name: "description", content: "Thirteen guided tours out of Tórshavn: bike rides, hike-and-bike days, hikes and a trail run, with local guides, every week." },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const tours = await listTours(env.DB);
  return { tours };
}

const SUB: Record<string, string> = {
  bike: "From a gentle city loop to a certified-instructor day",
  combo: "Ride to the trailhead, walk the part you can't ride",
  hike: "No bike at all — we drive you out and walk",
  trail_run: "One route, run at your pace with a guide",
};

const ANCHOR: Record<string, string> = { bike: "rides", combo: "hike-and-bike", hike: "hiking", trail_run: "trail-run" };

function slotLabel(t: TourSummary): string {
  const bits: string[] = [];
  if (t.weekday) bits.push(`${t.weekday}s`);
  if (t.distanceKm && t.category !== "hike") bits.push(`${t.distanceKm} km`);
  else bits.push(fmtDuration(t.durationMin));
  return bits.join(" · ");
}

export default function Tours({ loaderData }: Route.ComponentProps) {
  const { tours } = loaderData;
  const byCat = (c: string) => tours.filter((t) => t.category === c);
  const counts = TOUR_CATEGORY_ORDER.map((c) => ({ c, n: byCat(c).length }));

  return (
    <>
      <Header />

      {/* hero */}
      <section className="relative h-[320px] overflow-hidden">
        <img src="/images/tour-kirkjubour.jpg" alt="The road into Kirkjubøur, grass roofs and the sound behind" className="absolute inset-0 size-full object-cover" style={{ objectPosition: "50% 55%" }} />
        <div className="absolute inset-x-0 bottom-0 h-[82%] bg-[linear-gradient(180deg,rgba(7,14,21,0)_0%,rgba(7,14,21,.5)_34%,rgba(7,14,21,.94)_80%,#070E15_100%)]" />
        <Shell className="relative flex h-full flex-col justify-end gap-4 px-5 pb-7 md:flex-row md:items-end md:justify-between md:px-8">
          <div className="flex max-w-[660px] flex-col gap-3">
            <h1 className="font-display text-[38px] font-bold leading-[1] tracking-[-.03em] [text-shadow:0_2px_26px_rgba(7,14,21,.5)] md:text-[50px]">{tours.length === 13 ? "Thirteen" : tours.length} ways out of Tórshavn</h1>
            <p className="max-w-[580px] text-[17px] leading-[1.5] text-white/88">On a bike, on foot, or both in one day. Small groups, local guides, and everything leaves from the shop on Sverrisgøta.</p>
          </div>
          <div className="flex flex-wrap gap-[9px]">
            {counts.map(({ c, n }) => (
              <a key={c} href={`#${ANCHOR[c]}`} className="rounded-full bg-white/16 px-[13px] py-[6px] text-[11px] font-bold uppercase tracking-[.08em] hover:bg-white/24">
                {n} {c === "bike" ? "bike" : c === "combo" ? "hike & bike" : c === "hike" ? "hike" : "run"}
              </a>
            ))}
          </div>
        </Shell>
      </section>

      <Shell className="flex flex-col gap-[34px] px-5 pb-11 pt-7 md:px-8">
        {/* the shop's own words for someone who has just landed and finds the islands a bit much */}
        <Card className="grid gap-5 px-[22px] py-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:px-7">
          <div className="flex flex-col gap-2">
            <Lbl>New to the islands?</Lbl>
            <h2 className="font-display text-[24px] font-bold leading-[1.15] tracking-[-.018em]">Explore the Faroe Islands with a local guide</h2>
            <p className="text-[15px] leading-[1.55] text-ink-soft">The Faroe Islands may look challenging when you first arrive, but with the right route and a local guide they are a safe, enjoyable and unforgettable place to explore. Find the experience that suits you best.</p>
          </div>
          <div className="flex flex-col gap-4 text-[14.5px] leading-[1.55] text-ink-pale">
            <p>
              New to biking here? The{" "}
              <TourLink slug="city-sightseeing-ebike">sightseeing e-bike tour</TourLink> is a comfortable and reassuring first choice, and{" "}
              <TourLink slug="historical-kirkjubour">Historical Kirkjubøur</TourLink> is a beautiful ride on paved roads with local history along the way. On any guided ride you can take an e-bike to make the hills and the wind easier, or a gravel, road or mountain bike if you want a more active ride.
            </p>
            <p>
              On foot, the <TourLink slug="clifftop-bliss-sandoy">Clifftop on Sandoy</TourLink> and the{" "}
              <TourLink slug="pilgrims-path-medieval-heart">walk to Kirkjubøur</TourLink> reach great viewpoints without a long or demanding hike. For more distance, height or adventure, choose one of the longer hikes or the trail run.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 px-[22px] py-[17px] md:flex-row md:items-center md:gap-[26px]">
          <Lbl className="shrink-0">Every guided ride includes</Lbl>
          <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2">
            {["The bike", "Helmet", "Water bottles", "An energy bar", "A local guide"].map((x) => (
              <span key={x} className="inline-flex items-center gap-2 text-[14px]">
                <Check size={15} className="text-ok" /> {x}
              </span>
            ))}
          </div>
        </Card>

        {TOUR_CATEGORY_ORDER.map((c) => {
          const list = byCat(c);
          if (list.length === 0) return null;
          const cols = c === "bike" ? "md:grid-cols-2 xl:grid-cols-3" : c === "hike" ? "sm:grid-cols-2 xl:grid-cols-4" : c === "combo" ? "lg:grid-cols-2" : "";
          const horizontal = c === "combo" || c === "trail_run";
          return (
            <section key={c} id={ANCHOR[c]} className="flex flex-col gap-4 scroll-mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-[28px] font-bold tracking-[-.022em]">{TOUR_CATEGORY_LABEL[c]}</h2>
                <span className="text-[14px] text-ink-mute">
                  {list.length === 1 ? "" : `${["", "One", "Two", "Three", "Four", "Five", "Six"][list.length] ?? list.length} ${c === "bike" ? "rides" : c === "hike" ? "hikes" : "days"}, `}
                  {SUB[c]}
                </span>
              </div>
              <div className={cx("grid gap-4", cols)}>
                {list.map((t) => (
                  <Link key={t.id} to={`/tours/${t.slug}`} className={cx("group flex overflow-hidden rounded-card bg-card", horizontal ? "flex-col sm:flex-row" : "flex-col")}>
                    <div className={cx("relative shrink-0 overflow-hidden", horizontal ? "h-[180px] sm:h-auto sm:w-[240px]" : c === "hike" ? "h-[140px]" : "h-[150px]", c === "trail_run" && "sm:w-[340px]")}>
                      {t.image && <img src={t.image} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />}
                      {!horizontal && <Tag className="absolute left-[11px] top-[11px] px-3 py-[5px] text-[11px] tracking-[.09em]">{slotLabel(t)}</Tag>}
                      {t.slug === "city-sightseeing-ebike" && <Tag tone="ok" className="absolute right-[11px] top-[11px] px-3 py-[5px] text-[11px] tracking-[.09em]">Most booked</Tag>}
                    </div>
                    <div className={cx("flex flex-1 flex-col gap-[10px] px-4 pb-4 pt-[15px]", c === "trail_run" && "sm:px-[26px] sm:py-[22px]")}>
                      <span className={cx("font-semibold leading-[1.22]", c === "trail_run" ? "text-[21px]" : "text-[17px]")}>{t.title}</span>
                      <span className={cx("flex-1 leading-[1.45] text-ink-soft", c === "trail_run" ? "max-w-[70ch] text-[15px]" : "text-[13.5px]")}>{t.summary}</span>
                      <div className="flex flex-wrap gap-[6px]">
                        {(horizontal && t.weekday ? [`${t.weekday}s ${t.startTime ?? ""}`.trim(), ...t.facts] : t.facts).map((f) => (
                          <span key={f} className="num rounded-full bg-white/6 px-[10px] py-[4px] text-[12px] text-ink-soft">
                            {f}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between border-t border-white/6 pt-3">
                        <Price minor={t.priceMinor} size="sm" />
                        <span className={cx("rounded-full px-[17px] py-2 text-[13.5px] font-bold", c === "hike" ? "bg-white/10 text-ink group-hover:bg-white/16" : "bg-white text-night group-hover:bg-ink-pale")}>
                          {t.nextSeatsLeft != null ? "Book" : "Ask us"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {/* private + weather */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="flex flex-col gap-4 px-6 py-[22px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[21px] font-bold tracking-[-.018em]">Private, your own group</h2>
              <span className="text-[13.5px] text-ink-mute">Any day, weather permitting</span>
            </div>
            <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
              {[
                ["2 hrs", "A taste"],
                ["3 hrs", "A morning"],
                ["4 hrs", "Lunch"],
                ["7 hrs", "Lunch"],
              ].map(([h, l], i) => (
                <div key={h} className={cx("flex flex-col gap-[3px] rounded-field px-4 py-[14px]", i >= 2 ? "bg-brand/16 shadow-[inset_0_0_0_1.5px_#0A78D6]" : "bg-white/5")}>
                  <span className="num font-display text-[23px] font-bold">{h}</span>
                  <span className={cx("text-[12.5px]", i >= 2 ? "font-semibold text-brand-bright" : "text-ink-mute")}>{l}</span>
                </div>
              ))}
            </div>
            <span className="text-[14px] leading-[1.5] text-ink-soft">
              Every tour above can run privately for your group, priced per person. Bike, helmet, clip-in pedals if you want them, water, and a guide who rides here every week. Call {SHOP.phone} or write to {SHOP.email}.
            </span>
          </Card>
          <Card className="flex flex-col gap-3 px-6 py-[22px]">
            <div className="flex size-11 items-center justify-center rounded-full bg-ok/16 text-ok">
              <Shield size={21} />
            </div>
            <span className="text-[17px] font-semibold">Weather cancels? Everything back.</span>
            <span className="text-[14px] leading-[1.5] text-ink-soft">We check the forecast the evening before and call you by 20:00. Nobody has a good day riding into a Faroese gale.</span>
            <span className="num mt-auto text-[13.5px] text-ink-mute">
              {SHOP.email} · {SHOP.phone}
            </span>
          </Card>
        </div>
      </Shell>

      <Footer />
    </>
  );
}

/** A tour named in the intro, as a link to its page. */
function TourLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <Link to={`/tours/${slug}`} className="font-semibold text-brand-bright hover:text-ink">
      {children}
    </Link>
  );
}
