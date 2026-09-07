import { describe, expect, it } from "vitest";
import {
  bookingIsOpen,
  faroeseWallClockToUtc,
  isFaroeseSummerTime,
  minimumFor,
  planDepartures,
  ScheduleError,
  SATURDAY,
  SUNDAY,
  THURSDAY,
  TUESDAY,
  WEDNESDAY,
} from "./departures";

/** The real Tuesday tour from the 16 Apr 2026 catalogue. */
const VIEWPOINT = {
  id: "sched-viewpoint",
  tourId: "viewpoint-nordadalsskard",
  seasonStart: "2026-06-01",
  seasonEnd: "2026-06-30",
  weekdayMask: TUESDAY,
  startTime: "10:15",
  capacity: 8,
  priceMinor: 94000,
  durationMin: 180,
};

describe("expanding a season — a whole summer from one row", () => {
  it("June 2026 has five Tuesdays", () => {
    const out = planDepartures(VIEWPOINT);
    expect(out).toHaveLength(5);
    expect(out.every((d) => d.startsAt.getUTCDay() === 2)).toBe(true);
  });

  it("carries capacity and price onto every departure", () => {
    for (const d of planDepartures(VIEWPOINT)) {
      expect(d.capacity).toBe(8);
      expect(d.priceMinor).toBe(94000);
      expect(d.endsAt.getTime() - d.startsAt.getTime()).toBe(180 * 60_000);
    }
  });

  it("handles a multi-weekday mask — the real schedule stacks three tours on Saturday", () => {
    const out = planDepartures({ ...VIEWPOINT, weekdayMask: SATURDAY | SUNDAY });
    // June 2026 starts on a Monday: four Saturdays (6, 13, 20, 27) and four
    // Sundays (7, 14, 21, 28).
    expect(out).toHaveLength(8);
    expect(out.map((d) => d.startsAt.getUTCDate())).toEqual([6, 7, 13, 14, 20, 21, 27, 28]);
    expect(new Set(out.map((d) => d.startsAt.getUTCDay()))).toEqual(new Set([0, 6]));
  });

  it("a season of one day yields one departure, or none if the weekday misses", () => {
    expect(planDepartures({ ...VIEWPOINT, seasonStart: "2026-06-02", seasonEnd: "2026-06-02" })).toHaveLength(1);
    expect(planDepartures({ ...VIEWPOINT, seasonStart: "2026-06-03", seasonEnd: "2026-06-03" })).toHaveLength(0);
  });

  it("rejects a nonsense season rather than generating garbage", () => {
    expect(() => planDepartures({ ...VIEWPOINT, seasonEnd: "2026-05-01" })).toThrow(ScheduleError);
    expect(() => planDepartures({ ...VIEWPOINT, weekdayMask: 0 })).toThrow(ScheduleError);
    expect(() => planDepartures({ ...VIEWPOINT, startTime: "25:00" })).toThrow(ScheduleError);
    expect(() => planDepartures({ ...VIEWPOINT, startTime: "1015" })).toThrow(ScheduleError);
    expect(() => planDepartures({ ...VIEWPOINT, seasonStart: "01-06-2026" })).toThrow(ScheduleError);
    expect(() => planDepartures({ ...VIEWPOINT, capacity: 0 })).toThrow(ScheduleError);
  });
});

describe("Faroese daylight saving — 10:15 is not one fixed UTC instant", () => {
  it("summer 10:15 is 09:15 UTC", () => {
    const d = faroeseWallClockToUtc(2026, 5, 2, 10, 15); // 2 June 2026
    expect(d.toISOString()).toBe("2026-06-02T09:15:00.000Z");
  });

  it("winter 10:15 is 10:15 UTC", () => {
    const d = faroeseWallClockToUtc(2026, 10, 3, 10, 15); // 3 November 2026
    expect(d.toISOString()).toBe("2026-11-03T10:15:00.000Z");
  });

  it("knows the EU changeover dates for 2026", () => {
    // Forward: last Sunday of March 2026 is the 29th, at 01:00 UTC.
    expect(isFaroeseSummerTime(Date.UTC(2026, 2, 29, 0, 59))).toBe(false);
    expect(isFaroeseSummerTime(Date.UTC(2026, 2, 29, 1, 0))).toBe(true);
    // Back: last Sunday of October 2026 is the 25th, at 01:00 UTC.
    expect(isFaroeseSummerTime(Date.UTC(2026, 9, 25, 0, 59))).toBe(true);
    expect(isFaroeseSummerTime(Date.UTC(2026, 9, 25, 1, 0))).toBe(false);
  });

  it("a season spanning the October change keeps 10:15 local on both sides", () => {
    const out = planDepartures({
      ...VIEWPOINT,
      seasonStart: "2026-10-18",
      seasonEnd: "2026-11-03",
      weekdayMask: TUESDAY,
    });
    // 20 Oct is summer time, 27 Oct and 3 Nov are winter time.
    expect(out.map((d) => d.startsAt.toISOString())).toEqual([
      "2026-10-20T09:15:00.000Z",
      "2026-10-27T10:15:00.000Z",
      "2026-11-03T10:15:00.000Z",
    ]);
  });
});

