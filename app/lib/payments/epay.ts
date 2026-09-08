/**
 * ePay (payments.epay.eu) — the only external service in the system, and
 * the one that must be: card data belongs at a licensed processor.
 *
 * What is known for certain comes from the previous integration, which ran
 * in production: a session is created with POST /cit (customer-initiated
 * transaction) and answers with a session id, a client key, the URL of the
 * hosted-fields script and a hosted payment-window URL; GET /sessions/{id}
 * reports `state` (COMPLETED, EXPIRED, FAILED, …) and, once paid, the
 * transaction id. The notification ePay posts to `notificationUrl` carries
 * the same shape — and is NOT trusted here: a notification only tells us
 * which session to go and read (see settle.ts). The old webhook confirmed
 * bookings straight from the request body, so anyone who guessed the URL
 * could hand out free bikes.
 *
 * Capture, refund and void follow the same API's transaction endpoints. The
 * paths below are the ones this API documents for those operations; they
 * could not be exercised from the build environment (ePay is unreachable
 * from it), so the first live capture must be watched. Every call logs its
 * status and body on failure for exactly that reason.
 */

export interface EpayConfig {
  apiKey: string;
  pointOfSaleId: string;
  /** Override for tests and for a local stand-in server. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface EpaySession {
  sessionId: string;
  sessionKey: string;
  /** The hosted-fields script to load on the payment page. */
  javascriptUrl: string;
  /** A full hosted payment page, for when the fields cannot mount. */
  paymentWindowUrl: string;
}

export type EpaySessionState = "CREATED" | "PENDING" | "COMPLETED" | "EXPIRED" | "FAILED" | "CANCELLED" | string;

export interface EpaySessionStatus {
  state: EpaySessionState;
  transactionId: string | null;
  amountMinor: number | null;
  reference: string | null;
  raw: unknown;
}

export class EpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

export interface EpayEnv {
  EPAY_API_KEY?: string;
  EPAY_POS_ID?: string;
  EPAY_BASE_URL?: string;
  /** "instant" charges the card when the customer books; "pickup" only authorises and staff capture at the counter. */
  EPAY_CAPTURE?: string;
  /** Tests only: the fetch the client talks through. */
  EPAY_FETCH?: typeof fetch;
}

export function epayConfigured(env: EpayEnv): boolean {
  return Boolean(env.EPAY_API_KEY && env.EPAY_POS_ID);
}

export function epayFor(env: EpayEnv): EpayClient | null {
  if (!epayConfigured(env)) return null;
  return new EpayClient({ apiKey: env.EPAY_API_KEY!, pointOfSaleId: env.EPAY_POS_ID!, baseUrl: env.EPAY_BASE_URL, fetch: env.EPAY_FETCH });
}

/** Whether the money is taken at booking (default) or at the counter. */
export function captureMode(env: EpayEnv): "instant" | "pickup" {
  return env.EPAY_CAPTURE === "pickup" ? "pickup" : "instant";
}

export const EPAY_BASE_URL = "https://payments.epay.eu/public/api/v1";

export class EpayClient {
  private readonly base: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly cfg: EpayConfig) {
    this.base = (cfg.baseUrl ?? EPAY_BASE_URL).replace(/\/$/, "");
    // Bound as a plain call: workerd's fetch refuses to run with a foreign `this`.
    this.doFetch = cfg.fetch ?? ((input, init) => fetch(input, init));
  }

  async createSession(input: {
    amountMinor: number;
    currency?: string;
    /** Shown on the statement and in ePay's admin — the booking code plus a suffix, unique per attempt. */
    reference: string;
    notificationUrl: string;
    instantCapture: boolean;
    /** Minutes until the session dies on its own. Match the hold. */
    timeoutMinutes: number;
  }): Promise<EpaySession> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new RangeError(`amount must be a positive integer of øre, got ${input.amountMinor}`);
    const data = await this.call<{ session?: { id?: string }; key?: string; javascript?: string; paymentWindowUrl?: string }>("POST", "/cit", {
      pointOfSaleId: this.cfg.pointOfSaleId,
      amount: input.amountMinor,
      currency: input.currency ?? "DKK",
      reference: input.reference,
      instantCapture: input.instantCapture ? "ON" : "OFF",
      notificationUrl: input.notificationUrl,
      timeout: input.timeoutMinutes,
    });
    const sessionId = data.session?.id;
    if (!sessionId || !data.key || !data.javascript || !data.paymentWindowUrl) {
      throw new EpayError("ePay answered without a session", 200, JSON.stringify(data));
    }
    return { sessionId, sessionKey: data.key, javascriptUrl: data.javascript, paymentWindowUrl: data.paymentWindowUrl };
  }

  async getSession(sessionId: string): Promise<EpaySessionStatus> {
    const data = await this.call<Record<string, unknown>>("GET", `/sessions/${encodeURIComponent(sessionId)}`);
    return parseSession(data);
  }

  /** Take the money on an authorised transaction. Amount in øre; the whole authorisation by default. */
  async capture(transactionId: string, amountMinor: number): Promise<unknown> {
    return this.call("POST", `/transactions/${encodeURIComponent(transactionId)}/capture`, { amount: amountMinor });
  }

  /** Give captured money back, in part or in full. */
  async refund(transactionId: string, amountMinor: number): Promise<unknown> {
    return this.call("POST", `/transactions/${encodeURIComponent(transactionId)}/refund`, { amount: amountMinor });
  }

  /** Release an authorisation that was never captured. */
  async void(transactionId: string): Promise<unknown> {
    return this.call("POST", `/transactions/${encodeURIComponent(transactionId)}/void`);
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await this.doFetch(`${this.base}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`ePay ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
      throw new EpayError(`ePay ${method} ${path} failed with ${res.status}`, res.status, text);
    }
    try {
      return (text ? JSON.parse(text) : {}) as T;
    } catch {
      throw new EpayError(`ePay ${method} ${path} answered non-JSON`, res.status, text);
    }
  }
}

/** The session document, whether it came from GET /sessions/{id} or a notification body. */
export function parseSession(data: Record<string, unknown>): EpaySessionStatus {
  const session = (data.session as Record<string, unknown> | undefined) ?? data;
  const tx = (data.transaction as Record<string, unknown> | undefined) ?? (session.transaction as Record<string, unknown> | undefined);
  const state = String(session.state ?? data.state ?? "").toUpperCase();
  const amount = tx?.amount ?? session.amount ?? data.amount;
  return {
    state,
    transactionId: (tx?.id as string | undefined) ?? (data.transactionId as string | undefined) ?? null,
    amountMinor: typeof amount === "number" ? amount : null,
    reference: (session.reference as string | undefined) ?? (data.reference as string | undefined) ?? null,
    raw: data,
  };
}

/** The session id in a notification body, wherever ePay put it. Nothing else in the body is read. */
export function sessionIdFromNotification(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const s = b.session as Record<string, unknown> | undefined;
  const id = s?.id ?? b.sessionId ?? b.session_id;
  return typeof id === "string" && id.length > 0 && id.length < 200 ? id : null;
}
