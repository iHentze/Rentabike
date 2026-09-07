// Rule B5: a held booking expires after HOLD_TTL_MINUTES if payment never
// completed. Runs on the cron trigger in wrangler.jsonc.
//
// Stub until the schema and lifecycle land (tasks #2, #6). Kept as a real
// module so the Worker entry's dynamic import resolves from day one.
export async function sweepExpiredHolds(env: Env): Promise<{ released: number }> {
  const ttl = Number(env.HOLD_TTL_MINUTES ?? "30");
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error("HOLD_TTL_MINUTES must be a positive number");
  return { released: 0 };
}
