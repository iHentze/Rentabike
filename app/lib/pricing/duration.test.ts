import { describe, expect, it } from "vitest";
import { billableDays, tierDays } from "./duration";

const h = (hours: number) => hours * 3_600_000;
const T0 = Date.UTC(2026, 5, 12, 10, 0, 0); // Fri 12 Jun 2026 10:00Z

describe("billableDays — rule A1", () => {
  it("28 h (10:00 Mon → 14:00 Tue) bills 1.5 days — the decided case", () => {
    expect(billableDays(T0, T0 + h(28))).toBe(1.5);
  });

  it("exactly 24 h bills 1 day", () => {
    expect(billableDays(T0, T0 + h(24))).toBe(1);
  });

  it("25 h rounds up to 1.5", () => {
    expect(billableDays(T0, T0 + h(25))).toBe(1.5);
  });

  it("10 h bills the 1-day minimum, never a half", () => {
    expect(billableDays(T0, T0 + h(10))).toBe(1);
  });

  it("1 minute bills the 1-day minimum", () => {
    expect(billableDays(T0, T0 + 60_000)).toBe(1);
  });

  it("36 h bills 1.5, 37 h bills 2", () => {
    expect(billableDays(T0, T0 + h(36))).toBe(1.5);
    expect(billableDays(T0, T0 + h(37))).toBe(2);
  });

  it("3 × 24 h bills exactly 3 — the canonical basket", () => {
    expect(billableDays(T0, T0 + h(72))).toBe(3);
  });

  it("accepts Date objects and epoch ms interchangeably", () => {
    expect(billableDays(new Date(T0), new Date(T0 + h(28)))).toBe(1.5);
    expect(billableDays(new Date(T0), T0 + h(28))).toBe(1.5);
  });

  it("refuses a window that ends before it starts", () => {
    expect(() => billableDays(T0, T0)).toThrow(RangeError);
    expect(() => billableDays(T0, T0 - h(1))).toThrow(RangeError);
  });

  it("refuses invalid dates", () => {
    expect(() => billableDays(Number.NaN, T0)).toThrow(RangeError);
    expect(() => billableDays(new Date("nope"), T0)).toThrow(RangeError);
  });
});

describe("tierDays — rule A2", () => {
  it("1.5 days prices at the 2-day band, keeping the curve monotonic", () => {
    expect(tierDays(1)).toBe(1);
    expect(tierDays(1.5)).toBe(2);
    expect(tierDays(2)).toBe(2);
    expect(tierDays(6.5)).toBe(7);
    expect(tierDays(13.5)).toBe(14);
  });
});
