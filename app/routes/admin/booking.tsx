import { Fragment } from "react";
/**
 * One booking, everything about it, and the buttons that move it. The
 * audit trail is at the bottom because that is where the question "who did
 * this and when" gets asked.
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/booking";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { auditFor, paymentsFor } from "~/lib/admin/queries";
import { staffAction, swapBike, swapCandidates, type StaffIntent } from "~/lib/admin/actions";
import { getBookingById } from "~/lib/booking/lookup";
import { allowedFrom } from "~/lib/booking/lifecycle";
import type { BookingStatus } from "~/db/schema";
import { originOf } from "~/lib/email/send";
import { Flash, PayChip, StatusChip } from "~/components/admin";
import { Card, cx } from "~/components/ui";
import { fmtDayTime, fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";
import { SHOP } from "~/components/site";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const booking = await getBookingById(env.DB, params.id);
  if (!booking) throw new Response("Not found", { status: 404 });
  const [audit, payments] = await Promise.all([auditFor(env.DB, booking.id), paymentsFor(env.DB, booking.id)]);
  const url = new URL(request.url);
  // Straight from the counter form: say so once.
  const justBooked = url.searchParams.get("new") === booking.code;
  // "Change" on a bike line: the bikes that could take its place over this booking's window.
  const swap = url.searchParams.get("swap");
  const candidates = swap ? await swapCandidates(env.DB, booking, swap) : [];
  return { booking, audit, payments, can: allowedFrom(booking.status as BookingStatus), epay: Boolean(env.EPAY_API_KEY && env.EPAY_POS_ID), justBooked, swap, candidates };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const booking = await getBookingById(env.DB, params.id);
  if (!booking) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  if (form.get("intent") === "swap") {
    return swapBike(env.DB, booking, String(form.get("line") ?? ""), String(form.get("bike") ?? ""), staff.actor);
  }
  const intent = String(form.get("intent") ?? "") as StaffIntent;
  return staffAction(env, ctx, booking, intent, staff.actor, {
    reason: String(form.get("reason") ?? "").trim().slice(0, 300) || undefined,
    notes: String(form.get("notes") ?? ""),
    origin: originOf(request),
  });
}

const BTN = "rounded-full px-[16px] py-[9px] text-[14px] font-semibold";

export default function AdminBooking({ loaderData, actionData }: Route.ComponentProps) {
  const { booking: b, audit, payments, can, epay, justBooked, swap, candidates } = loaderData;
  const swappable = ["held", "confirmed", "picked_up"].includes(b.status);
  const bikes = b.lines.filter((l) => l.kind === "bike" || l.kind === "tour_seat");
  const rest = b.lines.filter((l) => l.kind === "addon" || l.kind === "fee");
  // Whatever is not yet paid — by card online or in cash at the counter — is what the counter still takes.
  const owed = Math.max(0, b.totalMinor - (b.paidMinor - b.refundedMinor));
  const authorisedOnly = payments.some((p) => p.status === "authorized");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/admin/bookings" className="text-[14px] font-semibold text-brand-bright hover:text-ink">
          ← Bookings
        </Link>
        <h1 className="num font-display text-[32px] font-bold tracking-[.06em]">{b.code}</h1>
        <StatusChip status={b.status} />
        <span className="text-[13px] text-ink-mute">{b.kind === "tour" ? "Tour" : "Rental"} · booked {fmtDayTime(b.createdAt)}</span>
      </div>
      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}
      {justBooked && !actionData && (
        <Flash ok>
          Booked at the counter as {b.code}.{b.customerEmail ? " The confirmation is on its way." : " No email on this one — the code is what they bring."}{" "}
          <Link to="/admin/new" className="font-semibold underline">
            Take another
          </Link>
        </Flash>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="lbl">Customer</span>
              <span className="text-[16px] font-semibold">{b.customerName}</span>
              <a href={`mailto:${b.customerEmail}`} className="text-[14px] text-brand-bright hover:text-ink">
                {b.customerEmail}
              </a>
              {b.customerPhone && (
                <a href={`tel:${b.customerPhone}`} className="num text-[14px] text-brand-bright hover:text-ink">
                  {b.customerPhone}
                </a>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="lbl">When and where</span>
              <span className="num text-[15px]">
                {fmtLongDay(b.startAt)} {fmtTime(b.startAt)}
              </span>
              <span className="num text-[15px]">
                → {fmtLongDay(b.endAt)} {fmtTime(b.endAt)}
              </span>
              <span className="text-[14px] text-ink-soft">
                {b.pickupName ?? SHOP.address}
                {b.dropoffName && b.dropoffName !== b.pickupName ? ` → ${b.dropoffName}` : ""}
              </span>
            </div>
            {b.notes && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="lbl">Customer wrote</span>
                <span className="text-[14.5px] leading-[1.5] text-ink-soft">{b.notes}</span>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-white/6 px-5 py-3 text-[15px] font-semibold">What's booked</div>
            <table className="w-full text-[14px]">
              <tbody>
                {[...bikes, ...rest].map((l, i) => (
                  <Fragment key={l.id ?? i}>
                    <tr className="border-b border-white/6 last:border-0">
                      <td className="px-5 py-[10px]">
                        {l.riderLabel && <span className="font-semibold">{l.riderLabel} · </span>}
                        {l.qty > 1 ? `${l.qty} × ` : ""}
                        {l.label}
                        {l.sizeLabel ? <span className="text-ink-mute"> · {l.sizeLabel}</span> : null}
                        {l.kind === "bike" && swappable && (
                          <Link to={swap === l.id ? `/admin/bookings/${b.id}` : `/admin/bookings/${b.id}?swap=${l.id}#swap`} className="ml-3 text-[13px] font-semibold text-brand-bright hover:text-ink">
                            {swap === l.id ? "Keep it" : "Change"}
                          </Link>
                        )}
                      </td>
                      <td className="num px-5 py-[10px] text-right">{l.lineTotalMinor === 0 ? <span className="text-ok">included</span> : formatDKKCode(l.lineTotalMinor)}</td>
                    </tr>
                    {swap === l.id && (
                      <tr id="swap" className="border-b border-white/6 bg-brand/8">
                        <td colSpan={2} className="px-5 py-3">
                          {candidates.length === 0 ? (
                            <span className="text-[13.5px] text-ink-soft">Nothing else is free for these dates{b.kind === "tour" ? " on this tour" : ""}.</span>
                          ) : (
                            <Form method="post" className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="intent" value="swap" />
                              <input type="hidden" name="line" value={l.id} />
                              <select name="bike" className="min-w-[280px] flex-1 rounded-field bg-white/10 px-[11px] py-[8px] text-[13.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] focus:outline-2 focus:outline-brand-bright">
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                    {c.riderMinCm && c.riderMaxCm ? ` · ${c.riderMinCm}–${c.riderMaxCm} cm` : ""} · {c.free} free
                                    {b.kind === "tour" ? "" : ` · ${formatDKKCode(c.tripMinor)}${c.tripMinor !== l.lineTotalMinor ? ` (${c.tripMinor > l.lineTotalMinor ? "+" : "−"}${formatDKKCode(Math.abs(c.tripMinor - l.lineTotalMinor)).replace("DKK ", "")})` : ""}`}
                                  </option>
                                ))}
                              </select>
                              <button className="rounded-full bg-white px-4 py-[8px] text-[13.5px] font-bold text-night hover:bg-ink-pale">Swap</button>
                              <span className="text-[12.5px] text-ink-mute">Same dates, re-priced for the new bike; the difference is settled at the counter.</span>
                            </Form>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                <tr>
                  <td className="px-5 py-3 text-[15px] font-semibold">Total</td>
                  <td className="num px-5 py-3 text-right text-[16px] font-bold">{formatDKKCode(b.totalMinor)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold">Money</span>
              <PayChip b={b} />
            </div>
            <div className="mt-3 grid gap-2 text-[14px] sm:grid-cols-3">
              <div>
                <div className="lbl">Paid so far</div>
                <div className="num text-[16px] font-semibold">{formatDKKCode(b.paidMinor)}</div>
              </div>
              <div>
                <div className="lbl">Refunded</div>
                <div className="num text-[16px] font-semibold">{formatDKKCode(b.refundedMinor)}</div>
              </div>
              <div>
                <div className="lbl">To take at the counter</div>
                <div className={cx("num text-[16px] font-semibold", owed > 0 && b.status !== "cancelled" ? "text-warn" : "text-ok")}>{b.status === "cancelled" ? "—" : formatDKKCode(owed)}</div>
              </div>
            </div>
            {payments.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1 border-t border-white/6 pt-3 text-[13px] text-ink-mute">
                {payments.map((p) => (
                  <li key={p.id} className="num">
                    {fmtDayTime(p.createdAt)} · {p.status} · {formatDKKCode(p.amountMinor)}
                    {p.capturedMinor > 0 ? ` · captured ${formatDKKCode(p.capturedMinor)}` : ""}
                    {p.refundedMinor > 0 ? ` · refunded ${formatDKKCode(p.refundedMinor)}` : ""}
                    {p.transactionId ? ` · tx ${p.transactionId}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {epay && authorisedOnly && b.status !== "cancelled" && (
              <Form method="post" className="mt-3">
                <input type="hidden" name="intent" value="capture" />
                <button className={cx(BTN, "bg-white/10 hover:bg-white/16")}>Capture the card now</button>
              </Form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <span className="text-[15px] font-semibold">Actions</span>
            {can.includes("picked_up") && (
              <Form method="post">
                <input type="hidden" name="intent" value="pickup" />
                <button className={cx(BTN, "w-full bg-white text-night hover:bg-ink-pale")}>Handed over{authorisedOnly ? " — and capture the card" : ""}</button>
              </Form>
            )}
            {can.includes("returned") && (
              <Form method="post">
                <input type="hidden" name="intent" value="return" />
                <button className={cx(BTN, "w-full bg-white text-night hover:bg-ink-pale")}>Bikes returned</button>
              </Form>
            )}
            {can.includes("confirmed") && (
              <Form method="post" onSubmit={(e) => { if (!window.confirm("Confirm without a card payment? Use this when they paid at the counter.")) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="confirm" />
                <input type="hidden" name="reason" value="paid at the counter" />
                <button className={cx(BTN, "w-full bg-white/10 hover:bg-white/16")}>Paid at the counter</button>
              </Form>
            )}
            {can.includes("no_show") && (
              <Form method="post" onSubmit={(e) => { if (!window.confirm(`Mark ${b.code} as a no-show? Card money stays charged.`)) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="no_show" />
                <button className={cx(BTN, "w-full bg-danger/14 text-danger hover:bg-danger/22")}>No-show</button>
              </Form>
            )}
            {can.includes("cancelled") && (
              <Form method="post" className="flex flex-col gap-2 border-t border-white/6 pt-3" onSubmit={(e) => { if (!window.confirm(`Cancel ${b.code}? The customer gets a full refund and an email.`)) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="cancel" />
                <input name="reason" placeholder="Reason — goes in the email (weather, bike broken…)" maxLength={300} className="rounded-field bg-white/10 px-[13px] py-[9px] text-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright" />
                <button className={cx(BTN, "w-full bg-danger/14 text-danger hover:bg-danger/22")}>Cancel booking — full refund</button>
              </Form>
            )}
            {can.length === 0 && <span className="text-[13.5px] text-ink-mute">Nothing more can happen to this booking.</span>}
          </Card>

          <Card className="p-5">
            <Form method="post" className="flex flex-col gap-2">
              <input type="hidden" name="intent" value="notes" />
              <label className="lbl" htmlFor="staff-notes">
                Staff notes
              </label>
              <textarea id="staff-notes" name="notes" rows={4} defaultValue={b.staffNotes ?? ""} placeholder="Only staff see this." className="rounded-field bg-white/10 px-[13px] py-[9px] text-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright" />
              <button className={cx(BTN, "self-start bg-white/10 hover:bg-white/16")}>Save note</button>
            </Form>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-white/6 px-5 py-3 text-[15px] font-semibold">History</div>
        <ul className="divide-y divide-white/6">
          {audit.map((a, i) => (
            <li key={i} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-[10px] text-[13.5px]">
              <span className="num w-[150px] text-ink-mute">{fmtDayTime(a.at)}</span>
              <span className="w-[120px] font-semibold">{a.actor}</span>
              <span className="text-ink-soft">
                {a.entity === "payment" ? "payment " : ""}
                {a.fromStatus == null && a.toStatus == null ? (a.note ?? "") : `${a.fromStatus ?? "—"} → ${a.toStatus ?? "—"}${a.note ? ` · ${a.note}` : ""}`}
              </span>
            </li>
          ))}
          {audit.length === 0 && <li className="px-5 py-3 text-[13.5px] text-ink-mute">No history yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
