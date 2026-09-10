/** Read one booking back for the confirmation and "my booking" pages. */

export interface BookingLineView {
  id: string;
  kind: "bike" | "addon" | "fee" | "tour_seat";
  label: string;
  riderLabel: string | null;
  qty: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  bikeTypeId: string | null;
  sizeLabel: string | null;
  tourDepartureId: string | null;
}

export interface BookingView {
  id: string;
  code: string;
  kind: "rental" | "tour";
  status: string;
  startAt: number;
  endAt: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  pickupLocationId: string | null;
  dropoffLocationId: string | null;
  pickupName: string | null;
  dropoffName: string | null;
  /** The hand-over instructions for the pickup place, when it has any (the airport does). */
  pickupNote: string | null;
  notes: string | null;
  staffNotes: string | null;
  totalMinor: number;
  paymentMethod: "shop" | "card";
  /** Authorised or captured on the card so far, and what went back. */
  paidMinor: number;
  refundedMinor: number;
  holdExpiresAt: number | null;
  createdAt: number;
  lines: BookingLineView[];
}

const SELECT = `SELECT b.id, b.code, b.kind, b.status, b.start_at, b.end_at, b.customer_name, b.customer_email, b.customer_phone,
              b.pickup_location_id, b.dropoff_location_id, b.notes, b.staff_notes, b.total_minor, b.payment_method, b.paid_minor, b.refunded_minor,
              b.hold_expires_at, b.created_at,
              p.name AS pickup_name, p.note AS pickup_note, d.name AS dropoff_name
         FROM bookings b
         LEFT JOIN locations p ON p.id = b.pickup_location_id
         LEFT JOIN locations d ON d.id = b.dropoff_location_id`;

export async function getBookingByCode(d1: D1Database, code: string): Promise<BookingView | null> {
  return hydrate(d1, await d1.prepare(`${SELECT} WHERE b.code = ?1`).bind(code.toUpperCase()).first<Record<string, unknown>>());
}

export async function getBookingById(d1: D1Database, id: string): Promise<BookingView | null> {
  return hydrate(d1, await d1.prepare(`${SELECT} WHERE b.id = ?1`).bind(id).first<Record<string, unknown>>());
}

async function hydrate(d1: D1Database, b: Record<string, unknown> | null): Promise<BookingView | null> {
  if (!b) return null;
  const lines = await d1
    .prepare(
      `SELECT bl.id, bl.kind, bl.label, bl.rider_label, bl.qty, bl.unit_price_minor, bl.line_total_minor, bl.bike_type_id, bt.size_label, bl.tour_departure_id
         FROM booking_lines bl LEFT JOIN bike_types bt ON bt.id = bl.bike_type_id
        WHERE bl.booking_id = ?1
        ORDER BY CASE bl.kind WHEN 'tour_seat' THEN 0 WHEN 'bike' THEN 1 WHEN 'addon' THEN 2 ELSE 3 END, bl.rider_label, bl.label`,
    )
    .bind(b.id as string)
    .all<Record<string, unknown>>();
  return {
    id: b.id as string,
    code: b.code as string,
    kind: b.kind as "rental" | "tour",
    status: b.status as string,
    startAt: b.start_at as number,
    endAt: b.end_at as number,
    customerName: b.customer_name as string,
    customerEmail: b.customer_email as string,
    customerPhone: (b.customer_phone as string | null) ?? null,
    pickupLocationId: (b.pickup_location_id as string | null) ?? null,
    dropoffLocationId: (b.dropoff_location_id as string | null) ?? null,
    pickupName: (b.pickup_name as string | null) ?? null,
    dropoffName: (b.dropoff_name as string | null) ?? null,
    pickupNote: (b.pickup_note as string | null) ?? null,
    notes: (b.notes as string | null) ?? null,
    staffNotes: (b.staff_notes as string | null) ?? null,
    totalMinor: b.total_minor as number,
    paymentMethod: (b.payment_method as "shop" | "card") ?? "shop",
    paidMinor: (b.paid_minor as number) ?? 0,
    refundedMinor: (b.refunded_minor as number) ?? 0,
    holdExpiresAt: (b.hold_expires_at as number | null) ?? null,
    createdAt: b.created_at as number,
    lines: (lines.results ?? []).map((l) => ({
      id: l.id as string,
      kind: l.kind as BookingLineView["kind"],
      label: l.label as string,
      riderLabel: (l.rider_label as string | null) ?? null,
      qty: l.qty as number,
      unitPriceMinor: l.unit_price_minor as number,
      lineTotalMinor: l.line_total_minor as number,
      bikeTypeId: (l.bike_type_id as string | null) ?? null,
      sizeLabel: (l.size_label as string | null) ?? null,
      tourDepartureId: (l.tour_departure_id as string | null) ?? null,
    })),
  };
}

export interface LocationView {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  pickupFeeMinor: number;
  dropoffFeeMinor: number;
  isDefault: boolean;
  note: string | null;
  lat: number | null;
  lng: number | null;
}

export async function listLocations(d1: D1Database): Promise<LocationView[]> {
  const rows = await d1
    .prepare(`SELECT id, slug, name, address, pickup_fee_minor, dropoff_fee_minor, is_default, note, lat, lng FROM locations WHERE active = 1 ORDER BY is_default DESC, pickup_fee_minor, name`)
    .all<{ id: string; slug: string; name: string; address: string | null; pickup_fee_minor: number; dropoff_fee_minor: number; is_default: number; note: string | null; lat: number | null; lng: number | null }>();
  return (rows.results ?? []).map((l) => ({ id: l.id, slug: l.slug, name: l.name, address: l.address, pickupFeeMinor: l.pickup_fee_minor, dropoffFeeMinor: l.dropoff_fee_minor, isDefault: Boolean(l.is_default), note: l.note, lat: l.lat, lng: l.lng }));
}
