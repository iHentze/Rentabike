import { describe, expect, it } from "vitest";
import { dayBounds, faroeDay } from "./queries";

describe("Faroese days", () => {
  it("summer days start at 23:00 UTC the evening before, winter days at midnight UTC", () => {
    expect(dayBounds("2026-06-12")).toEqual({ start: Date.UTC(2026, 5, 11, 23), end: Date.UTC(2026, 5, 12, 23) });
    expect(dayBounds("2026-01-12")).toEqual({ start: Date.UTC(2026, 0, 12, 0), end: Date.UTC(2026, 0, 13, 0) });
  });
  it("the day containing an instant", () => {
    // 23:30 UTC on 11 June is already 12 June in Tórshavn
    expect(faroeDay(Date.UTC(2026, 5, 11, 23, 30)).date).toBe("2026-06-12");
    expect(faroeDay(Date.UTC(2026, 5, 11, 22, 30)).date).toBe("2026-06-11");
  });
});
