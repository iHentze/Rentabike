import { describe, expect, it } from "vitest";
import { assertMinor, formatDKK, formatDKKCode, kronerToMinor, percentOf } from "./money";

describe("money is integer øre — rule A8", () => {
  it("formats in Danish convention, fixed locale", () => {
    // The old app made 40 bare toLocaleString() calls, so a visitor's browser
    // decided how their price was punctuated — in a payment flow.
    expect(formatDKK(255000)).toMatch(/2\.550/);
    expect(formatDKK(94000)).toMatch(/940/);
  });

  it("formats the canvas style with the code first", () => {
    expect(formatDKKCode(255000)).toBe("DKK 2,550");
    expect(formatDKKCode(94000)).toBe("DKK 940");
    expect(formatDKKCode(0)).toBe("DKK 0");
  });

  it("converts the export's kroner to øre", () => {
    expect(kronerToMinor(450)).toBe(45000);
    expect(kronerToMinor(1.5)).toBe(150);
    expect(kronerToMinor(14000)).toBe(1400000);
  });

  it("takes a percentage without leaving fractional øre", () => {
    expect(percentOf(45000, 50)).toBe(22500);
    expect(percentOf(33333, 50)).toBe(16667);
    expect(Number.isInteger(percentOf(33333, 33))).toBe(true);
  });

  it("refuses a float or a string where øre are expected", () => {
    expect(() => formatDKK(12.5)).toThrow(TypeError);
    expect(() => assertMinor("450")).toThrow(TypeError);
    expect(() => assertMinor(Number.NaN)).toThrow(TypeError);
    expect(() => kronerToMinor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
