/**
 * The board on the counter: who is collecting today, who is bringing bikes
 * back, who is late, and which holds are still waiting for a card.
 */
import type { Route } from "./+types/today";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { todayBoard } from "~/lib/admin/queries";
import { staffAction, type StaffIntent } from "~/lib/admin/actions";
import { getBookingById } from "~/lib/booking/lookup";
import { originOf } from "~/lib/email/send";
import { BookingTable, Flash, QuickAction, Section } from "~/components/admin";
import { fmtLongDay } from "~/lib/format";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const board = await todayBoard(env.DB);
  return { board, now: Date.now() };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const form = await request.formData();
  const booking = await getBookingById(env.DB, String(form.get("booking") ?? ""));
  if (!booking) return { ok: false, message: "That booking is gone." };
  const intent = String(form.get("intent") ?? "") as StaffIntent;
  if (!["pickup", "return", "no_show", "confirm"].includes(intent)) return { ok: false, message: "Not from here." };
  return staffAction(env, ctx, booking, intent, staff.actor, { origin: originOf(request) });
}

export default function Today({ loaderData, actionData }: Route.ComponentProps) {
  const { board, now } = loaderData;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">{fmtLongDay(now)}</h1>
        <span className="num text-[14px] text-ink-mute">
          {board.counts.confirmedAhead} confirmed ahead · {board.counts.heldNow} holds open
        </span>
      </div>
      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}

      {board.overdue.length > 0 && (
        <Section title="Not back yet" count={board.overdue.length}>
          <BookingTable rows={board.overdue} empty="" actions={(b) => <QuickAction bookingId={b.id} intent="return" label="Returned" tone="primary" />} />
        </Section>
      )}

      <Section title="Collecting today" count={board.pickups.length}>
        <BookingTable
          rows={board.pickups}
          empty="Nobody is collecting today."
          actions={(b) =>
            b.status === "confirmed" ? (
              <div className="flex gap-2">
                <QuickAction bookingId={b.id} intent="pickup" label="Handed over" tone="primary" />
                {b.startAt < now - 2 * 3_600_000 && <QuickAction bookingId={b.id} intent="no_show" label="No-show" tone="danger" confirm={`Mark ${b.code} as a no-show?`} />}
              </div>
            ) : b.status === "held" ? (
              <QuickAction bookingId={b.id} intent="confirm" label="Paid at counter" confirm={`Confirm ${b.code} as paid at the counter? The card payment, if any, will be ignored.`} />
            ) : null
          }
        />
      </Section>

      <Section title="Coming back today" count={board.returns.length}>
        <BookingTable rows={board.returns} empty="No returns due today." actions={(b) => <QuickAction bookingId={b.id} intent="return" label="Returned" tone="primary" />} />
      </Section>

      {board.holds.length > 0 && (
        <Section title="Waiting for a card" count={board.holds.length}>
          <p className="-mt-1 text-[13.5px] text-ink-mute">Bikes are held for thirty minutes while the customer pays. These release themselves; confirm one only if they paid at the counter.</p>
          <BookingTable rows={board.holds} empty="" actions={(b) => <QuickAction bookingId={b.id} intent="confirm" label="Paid at counter" confirm={`Confirm ${b.code} without a card payment?`} />} />
        </Section>
      )}
    </div>
  );
}
