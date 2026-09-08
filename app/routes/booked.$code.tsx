import type { Route } from "./+types/booked.$code";
import { cloudflareContext } from "~/context";
import { Footer, Plaque, SHOP, Shell } from "~/components/site";
import { Card, Lbl, PillLink, Row, cx } from "~/components/ui";
import { Calendar, Check, Download } from "~/components/icons";
import { getBookingByCode } from "~/lib/booking/lookup";
import { freeCancellationDeadline } from "~/lib/booking/cancellation";
import { fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `Booked · ${loaderData.booking.code} — Rent a Bike & Outdoor` : "Booked — Rent a Bike & Outdoor" }];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const booking = await getBookingByCode(env.DB, params.code);
  if (!booking) throw new Response("Not found", { status: 404 });
  const swapped = new URL(request.url).searchParams.get("swapped");
  return {
    booking,
    deadline: freeCancellationDeadline(booking.startAt).getTime(),
    swapped: swapped ? swapped.split("→") : null,
  };
}

const STATUS_LABEL: Record<string, string> = {
  held: "Held — payment pending",
  confirmed: "Confirmed",
  picked_up: "Out riding",
  returned: "Returned",
  cancelled: "Cancelled",
  expired: "Expired",
  no_show: "No-show",
};

export default function Booked({ loaderData }: Route.ComponentProps) {
  const { booking, deadline, swapped } = loaderData;
  const first = booking.customerName.split(/\s+/)[0] ?? booking.customerName;
  const bikes = booking.lines.filter((l) => l.kind === "bike");
  const seats = booking.lines.filter((l) => l.kind === "tour_seat");
  const others = booking.lines.filter((l) => l.kind === "addon" || l.kind === "fee");
  const live = booking.status === "confirmed" || booking.status === "held" || booking.status === "picked_up";
  const pay = paymentWords(booking, deadline);

  return (
    <>
      {/* colour field */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(178deg,#0A78D6_0%,#0A5AA8_34%,#0A2338_76%,#070E15_100%)]" />
        <div className="absolute left-1/2 top-[-140px] -ml-[320px] size-[640px] rounded-full bg-[radial-gradient(circle,rgba(90,190,255,.40)_0%,rgba(90,190,255,0)_68%)]" />
        <div className="absolute right-[-60px] top-[60px] h-[380px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(46,212,122,.20)_0%,rgba(46,212,122,0)_66%)]" />
        <Shell className="relative px-5 pb-[54px] pt-[22px] md:px-8">
          <Plaque size={30} />
          <div className="flex flex-col items-center gap-[18px] pt-11 text-center">
            <div className={cx("flex size-16 items-center justify-center rounded-full", live ? "bg-ok text-ok-ink" : "bg-white/20 text-ink")}>
              <Check size={34} strokeWidth={3} />
            </div>
            <div className="flex flex-col items-center gap-[10px]">
              <span className="text-[15px] text-white/72">{live ? `Show this at ${SHOP.address} on ${fmtLongDay(booking.startAt)}` : STATUS_LABEL[booking.status] ?? booking.status}</span>
              <span className="num font-display text-[56px] font-bold leading-none tracking-[.06em] md:text-[76px]">{booking.code}</span>
              <h1 className="font-display text-[26px] font-semibold tracking-[-.016em] text-white/90">{live ? `You're booked, ${first}` : `${first}, this booking is ${STATUS_LABEL[booking.status]?.toLowerCase() ?? booking.status}`}</h1>
            </div>
            {booking.status === "held" && (
              <a href={`/pay/${booking.code}`} className="inline-flex items-center gap-[9px] rounded-full bg-ok px-7 py-[14px] text-[16px] font-bold text-ok-ink hover:brightness-110">
                Pay {formatDKKCode(booking.totalMinor)} by card
              </a>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-[6px]">
              <a href={`/booked/${booking.code}/calendar.ics`} className="inline-flex items-center gap-[9px] rounded-full bg-white px-6 py-[13px] text-[15px] font-bold text-night hover:bg-ink-pale">
                <Calendar size={18} /> Add to calendar
              </a>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-[9px] rounded-full bg-white/18 px-6 py-[13px] text-[15px] font-semibold hover:bg-white/26">
                <Download size={18} /> Save or print
              </button>
            </div>
            <span className="text-[13.5px] text-white/60">Screenshot this — the code is all you need at the shop.</span>
          </div>
        </Shell>
      </section>

      <Shell className="flex flex-col items-center gap-[26px] px-5 pb-11 pt-[6px] md:px-8">
        <div className="flex w-full max-w-[760px] flex-col gap-[26px]">
          {swapped && swapped.length === 2 && (
            <Card className="flex gap-3 bg-brand/14 px-5 py-4 text-[14.5px] leading-[1.5]">
              <Check size={18} className="mt-[2px] shrink-0 text-brand-bright" />
              <span>
                The <strong className="font-semibold">{swapped[0]}</strong> went while you were booking, so we put you on the <strong className="font-semibold">{swapped[1]}</strong> — the closest we had, at the same price or less, as you asked.
              </span>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            <Lbl>What happens next</Lbl>
            <Card className="px-2 py-[6px]">
              <Row
                icon={<span className="text-[14px] font-bold">1</span>}
                iconTone="brand"
                title={booking.status === "held" ? "Pay by card to confirm" : "We email your confirmation"}
                sub={
                  booking.status === "held"
                    ? `The bikes are held for you${booking.holdExpiresAt ? ` until ${fmtTime(booking.holdExpiresAt)}` : ""}. Nothing is charged yet.`
                    : `Within a few minutes, to ${booking.customerEmail}, with a calendar file. ${booking.paymentMethod === "card" ? `Paid by card: ${formatDKKCode(booking.paidMinor)}.` : `${formatDKKCode(booking.totalMinor)} to pay when you collect — card or cash.`}`
                }
              />
              <div className="hairline mx-[14px]" />
              <Row icon={<span className="text-[14px] font-bold">2</span>} iconTone="brand" title={`${booking.pickupName ?? SHOP.address}, ${fmtLongDay(booking.startAt)} ${fmtTime(booking.startAt)}`} sub={booking.pickupNote ?? "Bring the code and something with your name on it. Ten minutes for fitting."} />
              <div className="hairline mx-[14px]" />
              <Row icon={<span className="text-[14px] font-bold">3</span>} iconTone="brand" title={`Back to ${booking.dropoffName ?? booking.pickupName ?? SHOP.address} by ${fmtLongDay(booking.endAt)} ${fmtTime(booking.endAt)}`} sub={`Someone's there ${SHOP.hours}. Call ahead if you're late — it's fine.`} />
            </Card>
          </div>

          <div className="grid gap-[18px] md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Lbl>{booking.kind === "tour" ? "Your tour" : "Your bikes"}</Lbl>
              <Card className="flex flex-col gap-[13px] p-[18px]">
                {seats.map((l, i) => (
                  <div key={`s${i}`} className="flex flex-col gap-[1px]">
                    <span className="text-[14.5px] font-semibold">{l.label}</span>
                    <span className="num text-[12.5px] text-ink-mute">{l.qty} × {formatDKKCode(l.unitPriceMinor)}</span>
                  </div>
                ))}
                {bikes.map((l, i) => (
                  <div key={i} className="flex items-center gap-[13px]">
                    <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-brand/22 text-[13px] font-bold text-brand-bright">{(l.riderLabel ?? String(i + 1)).slice(0, 1).toUpperCase()}</div>
                    <div className="flex min-w-0 flex-col gap-[1px]">
                      <span className="truncate text-[14.5px] font-semibold">{l.label}{l.qty > 1 ? ` ×${l.qty}` : ""}</span>
                      <span className="text-[12.5px] text-ink-mute">{[l.riderLabel, l.sizeLabel ? `Size ${l.sizeLabel}` : null].filter(Boolean).join(" · ") || "For the booking"}</span>
                    </div>
                  </div>
                ))}
                {others.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-white/6 pt-3">
                    {others.map((l, i) => (
                      <div key={i} className="flex justify-between text-[13px] text-ink-soft">
                        <span>
                          {l.label}
                          {l.qty > 1 ? ` ×${l.qty}` : ""}
                          {l.riderLabel && <span className="text-ink-mute"> · {l.riderLabel}</span>}
                        </span>
                        <span className="num">{formatDKKCode(l.lineTotalMinor)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <span className="pt-1 text-[13px] font-medium text-ok">{booking.kind === "tour" ? "Helmets included on every guided ride" : "Everything is packed with the bikes before you arrive"}</span>
              </Card>
            </div>
            <div className="flex flex-col gap-3">
              <Lbl>Payment</Lbl>
              <Card className="flex flex-col gap-[13px] p-[18px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="num font-display text-[30px] font-bold tracking-[-.02em]">{formatDKKCode(booking.totalMinor)}</span>
                  <span className={cx("inline-flex items-center gap-[7px] whitespace-nowrap rounded-full px-[13px] py-[6px] text-[12.5px] font-bold", pay.tone === "warn" ? "bg-warn/16 text-warn" : pay.tone === "ok" ? "bg-ok/16 text-ok" : "bg-white/8 text-ink-soft")}>
                    <span className="size-[7px] rounded-full bg-current" />
                    {pay.chip}
                  </span>
                </div>
                <span className="text-[13px] leading-[1.55] text-ink-mute">{pay.text}</span>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <PillLink to={`/booking?code=${booking.code}`} tone="ghost">
              Manage this booking
            </PillLink>
            <PillLink to="/tours" tone="brand" className="ml-auto">
              Add a guided tour
            </PillLink>
          </div>
        </div>
      </Shell>

      <Footer />
    </>
  );
}

/** The payment card: what has been charged, and what cancelling would mean now. */
function paymentWords(b: { status: string; paymentMethod: "shop" | "card"; paidMinor: number; refundedMinor: number; totalMinor: number }, deadline: number): { chip: string; tone: "ok" | "warn" | "mute"; text: string } {
  const now = Date.now();
  const window = now < deadline ? `Free cancellation until ${fmtTime(deadline)} on ${fmtLongDay(deadline)} — after that the booking is charged in full.` : `The free-cancellation window closed ${fmtLongDay(deadline)} — a cancellation now is charged in full.`;
  if (b.status === "held") return { chip: "Payment pending", tone: "warn", text: "Nothing is charged until the card goes through. The bikes are held meanwhile." };
  if (b.status === "cancelled" || b.status === "expired" || b.status === "no_show") {
    return { chip: STATUS_LABEL[b.status] ?? b.status, tone: "mute", text: b.refundedMinor > 0 ? `${formatDKKCode(b.refundedMinor)} has been refunded to the card.` : b.paidMinor > 0 ? "The card payment stands under our terms." : "Nothing was charged." };
  }
  if (b.paymentMethod === "card" && b.paidMinor > 0) return { chip: "Paid by card", tone: "ok", text: `${formatDKKCode(b.paidMinor)} paid by card through ePay. ${window.replace("charged in full", "not refunded")}` };
  return { chip: b.status === "returned" ? "Settled at the shop" : "Pay at the shop", tone: b.status === "returned" ? "mute" : "warn", text: `Nothing has been charged. Pay by card or cash when you collect. ${window}` };
}
