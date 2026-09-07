import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applySchema, env, seedBike, truncateAll } from "~/test/db";
import { findGuideConflicts, validateTourForPublish } from "./validate";

const T0 = Date.UTC(2026, 5, 3, 9, 15, 0); // Wed 3 June 2026, 10:15 Faroese

async function makeTour(
  id: string,
  opts: { requiresBike?: boolean; title?: string; summary?: string; body?: string; durationMin?: number } = {},
) {
  await env.DB.prepare(
    `INSERT INTO tours (id, slug, title, category, difficulty, summary, body, duration_min,
                        meeting_point, pricing_mode, requires_bike, published, created_at, updated_at)
     VALUES (?1,?1,?2,'bike','Moderate',?3,?4,?5,'Sverrisgøta 20','per_person',?6,0,0,0)`,
  )
    .bind(
      id,
      opts.title ?? "Viewpoint Norðadalsskarð",
      opts.summary ?? "A ride to the pass",
      opts.body ?? "Long copy",
      opts.durationMin ?? 180,
      opts.requiresBike === false ? 0 : 1,
    )
    .run();
}

async function addSchedule(tourId: string, priceMinor = 94000) {
  await env.DB.prepare(
    `INSERT INTO tour_schedules (id, tour_id, season_start, season_end, weekday_mask, start_time,
                                 capacity, price_minor, min_participants, booking_cutoff_hours, active)
     VALUES (?1,?2,'2026-06-01','2026-08-31',2,'10:15',8,?3,0,12,1)`,
  )
    .bind(`sched-${tourId}`, tourId, priceMinor)
    .run();
}

async function addDeparture(id: string, tourId: string, startsAt: number, guideId: string | null) {
  await env.DB.prepare(
    `INSERT INTO tour_departures (id, tour_id, starts_at, ends_at, capacity, seats_taken,
                                  price_minor, min_participants, status, guide_id, is_private, created_at)
     VALUES (?1,?2,?3,?4,8,0,94000,0,'open',?5,0,0)`,
  )
    .bind(id, tourId, startsAt, startsAt + 3 * 3_600_000, guideId)
    .run();
}

async function addGuide(id: string, name: string, mtbCertified: boolean) {
  await env.DB.prepare(`INSERT INTO guides (id, name, mtb_certified, active) VALUES (?1,?2,?3,1)`)
    .bind(id, name, mtbCertified ? 1 : 0)
    .run();
}

beforeAll(applySchema);
beforeEach(truncateAll);

describe("rule F6 — the checkout dead end", () => {
  it("refuses to publish a tour that needs a bike but allows none", async () => {
    await makeTour("t1");
    await addSchedule("t1");

    const r = await validateTourForPublish(env.DB, "t1");
    expect(r.publishable).toBe(false);
    expect(r.problems.map((p) => p.code)).toContain("requires_bike_without_options");
  });

  it("publishes once an allowed bike type exists", async () => {
    await makeTour("t1");
    await addSchedule("t1");
    await seedBike("gravel-54", 4);
    await env.DB.prepare(`INSERT INTO tour_bike_types (tour_id, bike_type_id) VALUES ('t1','gravel-54')`).run();

    const r = await validateTourForPublish(env.DB, "t1");
    expect(r.publishable).toBe(true);
    expect(r.problems.filter((p) => p.severity === "error")).toHaveLength(0);
  });

  it("a hike needs no bike and publishes without one", async () => {
    await makeTour("hike", { requiresBike: false, title: "Skyline Summit of Streymoy" });
    await addSchedule("hike");
    const r = await validateTourForPublish(env.DB, "hike");
    expect(r.publishable).toBe(true);
  });
});