describe("the seasonal minimum — rule F2", () => {
  it("no minimum in June, July and August", () => {
    expect(minimumFor(new Date("2026-06-15T09:15:00Z"))).toBe(0);
    expect(minimumFor(new Date("2026-07-15T09:15:00Z"))).toBe(0);
    expect(minimumFor(new Date("2026-08-15T09:15:00Z"))).toBe(0);
  });

  it("two people from September to May", () => {
    for (const iso of [
      "2026-09-15T10:15:00Z",
      "2026-12-15T10:15:00Z",
      "2026-01-15T10:15:00Z",
      "2026-05-15T09:15:00Z",
    ]) {
      expect(minimumFor(new Date(iso))).toBe(2);
    }
  });

  it("a season crossing into September changes the minimum mid-run", () => {
    const out = planDepartures({
      ...VIEWPOINT,
      seasonStart: "2026-08-25",
      seasonEnd: "2026-09-08",
      weekdayMask: TUESDAY,
    });
    expect(out.map((d) => d.minParticipants)).toEqual([0, 2, 2]);
  });
});

describe("booking cutoff — rule F1", () => {
  const departure = new Date("2026-06-02T09:15:00Z");

  it("open 13 hours out, closed 11", () => {
    expect(bookingIsOpen(departure, departure.getTime() - 13 * 3_600_000, 12)).toBe(true);
    expect(bookingIsOpen(departure, departure.getTime() - 11 * 3_600_000, 12)).toBe(false);
  });

  it("exactly at the cutoff is still open", () => {
    expect(bookingIsOpen(departure, departure.getTime() - 12 * 3_600_000, 12)).toBe(true);
  });

  it("closed once it has started", () => {
    expect(bookingIsOpen(departure, departure.getTime() + 1000, 12)).toBe(false);
  });
});

describe("the real 2026 week, rebuilt from the catalogue", () => {
  it("places all thirteen tours on their catalogue weekdays", () => {
    const week = [
      { name: "Westward Journey", mask: 1 << 0, time: "10:15" },
      { name: "Viewpoint Norðadalsskarð", mask: TUESDAY, time: "10:15" },
      { name: "Pilgrims' Path (hike)", mask: TUESDAY, time: "15:15" },
      { name: "City Sightseeing E-bike", mask: WEDNESDAY, time: "10:15" },
      { name: "Adventure MTB Epic", mask: WEDNESDAY, time: "10:15" },
      { name: "Historical Kirkjubø", mask: THURSDAY, time: "10:15" },
      { name: "Skyline Summit Núgvan", mask: THURSDAY, time: "15:15" },
      { name: "Clifftop Sandoy", mask: 1 << 4, time: "10:15" },
      { name: "Run the Pilgrims' Path", mask: SATURDAY, time: "10:15" },
      { name: "Hike & Bike Kirkjubø", mask: SATURDAY, time: "13:15" },
      { name: "E-bike Photoshoot", mask: SATURDAY, time: "16:15" },
      { name: "Hike & Bike Plateau", mask: SUNDAY, time: "10:15" },
      { name: "Adventure MTB Light", mask: SUNDAY, time: "10:15" },
    ];

    for (const t of week) {
      const out = planDepartures({
        ...VIEWPOINT,
        weekdayMask: t.mask,
        startTime: t.time,
        seasonStart: "2026-06-01",
        seasonEnd: "2026-06-07",
      });
      expect(out, `${t.name} should run once in the first week of June`).toHaveLength(1);
    }
  });
});
