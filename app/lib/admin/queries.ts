/**
 * What the counter needs to see. Read-only; every write goes through
 * lifecycle.ts, settle.ts or a conditional UPDATE in admin actions.
 */
import { FAROE_TZ, faroeParts } from "~/lib/format";

export interface BookingRow {
  id: string;
  code: string;
  kind: "rental" | "tour";
  status: string;
  startAt: number;
  endAt: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  pickupName: string | null;
  dropoffName: string | null;
  totalMinor: number;
  paymentMethod: "shop" | "card";
  paidMinor: number;
  refundedMinor: number;
  createdAt: number;
  /** "Anna: Cube Dual Suspension M, Marek: Centurion L" */
  summary: string;
  riders: number;
}

const ROW = `SELECT b.id, b.code, b.kind, b.status, b.start_at, b.end_at, b.customer_name, b.customer_email, b.customer_phone,
                   b.total_minor, b.payment_method, b.paid_minor, b.refunded_minor, b.created_at,
                   p.name AS pickup_name, d.name AS dropoff_name,
                   (SELECT group_concat(CASE WHEN bl.rider_label IS NOT NULL THEN bl.rider_label || ': ' ELSE '' END || bl.label, ', ')
                      FROM booking_lines bl WHERE bl.booking_id = b.id AND bl.kind IN ('bike','tour_seat')) AS summary,
                   (SELECT COUNT(*) FROM booking_lines bl WHERE bl.booking_id = b.id AND bl.kind = 'bike') AS riders
              FROM bookings b
              LEFT JOIN locations p ON p.id = b.pickup_location_id
              LEFT JOIN locations d ON d.id = b.dropoff_location_id`;

function toRow(r: Record<string, unknown>): BookingRow {
  return {
    id: r.id as string,
    code: r.code as string,
    kind: r.kind as "rental" | "tour",
    status: r.status as string,
    startAt: r.start_at as number,
    endAt: r.end_at as number,
    customerName: r.customer_name as string,
    customerEmail: r.customer_email as string,
    customerPhone: (r.customer_phone as string | null) ?? null,
    pickupName: (r.pickup_name as string | null) ?? null,
    dropoffName: (r.dropoff_name as string | null) ?? null,
    totalMinor: r.total_minor as number,
    paymentMethod: (r.payment_method as "shop" | "card") ?? "shop",
    paidMinor: (r.paid_minor as number) ?? 0,
    refundedMinor: (r.refunded_minor as number) ?? 0,
    createdAt: r.created_at as number,
    summary: (r.summary as string | null) ?? "",
    riders: (r.riders as number) ?? 0,
  };
}

/** The Faroese calendar day containing `at`, as [start, end) in UTC ms. */
export function faroeDay(at: number): { start: number; end: number; date: string } {
  const date = faroeParts(at).date;
  return { ...dayBounds(date), date };
}

/** "2026-06-12" → its [start, end) in UTC ms, on the Faroese clock (DST-safe). */
export function dayBounds(date: string): { start: number; end: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const startOf = (yy: number, mm: number, dd: number) => {
    // Try the UTC midnight, then correct by the zone offset at that instant.
    const guess = Date.UTC(yy, mm - 1, dd);
    const offsetMin = offsetMinutes(guess);
    return guess - offsetMin * 60_000;
  };
  const start = startOf(y, m, d);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const end = startOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return { start, end };
}

function offsetMinutes(at: number): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: FAROE_TZ, timeZoneName: "shortOffset" }).formatToParts(at).find((x) => x.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(p);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export interface TodayBoard {
  date: string;
  pickups: BookingRow[];
  returns: BookingRow[];
  /** Out on bikes past their return time. */
  overdue: BookingRow[];
  /** Holds still waiting for a card, and confirmed bookings not yet collected but due earlier today. */
  holds: BookingRow[];
  counts: { confirmedAhead: number; heldNow: number };
}

export async function todayBoard(d1: D1Database, at = Date.now()): Promise<TodayBoard> {
  const day = faroeDay(at);
  const q = async (where: string, ...binds: unknown[]) =>
    ((await d1.prepare(`${ROW} WHERE ${where}`).bind(...binds).all<Record<string, unknown>>()).results ?? []).map(toRow);
  const [pickups, returns, overdue, holds, ahead, heldNow] = await Promise.all([
    q(`b.status IN ('confirmed','held') AND b.start_at >= ?1 AND b.start_at < ?2 ORDER BY b.start_at, b.customer_name`, day.start, day.end),
    q(`b.status = 'picked_up' AND b.end_at >= ?1 AND b.end_at < ?2 ORDER BY b.end_at`, day.start, day.end),
    q(`b.status = 'picked_up' AND b.end_at < ?1 ORDER BY b.end_at`, day.start),
    q(`b.status = 'held' AND b.hold_expires_at > ?1 ORDER BY b.created_at DESC`, at),
    d1.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND start_at >= ?1`).bind(day.end).first<{ n: number }>(),
    d1.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'held'`).first<{ n: number }>(),
  ]);
  return { date: day.date, pickups, returns, overdue, holds, counts: { confirmedAhead: ahead?.n ?? 0, heldNow: heldNow?.n ?? 0 } };
}

export interface BookingFilter {
  status?: string;
  /** Free text: code, name, email or phone. */
  q?: string;
  /** "2026-06-12": bookings active on that day. */
  day?: string;
  /** upcoming (default when nothing else is set), past, all */
  when?: "upcoming" | "past" | "all";
  limit?: number;
}