describe("other publish blockers", () => {
  it("refuses a tour with no schedule — it could never produce a departure", async () => {
    await makeTour("t1", { requiresBike: false });
    const r = await validateTourForPublish(env.DB, "t1");
    expect(r.problems.map((p) => p.code)).toContain("no_schedule");
    expect(r.publishable).toBe(false);
  });

  it("refuses a tour priced at zero — every real tour has a price", async () => {
    await makeTour("t1", { requiresBike: false });
    await addSchedule("t1", 0);
    const r = await validateTourForPublish(env.DB, "t1");
    expect(r.problems.map((p) => p.code)).toContain("no_price");
  });

  it("refuses a tour with no description", async () => {
    await makeTour("t1", { requiresBike: false, summary: "  ", body: "" });
    await addSchedule("t1");
    const r = await validateTourForPublish(env.DB, "t1");
    expect(r.problems.map((p) => p.code)).toContain("no_copy");
  });

  it("warns, but still publishes, when nothing is listed as included", async () => {
    await makeTour("t1", { requiresBike: false });
    await addSchedule("t1");
    const r = await validateTourForPublish(env.DB, "t1");
    expect(r.publishable).toBe(true);
    expect(r.problems.find((p) => p.code === "no_inclusions")?.severity).toBe("warning");
  });

  it("reports a tour that does not exist", async () => {
    const r = await validateTourForPublish(env.DB, "nope");
    expect(r.publishable).toBe(false);
    expect(r.problems[0]?.code).toBe("missing");
  });
});

describe("defect 17 — guide capacity", () => {
  it("flags the two tours the catalogue puts on Wednesday 10:15", async () => {
    await makeTour("ebike", { title: "City Sightseeing E-bike Tour" });
    await makeTour("epic", { title: "Adventure Mountain Bike Epic Tour" });
    await addDeparture("d1", "ebike", T0, null);
    await addDeparture("d2", "epic", T0, null);

    const conflicts = await findGuideConflicts(env.DB, T0 - 3_600_000, T0 + 3_600_000);
    expect(conflicts.some((c) => c.reason === "unstaffed")).toBe(true);
    const unstaffed = conflicts.find((c) => c.reason === "unstaffed")!;
    expect(unstaffed.departureIds.sort()).toEqual(["d1", "d2"]);
  });

  it("is quiet when both simultaneous tours have their own guide", async () => {
    await addGuide("g1", "Berit", false);
    await addGuide("g2", "Jákup", true);
    await makeTour("ebike", { title: "City Sightseeing E-bike Tour" });
    await makeTour("epic", { title: "Adventure Mountain Bike Epic Tour" });
    await addDeparture("d1", "ebike", T0, "g1");
    await addDeparture("d2", "epic", T0, "g2");

    expect(await findGuideConflicts(env.DB, T0 - 3_600_000, T0 + 3_600_000)).toHaveLength(0);
  });

  it("catches one guide booked onto two departures at the same minute", async () => {
    await addGuide("g1", "Berit", true);
    await makeTour("a", { title: "City Sightseeing E-bike Tour" });
    await makeTour("b", { title: "Hike and Bike Plateau" });
    await addDeparture("d1", "a", T0, "g1");
    await addDeparture("d2", "b", T0, "g1");

    const conflicts = await findGuideConflicts(env.DB, T0 - 3_600_000, T0 + 3_600_000);
    expect(conflicts.some((c) => c.reason === "same_guide")).toBe(true);
  });

  it("catches an MTB tour staffed by an uncertified guide", async () => {
    await addGuide("g1", "Berit", false);
    await makeTour("epic", { title: "Adventure Mountain Bike Epic Tour" });
    await addDeparture("d1", "epic", T0, "g1");

    const conflicts = await findGuideConflicts(env.DB, T0 - 3_600_000, T0 + 3_600_000);
    expect(conflicts.map((c) => c.reason)).toContain("needs_certified_mtb");
  });

  it("a single staffed departure is never a conflict", async () => {
    await addGuide("g1", "Berit", false);
    await makeTour("ebike", { title: "City Sightseeing E-bike Tour" });
    await addDeparture("d1", "ebike", T0, "g1");
    expect(await findGuideConflicts(env.DB, T0 - 3_600_000, T0 + 3_600_000)).toHaveLength(0);
  });

  it("ignores cancelled departures", async () => {
    await makeTour("a", { title: "A" });
    await makeTour("b", { title: "B" });
    await addDeparture("d1", "a", T0, null);
    await addDeparture("d2", "b", T0, null);
    await env.DB.prepare("UPDATE tour_departures SET status='cancelled' WHERE id='d2'").run();
    expect(await findGuideConflicts(env.DB, T0 - 3_600_000, T0 + 3_600_000)).toHaveLength(0);
  });
});
