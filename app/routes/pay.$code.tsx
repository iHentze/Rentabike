/**
 * The card page. The booking is already held; this page takes the money and
 * the server confirms only after reading the session back from ePay.
 *
 * ePay's hosted fields mount into a container from a script ePay serves, so
 * the card number never touches this origin. If the script cannot load,
 * the hosted payment window opens in a new tab and this page keeps asking
 * the server whether the session is done.
 */
import { useEffect, useRef, useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/pay.$code";
import { cloudflareContext } from "~/context";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, cx } from "~/components/ui";
import { Lock, Warning } from "~/components/icons";
import { getBookingByCode } from "~/lib/booking/lookup";
import { epayConfigured } from "~/lib/payments/epay";
import { settleSession, startCardPayment } from "~/lib/payments/settle";
import { sendConfirmation, originOf } from "~/lib/email/send";
import { fmtLongDay, fmtTime } from "~/lib/format";
import { formatDKKCode } from "~/lib/money";

export function meta() {
  return [{ title: "Pay — Rent a Bike & Outdoor" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const booking = await getBookingByCode(env.DB, params.code);
  if (!booking) throw new Response("Not found", { status: 404 });
  if (booking.status !== "held") throw redirect(`/booked/${booking.code}`);
  if (!epayConfigured(env)) throw redirect(`/booked/${booking.code}`);
  const now = Date.now();
  if (booking.holdExpiresAt && booking.holdExpiresAt <= now) return { booking, session: null, lapsed: true, now };
  // A fresh session per page load: a reloaded page must not reuse one the customer half-filled.
  const minutes = Math.max(2, Math.floor(((booking.holdExpiresAt ?? now + 30 * 60_000) - now) / 60_000));
  const session = await startCardPayment(env, {
    bookingId: booking.id,
    code: booking.code,
    amountMinor: booking.totalMinor,
    notificationUrl: `${originOf(request)}/api/epay/webhook`,
    timeoutMinutes: minutes,
  });
  return { booking, session, lapsed: false, now };
}

/** The page asks "is it paid yet?" — the answer comes from ePay, never from the page. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const form = await request.formData();
  const sessionId = String(form.get("session") ?? "");
  const booking = await getBookingByCode(env.DB, params.code);
  if (!booking || !sessionId) return { outcome: "unknown-session" as const };
  const result = await settleSession(env, sessionId, "customer");
  if (result.outcome === "confirmed") ctx.waitUntil(sendConfirmation(env, result.bookingId, originOf(request)));
  return { outcome: result.outcome, state: "state" in result ? result.state : undefined };
}

declare global {
  interface Window {
    epay?: {
      setSessionId: (id: string) => Window["epay"] & object;
      setSessionKey: (key: string) => Window["epay"] & object;
      setCallbacks: (cb: Record<string, (...a: unknown[]) => unknown>) => Window["epay"] & object;
      init: () => void;
      mountFields: (id: string, cfg: Record<string, unknown>) => void;
      clearFields: (id: string) => void;
      createCardTransaction: () => void;
    };
  }
}

const FIELDS_ID = "epay-fields";

export default function Pay({ loaderData }: Route.ComponentProps) {
  const { booking, session, lapsed } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [phase, setPhase] = useState<"loading" | "ready" | "processing" | "window" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  // When the server says confirmed, go to the booked page. Anything final and negative → say so.
  useEffect(() => {
    const d = fetcher.data;
    if (!d) return;
    if (d.outcome === "confirmed" || d.outcome === "already") {
      if (polling.current) clearInterval(polling.current);
      window.location.assign(`/booked/${booking.code}`);
    } else if (d.outcome === "failed") {
      if (polling.current) clearInterval(polling.current);
      setError(d.state === "EXPIRED" ? "The payment window ran out. Reload to try again." : "The card was declined. Try another card.");
      setPhase("error");
    } else if (d.outcome === "lapsed") {
      if (polling.current) clearInterval(polling.current);
      setError("The bikes were released before the payment came through. Nothing is charged — please book again.");
      setPhase("error");
    }
  }, [fetcher.data, booking.code]);

  const check = () => {
    if (!session) return;
    fetcher.submit({ session: session.sessionId }, { method: "post" });
  };
  const startPolling = () => {
    if (polling.current) return;
    polling.current = setInterval(check, 3000);
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const script = document.createElement("script");
    script.type = "module";
    script.src = session.javascriptUrl;
    const fallback = setTimeout(() => {
      if (!cancelled && phase === "loading") setPhase("window");
    }, 7000);
    script.onerror = () => {
      if (!cancelled) setPhase("window");
    };
    document.head.appendChild(script);
    const wait = setInterval(() => {
      const epay = window.epay;
      if (!epay || cancelled) return;
      clearInterval(wait);
      epay
        .setSessionId(session.sessionId)
        .setSessionKey(session.sessionKey)
        .setCallbacks({
          clientReady: () => {
            clearTimeout(fallback);
            setPhase("ready");
          },
          transactionAccepted: () => {
            setPhase("processing");
            check();
            startPolling();
          },
          transactionDeclined: (data: unknown) => {
            setError((data as { message?: string })?.message || "The card was declined. Try another card.");
            setPhase("ready");
            try {
              epay.clearFields(FIELDS_ID);
            } catch {
              /* the fields may already be gone */
            }
          },
          sessionExpired: () => {
            setError("The payment window ran out. Reload to try again.");
            setPhase("error");
            return false;
          },
          invalidSession: () => {
            setError("The payment session is invalid. Reload to try again.");
            setPhase("error");
          },
          error: (data: unknown) => {
            setError((data as { message?: string })?.message || "A payment error occurred.");
            setPhase("error");
          },
        })
        .init();
      epay.mountFields(FIELDS_ID, {
        theme: "default",
        language: "en",
        fields: { name: { enabled: true, value: booking.customerName }, pan: { focus: true, showSupportedSchemes: true, showBrandSelector: true } },
        loader: { backgroundColor: "transparent", borderStyle: "none", height: "150px" },
        variables: {
          colorText: "#F2F6FA",
          colorPrimary: "#0A78D6",
          colorDanger: "#FF5A5A",
          fontFamily: "'Public Sans', system-ui, sans-serif",
          inputBackgroundColor: "rgba(255,255,255,.10)",
          inputBorderColor: "rgba(255,255,255,.13)",
          inputFocusBorderColor: "#5ABEFF",
          inputBorderRadius: "12px",
          inputFontSize: "16px",
          inputPadding: "12px 15px",
          inputPlaceholderColor: "#7f95a8",
          labelColor: "#B9C7D4",
          labelFontSize: "12px",
          labelFontWeight: "700",
          labelMarginBottom: "6px",
          gridRowSpacing: "14px",
          gridColumnSpacing: "12px",
          windowPadding: "0",
          windowBackgroundColor: "transparent",
          windowBorderStyle: "none",
        },
      });
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      clearInterval(wait);
      if (polling.current) clearInterval(polling.current);
      script.remove();
      delete window.epay;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  const pay = () => {
    if (phase === "window" && session) {
      window.open(session.paymentWindowUrl, "_blank", "noopener");
      setPhase("processing");
      startPolling();
      return;
    }
    if (!window.epay) return;
    setError(null);
    setPhase("processing");
    window.epay.createCardTransaction();
  };

  const deadline = booking.holdExpiresAt;

  return (
    <>
      <Header
        variant="funnel"
        right={
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ok">
            <Lock size={15} /> Secure payment
          </span>
        }
      />
      <Shell className="flex flex-col items-center px-5 pb-14 pt-8 md:px-8">
        <div className="flex w-full max-w-[560px] flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="lbl">Booking {booking.code}</span>
            <h1 className="font-display text-[30px] font-bold tracking-[-.024em]">Pay {formatDKKCode(booking.totalMinor)}</h1>
            <p className="text-[15px] text-ink-soft">
              {fmtLongDay(booking.startAt)} {fmtTime(booking.startAt)} → {fmtLongDay(booking.endAt)} {fmtTime(booking.endAt)} · {booking.pickupName ?? SHOP.address}
            </p>
          </div>

          {lapsed ? (
            <Card className="flex gap-3 bg-warn/10 p-5 text-[14.5px] leading-[1.5]">
              <Warning size={18} className="mt-[2px] shrink-0 text-warn" />
              <span>
                The thirty-minute hold on these bikes has run out and they are back on sale. Nothing is charged.{" "}
                <Link to="/" className="font-semibold text-brand-bright hover:text-ink">
                  Start again
                </Link>
                .
              </span>
            </Card>
          ) : (
            <Card className="flex flex-col gap-4 p-[22px]">
              {deadline && <p className="num text-[13.5px] text-ink-mute">The bikes are held for you until {fmtTime(deadline)}.</p>}
              {error && (
                <div className="flex gap-3 rounded-field bg-danger/12 px-4 py-3 text-[14px] text-danger">
                  <Warning size={17} className="mt-[1px] shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {phase === "loading" && <p className="py-6 text-center text-[14.5px] text-ink-mute">Preparing the secure card form…</p>}
              {phase === "window" && <p className="text-[14.5px] leading-[1.5] text-ink-soft">The card form could not load here. The button opens ePay's own payment page in a new tab; this page updates by itself when you're done.</p>}
              <div id={FIELDS_ID} className={cx(phase === "loading" || phase === "window" ? "hidden" : "")} />
              {phase === "processing" && <p className="text-[14.5px] text-ink-soft">Checking with the bank…</p>}
              <button
                type="button"
                onClick={pay}
                disabled={phase === "loading" || phase === "processing" || (phase === "error" && !session)}
                className="rounded-full bg-white px-6 py-[13px] text-[15.5px] font-bold text-night hover:bg-ink-pale disabled:opacity-50"
              >
                {phase === "window" ? "Open the payment page" : phase === "processing" ? "Working…" : phase === "error" ? "Try again" : `Pay ${formatDKKCode(booking.totalMinor)}`}
              </button>
              <p className="text-[12.5px] leading-[1.5] text-ink-mute">
                Visa, Mastercard and Dankort through ePay. The card number goes to ePay directly; we never see it. Free cancellation until 48 hours before pickup.
              </p>
              <noscript>
                <p className="text-[14px] text-warn">
                  This page needs JavaScript for the card form. Alternatively,{" "}
                  {session && (
                    <a href={session.paymentWindowUrl} className="font-semibold text-brand-bright">
                      pay on ePay's page
                    </a>
                  )}
                  .
                </p>
              </noscript>
            </Card>
          )}
          <p className="text-[13.5px] text-ink-mute">
            Rather pay when you collect? Call {SHOP.phone} and we'll switch the booking — the bikes stay held for you.
          </p>
        </div>
      </Shell>
      <Footer />
    </>
  );
}
