import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * One Drizzle instance per request, bound to the D1 binding from wrangler.jsonc.
 *
 * D1 has NO interactive transactions. `db.batch([...])` is atomic and rolls
 * back on failure, but you cannot read → decide in JS → write inside one
 * transaction. Every capacity decision therefore lives in a conditional
 * INSERT/UPDATE whose WHERE clause carries the check, asserted with
 * `meta.changes === 1`. See app/lib/booking/reserve.ts.
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
