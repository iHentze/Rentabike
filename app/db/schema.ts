/**
 * RentABike schema — D1 (SQLite) via Drizzle.
 *
 * Conventions, all load-bearing:
 *  - Money is INTEGER øre. Never a float, never a string. One formatDKK().
 *  - Timestamps are INTEGER epoch milliseconds (mode "timestamp_ms").
 *  - IDs are TEXT, generated app-side (crypto.randomUUID()).
 *  - Enums are TEXT with a Drizzle enum list; SQLite does not enforce them,
 *    the application and tests do.
 *
 * Shapes come from the real WooCommerce export (52 products, 23 tier
 * ladders, 18 add-on sets) and the 16 Apr 2026 tour catalogue — not from
 * assumptions. See plan §Schema.
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------
const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('subsec') * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('subsec') * 1000)`);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const BIKE_CATEGORIES = ["ebike", "mountain", "gravel", "road", "extra"] as const;
export type BikeCategory = (typeof BIKE_CATEGORIES)[number];

/**
 * A sellable SKU. Every bike in the real catalogue is model + size + rider
 * height range — "E-Bike size 44 (150-165 cm)". Stock is per size. Fit is a
 * filter, not decoration: a 165 cm rider must never be offered the 58.
 */
export const bikeTypes = sqliteTable(
  "bike_types",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category", { enum: BIKE_CATEGORIES }).notNull(),
    model: text("model"),
    sizeLabel: text("size_label"),
    riderMinCm: integer("rider_min_cm"),
    riderMaxCm: integer("rider_max_cm"),
    stock: integer("stock").notNull().default(0),
    listed: integer("listed", { mode: "boolean" }).notNull().default(true),
    description: text("description"),
    image: text("image"),
    /** Every product photo from the shop, JSON array of URLs, main first. */
    images: text("images"),
    /** WooCommerce product id — kept for migration and reconciliation only. */
    wcProductId: integer("wc_product_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("bike_types_slug_idx").on(t.slug), index("bike_types_category_idx").on(t.category)],
);

/**
 * Duration-band pricing, keyed on the PRODUCT — there are 23 distinct ladders
 * across 52 products, so a category-level card cannot represent reality.
 *
 * `perDay` is REQUIRED, not inferrable: for bikes each band is a per-day rate;
 * for 9 Extra items the same shape is a total for the period, and ascends.
 */
export const rateTiers = sqliteTable(
  "rate_tiers",
  {
    id: id(),
    bikeTypeId: text("bike_type_id")
      .notNull()
      .references(() => bikeTypes.id, { onDelete: "cascade" }),
    minDays: integer("min_days").notNull(),
    maxDays: integer("max_days").notNull(),
    priceMinor: integer("price_minor").notNull(),
    perDay: integer("per_day", { mode: "boolean" }).notNull(),
  },
  (t) => [index("rate_tiers_bike_type_idx").on(t.bikeTypeId, t.minDays)],
);

export const ADDON_UNITS = ["per_bike", "per_bike_per_day", "per_booking"] as const;
export type AddonUnit = (typeof ADDON_UNITS)[number];

/**
 * Add-ons are flat per bike and never multiplied by days (rule A5): helmet 50,
 * pedals 100. `isSale` marks the one item sold rather than rented ("Water
 * bottle with logo for sale: 89").
 */
export const addons = sqliteTable(
  "addons",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    unit: text("unit", { enum: ADDON_UNITS }).notNull(),
    priceMinor: integer("price_minor").notNull(),
    isSale: integer("is_sale", { mode: "boolean" }).notNull().default(false),
    /** A photo, where the shop's extras catalogue has one for this kind of thing. */
    image: text("image"),
  },
  (t) => [uniqueIndex("addons_slug_idx").on(t.slug)],
);

