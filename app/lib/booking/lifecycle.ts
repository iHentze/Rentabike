/**
 * The booking state machine — rule C.
 *
 *   draft → held → confirmed → picked_up → returned
 *             │        │            │
 *             ▼        ▼            ▼
 *          expired  cancelled    no_show
 *
 * Only `held`, `confirmed` and `picked_up` consume inventory, so releasing a
 * booking is a status change and nothing else — the capacity subquery stops
 * counting it the moment the row flips.
 *
 * Every transition is a CONDITIONAL update carrying the expected current
 * status, asserted with `meta.changes === 1`. Two staff members cannot both
 * cancel the same booking, and a webhook cannot confirm a booking the sweeper
 * has already expired: the loser writes zero rows and is told why.
 *
 * Every transition writes an audit row in the same batch — who, when, from,
 * to. `cancelled` is only ever written by a person; `expired` only by the
 * sweeper.
 */
import type { BookingStatus } from "~/db/schema";

const ALLOWED: Record<BookingStatus, readonly BookingStatus[]> = {
  draft: ["held", "cancelled"],
  held: ["confirmed", "expired", "cancelled"],
  confirmed: ["picked_up", "cancelled", "no_show"],
  picked_up: ["returned"],
  returned: [],
  expired: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function allowedFrom(from: BookingStatus): readonly BookingStatus[] {
  return ALLOWED[from];
}

/** Statuses a booking can never leave. */
export function isTerminal(status: BookingStatus): boolean {
  return ALLOWED[status].length === 0;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: "illegal" | "conflict" | "missing",
  ) {
    super(message);
  }
}

export interface TransitionInput {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  /** 'customer' | 'sweeper' | 'webhook' | a staff email. */
  actor: string;
  note?: string;
  now?: number;
}

/**
 * Move a booking between statuses, or fail loudly. Never silently no-ops:
 * a caller that does not check the result would otherwise report success
 * for a booking somebody else already moved.
 */
export async function transition(d1: D1Database, input: TransitionInput): Promise<void> {
  const { bookingId, from, to, actor } = input;
  const now = input.now ?? Date.now();

  if (!canTransition(from, to)) {
    throw new TransitionError(
      `illegal transition ${from} → ${to}` +
        (isTerminal(from) ? ` (${from} is terminal)` : ` (allowed: ${ALLOWED[from].join(", ") || "none"})`),
      "illegal",
    );
  }

  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE bookings
            SET status = ?3,
                updated_at = ?4,
                hold_expires_at = CASE WHEN ?3 = 'held' THEN hold_expires_at ELSE NULL END
          WHERE id = ?1 AND status = ?2`,
      )
      .bind(bookingId, from, to, now),
    // Guarded on the UPDATE's row count: SQLite's changes() reports the rows
    // modified by the immediately preceding statement, and a D1 batch runs its
    // statements in order inside one transaction. Without this, a rejected
    // transition would still leave an audit row claiming it happened — a log
    // that lies is worse than no log.
    d1
      .prepare(
        `INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at)
         SELECT ?1,'booking',?2,?3,?4,?5,?6,?7 WHERE changes() = 1`,
      )
      .bind(crypto.randomUUID(), bookingId, from, to, actor, input.note ?? null, now),
  ]);

  if ((results[0]?.meta?.changes ?? 0) !== 1) {
    const row = await d1.prepare(`SELECT status FROM bookings WHERE id = ?1`).bind(bookingId).first<{ status: string }>();
    if (!row) throw new TransitionError(`booking ${bookingId} does not exist`, "missing");
    throw new TransitionError(
      `booking ${bookingId} is ${row.status}, not ${from} — somebody moved it first`,
      "conflict",
    );
  }
}
