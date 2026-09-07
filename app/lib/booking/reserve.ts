/**
 * The capacity guard — rules B1–B6. This is the technical heart.
 *
 * D1 HAS NO INTERACTIVE TRANSACTIONS. You cannot read a count, decide in
 * JavaScript, and write, all inside one transaction. The naive port of the old
 * PostgreSQL trigger has a race window that produces a double-booking under
 * exactly the conditions that matter: two people booking the last bike on a
 * summer morning.
 *
 * So the decision moves INTO the statement. Capacity is the WHERE clause of the
 * insert itself, and the application asserts `meta.changes === 1`. Zero rows
 * written means the bike went while the customer was typing — a clean, correct
 * "no longer available" instead of a silent overbooking.
 *
 * ONE FLEET (rule B1). A tour booking is an ordinary booking: one `tour_seat`
 * line plus N `bike` lines over the departure window, through this same guard,
 * in the same batch. That is the whole fix for tours and rentals double-booking
 * a single fleet (defect 10) — 8 riders on a Saturday tour now reduce what is
 * rentable on Saturday, automatically, because it is the same rows in the same
 * table. It also means a seat can never be sold without its bike.
 *
 * ATOMICITY, HONESTLY. `db.batch()` is one transaction and rolls back on error,
 * but a conditional INSERT that matches nothing is NOT an error — it commits
 * with changes = 0. So a partly-filled booking can commit. We therefore inspect
 * every result and issue a compensating DELETE when any line failed. Between
 * the batch committing and that DELETE, the successful lines briefly hold
 * inventory, so a concurrent customer may see "sold out" for a few milliseconds
 * when a bike was in fact free. That direction is deliberate: this design can
 * refuse a booking it could have taken, but it cannot take one it should have
 * refused. If that ever needs to be exact, the escape hatch is a Durable Object
 * as a serialization point — not worth a second store to keep consistent with
 * D1 at 500 bookings a month.
 */
import type { Quote, QuoteLine } from "~/lib/pricing/quote";
import { INVENTORY_HOLDING_STATUSES } from "~/db/schema";

const HOLDING = INVENTORY_HOLDING_STATUSES.map((s) => `'${s}'`).join(",");

export interface ReserveInput {
  quote: Quote;
  kind: "rental" | "tour";
  startAt: Date;
  endAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  pickupLocationId?: string;
  dropoffLocationId?: string;
  channel?: "web" | "counter" | "phone" | "reseller";
  notes?: string;
  /** Present for tour bookings: the departure whose seats are being taken. */
  tourDepartureId?: string;
  seats?: number;
  holdTtlMinutes?: number;
  now?: number;
}

export type ReserveResult =
  | { ok: true; bookingId: string; code: string; totalMinor: number }
  | { ok: false; reason: "sold_out"; unavailable: string[] };

export class ReserveError extends Error {}

const DEFAULT_HOLD_MINUTES = 30;

export async function reserveBooking(d1: D1Database, input: ReserveInput): Promise<ReserveResult> {
  const now = input.now ?? Date.now();
  const bookingId = crypto.randomUUID();
  const code = bookingCode(bookingId);
  const startMs = input.startAt.getTime();
  const endMs = input.endAt.getTime();
  if (!(endMs > startMs)) throw new ReserveError("end must be after start");

  const ttl = input.holdTtlMinutes ?? DEFAULT_HOLD_MINUTES;
  const holdExpiresAt = now + ttl * 60_000;

  const statements: D1PreparedStatement[] = [];

  // 1. The booking goes in as `held` immediately — NOT as a draft. `held` is an
  //    inventory-holding status, so a concurrent batch's capacity subquery sees
  //    these lines the moment this transaction commits. Batches serialize, so
  //    the second one to commit counts the first one's rows.
  statements.push(
    d1
      .prepare(
        `INSERT INTO bookings
           (id, code, kind, status, start_at, end_at, customer_name, customer_email,
            customer_phone, pickup_location_id, dropoff_location_id, channel, notes,
            total_minor, currency, hold_expires_at, created_at, updated_at)
         VALUES (?1,?2,?3,'held',?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'DKK',?14,?15,?15)`,
      )
      .bind(
        bookingId,
        code,
        input.kind,
        startMs,
        endMs,
        input.customerName,
        input.customerEmail,
        input.customerPhone ?? null,
        input.pickupLocationId ?? null,
        input.dropoffLocationId ?? null,
        input.channel ?? "web",
        input.notes ?? null,
        input.quote.totalMinor,
        holdExpiresAt,
        now,
      ),
  );

  // 2. Tour seats, if any. Same shape of guard: the decision is in the WHERE.
  //    `status = 'open'` also closes a cancelled or completed departure.
  const seatIndex = input.tourDepartureId ? statements.length : -1;
  if (input.tourDepartureId) {
    const seats = input.seats ?? 1;
    if (!Number.isInteger(seats) || seats < 1) throw new ReserveError("seats must be a positive integer");
    statements.push(
      d1
        .prepare(
          `UPDATE tour_departures
              SET seats_taken = seats_taken + ?2
            WHERE id = ?1
              AND status = 'open'
              AND seats_taken + ?2 <= capacity`,
        )
        .bind(input.tourDepartureId, seats),
    );
  }

  // 3. One statement per line. Bike lines carry the capacity check; addon, fee
  //    and tour_seat lines are unconditional because they consume no stock.
  const lineMeta: Array<{ index: number; label: string; guarded: boolean }> = [];
  for (const line of input.quote.lines) {
    const lineId = crypto.randomUUID();
    lineMeta.push({ index: statements.length, label: line.label, guarded: line.kind === "bike" });
    statements.push(
      line.kind === "bike"
        ? guardedBikeLine(d1, lineId, bookingId, line, startMs, endMs)
        : plainLine(d1, lineId, bookingId, line, input.tourDepartureId),
    );
  }

  const auditIndex = statements.length;
  statements.push(
    d1
      .prepare(
        `INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at)
         VALUES (?1,'booking',?2,NULL,'held',?3,?4,?5)`,
      )
      .bind(crypto.randomUUID(), bookingId, input.channel === "counter" ? "staff" : "customer", `hold ${ttl}m`, now),
  );

  const results = await d1.batch(statements);

  // Assert every guarded statement actually wrote its row.
  const unavailable: string[] = [];
  for (const m of lineMeta) {
    if (!m.guarded) continue;
    if (changesOf(results[m.index]) !== 1) unavailable.push(m.label);
  }
  const seatsTaken = seatIndex >= 0 && changesOf(results[seatIndex]) === 1;
  if (seatIndex >= 0 && !seatsTaken) unavailable.push("tour seats");
  void auditIndex;

  if (unavailable.length > 0) {
    // Compensate. ON DELETE CASCADE removes the lines that did land.
    //
    // The seat counter is NOT a booking_lines row, so the cascade does not
    // touch it: if the seats were taken but the bikes were gone, the seats
    // must be handed back explicitly or the departure would keep selling
    // capacity against a booking that no longer exists — a seat sold without
    // a bike, which is the exact failure this design exists to prevent.
    const undo: D1PreparedStatement[] = [d1.prepare(`DELETE FROM bookings WHERE id = ?1`).bind(bookingId)];
    if (seatsTaken) {
      undo.push(
        d1
          .prepare(`UPDATE tour_departures SET seats_taken = MAX(0, seats_taken - ?2) WHERE id = ?1`)
          .bind(input.tourDepartureId!, input.seats ?? 1),
      );
    }
    await d1.batch(undo);
    return { ok: false, reason: "sold_out", unavailable };
  }

  return { ok: true, bookingId, code, totalMinor: input.quote.totalMinor };
}

