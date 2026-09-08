/**
 * The two emails a booking sends: "you're booked" and "it's cancelled".
 * Plain text first — it is what every client shows reliably — and an HTML
 * version with the same words in a single column that survives Outlook.
 */
import type { BookingView } from "~/lib/booking/lookup";
import type { Mail } from "./mailer";
import { bookingIcs } from "~/lib/booking/ics";
import { SHOP } from "~/components/site";
import { fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";
import { freeCancellationDeadline } from "~/lib/booking/cancellation";

export interface MailContext {
  /** "https://rentabike.fo" — links in the mail are absolute. */
  origin: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function firstName(b: BookingView): string {
  return b.customerName.split(/\s+/)[0] ?? b.customerName;
}

function lineText(b: BookingView): string[] {
  return b.lines.map((l) => {
    const who = l.riderLabel ? `${l.riderLabel} — ` : "";
    const qty = l.qty > 1 ? `${l.qty} × ` : "";
    const price = l.lineTotalMinor === 0 ? "included" : formatDKKCode(l.lineTotalMinor);
    return `${who}${qty}${l.label}${l.sizeLabel ? ` (${l.sizeLabel})` : ""}: ${price}`;
  });
}

function paymentText(b: BookingView): string {
  if (b.paymentMethod === "card") return b.paidMinor > 0 ? `Paid by card: ${formatDKKCode(b.paidMinor)}.` : "Card payment pending.";
  return `To pay when you collect: ${formatDKKCode(b.totalMinor)}. Cards and cash both work.`;
}

export function confirmationMail(b: BookingView, ctx: MailContext): Mail {
  const when = `${fmtLongDay(b.startAt)} ${fmtTime(b.startAt)} → ${fmtLongDay(b.endAt)} ${fmtTime(b.endAt)}`;
  const where = b.pickupName ?? SHOP.address;
  const back = b.dropoffName && b.dropoffName !== where ? `Return to ${b.dropoffName}.` : "Return to the same place.";
  const deadline = freeCancellationDeadline(b.startAt);
  const manage = `${ctx.origin}/booking?code=${b.code}`;
  const lines = lineText(b);
  const tour = b.kind === "tour";

  const text = [
    `Hi ${firstName(b)},`,
    "",
    tour ? `You're on the tour. Your code is ${b.code}.` : `Your bikes are booked. Your code is ${b.code}.`,
    "",
    `When: ${when}`,
    `Where: ${SHOP.name}, ${where}, ${SHOP.town}. ${back}`,
    b.pickupNote ? `Hand-over: ${b.pickupNote}` : null,
    "",
    "What's booked:",
    ...lines.map((l) => `  • ${l}`),
    `Total: ${formatDKKCode(b.totalMinor)}`,
    paymentText(b),
    "",
    `Bring the code and something with your name on it. Ten minutes to fit the ${tour ? "bikes" : "bikes"}; we adjust the seat post for you.`,
    `Free cancellation until ${fmtLongDay(deadline)} ${fmtTime(deadline)}: ${manage}`,
    "",
    `Questions? ${SHOP.phone} or ${SHOP.email}.`,
    "",
    SHOP.name,
    `${SHOP.address}, ${SHOP.town}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = shell(
    `${tour ? "You're on the tour" : "Your bikes are booked"} · ${b.code}`,
    `
    <p style="margin:0 0 14px">Hi ${esc(firstName(b))},</p>
    <p style="margin:0 0 18px">${tour ? "You're on the tour." : "Your bikes are booked."} Show this code at the counter:</p>
    <p style="margin:0 0 22px;font-size:34px;font-weight:700;letter-spacing:.08em;font-family:Georgia,serif">${esc(b.code)}</p>
    ${row("When", esc(when))}
    ${row("Where", `${esc(SHOP.name)}, ${esc(where)}, ${esc(SHOP.town)}. ${esc(back)}`)}
    ${b.pickupNote ? row("Hand-over", esc(b.pickupNote)) : ""}
    <h2 style="margin:22px 0 8px;font-size:15px">What's booked</h2>
    <ul style="margin:0 0 8px;padding-left:18px">${lines.map((l) => `<li style="margin:0 0 4px">${esc(l)}</li>`).join("")}</ul>
    <p style="margin:0 0 4px"><strong>Total ${esc(formatDKKCode(b.totalMinor))}</strong></p>
    <p style="margin:0 0 18px">${esc(paymentText(b))}</p>
    <p style="margin:0 0 10px">Bring the code and something with your name on it. Ten minutes to fit the bikes; we adjust the seat post for you.</p>
    <p style="margin:0 0 18px">Free cancellation until ${esc(fmtLongDay(deadline))} ${esc(fmtTime(deadline))} — <a href="${esc(manage)}" style="color:#0A78D6">manage your booking</a>.</p>
    <p style="margin:0">Questions? ${esc(SHOP.phone)} or <a href="mailto:${esc(SHOP.email)}" style="color:#0A78D6">${esc(SHOP.email)}</a>.</p>`,
  );

  return {
    to: b.customerEmail,
    subject: `${tour ? "You're on the tour" : "Booked"} · ${b.code} · ${fmtLongDay(b.startAt)}`,
    text,
    html,
    attachments: [{ filename: `rentabike-${b.code}.ics`, type: "text/calendar", content: bookingIcs(b) }],
  };
}

export function cancellationMail(b: BookingView, opts: { refundMinor: number; byShop: boolean; reason?: string }, ctx: MailContext): Mail {
  const refund =
    opts.refundMinor > 0
      ? `${formatDKKCode(opts.refundMinor)} goes back to your card; banks take three to five working days to show it.`
      : b.paymentMethod === "card" && b.paidMinor > 0
        ? "Under our terms the booking is inside the 48-hour window and stays charged. If there's a good reason, call us."
        : "Nothing was charged.";
  const text = [
    `Hi ${firstName(b)},`,
    "",
    `${opts.byShop ? "We've had to cancel" : "You've cancelled"} booking ${b.code} for ${fmtLongDay(b.startAt)}.`,
    opts.reason ? `Reason: ${opts.reason}` : null,
    refund,
    "",
    `Sorry it didn't work out this time. ${ctx.origin} is open whenever you want to book again.`,
    "",
    `${SHOP.name} · ${SHOP.phone} · ${SHOP.email}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  const html = shell(
    `Cancelled · ${b.code}`,
    `<p style="margin:0 0 14px">Hi ${esc(firstName(b))},</p>
    <p style="margin:0 0 14px">${opts.byShop ? "We've had to cancel" : "You've cancelled"} booking <strong>${esc(b.code)}</strong> for ${esc(fmtLongDay(b.startAt))}.</p>
    ${opts.reason ? `<p style="margin:0 0 14px">Reason: ${esc(opts.reason)}</p>` : ""}
    <p style="margin:0 0 18px">${esc(refund)}</p>
    <p style="margin:0">Sorry it didn't work out this time. <a href="${esc(ctx.origin)}" style="color:#0A78D6">rentabike.fo</a> is open whenever you want to book again.</p>`,
  );
  return { to: b.customerEmail, subject: `Cancelled · ${b.code}`, text, html };
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 8px"><span style="display:inline-block;min-width:84px;color:#6B7A88;font-size:12px;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</span>${value}</p>`;
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f7"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px">
<tr><td style="padding:22px 28px 6px;font-weight:700;color:#0A78D6;font-size:14px;letter-spacing:.02em">RENT A BIKE &amp; OUTDOOR</td></tr>
<tr><td style="padding:6px 28px 26px">${body}</td></tr>
<tr><td style="padding:14px 28px 22px;border-top:1px solid #e6eaee;color:#6B7A88;font-size:12px">${esc(SHOP.name)} · ${esc(SHOP.address)}, ${esc(SHOP.town)} · ${esc(SHOP.phone)}</td></tr>
</table></td></tr></table></body></html>`;
}
