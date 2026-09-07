/**
 * Parser for the WooCommerce product export — data/woocommerce-products-*.csv.
 *
 * Every rule here was decoded from ALL 52 rows of the real file and then
 * adversarially verified against it (see plan §Revision 5). Where the data is
 * wrong we do NOT repair it silently: the row is imported as-is and named in
 * the validation report, because a silently "fixed" price hides a bug that is
 * live on the shop's own website.
 *
 * What the file actually contains:
 *   - 39 bikes, each "<model> size <n> (<min>-<max> cm)" with 18 format
 *     variants (en-dashes, U+2033 inch marks, "CM", a missing unit, age ranges
 *     on the two children's bikes, two bikes with no height at all).
 *   - 13 non-bikes, all category EXTRA. Nine carry a "Fixed" period-total
 *     ladder and stock, and are rentable standalone. Helmets carry a single
 *     open-ended "any" band (proven flat, not per-day). Two are kr.79 retail
 *     goods with no ladder. Pedals carry a Fixed ladder.
 *   - 23 distinct tier ladders. "/ Day" cells are per-day rates; "Fixed" cells
 *     are totals for the band and ASCEND. Left-dense: no gaps in tier_1..6.
 *   - 20 distinct add-ons across 18 per-product allowlists, "name: price"
 *     joined by "; ". No name contains ";" or ":". Prices are bare integers.
 */
import { kronerToMinor } from "~/lib/money";
import type { AddonUnit, BikeCategory } from "~/db/schema";

// ---------------------------------------------------------------------------
// RFC 4180 — quoted fields hold commas and raw newlines. No dependency.
// ---------------------------------------------------------------------------

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// ---------------------------------------------------------------------------
// Title → model, size, rider fit
// ---------------------------------------------------------------------------

export type SizeUnit = "cm" | "inch" | "letter";
export type RiderSpecKind = "height" | "age" | "none";

export interface ParsedTitle {
  isBike: boolean;
  model: string;
  sizeLabel: string | null;
  sizeUnit: SizeUnit | null;
  riderSpecKind: RiderSpecKind;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  riderMinAgeYears: number | null;
  riderMaxAgeYears: number | null;
}

