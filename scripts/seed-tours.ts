/**
 * The thirteen tours from the 16 April 2026 catalogue, as SQL.
 *
 *   npx tsx scripts/seed-tours.ts > .wrangler/tours.sql
 *   npx wrangler d1 execute rentabike --local --file=.wrangler/tours.sql
 *
 * Prices and weekly slots follow the canonical table settled against the
 * catalogue (the 4 March weekly sheet disagreed on five of them — the catalogue
 * wins). Departures for the next 58 weeks are emitted too, so a fresh
 * local database has something to book; in production the cron keeps them
 * rolling (see app/lib/tours/ensure.ts).
 */
import { planDepartures } from "../app/lib/tours/departures";

import { TOURS } from "./tours-data";

const q = (v: string | number | null): string => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const now = Date.now();
const out: string[] = [];
const horizonWeeks = Number(process.argv.find((a) => a.startsWith("--weeks="))?.slice(8) ?? 58);
const today = new Date(now).toISOString().slice(0, 10);
const horizon = new Date(now + horizonWeeks * 7 * 86_400_000).toISOString().slice(0, 10);

for (const t of TOURS) {
  const id = `tour-${t.slug}`;
  const sid = `sch-${t.slug}`;
  const requiresBike = t.category === "bike" || t.category === "combo" ? 1 : 0;
  out.push(
    `INSERT INTO tours (id, slug, title, category, difficulty, summary, body, duration_min, distance_km, ascent_m, summit_m, meeting_point, end_point, pricing_mode, requires_bike, image, facts, published, created_at, updated_at) VALUES (` +
      [id, t.slug, t.title, t.category, t.difficulty, t.summary, t.body, t.durationMin, t.distanceKm, t.ascentM, t.summitM, "Sverrisgøta 20, Tórshavn", t.endPoint ?? null, "per_person", requiresBike, t.image, t.facts.join(" | "), 1, now, now].map(q).join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, category=excluded.category, difficulty=excluded.difficulty, summary=excluded.summary, body=excluded.body, duration_min=excluded.duration_min, distance_km=excluded.distance_km, ascent_m=excluded.ascent_m, summit_m=excluded.summit_m, requires_bike=excluded.requires_bike, image=excluded.image, facts=excluded.facts, published=excluded.published, updated_at=excluded.updated_at;`,
  );
  out.push(
    `INSERT INTO tour_schedules (id, tour_id, season_start, season_end, weekday_mask, start_time, capacity, price_minor, private_price_minor, min_participants, booking_cutoff_hours, active) VALUES (` +
      [sid, id, "2026-01-01", "2027-12-31", t.weekday, t.startTime, t.capacity, t.price * 100, t.privatePrice * 100, 0, 12, 1].map(q).join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET weekday_mask=excluded.weekday_mask, start_time=excluded.start_time, capacity=excluded.capacity, price_minor=excluded.price_minor, private_price_minor=excluded.private_price_minor, active=excluded.active;`,
  );
  out.push(`DELETE FROM tour_inclusions WHERE tour_id = ${q(id)};`);
  t.inclusions.forEach((label, i) => {
    out.push(`INSERT INTO tour_inclusions (id, tour_id, seq, label, included) VALUES (${q(`${id}-inc${i + 1}`)}, ${q(id)}, ${i + 1}, ${q(label)}, 1);`);
  });
  out.push(`DELETE FROM tour_bike_types WHERE tour_id = ${q(id)};`);
  if (t.bikes.length) {
    out.push(
      `INSERT OR IGNORE INTO tour_bike_types (tour_id, bike_type_id) SELECT ${q(id)}, id FROM bike_types WHERE listed = 1 AND category IN (${t.bikes.map(q).join(", ")});`,
    );
  }
  // Departures for the near future, so a fresh database has something to book.
  const planned = planDepartures({
    id: sid,
    tourId: id,
    seasonStart: today,
    seasonEnd: horizon,
    weekdayMask: t.weekday,
    startTime: t.startTime,
    capacity: t.capacity,
    priceMinor: t.price * 100,
    durationMin: t.durationMin,
  }).filter((p) => p.startsAt.getTime() > now);
  for (const p of planned) {
    const did = `dep-${t.slug}-${p.startsAt.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
    out.push(
      `INSERT OR IGNORE INTO tour_departures (id, tour_id, schedule_id, starts_at, ends_at, capacity, seats_taken, price_minor, min_participants, status, is_private, created_at) VALUES (` +
        [did, id, sid, p.startsAt.getTime(), p.endsAt.getTime(), p.capacity, 0, p.priceMinor, p.minParticipants, "open", 0, now].map(q).join(", ") +
        `);`,
    );
  }
}

process.stdout.write(out.join("\n") + "\n");
process.stderr.write(`${TOURS.length} tours, ${out.length} statements, departures through ${horizon}\n`);
