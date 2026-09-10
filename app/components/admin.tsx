/** Small parts shared by the counter screens. */
import { Form, Link } from "react-router";
import type { ReactNode } from "react";
import { cx } from "./ui";
import type { BookingRow } from "~/lib/admin/queries";
import { fmtDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export const STATUS: Record<string, { label: string; tone: string }> = {
  held: { label: "Held", tone: "bg-warn/16 text-warn" },
  confirmed: { label: "Confirmed", tone: "bg-brand/18 text-brand-bright" },
  picked_up: { label: "Out", tone: "bg-ok/16 text-ok" },
  returned: { label: "Returned", tone: "bg-white/8 text-ink-soft" },
  cancelled: { label: "Cancelled", tone: "bg-white/8 text-ink-mute" },
  expired: { label: "Expired", tone: "bg-white/8 text-ink-mute" },
  no_show: { label: "No-show", tone: "bg-danger/16 text-danger" },
  draft: { label: "Draft", tone: "bg-white/8 text-ink-mute" },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "bg-white/8 text-ink-soft" };
  return <span className={cx("inline-block whitespace-nowrap rounded-full px-[10px] py-[3px] text-[12px] font-bold", s.tone)}>{s.label}</span>;
}

export function PayChip({ b }: { b: Pick<BookingRow, "paymentMethod" | "paidMinor" | "refundedMinor" | "totalMinor" | "status"> }) {
  if (b.paymentMethod === "shop") {
    // Money taken at the counter is recorded on the booking; the card path never sets this without a card row.
    if (b.totalMinor > 0 && b.paidMinor - b.refundedMinor >= b.totalMinor) return <span className="text-[12.5px] font-semibold text-ok">paid at counter</span>;
    return <span className="text-[12.5px] text-ink-mute">pay at counter</span>;
  }
  const net = b.paidMinor - b.refundedMinor;
  if (b.refundedMinor > 0) return <span className="text-[12.5px] text-ink-mute">refunded {formatDKKCode(b.refundedMinor)}</span>;
  if (net >= b.totalMinor && b.totalMinor > 0) return <span className="text-[12.5px] font-semibold text-ok">paid by card</span>;
  return <span className="text-[12.5px] text-warn">card pending</span>;
}

export function Flash({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={cx("rounded-field px-4 py-3 text-[14.5px]", ok ? "bg-ok/12 text-ok" : "bg-danger/12 text-danger")}>{children}</div>;
}

/** One-click transitions from a list. `intent` is what staffAction understands. */
export function QuickAction({ bookingId, intent, label, tone = "ghost", confirm }: { bookingId: string; intent: string; label: string; tone?: "ghost" | "primary" | "danger"; confirm?: string }) {
  return (
    <Form method="post" onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>
      <input type="hidden" name="booking" value={bookingId} />
      <input type="hidden" name="intent" value={intent} />
      <button
        className={cx(
          "whitespace-nowrap rounded-full px-[14px] py-[7px] text-[13.5px] font-semibold",
          tone === "primary" ? "bg-white text-night hover:bg-ink-pale" : tone === "danger" ? "bg-danger/14 text-danger hover:bg-danger/22" : "bg-white/10 text-ink hover:bg-white/16",
        )}
      >
        {label}
      </button>
    </Form>
  );
}

export function BookingTable({ rows, empty, actions }: { rows: BookingRow[]; empty: string; actions?: (b: BookingRow) => ReactNode }) {
  if (rows.length === 0) return <p className="px-1 py-3 text-[14.5px] text-ink-mute">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-card bg-card">
      <table className="w-full min-w-[720px] border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
            <th className="px-4 py-3 font-semibold">Code</th>
            <th className="px-3 py-3 font-semibold">Customer</th>
            <th className="px-3 py-3 font-semibold">When</th>
            <th className="px-3 py-3 font-semibold">Bikes</th>
            <th className="px-3 py-3 font-semibold">Where</th>
            <th className="px-3 py-3 text-right font-semibold">Total</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            {actions && <th className="px-3 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-white/6 align-top">
              <td className="px-4 py-3">
                <Link to={`/admin/bookings/${b.id}`} className="num font-display text-[16px] font-bold tracking-[.06em] text-brand-bright hover:text-ink">
                  {b.code}
                </Link>
                <div className="text-[12px] text-ink-mute">{b.kind === "tour" ? "tour" : "rental"}</div>
              </td>
              <td className="px-3 py-3">
                <div className="font-semibold">{b.customerName}</div>
                <div className="text-[12.5px] text-ink-mute">{b.customerPhone ?? b.customerEmail}</div>
              </td>
              <td className="num whitespace-nowrap px-3 py-3">
                <div>
                  {fmtDay(b.startAt)} {fmtTime(b.startAt)}
                </div>
                <div className="text-[12.5px] text-ink-mute">
                  → {fmtDay(b.endAt)} {fmtTime(b.endAt)}
                </div>
              </td>
              <td className="max-w-[260px] px-3 py-3 text-[13.5px] text-ink-soft">{b.summary || "—"}</td>
              <td className="px-3 py-3 text-[13.5px] text-ink-soft">
                {b.pickupName ?? "Shop"}
                {b.dropoffName && b.dropoffName !== b.pickupName ? ` → ${b.dropoffName}` : ""}
              </td>
              <td className="num whitespace-nowrap px-3 py-3 text-right">
                <div className="font-semibold">{formatDKKCode(b.totalMinor)}</div>
                <PayChip b={b} />
              </td>
              <td className="px-3 py-3">
                <StatusChip status={b.status} />
              </td>
              {actions && <td className="px-3 py-3">{actions(b)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2 text-[17px] font-semibold tracking-[-.01em]">
        {title}
        {count !== undefined && <span className="num text-[13px] font-normal text-ink-mute">{count}</span>}
      </h2>
      {children}
    </section>
  );
}
