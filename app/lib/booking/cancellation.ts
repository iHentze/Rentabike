/**
 * Cancellation and refunds — rules D1 and D2.
 *
 *  D1  Free cancellation up to 48 hours before start; no refund after.
 *      Applies to rentals and tours alike.
 *  D2  Shop-initiated cancellation is ALWAYS a full refund, whatever the
 *      timing — weather, mechanical, guide unavailable, or a tour that missed
 *      its minimum. The customer never loses money on a decision the shop made.
 *
 * The old app had no refund logic at all: `refunded` and `voided` existed as
 * TypeScript union members that no code path ever wrote.
 *
 * Deliberately pure. Money decisions get unit tests, not a database.
 */

export const FREE_CANCELLATION_HOURS = 48;

export type CancelledBy = "customer" | "shop";

export interface RefundDecision {
  /** Fraction of the paid amount to return, 0–1. */
  fraction: number;
  refundMinor: number;
  reason: string;
  /** Hours between the cancellation and the booking start; negative if after. */
  hoursBefore: number;
}

export function refundFor(
  startAt: Date | number,
  now: Date | number,
  paidMinor: number,
  cancelledBy: CancelledBy,
): RefundDecision {
  if (!Number.isInteger(paidMinor) || paidMinor < 0) {
    throw new RangeError(`paidMinor must be a non-negative integer, got ${paidMinor}`);
  }
  const start = startAt instanceof Date ? startAt.getTime() : startAt;
  const at = now instanceof Date ? now.getTime() : now;
  const hoursBefore = (start - at) / 3_600_000;

  // D2 first — it overrides the clock in both directions.
  if (cancelledBy === "shop") {
    return {
      fraction: 1,
      refundMinor: paidMinor,
      reason: "Cancelled by Rent a Bike — full refund regardless of timing",
      hoursBefore,
    };
  }

  if (hoursBefore >= FREE_CANCELLATION_HOURS) {
    return {
      fraction: 1,
      refundMinor: paidMinor,
      reason: `Cancelled ${Math.floor(hoursBefore)} h before start — free cancellation`,
      hoursBefore,
    };
  }

  return {
    fraction: 0,
    refundMinor: 0,
    reason:
      hoursBefore < 0
        ? "Cancelled after the booking started — no refund"
        : `Cancelled ${Math.floor(hoursBefore)} h before start, inside the ${FREE_CANCELLATION_HOURS} h window — no refund`,
    hoursBefore,
  };
}

/** Whether a customer can still cancel free of charge — for the UI countdown. */
export function freeCancellationDeadline(startAt: Date | number): Date {
  const start = startAt instanceof Date ? startAt.getTime() : startAt;
  return new Date(start - FREE_CANCELLATION_HOURS * 3_600_000);
}