// U+002D hyphen-minus, U+2010–U+2012, U+2013 en dash, U+2014 em dash, U+2212 minus.
const DASH = "[\\u002D\\u2010\\u2011\\u2012\\u2013\\u2014\\u2212]";
const RE_TRAIL_PAREN = /\s*\(([^()]*)\)\s*$/;
const RE_HEIGHT = new RegExp(`^(\\d{2,3})\\s*${DASH}\\s*(\\d{2,3})\\s*(?:cm)?$`, "i");
const RE_AGE = new RegExp(`^(\\d{1,2})\\s*(?:(\\+)|${DASH}\\s*(\\d{1,2}))?\\s*(?:years?|ár|år)\\b`, "i");
const RE_SIZE_KW = /\bsize\s*(\d{1,2}(?:[.,]\d)?)\s*(cm|″|"|in(?:ch)?)?/i;
const RE_LETTER = /\b(Large|Medium|Small)\s*$/i; // never bare L/M/S — "Pannier 13 L"
const RE_INCH_TAIL = /(\d{1,2}(?:[.,]\d)?)\s*(?:″|")\s*$/;
const RE_TRAIL_SEP = new RegExp(`(?:\\s*[,:]|\\s*${DASH})+$`);

const HEIGHT_MIN_CM = 100;
const HEIGHT_MAX_CM = 250; // guards "(10-14 year)" and "(2*20L)" from ever reading as heights
const INCH_FRAME_MAX = 30; // bare 16–21 = inch frames; 44–61 = cm. Nothing sits between.

function normalizeTitle(s: string): string {
  return s.normalize("NFC").replace(/ /g, " ").replace(/’/g, "'").replace(/\s+/g, " ").trim();
}

export function parseTitle(raw: string): ParsedTitle {
  const t = normalizeTitle(raw);
  const out: ParsedTitle = {
    isBike: false,
    model: t,
    sizeLabel: null,
    sizeUnit: null,
    riderSpecKind: "none",
    riderMinCm: null,
    riderMaxCm: null,
    riderMinAgeYears: null,
    riderMaxAgeYears: null,
  };
  let head = t;

  // 1. Trailing parenthetical → height | age | neither.
  const pm = RE_TRAIL_PAREN.exec(t);
  if (pm) {
    const inner = pm[1]!.trim();
    const h = RE_HEIGHT.exec(inner);
    const a = RE_AGE.exec(inner);
    const inRange = (n: number) => n >= HEIGHT_MIN_CM && n <= HEIGHT_MAX_CM;
    if (h && inRange(+h[1]!) && inRange(+h[2]!)) {
      out.riderMinCm = +h[1]!;
      out.riderMaxCm = +h[2]!;
      out.riderSpecKind = "height";
      head = t.slice(0, pm.index).trim();
    } else if (a) {
      out.riderMinAgeYears = +a[1]!;
      if (a[3] !== undefined) out.riderMaxAgeYears = +a[3];
      out.riderSpecKind = "age"; // heights stay null on purpose
      head = t.slice(0, pm.index).trim();
    }
    // else: "(2*20L)", "(súkklutaska)" — stays inside the model name.
  }

  // 2. Size token.
  const s = RE_SIZE_KW.exec(head);
  if (s) {
    const val = parseFloat(s[1]!.replace(",", "."));
    const u = (s[2] ?? "").toLowerCase();
    const unit: SizeUnit = u === "cm" ? "cm" : u ? "inch" : val <= INCH_FRAME_MAX ? "inch" : "cm";
    out.sizeUnit = unit;
    out.sizeLabel = unit === "cm" ? s[1]! : `${s[1]}″`;
    head = head.slice(0, s.index) + " " + head.slice(s.index + s[0].length);
  } else {
    const l = RE_LETTER.exec(head);
    const i = RE_INCH_TAIL.exec(head);
    if (l) {
      out.sizeLabel = l[1]![0]!.toUpperCase() + l[1]!.slice(1).toLowerCase();
      out.sizeUnit = "letter";
      head = head.slice(0, l.index);
    } else if (i) {
      // Children's bikes: this is the WHEEL size, not a frame size.
      out.sizeUnit = "inch";
      out.sizeLabel = `${i[1]}″`;
      head = head.slice(0, i.index);
    }
  }

  // 3. Whatever remains, minus a trailing separator, is the model.
  out.model = head.replace(/\s+/g, " ").trim().replace(RE_TRAIL_SEP, "").trim();
  out.isBike = out.sizeLabel !== null || out.riderSpecKind !== "none";
  return out;
}

// ---------------------------------------------------------------------------
// tier_1..tier_6 → bands
// ---------------------------------------------------------------------------

export interface Band {
  minDays: number;
  /** null = open-ended (only the helmet's "any" band). */
  maxDays: number | null;
  priceMinor: number;
  /** "/ Day" or "/ days" → per-day rate; "Fixed" → total for the band. */
  perDay: boolean;
}

// cell := (range | "any") ":" amount [unit]
// Amount: \d+ so a hand-edited "1400.00" with the thousands separator turned
// off still parses (the original \d{1,3} threw on it). A comma must be a
// thousands separator followed by exactly three digits — "1,00" is rejected
// rather than read as a thousand.
const TIER_RE = new RegExp(
  `^(?:(?<min>\\d+)\\s*${DASH}\\s*(?<max>\\d+)\\s+days|(?<any>any))\\s*:\\s*kr\\.?\\s*` +
    `(?<amount>\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?)(?:\\s*(?<unit>\\/\\s*[Dd]ays?|[Ff]ixed))?$`,
);

export class ParseError extends Error {}

export function parseTierCell(raw: string | undefined): Band | null {
  const s = (raw ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (s === "") return null;
  const m = TIER_RE.exec(s);
  if (!m?.groups) throw new ParseError(`unparseable tier cell: ${JSON.stringify(raw)}`);
  const g = m.groups;
  const amount = g.amount!;
  if (/,\d{1,2}(?!\d)/.test(amount)) throw new ParseError(`comma is not a thousands separator in ${JSON.stringify(raw)}`);
  const kroner = Number(amount.replace(/,/g, ""));
  if (g.unit === undefined) throw new ParseError(`tier cell has no unit (per-day or Fixed): ${JSON.stringify(raw)}`);
  return {
    minDays: g.any ? 1 : Number(g.min),
    maxDays: g.any ? null : Number(g.max),
    priceMinor: kronerToMinor(kroner),
    perDay: g.unit.startsWith("/"),
  };
}

/** Left-dense: stop at the first empty cell. */
export function parseLadder(row: Record<string, string>): Band[] {
  const out: Band[] = [];
  for (let i = 1; i <= 6; i++) {
    const b = parseTierCell(row[`tier_${i}`]);
    if (!b) break;
    out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ladder validation — the tier validation pass the plan calls for.
// ---------------------------------------------------------------------------

export type IssueKind =
  | "overlap"
  | "gap"
  | "not_starting_at_1"
  | "non_monotonic_per_day"
  | "non_ascending_total"
  | "implausible_magnitude"
  | "mixed_units"
  | "ends_before_60";

export interface LadderIssue {
  kind: IssueKind;
  severity: "error" | "warning" | "info";
  detail: string;
}

const MAX_PLAUSIBLE_BAND_MINOR = 5_000_00; // 5,000 DKK — nothing legitimate exceeds it
const MAX_PLAUSIBLE_STEP = 5; // a band more than 5× its neighbour is a typo

export function validateLadder(bands: readonly Band[]): LadderIssue[] {
  const issues: LadderIssue[] = [];
  if (bands.length === 0) return issues;

  const perDayCount = bands.filter((b) => b.perDay).length;
  if (perDayCount !== 0 && perDayCount !== bands.length) {
    issues.push({ kind: "mixed_units", severity: "error", detail: "row mixes per-day and Fixed cells" });
  }
  if (bands[0]!.minDays !== 1) {
    issues.push({ kind: "not_starting_at_1", severity: "error", detail: `first band starts at day ${bands[0]!.minDays}` });
  }

  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i]!;
    const b = bands[i + 1]!;
    if (a.maxDays !== null && b.minDays <= a.maxDays) {
      issues.push({
        kind: "overlap",
        severity: "error",
        detail: `band ${i + 1} (${a.minDays}-${a.maxDays}) overlaps band ${i + 2} (${b.minDays}-${b.maxDays}) — day ${b.minDays} priced twice`,
      });
    } else if (a.maxDays !== null && b.minDays > a.maxDays + 1) {
      issues.push({
        kind: "gap",
        severity: "error",
        detail: `days ${a.maxDays + 1}-${b.minDays - 1} fall between band ${i + 1} and band ${i + 2}`,
      });
    }
    if (a.perDay && b.priceMinor > a.priceMinor) {
      issues.push({
        kind: "non_monotonic_per_day",
        severity: "error",
        detail: `per-day rate RISES from ${a.priceMinor / 100} to ${b.priceMinor / 100} at band ${i + 2} — a longer rental costs more per day`,
      });
    }
    if (!a.perDay && b.priceMinor < a.priceMinor) {
      issues.push({
        kind: "non_ascending_total",
        severity: "error",
        detail: `period total FALLS from ${a.priceMinor / 100} to ${b.priceMinor / 100} at band ${i + 2}`,
      });
    }
    const ratio = b.priceMinor / a.priceMinor;
    if (ratio > MAX_PLAUSIBLE_STEP || ratio < 1 / MAX_PLAUSIBLE_STEP) {
      issues.push({
        kind: "implausible_magnitude",
        severity: "error",
        detail: `band ${i + 2} is ${ratio.toFixed(1)}× band ${i + 1} (${a.priceMinor / 100} → ${b.priceMinor / 100})`,
      });
    }
  }
  for (const [i, b] of bands.entries()) {
    if (b.priceMinor > MAX_PLAUSIBLE_BAND_MINOR) {
      issues.push({
        kind: "implausible_magnitude",
        severity: "error",
        detail: `band ${i + 1} is kr.${(b.priceMinor / 100).toLocaleString("en-GB")} — almost certainly a misplaced zero`,
      });
    }
  }
  const last = bands[bands.length - 1]!;
  if (last.maxDays !== null && last.maxDays < 60) {
    issues.push({
      kind: "ends_before_60",
      severity: "info",
      detail: `ladder ends at day ${last.maxDays}; longer rentals clamp to the last band`,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Add-ons column
// ---------------------------------------------------------------------------

export interface ParsedAddon {
  slug: string;
  name: string;
  priceMinor: number;
  isSale: boolean;
  unit: AddonUnit;
}

// Greedy (.*) splits on the LAST colon: a name may end in "." or "''" right
// before the delimiter. Anchored \d+ means a colon inside a name can never be
// mistaken for the delimiter unless the tail is pure digits.
const ENTRY_RE = /^(.*):\s*(\d+)\s*$/;
const SALE_RE = /\bfor sale\b/i;

/**
 * The data stores every add-on identically, but a car carrier is a per-car
 * item: charging it per bike overcharges a family renting four bikes with one
 * carrier. The two carriers are therefore per_booking. Everything else is per
 * bike (rule A5), which the helmet row proves — its standalone product is
 * flat 50 regardless of duration, matching the add-on exactly.
 */
const PER_BOOKING_ADDONS = new Set(["bike-carrier-for-car-back-door", "bike-carrier-for-car-hook-for-rent"]);

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ð/g, "d")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/þ/g, "th")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseAddonCell(cell: string | undefined): ParsedAddon[] {
  const out: ParsedAddon[] = [];
  const trimmed = (cell ?? "").trim();
  if (trimmed === "") return out;
  const seen = new Set<string>();
  for (const chunk of trimmed.split(";")) {
    const entry = chunk.trim();
    if (entry === "") continue;
    const m = ENTRY_RE.exec(entry);
    if (!m) throw new ParseError(`add-on entry is not "<name>: <integer>": ${JSON.stringify(entry)}`);
    const name = m[1]!.trim();
    const slug = slugify(name);
    if (!name || !slug) throw new ParseError(`add-on has an empty name: ${JSON.stringify(entry)}`);
    if (seen.has(slug)) throw new ParseError(`duplicate add-on "${slug}" in one cell`);
    seen.add(slug);
    out.push({
      slug,
      name,
      priceMinor: kronerToMinor(Number(m[2])),
      isSale: SALE_RE.test(name),
      unit: PER_BOOKING_ADDONS.has(slug) ? "per_booking" : "per_bike",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Category, stock, identity
// ---------------------------------------------------------------------------

const TERM_TO_CATEGORY: Readonly<Record<string, BikeCategory>> = {
  "E-BIKES": "ebike",
  "MOUNTAIN BIKES": "mountain",
  "GRAVEL & CROSS BIKES": "gravel",
  "ROAD BIKES": "road",
  EXTRA: "extra",
};
// Parent shop term and two retail sub-shop tags. Listed so a NEW term trips
// the guard instead of being swallowed.
const NOISE_TERMS = new Set(["RENT A BIKE", "ORKA", "ÚTGERÐ TIL SÚKKLUNA"]);
// Only consulted for the two "E-BIKES | MOUNTAIN BIKES" rows (E-MTB Centurion).
// "Has a motor" is the axis a renter filters on.
const TERM_PRIORITY = ["EXTRA", "E-BIKES", "GRAVEL & CROSS BIKES", "ROAD BIKES", "MOUNTAIN BIKES"];

export function categorise(subcategory: string, categories: string): BikeCategory {
  const direct = TERM_TO_CATEGORY[subcategory.trim()];
  if (direct) return direct;
  const terms = categories
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = terms.filter((t) => !(t in TERM_TO_CATEGORY) && !NOISE_TERMS.has(t));
  if (unknown.length) throw new ParseError(`unknown category term(s): ${unknown.join(", ")}`);
  const winner = TERM_PRIORITY.find((t) => terms.includes(t));
  if (!winner) throw new ParseError(`no primary category in ${JSON.stringify(categories)}`);
  return TERM_TO_CATEGORY[winner]!;
}

// ---------------------------------------------------------------------------
// Row → what to seed
// ---------------------------------------------------------------------------

export interface SeedBikeType {
  id: string;
  wcProductId: number;
  slug: string;
  name: string;
  category: BikeCategory;
  model: string;
  sizeLabel: string | null;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  stock: number;
  listed: boolean;
  description: string | null;
  image: string | null;
  images: string[];
  bands: Band[];
  addonSlugs: string[];
  issues: LadderIssue[];
}

export interface SeedAddonOnly {
  wcProductId: number;
  addon: ParsedAddon;
  reason: string;
}

export interface ParsedCatalogue {
  bikeTypes: SeedBikeType[];
  /** Union of every add-on named on any product, plus the addon-only rows. */
  addons: Map<string, ParsedAddon>;
  addonOnly: SeedAddonOnly[];
  report: string[];
}

/** WooCommerce product URL slug, falling back to the title. */
function slugFromUrl(url: string, title: string): string {
  const m = /\/product\/([^/?#]+)\/?$/.exec(url);
  return m ? m[1]! : slugify(title);
}

export function parseCatalogue(csvText: string): ParsedCatalogue {
  const rows = parseCsv(csvText);
  const bikeTypes: SeedBikeType[] = [];
  const addons = new Map<string, ParsedAddon>();
  const addonOnly: SeedAddonOnly[] = [];
  const report: string[] = [];
  const slugs = new Set<string>();

  for (const row of rows) {
    const wcId = Number(row.id);
    if (!Number.isInteger(wcId)) throw new ParseError(`row without a numeric id: ${JSON.stringify(row.title)}`);
    const title = normalizeTitle(row.title ?? "");
    const parsed = parseTitle(title);
    const category = categorise(row.subcategory ?? "", row.categories ?? "");
    const bands = parseLadder(row);
    const listed = (row.listed_on_category_page ?? "").trim().toLowerCase() === "yes";
    const stockRaw = (row.units_available ?? "").trim();
    const stock = /^\d+$/.test(stockRaw) ? Number(stockRaw) : 0;

    for (const a of parseAddonCell(row["addons (name: DKK)"])) {
      const prev = addons.get(a.slug);
      if (prev && prev.priceMinor !== a.priceMinor) {
        report.push(`[${wcId}] add-on "${a.name}" priced ${a.priceMinor / 100} here but ${prev.priceMinor / 100} elsewhere`);
      }
      addons.set(a.slug, prev ?? a);
    }

    // Non-bike rows that are really add-ons, not rentable stock:
    //  - no ladder at all (fixed product price) → a retail sale item
    //  - a single open-ended "any" band → the helmet, proven flat
    if (!parsed.isBike) {
      const noLadder = bands.length === 0;
      const openEnded = bands.length === 1 && bands[0]!.maxDays === null;
      if (noLadder || openEnded) {
        const priceShown = /kr\.?\s*([\d.,]+)/.exec(row.price_shown ?? "");
        const priceMinor = openEnded ? bands[0]!.priceMinor : kronerToMinor(Number(priceShown?.[1]?.replace(/,/g, "") ?? 0));
        const name = title;
        const slug = openEnded ? "helmet-for-rent" : slugify(name);
        const addon: ParsedAddon = {
          slug,
          name: openEnded ? (addons.get(slug)?.name ?? name) : name,
          priceMinor,
          isSale: noLadder,
          unit: noLadder ? "per_booking" : "per_bike",
        };
        if (!addons.has(slug)) addons.set(slug, addon);
        addonOnly.push({
          wcProductId: wcId,
          addon,
          reason: openEnded ? "single open-ended band — flat charge, same as the helmet add-on" : "fixed product price, no ladder — retail sale item",
        });
        if (!stockRaw) report.push(`[${wcId}] "${title}" has no stock figure (retail item, not tracked)`);
        continue;
      }
    }

    const issues = validateLadder(bands);
    for (const i of issues) if (i.severity === "error") report.push(`[${wcId}] "${title}": ${i.kind} — ${i.detail}`);
    if (!listed) report.push(`[${wcId}] "${title}" is hidden from the catalogue with ${stock} unit(s) — invisible inventory`);
    if (parsed.isBike && parsed.riderSpecKind === "none") report.push(`[${wcId}] "${title}" has no rider height range`);
    if (bands.length === 0) report.push(`[${wcId}] "${title}" has no price ladder and is not a sale item`);

    let slug = slugFromUrl(row.url ?? "", title);
    if (slugs.has(slug)) {
      report.push(`[${wcId}] duplicate product slug "${slug}" — suffixing with the WooCommerce id`);
      slug = `${slug}-${wcId}`;
    }
    slugs.add(slug);

    bikeTypes.push({
      id: `wc-${wcId}`,
      wcProductId: wcId,
      slug,
      name: title,
      category,
      model: parsed.model,
      sizeLabel: parsed.sizeLabel,
      riderMinCm: parsed.riderMinCm,
      riderMaxCm: parsed.riderMaxCm,
      stock,
      listed,
      description: (row.description ?? "").trim() || null,
      image: (row.image_urls ?? "").split("|")[0]?.trim() || null,
      images: (row.image_urls ?? "").split("|").map((u) => u.trim()).filter(Boolean),
      bands,
      addonSlugs: parseAddonCell(row["addons (name: DKK)"]).map((a) => a.slug),
      issues,
    });
  }

  return { bikeTypes, addons, addonOnly, report };
}
