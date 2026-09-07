/**
 * Loads the parsed WooCommerce catalogue into D1.
 *
 * Idempotent: every write is INSERT OR REPLACE keyed on the stable WooCommerce
 * product id / add-on slug, so re-running the seed after the shop fixes a
 * price updates the row rather than duplicating it. Tier rows are replaced
 * wholesale per product because a ladder can change shape, not just value.
 *
 * Refuses to load anything the parser reported as an ERROR unless told to,
 * so the four known-bad ladders cannot slip into production by accident. In
 * development they load with the report printed, because the point is to see
 * the real data — bugs included — on the real screens.
 */
import { parseCatalogue, type ParsedCatalogue } from "./parse";

export interface SeedOptions {
  /** Load even when the validation report has errors. */
  allowErrors?: boolean;
  now?: number;
}

export interface SeedSummary {
  bikeTypes: number;
  rateTiers: number;
  addons: number;
  bikeAddons: number;
  report: string[];
}

export class SeedRefused extends Error {
  constructor(readonly report: string[]) {
    super(`seed refused: ${report.length} data problem(s) in the export — pass allowErrors to load anyway`);
  }
}

export async function seedCatalogue(d1: D1Database, csvText: string, opts: SeedOptions = {}): Promise<SeedSummary> {
  const parsed = parseCatalogue(csvText);
  const errors = parsed.report.filter((line) => /: (overlap|gap|non_monotonic_per_day|non_ascending_total|implausible_magnitude|mixed_units|not_starting_at_1) —/.test(line));
  if (errors.length && !opts.allowErrors) throw new SeedRefused(errors);
  return writeCatalogue(d1, parsed, opts.now ?? Date.now());
}

export async function writeCatalogue(d1: D1Database, cat: ParsedCatalogue, now: number): Promise<SeedSummary> {
  const stmts: D1PreparedStatement[] = [];

  // --- add-ons -------------------------------------------------------------
  for (const a of cat.addons.values()) {
    stmts.push(
      d1
        .prepare(
          `INSERT INTO addons (id, slug, name, unit, price_minor, is_sale)
           VALUES (?1,?2,?3,?4,?5,?6)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, unit=excluded.unit,
             price_minor=excluded.price_minor, is_sale=excluded.is_sale`,
        )
        .bind(`addon-${a.slug}`, a.slug, a.name, a.unit, a.priceMinor, a.isSale ? 1 : 0),
    );
  }

  // --- bike types, ladders, allowlists -------------------------------------
  let tierCount = 0;
  let linkCount = 0;
  for (const b of cat.bikeTypes) {
    stmts.push(
      d1
        .prepare(
          `INSERT INTO bike_types
             (id, slug, name, category, model, size_label, rider_min_cm, rider_max_cm,
              stock, listed, description, image, images, wc_product_id, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?15,?13,?14,?14)
           ON CONFLICT(id) DO UPDATE SET
             slug=excluded.slug, name=excluded.name, category=excluded.category,
             model=excluded.model, size_label=excluded.size_label,
             rider_min_cm=excluded.rider_min_cm, rider_max_cm=excluded.rider_max_cm,
             stock=excluded.stock, listed=excluded.listed, description=excluded.description,
             image=excluded.image, images=excluded.images, updated_at=excluded.updated_at`,
        )
        .bind(
          b.id,
          b.slug,
          b.name,
          b.category,
          b.model,
          b.sizeLabel,
          b.riderMinCm,
          b.riderMaxCm,
          b.stock,
          b.listed ? 1 : 0,
          b.description,
          b.image,
          b.wcProductId,
          now,
          JSON.stringify(b.images),
        ),
    );

    // Replace the ladder wholesale.
    stmts.push(d1.prepare(`DELETE FROM rate_tiers WHERE bike_type_id = ?1`).bind(b.id));
    for (const [i, band] of b.bands.entries()) {
      if (band.maxDays === null) {
        // Only the helmet has an open band and it is routed to addons, never here.
        throw new Error(`${b.id}: open-ended band cannot be a rate tier`);
      }
      stmts.push(
        d1
          .prepare(
            `INSERT INTO rate_tiers (id, bike_type_id, min_days, max_days, price_minor, per_day)
             VALUES (?1,?2,?3,?4,?5,?6)`,
          )
          .bind(`${b.id}-t${i + 1}`, b.id, band.minDays, band.maxDays, band.priceMinor, band.perDay ? 1 : 0),
      );
      tierCount++;
    }

    stmts.push(d1.prepare(`DELETE FROM bike_addons WHERE bike_type_id = ?1`).bind(b.id));
    for (const slug of b.addonSlugs) {
      stmts.push(
        d1
          .prepare(`INSERT OR IGNORE INTO bike_addons (bike_type_id, addon_id) VALUES (?1, ?2)`)
          .bind(b.id, `addon-${slug}`),
      );
      linkCount++;
    }
  }

  // D1 batches are capped well above this (a few hundred statements here).
  // Chunk anyway so a larger future export cannot hit the limit.
  for (let i = 0; i < stmts.length; i += 100) {
    await d1.batch(stmts.slice(i, i + 100));
  }

  return {
    bikeTypes: cat.bikeTypes.length,
    rateTiers: tierCount,
    addons: cat.addons.size,
    bikeAddons: linkCount,
    report: cat.report,
  };
}
