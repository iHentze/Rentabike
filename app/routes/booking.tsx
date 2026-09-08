import { Form, Link } from "react-router";
import type { Route } from "./+types/booking";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, Lbl, Note, PillLink, cx } from "~/components/ui";
import { Calendar, Check, Shield, Warning } from "~/components/icons";
import { getBookingByCode, type BookingView } from "~/lib/booking/lookup";
import { FREE_CANCELLATION_HOURS, freeCancellationDeadline, refundFor } from "~/lib/booking/cancellation";
import { canTransition, transition } from "~/lib/booking/lifecycle";
import { releaseSeats } from "~/lib/admin/actions";
import { refundBooking } from "~/lib/payments/settle";
import { sendCancellation, originOf } from "~/lib/email/send";
import type { BookingStatus } from "~/db/schema";
import { fmtDayTime, fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export function meta(_: Route.MetaArgs) {
  return [{ title: "My booking — Rent a Bike & Outdoor" }];
}

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "mute" }> = {
  held: { label: "Held — awaiting payment", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  picked_up: { label: "Out riding", tone: "ok" },
  returned: { label: "Returned — thank you", tone: "mute" },
  cancelled: { label: "Cancelled", tone: "mute" },
  expired: { label: "Expired — the hold ran out", tone: "mute" },
  no_show: { label: "No-show", tone: "mute" },
};

/** The email on the booking is the key: nobody else can read or cancel it. */
async function find(d1: D1Database, code: string, email: string): Promise<BookingView | "wrong-email" | null> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 6) return null;
  const booking = await getBookingByCode(d1, clean);
  if (!booking) return null;
  if (booking.customerEmail.trim().toLowerCase() !== email.trim().toLowerCase()) return "wrong-email";
  return booking;
}

function view(booking: BookingView, now: number) {
  const status = STATUS[booking.status] ?? { label: booking.status, tone: "mute" as const };
  const cancellable = canTransition(booking.status as BookingStatus, "cancelled") && booking.startAt > now - 24 * 3_600_000;
  const refund = refundFor(booking.startAt, now, booking.totalMinor, "customer");
  return { booking, status, cancellable, deadline: freeCancellationDeadline(booking.startAt).getTime(), free: refund.fraction === 1, hoursBefore: refund.hoursBefore };
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const email = url.searchParams.get("email") ?? "";
  if (code && email) {
    const found = await find(env.DB, code, email);
    if (found && found !== "wrong-email") return { code, email, found: view(found, Date.now()), error: null as string | null, done: null as string | null };
    return { code, email, found: null, error: found === "wrong-email" ? "email" : "code", done: null as string | null };
  }
  return { code, email, found: null, error: null as string | null, done: null as string | null };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "find");
  const code = String(form.get("code") ?? "");
  const email = String(form.get("email") ?? "");
  const found = await find(env.DB, code, email);
  if (!found || found === "wrong-email") return { code, email, found: null, error: found === "wrong-email" ? "email" : "code", done: null as string | null };

  if (intent === "cancel") {
    const now = Date.now();
    const v = view(found, now);
    if (!v.cancellable) return { code, email, found: v, error: "not-cancellable", done: null as string | null };
    const refund = refundFor(found.startAt, now, found.paidMinor - found.refundedMinor, "customer");
    await transition(env.DB, { bookingId: found.id, from: found.status as BookingStatus, to: "cancelled", actor: "customer", note: refund.reason, now });
    await releaseSeats(env.DB, found);
    // Money back through ePay when the rule says so; an uncaptured authorisation is always released.
    const money = await refundBooking(env, found.id, refund.refundMinor, "customer", refund.reason, now).catch((err) => {
      console.error(`refund failed for ${found.code}:`, err);
      return { refundedMinor: 0, voided: false };
    });
    ctx.waitUntil(sendCancellation(env, { ...found, status: "cancelled" }, { refundMinor: money.voided ? found.paidMinor : money.refundedMinor, byShop: false }, originOf(request)));
    const after = await getBookingByCode(env.DB, found.code);
    return { code, email, found: after ? view(after, now) : null, error: null as string | null, done: refund.fraction === 1 ? "free" : "charged" };
  }
  return { code, email, found: view(found, Date.now()), error: null as string | null, done: null as string | null };
}

