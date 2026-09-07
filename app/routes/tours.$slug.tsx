import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/tours.$slug";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, Lbl, Tag, cx } from "~/components/ui";
import { Check, Info, Minus, Plus } from "~/components/icons";
import { getTour } from "~/lib/tours/catalogue";
import { fmtDuration, fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.tour.title} — Rent a Bike & Outdoor` : "Tour — Rent a Bike & Outdoor" },
    { name: "description", content: loaderData?.tour.summary ?? "" },
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const tour = await getTour(env.DB, params.slug);
  if (!tour) throw new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const riders = Math.min(tour.capacity ?? 8, Math.max(1, Number.parseInt(url.searchParams.get("riders") ?? "2", 10) || 2));
  const chosen = url.searchParams.get("dep") ?? tour.departures.find((d) => d.bookable)?.id ?? null;
  return { tour, riders, chosen };
}

/** "Choose your bikes" / "Book": carry the departure and party size into the funnel. */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const dep = String(form.get("dep") ?? "");
  const riders = Math.max(1, Number.parseInt(String(form.get("riders") ?? "1"), 10) || 1);
  if (!dep) return redirect(`/tours/${params.slug}`);
  return redirect(`/riders?tour=${encodeURIComponent(dep)}&riders=${riders}`);
}

export default function TourDetail({ loaderData }: Route.ComponentProps) {
  const { tour, riders, chosen } = loaderData;
  const dep = tour.departures.find((d) => d.id === chosen) ?? null;
  const unit = dep?.priceMinor ?? tour.priceMinor;
  const total = unit * riders;
  const withBike = tour.requiresBike;

  return (
    <>
      <Header />

      <section className="relative h-[360px] overflow-hidden md:h-[420px]">
        {tour.image && <img src={tour.image} alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: "50% 60%" }} />}
        <div className="absolute inset-x-0 bottom-0 h-[74%] bg-[linear-gradient(180deg,rgba(7,14,21,0)_0%,rgba(7,14,21,.5)_40%,rgba(7,14,21,.94)_82%,#070E15_100%)]" />
        <Shell className="relative flex h-full flex-col justify-end gap-[14px] px-5 pb-[34px] md:px-8">
          <div className="flex flex-wrap items-center gap-[10px]">
            {tour.weekday && <Tag className="px-[14px] py-[6px] text-[11.5px] tracking-[.09em]">Every {tour.weekday}{tour.startTime ? ` · ${tour.startTime}` : ""}</Tag>}
            <Tag tone="ghost" className="px-[14px] py-[6px] text-[11.5px] tracking-[.09em]">{tour.difficulty}</Tag>
          </div>
          <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-.03em] [text-shadow:0_2px_26px_rgba(7,14,21,.5)] md:text-[56px]">{tour.title}</h1>
        </Shell>
      </section>

      <Shell className="grid gap-10 px-5 pb-12 pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start md:px-8">
        <div className="flex flex-col gap-7">
          <Card className="grid grid-cols-2 p-1 md:grid-cols-4">
            {[
              ["Duration", fmtDuration(tour.durationMin)],
              [tour.category === "hike" ? "Summit" : "Ascent", tour.summitM ? `${tour.summitM} m` : tour.ascentM ? `${tour.ascentM} m` : tour.distanceKm ? `${tour.distanceKm} km` : "—"],
              ["Group", tour.capacity ? `Max ${tour.capacity}` : "Small"],
              ["Meet at", "The shop"],
            ].map(([k, v], i) => (
              <div key={k} className={cx("flex flex-col gap-[5px] px-[18px] py-4", i > 0 && "md:border-l md:border-white/6", i === 1 && "border-l border-white/6 md:border-l", i === 3 && "border-l border-white/6")}>
                <Lbl>{k}</Lbl>
                <span className="num font-display text-[20px] font-bold">{v}</span>
              </div>
            ))}
          </Card>

          <div className="flex flex-col gap-[14px]">
            <h2 className="text-[26px] font-semibold tracking-[-.018em]">{tour.category === "hike" ? "The walk" : tour.category === "trail_run" ? "The run" : "The ride"}</h2>
            {tour.body.split(/\n\n+/).map((p, i) => (
              <p key={i} className="max-w-[62ch] text-[16.5px] leading-[1.65] text-ink-pale">
                {p}
              </p>
            ))}
            {tour.facts.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {tour.facts.map((f) => (
                  <span key={f} className="num rounded-full bg-white/6 px-3 py-[5px] text-[13px] text-ink-soft">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {tour.inclusions.length > 0 && (
            <div className="flex flex-col gap-[14px]">
              <h2 className="text-[26px] font-semibold tracking-[-.018em]">What's included</h2>
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {tour.inclusions.map((inc) => (
                  <div key={inc.label} className="flex items-start gap-[11px]">
                    <Check size={18} className={cx("mt-[3px] shrink-0", inc.included ? "text-ok" : "text-ink-dim")} />
                    <span className="text-[15.5px] leading-[1.5] text-ink-pale">{inc.label}</span>
                  </div>
                ))}
                <div className="flex items-start gap-[11px]">
                  <Check size={18} className="mt-[3px] shrink-0 text-ok" />
                  <span className="text-[15.5px] leading-[1.5] text-ink-pale">A full refund if weather cancels it</span>
                </div>
              </div>
            </div>
          )}

          <Card className="flex gap-[14px] px-5 py-[18px]">
            <div className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand-bright">
              <Info size={20} />
            </div>
            <span className="text-[15px] leading-[1.55] text-ink-pale">We check the forecast the evening before and call you by 20:00 if it looks unsafe. Faroese weather changes fast — that call is the difference between a good day and a miserable one.</span>
          </Card>
        </div>

        {/* booking */}
        <Card className="overflow-hidden lg:sticky lg:top-6">
          <Form method="post" action={`/tours/${tour.slug}`} className="flex flex-col gap-[18px] p-5">
            <div className="flex items-baseline gap-2">
              <span className="num font-display text-[36px] font-bold tracking-[-.024em]">{formatDKKCode(unit)}</span>
              <span className="text-[15px] text-ink-mute">per person</span>
            </div>

            <div className="flex flex-col gap-[10px]">
              <Lbl>{tour.weekday ? `Next ${tour.weekday}s` : "Next departures"}</Lbl>
              {tour.departures.length === 0 ? (
                <span className="text-[14px] leading-[1.5] text-ink-soft">No dates on sale right now — call {SHOP.phone} and we'll find one.</span>
              ) : (
                <div className="flex flex-col gap-2">
                  {tour.departures.map((d) => {
                    const on = d.id === chosen;
                    const full = d.seatsLeft <= 0 || d.status !== "open";
                    const closed = !full && !d.bookable;
                    const body = (
                      <>
                        <div className="flex flex-col gap-[2px]">
                          <span className={cx("text-[15px]", on ? "font-semibold" : "font-medium", full && "text-ink-dim")}>{fmtLongDay(d.startsAt)}</span>
                          <span className={cx("num text-[13px]", full ? "font-semibold text-danger" : closed ? "text-warn" : on ? "text-ink-soft" : "text-ink-mute")}>
                            {full ? "Fully booked" : closed ? `${fmtTime(d.startsAt)} · booking closed (12 h before)` : `${fmtTime(d.startsAt)} · ${d.seatsLeft} ${d.seatsLeft === 1 ? "spot" : "spots"} left${d.minParticipants > 1 ? ` · min ${d.minParticipants}` : ""}`}
                          </span>
                        </div>
                        {on && <Check size={20} className="text-brand-bright" strokeWidth={2.4} />}
                      </>
                    );
                    const cls = cx("flex items-center justify-between rounded-field px-[15px] py-[13px]", on ? "bg-brand/16 shadow-[inset_0_0_0_2px_#0A78D6]" : full ? "bg-white/3" : "bg-white/5 hover:bg-white/8");
                    return full || closed ? (
                      <div key={d.id} className={cls}>{body}</div>
                    ) : (
                      <Link key={d.id} to={`?riders=${riders}&dep=${d.id}`} className={cls} preventScrollReset>
                        {body}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-[10px]">
              <Lbl>{withBike ? "Riders" : "People"}</Lbl>
              <div className="flex items-center justify-between rounded-field bg-white/5 py-[9px] pl-[15px] pr-[10px]">
                <span className="num text-[15px] font-semibold">
                  {riders} {withBike ? (riders === 1 ? "rider" : "riders") : riders === 1 ? "person" : "people"}
                </span>
                <div className="flex gap-[7px]">
                  <Link to={`?riders=${Math.max(1, riders - 1)}${chosen ? `&dep=${chosen}` : ""}`} preventScrollReset aria-label="One fewer" className="flex size-[34px] items-center justify-center rounded-full bg-white/8 hover:bg-white/14">
                    <Minus size={15} strokeWidth={2.4} />
                  </Link>
                  <Link to={`?riders=${riders + 1}${chosen ? `&dep=${chosen}` : ""}`} preventScrollReset aria-label="One more" className="flex size-[34px] items-center justify-center rounded-full bg-white/8 hover:bg-white/14">
                    <Plus size={15} strokeWidth={2.4} />
                  </Link>
                </div>
                <input type="hidden" name="riders" value={riders} />
              </div>
              {dep && riders > dep.seatsLeft && <span className="text-[13px] text-danger">Only {dep.seatsLeft} left on that date.</span>}
            </div>

            <div className="flex flex-col gap-[10px] border-t border-white/6 pt-4 text-[15px]">
              <div className="flex justify-between">
                <span className="num text-ink-soft">{riders} × {formatDKKCode(unit)}</span>
                <span className="num font-semibold">{formatDKKCode(total)}</span>
              </div>
              {withBike && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Bike and helmet for the day</span>
                  <span className="font-semibold text-ok">Included</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-white/6 pt-3">
                <span className="text-[16px] font-semibold">Total</span>
                <span className="num font-display text-[26px] font-bold tracking-[-.02em]">{formatDKKCode(total)}</span>
              </div>
            </div>

            <input type="hidden" name="dep" value={chosen ?? ""} />
            <button disabled={!dep || riders > dep.seatsLeft} className="rounded-full bg-white px-6 py-[15px] text-[16px] font-bold text-night hover:bg-ink-pale disabled:cursor-not-allowed disabled:bg-white/7 disabled:text-ink-dim">
              {withBike ? "Choose your bikes" : "Book"}
            </button>
            <span className="text-center text-[13px] leading-[1.5] text-ink-mute">{withBike ? "No payment yet — you'll pick a bike for each rider first." : "No payment yet — you pay at the shop on the day."}</span>
          </Form>
        </Card>
      </Shell>

      <Footer />
    </>
  );
}