export async function listBookings(d1: D1Database, f: BookingFilter, now = Date.now()): Promise<BookingRow[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  const bind = (v: unknown) => {
    binds.push(v);
    return `?${binds.length}`;
  };
  if (f.status && f.status !== "all") where.push(`b.status = ${bind(f.status)}`);
  if (f.q) {
    const like = `%${f.q.trim()}%`;
    where.push(`(b.code LIKE ${bind(f.q.trim().toUpperCase())} OR b.customer_name LIKE ${bind(like)} OR b.customer_email LIKE ${bind(like)} OR b.customer_phone LIKE ${bind(like)})`);
  }
  if (f.day) {
    const { start, end } = dayBounds(f.day);
    where.push(`b.start_at < ${bind(end)} AND b.end_at > ${bind(start)}`);
  }
  const when = f.when ?? (f.q || f.day || (f.status && f.status !== "all") ? "all" : "upcoming");
  if (when === "upcoming") where.push(`b.end_at >= ${bind(now)}`);
  if (when === "past") where.push(`b.end_at < ${bind(now)}`);
  const order = when === "past" ? "b.start_at DESC" : "b.start_at ASC";
  const sql = `${ROW}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ${Math.min(500, Math.max(1, f.limit ?? 200))}`;
  const rows = await d1.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return (rows.results ?? []).map(toRow);
}

export interface AuditRow {
  entity: string;
  entityId: string;
  fromStatus: string | null;
  toStatus: string | null;
  actor: string;
  note: string | null;
  at: number;
}

export async function auditFor(d1: D1Database, bookingId: string): Promise<AuditRow[]> {
  const rows = await d1
    .prepare(
      `SELECT a.entity, a.entity_id, a.from_status, a.to_status, a.actor, a.note, a.at
         FROM audit_log a
        WHERE (a.entity = 'booking' AND a.entity_id = ?1)
           OR (a.entity = 'payment' AND a.entity_id IN (SELECT id FROM payments WHERE booking_id = ?1))
        ORDER BY a.at DESC`,
    )
    .bind(bookingId)
    .all<Record<string, unknown>>();
  return (rows.results ?? []).map((r) => ({
    entity: r.entity as string,
    entityId: r.entity_id as string,
    fromStatus: (r.from_status as string | null) ?? null,
    toStatus: (r.to_status as string | null) ?? null,
    actor: r.actor as string,
    note: (r.note as string | null) ?? null,
    at: r.at as number,
  }));
}

export interface PaymentView {
  id: string;
  status: string;
  amountMinor: number;
  capturedMinor: number;
  refundedMinor: number;
  sessionId: string | null;
  transactionId: string | null;
  createdAt: number;
}

export async function paymentsFor(d1: D1Database, bookingId: string): Promise<PaymentView[]> {
  const rows = await d1
    .prepare(`SELECT id, status, amount_minor, captured_minor, refunded_minor, session_id, transaction_id, created_at FROM payments WHERE booking_id = ?1 ORDER BY created_at DESC`)
    .bind(bookingId)
    .all<Record<string, unknown>>();
  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    status: r.status as string,
    amountMinor: r.amount_minor as number,
    capturedMinor: (r.captured_minor as number) ?? 0,
    refundedMinor: (r.refunded_minor as number) ?? 0,
    sessionId: (r.session_id as string | null) ?? null,
    transactionId: (r.transaction_id as string | null) ?? null,
    createdAt: r.created_at as number,
  }));
}

export interface StockRow {
  id: string;
  name: string;
  category: string;
  sizeLabel: string | null;
  riderMinCm: number | null;
  riderMaxCm: number | null;
  stock: number;
  listed: boolean;
  /** Units out or booked on the Faroese day given. */
  outToday: number;
}

export async function stockList(d1: D1Database, at = Date.now()): Promise<StockRow[]> {
  const day = faroeDay(at);
  const rows = await d1
    .prepare(
      `SELECT bt.id, bt.name, bt.category, bt.size_label, bt.rider_min_cm, bt.rider_max_cm, bt.stock, bt.listed,
              COALESCE((SELECT SUM(bl.qty) FROM booking_lines bl JOIN bookings b ON b.id = bl.booking_id
                         WHERE bl.bike_type_id = bt.id AND bl.kind = 'bike' AND b.status IN ('held','confirmed','picked_up')
                           AND b.start_at < ?2 AND b.end_at > ?1), 0) AS out_today
         FROM bike_types bt
        ORDER BY bt.category, bt.name, bt.rider_min_cm`,
    )
    .bind(day.start, day.end)
    .all<Record<string, unknown>>();
  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    sizeLabel: (r.size_label as string | null) ?? null,
    riderMinCm: (r.rider_min_cm as number | null) ?? null,
    riderMaxCm: (r.rider_max_cm as number | null) ?? null,
    stock: r.stock as number,
    listed: Boolean(r.listed),
    outToday: (r.out_today as number) ?? 0,
  }));
}

/** Everyone booked on one departure, live bookings first: who is coming on Saturday's ride. */
export async function bookingsOnDeparture(d1: D1Database, departureId: string): Promise<BookingRow[]> {
  const rows = await d1
    .prepare(
      `${ROW}
        WHERE b.id IN (SELECT bl.booking_id FROM booking_lines bl WHERE bl.kind = 'tour_seat' AND bl.tour_departure_id = ?1)
        ORDER BY CASE WHEN b.status IN ('held','confirmed','picked_up') THEN 0 ELSE 1 END, b.created_at`,
    )
    .bind(departureId)
    .all<Record<string, unknown>>();
  return (rows.results ?? []).map(toRow);
}