export default function MyBooking({ loaderData, actionData }: Route.ComponentProps) {
  const data = actionData ?? loaderData;
  const { code, email, found, error, done } = data;

  return (
    <>
      <Header />
      <Shell className="flex flex-col gap-6 px-5 pb-14 pt-9 md:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[34px] font-bold tracking-[-.026em] md:text-[44px]">My booking</h1>
          <p className="max-w-[58ch] text-[16px] text-ink-soft">The six-letter code from your confirmation, and the email you booked with.</p>
        </div>

        <Form method="post" className="flex flex-col gap-3 rounded-card bg-card p-[22px] md:max-w-[760px]">
          <input type="hidden" name="intent" value="find" />
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <label className="flex flex-col gap-[7px]">
              <Lbl>Code</Lbl>
              <input name="code" defaultValue={code} required minLength={6} maxLength={7} autoCapitalize="characters" placeholder="A7F3C2" className="num rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[16px] font-bold tracking-[.12em] uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright" />
            </label>
            <label className="flex flex-col gap-[7px]">
              <Lbl>Email</Lbl>
              <input name="email" type="email" defaultValue={email} required className="rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[15.5px] focus:outline-2 focus:outline-brand-bright" />
            </label>
            <button className="self-end rounded-full bg-white px-6 py-[13px] text-[15px] font-bold text-night hover:bg-ink-pale">Find it</button>
          </div>
          {error === "code" && <span className="text-[14px] text-danger">No booking with that code. It's six letters and digits — check the confirmation email.</span>}
          {error === "email" && <span className="text-[14px] text-danger">That's not the email on this booking.</span>}
        </Form>

        {found && (
          <div className="grid gap-5 md:max-w-[760px]">
            {done === "free" && (
              <Card className="flex gap-3 bg-ok/12 px-5 py-4 text-[14.5px] leading-[1.5]">
                <Check size={18} className="mt-[2px] shrink-0 text-ok" />
                <span>Cancelled. Nothing is owed — you were outside the {FREE_CANCELLATION_HOURS}-hour window. The bikes are back on sale.</span>
              </Card>
            )}
            {done === "charged" && (
              <Note icon={<Warning size={17} />} title="Cancelled inside the 48-hour window">
                The booking is cancelled. Under our terms it is still charged in full; if there's a good reason, call {SHOP.phone} and we'll talk.
              </Note>
            )}
            {error === "not-cancellable" && <Note icon={<Warning size={17} />}>This booking can't be cancelled online any more. Call {SHOP.phone}.</Note>}

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="num font-display text-[26px] font-bold tracking-[.08em]">{found.booking.code}</span>
                  <span className={cx("rounded-full px-3 py-1 text-[12px] font-bold", found.status.tone === "ok" ? "bg-ok/16 text-ok" : found.status.tone === "warn" ? "bg-warn/16 text-warn" : "bg-white/8 text-ink-soft")}>{found.status.label}</span>
                </div>
                <span className="text-[14px] text-ink-soft">{found.booking.customerName}</span>
              </div>
              <div className="flex flex-col gap-4 px-5 py-4">
                <div className="flex items-start gap-3">
                  <Calendar size={18} className="mt-[3px] shrink-0 text-brand-bright" />
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[15.5px] font-semibold">
                      {fmtDayTime(found.booking.startAt)} → {fmtDayTime(found.booking.endAt)}
                    </span>
                    <span className="text-[13.5px] text-ink-mute">
                      {found.booking.kind === "tour" ? "Meet at" : "Collect at"} {found.booking.pickupName ?? SHOP.address}
                      {found.booking.dropoffName && found.booking.dropoffName !== found.booking.pickupName && ` · return to ${found.booking.dropoffName}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-white/6 pt-4">
                  {found.booking.lines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-4 text-[14.5px]">
                      <span className={cx(l.kind === "fee" || l.kind === "addon" ? "text-ink-soft" : "")}>
                        {l.riderLabel ? `${l.riderLabel} · ` : ""}
                        {l.label}
                        {l.qty > 1 && ` ×${l.qty}`}
                      </span>
                      <span className="num shrink-0">{l.lineTotalMinor === 0 ? <span className="text-ok">Included</span> : formatDKKCode(l.lineTotalMinor)}</span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between border-t border-white/6 pt-3">
                    <span className="text-[15.5px] font-semibold">Total · pay at the shop</span>
                    <span className="num font-display text-[24px] font-bold tracking-[-.02em]">{formatDKKCode(found.booking.totalMinor)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {found.cancellable && (
              <Card className="flex flex-col gap-4 p-5">
                <div className="flex items-start gap-[14px]">
                  <div className={cx("flex size-11 shrink-0 items-center justify-center rounded-full", found.free ? "bg-ok/16 text-ok" : "bg-warn/18 text-warn")}>
                    <Shield size={21} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[16px] font-semibold">{found.free ? `Free cancellation until ${fmtTime(found.deadline)} on ${fmtLongDay(found.deadline)}` : "Inside the 48-hour window"}</span>
                    <span className="text-[14.5px] leading-[1.5] text-ink-soft">
                      {found.free ? "Cancel before then and nothing is owed." : "Cancelling now still counts as a full booking under our terms, because other people were turned away. Weather cancellations are always free — that's our call, not yours, and we make it the evening before."}
                    </span>
                  </div>
                </div>
                <Form method="post" className="flex flex-wrap items-center gap-3" onSubmit={(e) => { if (!confirm("Cancel this booking?")) e.preventDefault(); }}>
                  <input type="hidden" name="intent" value="cancel" />
                  <input type="hidden" name="code" value={found.booking.code} />
                  <input type="hidden" name="email" value={email} />
                  <button className={cx("rounded-full px-6 py-[12px] text-[15px] font-bold", found.free ? "bg-white/9 hover:bg-white/14" : "bg-danger/20 text-danger hover:bg-danger/30")}>
                    {found.free ? "Cancel this booking" : "Cancel anyway"}
                  </button>
                  <span className="text-[13.5px] text-ink-mute">Need to change dates or bikes instead? Call {SHOP.phone} — quicker than cancelling and rebooking.</span>
                </Form>
              </Card>
            )}

            <div className="flex flex-wrap gap-3">
              <PillLink to={`/booked/${found.booking.code}`} tone="ghost">
                Confirmation page
              </PillLink>
              <a href={`/booked/${found.booking.code}/calendar.ics`} className="inline-flex items-center rounded-full bg-white/9 px-6 py-[13px] text-[15px] font-semibold hover:bg-white/14">
                Add to calendar
              </a>
            </div>
          </div>
        )}

        {!found && !error && (
          <p className="text-[14px] text-ink-mute">
            Lost the code? Call {SHOP.phone} or write to {SHOP.email} with the name on the booking. <Link to="/" className="font-semibold text-brand-bright hover:text-ink">Back to the start</Link>
          </p>
        )}
      </Shell>
      <Footer />
    </>
  );
}
