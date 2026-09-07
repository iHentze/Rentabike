/**
 * Publish-time validation for tours, and the guide-capacity check.
 *
 * RULE F6 — a tour with `requiresBike` and zero allowed bike types must never
 * reach the site. That combination is today's permanent dead end: the flow
 * takes the "Book Now" branch, ships `needsBike: true` with every bike id
 * null, and checkout then blocks submission forever with no interface anywhere
 * to choose a bike. A customer who reaches it cannot buy, and nothing tells
 * them why. Catching it at publish is the only place it can be caught cheaply.
 *
 * DEFECT 17 — nothing in the old system modelled guide capacity. Under the
 * 16 Apr 2026 catalogue two pairs of tours depart at the same minute
 * (Wednesday 10:15 and Sunday 10:15). Each needs its own guide, and the MTB
 * tours need a *certified* MTB guide. Selling both to a shop that can staff
 * one is a worse failure than showing sold out: you find out on the morning,
 * in front of the customer.
 */

export type Severity = "error" | "warning";

export interface Problem {
  severity: Severity;
  code: string;
  message: string;
}

export interface TourValidationResult {
  publishable: boolean;
  problems: Problem[];
}

/** Everything publish-worthiness depends on, in four small queries. */
export async function validateTourForPublish(d1: D1Database, tourId: string): Promise<TourValidationResult> {
  const tour = await d1
    .prepare(
      `SELECT id, title, requires_bike, category, difficulty, duration_min, summary, body
         FROM tours WHERE id = ?1`,
    )
    .bind(tourId)
    .first<{
      id: string;
      title: string;
      requires_bike: number;
      category: string;
      difficulty: string;
      duration_min: number;
      summary: string;
      body: string;
    }>();

  if (!tour) {
    return { publishable: false, problems: [{ severity: "error", code: "missing", message: `no tour ${tourId}` }] };
  }

  const [bikeOptions, schedules, inclusions] = await Promise.all([
    d1.prepare(`SELECT COUNT(*) c FROM tour_bike_types WHERE tour_id = ?1`).bind(tourId).first<{ c: number }>(),
    d1
      .prepare(`SELECT COUNT(*) c, MIN(price_minor) minp FROM tour_schedules WHERE tour_id = ?1 AND active = 1`)
      .bind(tourId)
      .first<{ c: number; minp: number | null }>(),
    d1.prepare(`SELECT COUNT(*) c FROM tour_inclusions WHERE tour_id = ?1`).bind(tourId).first<{ c: number }>(),
  ]);

  const problems: Problem[] = [];

  // F6 — the dead end.
  if (tour.requires_bike === 1 && (bikeOptions?.c ?? 0) === 0) {
    problems.push({
      severity: "error",
      code: "requires_bike_without_options",
      message:
        `"${tour.title}" needs a bike but lists no allowed bike types. ` +
        `A customer would reach checkout with no way to choose one and could never complete the booking.`,
    });
  }

  if ((schedules?.c ?? 0) === 0) {
    problems.push({
      severity: "error",
      code: "no_schedule",
      message: `"${tour.title}" has no active schedule, so it can never produce a departure to book.`,
    });
  }

  if ((schedules?.minp ?? 0) <= 0) {
    problems.push({
      severity: "error",
      code: "no_price",
      message: `"${tour.title}" has a schedule priced at zero — every one of the thirteen tours has a real price.`,
    });
  }

  if (!tour.summary?.trim() || !tour.body?.trim()) {
    problems.push({ severity: "error", code: "no_copy", message: `"${tour.title}" is missing its description.` });
  }

  if ((tour.duration_min ?? 0) <= 0) {
    problems.push({ severity: "error", code: "no_duration", message: `"${tour.title}" has no duration.` });
  }

  if ((inclusions?.c ?? 0) === 0) {
    problems.push({
      severity: "warning",
      code: "no_inclusions",
      message: `"${tour.title}" lists nothing as included. The catalogue states what every tour includes.`,
    });
  }

  return { publishable: !problems.some((p) => p.severity === "error"), problems };
}

// ---------------------------------------------------------------------------
// Guide capacity — defect 17
// ---------------------------------------------------------------------------

export interface GuideConflict {
  startsAt: number;
  departureIds: string[];
  tourTitles: string[];
  reason: "same_guide" | "unstaffed" | "needs_certified_mtb";
}

/**
 * Departures that cannot all be run as scheduled.
 *
 * Overlap is by instant, not by window: two tours starting at 10:15 need two
 * guides even if one is two hours and the other is five.
 */
export async function findGuideConflicts(d1: D1Database, fromMs: number, toMs: number): Promise<GuideConflict[]> {
  const rows = await d1
    .prepare(
      `SELECT d.id, d.starts_at, d.guide_id, t.title, t.category, t.difficulty,
              g.mtb_certified
         FROM tour_departures d
         JOIN tours t ON t.id = d.tour_id
    LEFT JOIN guides g ON g.id = d.guide_id
        WHERE d.status = 'open' AND d.starts_at >= ?1 AND d.starts_at < ?2
     ORDER BY d.starts_at`,
    )
    .bind(fromMs, toMs)
    .all<{
      id: string;
      starts_at: number;
      guide_id: string | null;
      title: string;
      category: string;
      difficulty: string;
      mtb_certified: number | null;
    }>();

  const bySlot = new Map<number, typeof rows.results>();
  for (const r of rows.results ?? []) {
    const list = bySlot.get(r.starts_at) ?? [];
    list.push(r);
    bySlot.set(r.starts_at, list);
  }

  const conflicts: GuideConflict[] = [];
  for (const [startsAt, group] of bySlot) {
    // Two departures sharing one guide.
    const assigned = new Map<string, string[]>();
    for (const d of group) {
      if (!d.guide_id) continue;
      assigned.set(d.guide_id, [...(assigned.get(d.guide_id) ?? []), d.id]);
    }
    for (const [, ids] of assigned) {
      if (ids.length > 1) {
        conflicts.push({
          startsAt,
          departureIds: ids,
          tourTitles: group.filter((d) => ids.includes(d.id)).map((d) => d.title),
          reason: "same_guide",
        });
      }
    }

    // More simultaneous departures than assigned guides.
    const unstaffed = group.filter((d) => !d.guide_id);
    if (group.length > 1 && unstaffed.length > 0) {
      conflicts.push({
        startsAt,
        departureIds: unstaffed.map((d) => d.id),
        tourTitles: unstaffed.map((d) => d.title),
        reason: "unstaffed",
      });
    }

    // An MTB tour needs a certified guide — the catalogue says so explicitly
    // ("local certified mtb guide").
    for (const d of group) {
      const isMtb = /mountain bike|mtb/i.test(d.title);
      if (isMtb && d.guide_id && d.mtb_certified !== 1) {
        conflicts.push({
          startsAt,
          departureIds: [d.id],
          tourTitles: [d.title],
          reason: "needs_certified_mtb",
        });
      }
    }
  }

  return conflicts.sort((a, b) => a.startsAt - b.startsAt);
}