/**
 * The conditional insert. Unit price is a BOUND PARAMETER from the server
 * quote, never a column read — the flat `price_per_day` the old schema carried
 * no longer exists, and reading a price here would have quietly reintroduced
 * browser-influenced pricing into the one statement nobody wanted to touch.
 *
 * Overlap is half-open [start, end): `b.start_at < end AND b.end_at > start`,
 * so a bike returned at 14:00 is rentable at 14:00 (rule B3).
 */
function guardedBikeLine(
  d1: D1Database,
  lineId: string,
  bookingId: string,
  line: QuoteLine,
  startMs: number,
  endMs: number,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO booking_lines
         (id, booking_id, kind, bike_type_id, addon_id, tour_departure_id,
          rider_label, label, qty, unit_price_minor, line_total_minor)
       SELECT ?1, ?2, 'bike', bt.id, NULL, ?9, ?3, ?4, ?5, ?6, ?7
         FROM bike_types bt
        WHERE bt.id = ?8
          AND ?5 <= bt.stock - COALESCE((
                SELECT SUM(bl.qty)
                  FROM booking_lines bl
                  JOIN bookings b ON b.id = bl.booking_id
                 WHERE bl.bike_type_id = bt.id
                   AND bl.kind = 'bike'
                   AND b.status IN (${HOLDING})
                   AND b.start_at < ?11
                   AND b.end_at   > ?10
              ), 0)`,
    )
    .bind(
      lineId,
      bookingId,
      line.riderLabel ?? null,
      line.label,
      line.qty,
      line.unitPriceMinor,
      line.lineTotalMinor,
      line.bikeTypeId!,
      null,
      startMs,
      endMs,
    );
}

function plainLine(
  d1: D1Database,
  lineId: string,
  bookingId: string,
  line: QuoteLine,
  tourDepartureId?: string,
): D1PreparedStatement {
  return d1
    .prepare(
      `INSERT INTO booking_lines
         (id, booking_id, kind, bike_type_id, addon_id, tour_departure_id,
          rider_label, label, qty, unit_price_minor, line_total_minor)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`,
    )
    .bind(
      lineId,
      bookingId,
      line.kind,
      line.bikeTypeId ?? null,
      line.addonId ?? null,
      line.kind === "tour_seat" ? (tourDepartureId ?? null) : null,
      line.riderLabel ?? null,
      line.label,
      line.qty,
      line.unitPriceMinor,
      line.lineTotalMinor,
    );
}

function changesOf(result: D1Result | undefined): number {
  return result?.meta?.changes ?? 0;
}

/** Short, unambiguous at the counter: no O/0 or I/1 confusion. */
function bookingCode(uuid: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const hex = uuid.replace(/-/g, "");
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % alphabet.length];
  }
  return out;
}

/**
 * How many units of a bike type are free across a window. Read-only — used by
 * the catalogue to grey out sizes, NEVER to decide a booking. The decision
 * always lives in the conditional insert above.
 */
export async function availableUnits(
  d1: D1Database,
  bikeTypeId: string,
  startAt: Date,
  endAt: Date,
): Promise<number> {
  const row = await d1
    .prepare(
      `SELECT bt.stock - COALESCE((
                SELECT SUM(bl.qty)
                  FROM booking_lines bl
                  JOIN bookings b ON b.id = bl.booking_id
                 WHERE bl.bike_type_id = bt.id
                   AND bl.kind = 'bike'
                   AND b.status IN (${HOLDING})
                   AND b.start_at < ?3
                   AND b.end_at   > ?2
              ), 0) AS free
         FROM bike_types bt
        WHERE bt.id = ?1`,
    )
    .bind(bikeTypeId, startAt.getTime(), endAt.getTime())
    .first<{ free: number }>();
  return Math.max(0, row?.free ?? 0);
}
