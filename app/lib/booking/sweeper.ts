/**
 * Rule B5 — a held booking expires after HOLD_TTL_MINUTES if payment never
 * completed. Runs on the cron trigger in wrangler.jsonc.
 *
 * Nothing in the old app ever released an abandoned checkout: the only
 * "expired" in that codebase was the ePay session in the browser, so a
 * customer who closed the tab held those bikes until someone noticed by hand.
 * On a summer Saturday that is real lost revenue, and it is invisible.
 *
 * The sweep is a single conditional UPDATE — no read-then-write — so it is
 * safe to run concurrently with checkout. A booking being confirmed at the
 * same instant either flips to `confirmed` first (and the sweeper's WHERE no
 * longer matches it) or flips after (and the sweeper has already released it,
 * so the confirm fails loudly rather than confirming an expired hold).
 */

export interface SweepResult {
  released: number;
  at: number;
}

/**
 * Only what the sweep actually needs. Deliberately not the generated `Env`:
 * that types `HOLD_TTL_MINUTES` as the literal in wrangler.jsonc, which would
 * make it impossible to test any other value — including the bad ones this
 * must reject.
 */
export interface SweeperEnv {
  DB: D1Database;
  HOLD_TTL_MINUTES?: string;
}

export async function sweepExpiredHolds(env: SweeperEnv, now: number = Date.now()): Promise<SweepResult> {
  const ttl = Number(env.HOLD_TTL_MINUTES ?? "30");
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error(`HOLD_TTL_MINUTES must be a positive number, got ${String(env.HOLD_TTL_MINUTES)}`);
  }

  // Bookings whose hold has run out. hold_expires_at is set when the booking
  // enters `held` and cleared on every other transition, so a NULL here means
  // "not holding" and is correctly skipped.
  const expired = await env.DB.prepare(
    `SELECT id FROM bookings
      WHERE status = 'held' AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?1
      LIMIT 500`,
  )
    .bind(now)
    .all<{ id: string }>();

  const ids = (expired.results ?? []).map((r) => r.id);
  if (ids.length === 0) return { released: 0, at: now };

  const statements: D1PreparedStatement[] = [];
  for (const id of ids) {
    statements.push(
      env.DB.prepare(
        `UPDATE bookings
            SET status = 'expired', hold_expires_at = NULL, updated_at = ?2
          WHERE id = ?1 AND status = 'held' AND hold_expires_at <= ?2`,
      ).bind(id, now),
    );
    statements.push(
      env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, from_status, to_status, actor, note, at)
         SELECT ?1,'booking',?2,'held','expired','sweeper',?3,?4 WHERE changes() = 1`,
      ).bind(crypto.randomUUID(), id, `hold lapsed after ${ttl}m`, now),
    );
  }

  const results = await env.DB.batch(statements);
  let released = 0;
  for (let i = 0; i < results.length; i += 2) {
    if ((results[i]?.meta?.changes ?? 0) === 1) released++;
  }

  return { released, at: now };
}
