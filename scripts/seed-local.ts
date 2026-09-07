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
    `INSERT INTO bike_types (id, slug, name, category, model, size_label, rider_min_cm, rider_max_cm, stock, listed, description, image, images, wc_product_id, created_at, updated_at) VALUES (` +
      [b.id, b.slug, b.name, b.category, b.model, b.sizeLabel, b.riderMinCm, b.riderMaxCm, b.stock, b.listed ? 1 : 0, b.description, b.image, JSON.stringify(b.images), b.wcProductId, now, now]
        .map(q)
        .join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, category=excluded.category, model=excluded.model, size_label=excluded.size_label, rider_min_cm=excluded.rider_min_cm, rider_max_cm=excluded.rider_max_cm, stock=excluded.stock, listed=excluded.listed, description=excluded.description, image=excluded.image, images=excluded.images, updated_at=excluded.updated_at;`,
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

// Pickup and drop-off points, straight from the shop's own WordPress list
// (22 terms; "Runavík" existed twice there — the copy attached to no product
// is dropped). Fee is per booking and the same whichever way the bikes
// travel. Three rows the site itself is unsure about, decided on the name the
// customer is shown: Leirvík (name 550, site charged 590), Sørvágur (no cost
// on the site, name says 490), the two Tórshavn hotels (no cost = free).
const AIRPORT_NOTE =
  "Your rental bike and equipment will be at the airport for you at the time you have booked. " +
  "Rent a Bike staff will meet you at the airport if possible. If this is not possible, your bike and equipment " +
  "will be placed just outside the front door of the airport, on the right. The bike will be locked and you will " +
  "receive the code for the lock by email. There is only one entrance to the airport.";
const LOCATIONS: Array<[id: string, name: string, address: string, feeDkk: number, note: string | null, lat: number | null, lng: number | null]> = [
  ["shop", "Sverrisgøta 20", "Rent a Bike, Sverrisgøta 20, FO-100 Tórshavn", 0, null, 62.01, -6.77],
  ["hotel-brandan", "Hotel Brandan", "Oknarvegur 2, Tórshavn", 0, null, null, null],
  ["hotel-foroyar", "Hotel Føroyar", "Oyggjarvegur 45, Tórshavn", 0, null, 62.00783, -6.79283],
  ["kirkjubo", "Kirkjubøur", "Kirkjubøur", 160, null, null, null],
  ["leynar", "Leynar", "Leynar", 225, null, 62.1167, -7.0333],
  ["fuglafjordur", "Fuglafjørður", "Visit Eysturoy, Í Støð 14, 530 Fuglafjørður", 350, null, null, null],
  ["oyrabakka", "Oyrabakka", "Oyrabakka", 350, null, null, null],
  ["hvalvik", "Hvalvík", "Hvalvík", 370, null, null, null],
  ["vestmanna", "Vestmanna", "Vestmanna Tourist Centre", 380, null, null, null],
  ["giljanes", "Giljanes", "Giljanes Hostel & Campsite", 410, null, null, null],
  ["toftir", "Toftir", "Navia Shop, Toftir", 420, null, null, null],
  ["eidi", "Eiði", "Eiði", 460, null, null, null],
  ["runavik", "Runavík", "Visit Runavík, Heiðavegur 13, Saltangará", 460, null, 62.111635, -6.72301],
  ["funningur", "Funningur", "Funningur", 480, null, 62.28617, -6.967],
  ["airport", "Airport", "Vágar Airport", 490, AIRPORT_NOTE, 62.0633297, -7.27546],
  ["sorvagur", "Sørvágur", "Sørvágur", 490, null, null, null],
  ["gotugjogv", "Gøtugjógv", "Gøtugjógv", 550, null, null, null],
  ["leirvik", "Leirvík", "Leirvík", 550, null, null, null],
  ["gjogv", "Gjógv", "Gjógv", 570, null, null, null],
  ["klaksvik", "Klaksvík", "Visit North, Biskupstorg 1, 700 Klaksvík", 590, null, null, null],
  ["norddepil", "Norðdepil", "Norðdepil", 690, null, null, null],
];
for (const [id, name, address, fee, note, lat, lng] of LOCATIONS) {
  out.push(
    `INSERT INTO locations (id, slug, name, address, pickup_fee_minor, dropoff_fee_minor, is_default, active, note, lat, lng) VALUES (` +
      [id, id, name, address, fee * 100, fee * 100, id === "shop" ? 1 : 0, 1, note, lat, lng].map(q).join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, address=excluded.address, pickup_fee_minor=excluded.pickup_fee_minor, dropoff_fee_minor=excluded.dropoff_fee_minor, is_default=excluded.is_default, active=excluded.active, note=excluded.note, lat=excluded.lat, lng=excluded.lng;`,
  );
}
// The invented campsite stays, inactive, so old test bookings keep their reference.
out.push(`UPDATE locations SET active = 0 WHERE id = 'campsite';`);

process.stdout.write(out.join("\n") + "\n");
process.stderr.write(
  `${cat.bikeTypes.length} bike types, ${cat.addons.size} add-ons, ${out.length} statements\n` +
    (cat.report.length ? `\nVALIDATION REPORT (${cat.report.length}):\n${cat.report.map((l) => `  ${l}`).join("\n")}\n` : ""),
);
