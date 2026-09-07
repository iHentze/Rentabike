/**
 * Rule A8 — all money is integer øre. Never a float, never a string.
 *
 * The old app made 40 bare `toLocaleString()` calls, so a visitor's browser
 * locale decided how their price was punctuated — in a payment flow. This is
 * the one place a number becomes a string.
 */

export type Minor = number;

const DKK = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 245000 → "2.450 kr." */
export function formatDKK(minor: Minor): string {
  assertMinor(minor);
  return DKK.format(minor / 100);
}

/** Canvas style: 245000 → "DKK 2,450". Used where the design shows the code first. */
export function formatDKKCode(minor: Minor): string {
  assertMinor(minor);
  const whole = Math.round(minor / 100);
  return `DKK ${whole.toLocaleString("en-GB")}`;
}

/** 450 → 45000. For seeding from the WooCommerce export's "kr.450.00". */
export function kronerToMinor(kroner: number): Minor {
  if (!Number.isFinite(kroner)) throw new RangeError(`kronerToMinor: not a number: ${kroner}`);
  return Math.round(kroner * 100);
}

/** Percent of an amount, rounded to the øre. Used for half days (50%) and refunds. */
export function percentOf(minor: Minor, percent: number): Minor {
  assertMinor(minor);
  return Math.round((minor * percent) / 100);
}

export function assertMinor(v: unknown): asserts v is Minor {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new TypeError(`money must be an integer number of øre, got ${String(v)}`);
  }
}