/** Add-ons are a per-product allowlist — 18 distinct sets in the export. */
export const bikeAddons = sqliteTable(
  "bike_addons",
  {
    bikeTypeId: text("bike_type_id")
      .notNull()
      .references(() => bikeTypes.id, { onDelete: "cascade" }),
    addonId: text("addon_id")
      .notNull()
      .references(() => addons.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bikeTypeId, t.addonId] })],
);

/** Fees are per booking (rule A6) and materialise as `fee` lines at quote time. */
export const locations = sqliteTable("locations", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  pickupFeeMinor: integer("pickup_fee_minor").notNull().default(0),
  dropoffFeeMinor: integer("dropoff_fee_minor").notNull().default(0),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** What the customer needs to know about the hand-over there — the airport has a whole paragraph. */
  note: text("note"),
  lat: real("lat"),
  lng: real("lng"),
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Lifecycle (plan §Business rules C):
 *   draft → held → confirmed → picked_up → returned
 *   with expired | cancelled | no_show terminal.
 * Only held, confirmed and picked_up consume inventory.
 */
export const BOOKING_STATUSES = [
  "draft",
  "held",
  "confirmed",
  "picked_up",
  "returned",
  "expired",
  "cancelled",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const INVENTORY_HOLDING_STATUSES: readonly BookingStatus[] = ["held", "confirmed", "picked_up"];

export const BOOKING_KINDS = ["rental", "tour"] as const;
export const BOOKING_CHANNELS = ["web", "counter", "phone", "reseller"] as const;

export const bookings = sqliteTable(
  "bookings",
  {
    id: id(),
    /** Short human code for the counter and the confirmation email. */
    code: text("code").notNull(),
    kind: text("kind", { enum: BOOKING_KINDS }).notNull(),
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("draft"),
    /** Half-open window [startAt, endAt) — rule B3. */
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    pickupLocationId: text("pickup_location_id").references(() => locations.id),
    dropoffLocationId: text("dropoff_location_id").references(() => locations.id),
    channel: text("channel", { enum: BOOKING_CHANNELS }).notNull().default("web"),
    notes: text("notes"),
    /** Server-computed. The browser never sends a total. */
    totalMinor: integer("total_minor").notNull().default(0),
    currency: text("currency").notNull().default("DKK"),
    /** Rule B5 — set when status becomes `held`; the sweeper releases past it. */
    holdExpiresAt: integer("hold_expires_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_code_idx").on(t.code),
    // The capacity guard's overlap query: status IN (...) AND start < ? AND end > ?
    index("bookings_status_window_idx").on(t.status, t.startAt, t.endAt),
    index("bookings_hold_expiry_idx").on(t.status, t.holdExpiresAt),
    index("bookings_email_idx").on(t.customerEmail),
  ],
);

export const LINE_KINDS = ["bike", "addon", "fee", "tour_seat"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

/**
 * Polymorphic line items. Replaces `booking_items.bike_id NOT NULL` — which
 * made a flat helmet charge unrepresentable and location fees a display
 * string nobody added to the total (defects 6 and the add-on shape).
 *
 * A tour booking is an ordinary booking: one `tour_seat` line plus N `bike`
 * lines over the departure window. Same capacity guard, same batch — the
 * whole fix for tours and rentals double-booking one fleet (defect 10).
 */
export const bookingLines = sqliteTable(
  "booking_lines",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LINE_KINDS }).notNull(),
    bikeTypeId: text("bike_type_id").references(() => bikeTypes.id),
    addonId: text("addon_id").references(() => addons.id),
    tourDepartureId: text("tour_departure_id").references(() => tourDepartures.id),
    /** Which rider this line belongs to, for per-rider bike assignment. */
    riderLabel: text("rider_label"),
    label: text("label").notNull(),
    qty: integer("qty").notNull().default(1),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
  },
  (t) => [
    index("booking_lines_booking_idx").on(t.bookingId),
    // The guard sums qty per bike_type across overlapping bookings.
    index("booking_lines_bike_type_idx").on(t.bikeTypeId, t.kind),
    index("booking_lines_departure_idx").on(t.tourDepartureId),
  ],
);

