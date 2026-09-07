import { env } from "cloudflare:test";
// Vite inlines the generated migration at build time, so the DDL is available
// inside workerd where there is no filesystem.
// Every migration in drizzle/, in file order — the same set wrangler applies.
const MIGRATIONS = import.meta.glob("../../drizzle/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const initSql = Object.keys(MIGRATIONS)
  .sort()
  .map((k) => MIGRATIONS[k])
  .join(`\n--> statement-breakpoint\n`);

/** Drizzle separates statements with this marker. */
const BREAK = "--> statement-breakpoint";

let applied = false;

/** Create the real schema in the test D1 instance. Idempotent per worker. */
export async function applySchema(): Promise<void> {
  if (applied) return;
  const statements = initSql
    .split(BREAK)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
  applied = true;
}

/**
 * Wipe every row between tests without re-running DDL.
 *
 * Order matters: children before parents, or the foreign keys reject the
 * delete. Listed explicitly rather than read from sqlite_master, because that
 * returns tables in creation order and deleting a parent first fails.
 */
const TRUNCATION_ORDER = [
  "audit_log",
  "payments",
  "booking_lines",
  "bookings",
  "tour_bike_types",
  "tour_inclusions",
  "tour_options",
  "tour_departures",
  "tour_schedules",
  "tour_legs",
  "tours",
  "bike_addons",
  "rate_tiers",
  "addons",
  "bike_types",
  "locations",
  "guides",
] as const;

export async function truncateAll(): Promise<void> {
  for (const table of TRUNCATION_ORDER) {
    await env.DB.prepare(`DELETE FROM "${table}"`).run();
  }
}

/** Seed one bike type with the given stock and a standard ladder. */
export async function seedBike(id: string, stock: number, name = id): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO bike_types (id, slug, name, category, stock, listed, created_at, updated_at)
     VALUES (?1, ?1, ?2, 'gravel', ?3, 1, 0, 0)`,
  )
    .bind(id, name, stock)
    .run();
}

export async function seedTour(tourId: string, departureId: string, capacity: number, startMs: number, endMs: number) {
  await env.DB.prepare(
    `INSERT INTO tours (id, slug, title, category, difficulty, summary, body, duration_min,
                        meeting_point, pricing_mode, requires_bike, published, created_at, updated_at)
     VALUES (?1, ?1, 'Test tour', 'bike', 'Moderate', 's', 'b', 180,
             'Sverrisgøta 20', 'per_person', 1, 1, 0, 0)`,
  )
    .bind(tourId)
    .run();
  await env.DB.prepare(
    `INSERT INTO tour_departures (id, tour_id, starts_at, ends_at, capacity, seats_taken,
                                  price_minor, min_participants, status, is_private, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, 94000, 0, 'open', 0, 0)`,
  )
    .bind(departureId, tourId, startMs, endMs, capacity)
    .run();
}

export { env };
