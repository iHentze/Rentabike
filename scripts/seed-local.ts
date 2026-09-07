/**
 * Emit the catalogue as SQL for `wrangler d1 execute --local --file`.
 *
 *   npx tsx scripts/seed-local.ts > .wrangler/seed.sql
 *   npx wrangler d1 execute rentabike --local --file=.wrangler/seed.sql
 *
 * Runs under plain Node with no D1 binding, so it reuses the parser and prints
 * the same statements writeCatalogue would issue. The validation report goes
 * to stderr so it never lands inside the SQL.
 */
import { readFileSync } from "node:fs";
import { parseCatalogue } from "../app/db/seed/parse";

// --compact collapses rate_tiers and bike_addons into multi-row inserts so the
// whole seed fits through an API that takes one SQL string per call.
const compact = process.argv.includes("--compact");
const file = process.argv.find((a) => a.endsWith(".csv")) ?? "data/woocommerce-products-2026-09-06.csv";
const cat = parseCatalogue(readFileSync(file, "utf8"));
const now = Date.now();

const q = (v: string | number | null): string =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;

const out: string[] = [];
const tierRows: string[] = [];
const linkRows: string[] = [];

for (const a of cat.addons.values()) {
  out.push(
    `INSERT INTO addons (id, slug, name, unit, price_minor, is_sale) VALUES (${q(`addon-${a.slug}`)}, ${q(a.slug)}, ${q(a.name)}, ${q(a.unit)}, ${a.priceMinor}, ${a.isSale ? 1 : 0})` +
      ` ON CONFLICT(id) DO UPDATE SET name=excluded.name, unit=excluded.unit, price_minor=excluded.price_minor, is_sale=excluded.is_sale;`,
  );
}

for (const b of cat.bikeTypes) {
  out.push(
    `INSERT INTO bike_types (id, slug, name, category, model, size_label, rider_min_cm, rider_max_cm, stock, listed, description, image, wc_product_id, created_at, updated_at) VALUES (` +
      [b.id, b.slug, b.name, b.category, b.model, b.sizeLabel, b.riderMinCm, b.riderMaxCm, b.stock, b.listed ? 1 : 0, b.description, b.image, b.wcProductId, now, now]
        .map(q)
        .join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, category=excluded.category, model=excluded.model, size_label=excluded.size_label, rider_min_cm=excluded.rider_min_cm, rider_max_cm=excluded.rider_max_cm, stock=excluded.stock, listed=excluded.listed, description=excluded.description, image=excluded.image, updated_at=excluded.updated_at;`,
  );
  if (!compact) out.push(`DELETE FROM rate_tiers WHERE bike_type_id = ${q(b.id)};`);
  for (const [i, band] of b.bands.entries()) {
    if (band.maxDays === null) throw new Error(`${b.id}: open-ended band cannot be a rate tier`);
    const row = `(${q(`${b.id}-t${i + 1}`)}, ${q(b.id)}, ${band.minDays}, ${band.maxDays}, ${band.priceMinor}, ${band.perDay ? 1 : 0})`;
    if (compact) tierRows.push(row);
    else out.push(`INSERT INTO rate_tiers (id, bike_type_id, min_days, max_days, price_minor, per_day) VALUES ${row};`);
  }
  if (!compact) out.push(`DELETE FROM bike_addons WHERE bike_type_id = ${q(b.id)};`);
  for (const slug of b.addonSlugs) {
    const row = `(${q(b.id)}, ${q(`addon-${slug}`)})`;
    if (compact) linkRows.push(row);
    else out.push(`INSERT OR IGNORE INTO bike_addons (bike_type_id, addon_id) VALUES ${row};`);
  }
}

if (compact) {
  // Fresh load: clear once, then insert in batches of 60 rows per statement.
  out.push(`DELETE FROM bike_addons;`, `DELETE FROM rate_tiers;`);
  for (let i = 0; i < tierRows.length; i += 60) {
    out.push(`INSERT INTO rate_tiers (id, bike_type_id, min_days, max_days, price_minor, per_day) VALUES ${tierRows.slice(i, i + 60).join(", ")};`);
  }
  for (let i = 0; i < linkRows.length; i += 60) {
    out.push(`INSERT OR IGNORE INTO bike_addons (bike_type_id, addon_id) VALUES ${linkRows.slice(i, i + 60).join(", ")};`);
  }
}

// The shop's own address as the default location, plus the campsite drop-off
// the canvas designs against. Fees from the design; confirm with the shop.
out.push(
  `INSERT OR IGNORE INTO locations (id, slug, name, address, pickup_fee_minor, dropoff_fee_minor, is_default, active) VALUES ('shop', 'sverrisgota-20', 'Sverrisgøta 20', 'Sverrisgøta 20, FO-100 Tórshavn', 0, 0, 1, 1);`,
  `INSERT OR IGNORE INTO locations (id, slug, name, address, pickup_fee_minor, dropoff_fee_minor, is_default, active) VALUES ('campsite', 'vid-gjonna', 'Við Gjónna', 'Við Gjónna campsite, Tórshavn', 15000, 15000, 0, 1);`,
);

process.stdout.write(out.join("\n") + "\n");
process.stderr.write(
  `${cat.bikeTypes.length} bike types, ${cat.addons.size} add-ons, ${out.length} statements\n` +
    (cat.report.length ? `\nVALIDATION REPORT (${cat.report.length}):\n${cat.report.map((l) => `  ${l}`).join("\n")}\n` : ""),
);