// ---------------------------------------------------------------------------
// Tours
// ---------------------------------------------------------------------------

export const TOUR_CATEGORIES = ["bike", "combo", "hike", "trail_run"] as const;
export type TourCategory = (typeof TOUR_CATEGORIES)[number];
/** Their vocabulary, from the catalogue — not an invented scale. */
export const TOUR_DIFFICULTIES = ["Easy", "Moderate", "Advanced"] as const;
export const TOUR_PRICING_MODES = ["per_person", "per_group"] as const;

export const tours = sqliteTable(
  "tours",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category", { enum: TOUR_CATEGORIES }).notNull(),
    difficulty: text("difficulty", { enum: TOUR_DIFFICULTIES }).notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    durationMin: integer("duration_min").notNull(),
    distanceKm: real("distance_km"),
    ascentM: integer("ascent_m"),
    summitM: integer("summit_m"),
    meetingPoint: text("meeting_point").notNull().default("Sverrisgøta 20, Tórshavn"),
    /** Distinct from meeting point — Norðadalur and Kirkjubøur end elsewhere. */
    endPoint: text("end_point"),
    pricingMode: text("pricing_mode", { enum: TOUR_PRICING_MODES }).notNull().default("per_person"),
    /** Rule F6: requires_bike with zero allowed bike types cannot publish. */
    requiresBike: integer("requires_bike", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    // Short card facts, pipe-separated: "225 m pass | Paved throughout | E-bike, MTB or road".
    facts: text("facts"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("tours_slug_idx").on(t.slug), index("tours_category_idx").on(t.category, t.published)],
);

export const LEG_MODES = ["bike", "hike", "run", "bus", "van", "ferry", "tunnel"] as const;

/** Ordered segments: the combos switch mode mid-route; Sandoy opens with a tunnel drive. */
export const tourLegs = sqliteTable(
  "tour_legs",
  {
    id: id(),
    tourId: text("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    mode: text("mode", { enum: LEG_MODES }).notNull(),
    label: text("label").notNull(),
    distanceKm: real("distance_km"),
    ascentM: integer("ascent_m"),
    durationMin: integer("duration_min"),
  },
  (t) => [uniqueIndex("tour_legs_order_idx").on(t.tourId, t.seq)],
);

/**
 * A season of recurring departures as ONE row, expanded by a generator.
 * Today a season is ~130 dates typed one at a time.
 *
 * `minParticipants` lives here, not on tours, because the minimum is
 * SEASONAL (rule F2): none in June–August, 2 from September to May.
 * `weekdayMask` is a 7-bit mask, bit 0 = Monday.
 */
export const tourSchedules = sqliteTable(
  "tour_schedules",
  {
    id: id(),
    tourId: text("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    seasonStart: text("season_start").notNull(), // ISO date YYYY-MM-DD
    seasonEnd: text("season_end").notNull(),
    weekdayMask: integer("weekday_mask").notNull(),
    startTime: text("start_time").notNull(), // HH:MM local (Atlantic/Faroe)
    capacity: integer("capacity").notNull(),
    priceMinor: integer("price_minor").notNull(),
    privatePriceMinor: integer("private_price_minor"),
    minParticipants: integer("min_participants").notNull().default(0),
    /** Rule F1 — default 12 h, overridable per schedule. */
    bookingCutoffHours: integer("booking_cutoff_hours").notNull().default(12),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("tour_schedules_tour_idx").on(t.tourId, t.active)],
);

export const DEPARTURE_STATUSES = ["open", "closed", "cancelled", "completed"] as const;

/**
 * The bookable unit. Seats are guarded atomically:
 *   UPDATE tour_departures SET seats_taken = seats_taken + ?
 *    WHERE id = ? AND status = 'open' AND seats_taken + ? <= capacity;
 * assert changes === 1. Replaces the read-subtract-write race (defect 8).
 */
export const tourDepartures = sqliteTable(
  "tour_departures",
  {
    id: id(),
    tourId: text("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    scheduleId: text("schedule_id").references(() => tourSchedules.id, { onDelete: "set null" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    capacity: integer("capacity").notNull(),
    seatsTaken: integer("seats_taken").notNull().default(0),
    priceMinor: integer("price_minor").notNull(),
    minParticipants: integer("min_participants").notNull().default(0),
    status: text("status", { enum: DEPARTURE_STATUSES }).notNull().default("open"),
    /** Defect 17: nothing else stops selling two simultaneous tours to one guide. */
    guideId: text("guide_id").references(() => guides.id),
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("tour_departures_tour_time_idx").on(t.tourId, t.startsAt),
    index("tour_departures_status_time_idx").on(t.status, t.startsAt),
    uniqueIndex("tour_departures_schedule_slot_idx").on(t.scheduleId, t.startsAt),
  ],
);

/** The trail run's run-back-or-bus; private-tour durations. */
export const tourOptions = sqliteTable(
  "tour_options",
  {
    id: id(),
    tourId: text("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    groupLabel: text("group_label").notNull(),
    choiceLabel: text("choice_label").notNull(),
    priceDeltaMinor: integer("price_delta_minor").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("tour_options_tour_idx").on(t.tourId, t.groupLabel)],
);

/** "Up to 10 professionally edited photos" is a fulfilment obligation, not copy. */
export const tourInclusions = sqliteTable(
  "tour_inclusions",
  {
    id: id(),
    tourId: text("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull().default(0),
    label: text("label").notNull(),
    included: integer("included", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("tour_inclusions_tour_idx").on(t.tourId)],
);

/** Which bike types a tour may be booked with. Rule F6 validates non-empty when requiresBike. */
export const tourBikeTypes = sqliteTable(
  "tour_bike_types",
  {
    tourId: text("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    bikeTypeId: text("bike_type_id")
      .notNull()
      .references(() => bikeTypes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tourId, t.bikeTypeId] })],
);

export const guides = sqliteTable("guides", {
  id: id(),
  name: text("name").notNull(),
  /** The MTB tours specifically need a certified MTB guide. */
  mtbCertified: integer("mtb_certified", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ---------------------------------------------------------------------------
// Payments & audit
// ---------------------------------------------------------------------------

export const PAYMENT_STATUSES = ["pending", "authorized", "captured", "failed", "voided", "refunded"] as const;

/**
 * One row per payment attempt. `eventId` is UNIQUE so a replayed webhook is a
 * no-op (rule E1). Today `refunded` and `voided` exist as TS union members no
 * code path writes; here they are real states with real rows.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("epay"),
    sessionId: text("session_id"),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("DKK"),
    /** Provider event id — idempotency key for webhooks. */
    eventId: text("event_id"),
    rawPayload: text("raw_payload"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    uniqueIndex("payments_event_idx").on(t.eventId),
    index("payments_session_idx").on(t.sessionId),
  ],
);

/** Every status transition: who, when, from, to. `cancelled` is only ever written by a person. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    entity: text("entity").notNull(), // 'booking' | 'departure' | 'payment' | ...
    entityId: text("entity_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actor: text("actor").notNull(), // 'customer' | 'sweeper' | 'webhook' | staff email
    note: text("note"),
    at: integer("at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId, t.at)],
);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------
export type BikeType = typeof bikeTypes.$inferSelect;
export type RateTier = typeof rateTiers.$inferSelect;
export type Addon = typeof addons.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingLine = typeof bookingLines.$inferSelect;
export type NewBookingLine = typeof bookingLines.$inferInsert;
export type Tour = typeof tours.$inferSelect;
export type TourSchedule = typeof tourSchedules.$inferSelect;
export type TourDeparture = typeof tourDepartures.$inferSelect;
export type Payment = typeof payments.$inferSelect;
