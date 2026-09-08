/**
 * The frame around every customer page: header, footer, the trip strip that
 * follows a booking through the funnel, and the page shell that keeps the
 * 1280px canvas width on a wide screen and full-bleed on a phone.
 */
import { Link, NavLink } from "react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Calendar, Chevron, Clock, Phone, Pin } from "./icons";
import { cx } from "./ui";
import { fmtDayTime, fmtRange } from "~/lib/format";
import type { Trip } from "~/lib/trip";
import { tripDays, tripHref } from "~/lib/trip";
import { plural, fmtDays } from "~/lib/format";

export const SHOP = {
  name: "Rent a Bike & Outdoor",
  address: "Sverrisgøta 20",
  town: "Tórshavn",
  phone: "+298 270 600",
  phoneHref: "tel:+298270600",
  email: "rentabike@rentabike.fo",
  hours: "08:00–18:00",
} as const;

export function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1280px]", className)}>{children}</div>;
}

/** The white plaque keeps the logo's real brand blue on the dark ground. */
export function Plaque({ size = 30 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center rounded-plaque bg-white px-[5px] py-[2px]" aria-label={SHOP.name}>
      <img src="/images/logo.png" alt="" style={{ height: size }} className="block w-auto" />
    </Link>
  );
}

const NAV = [
  { to: "/bikes", label: "Rent a bike" },
  { to: "/tours", label: "Guided tours" },
  { to: "/booking", label: "My booking" },
];

/** The WooCommerce shop stays where it is for sales; this site does rentals and tours. */
export const WEBSHOP_URL = "https://rentabike.fo/shop/";

export function Header({ variant = "site", right }: { variant?: "site" | "funnel"; right?: ReactNode }) {
  const home = variant === "site";
  const [open, setOpen] = useState(false);

  // The menu is a sheet over the page: freeze the page while it is up, and close on Escape.
  useEffect(() => {
    if (!open) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = was;
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <header className="relative z-40 bg-header">
      <Shell className={cx("flex items-center gap-4 px-5 md:px-8", home ? "py-[14px]" : "py-3")}>
        <Plaque size={home ? 42 : 36} />
        {home && (
          <nav className="ml-[14px] hidden items-center gap-[26px] lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => cx("text-[15px]", isActive ? "font-semibold text-ink" : "font-medium text-ink-soft hover:text-ink")}
              >
                {n.label}
              </NavLink>
            ))}
            <a href={WEBSHOP_URL} className="text-[15px] font-medium text-ink-soft hover:text-ink">
              Webshop <span aria-hidden>↗</span>
            </a>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-4">
          {right ?? (
            <>
              <span className="hidden text-[14.5px] text-ink-soft lg:inline">Open today {SHOP.hours}</span>
              {/* the menu button, on screens too narrow for the links */}
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls="site-menu"
                aria-label={open ? "Close the menu" : "Open the menu"}
                className="flex size-11 items-center justify-center rounded-full bg-white/9 hover:bg-white/14 lg:hidden"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </>
          )}
        </div>
      </Shell>

      {/* the mobile menu: the same four links, then how to reach the shop */}
      {home && open && (
        <div id="site-menu" className="fixed inset-x-0 bottom-0 top-[62px] z-40 overflow-y-auto bg-ground lg:hidden">
          <Shell className="flex flex-col px-5 pb-10 pt-3">
            <nav className="flex flex-col">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className={({ isActive }) => cx("border-b border-white/7 py-[18px] text-[22px] font-semibold tracking-[-.01em]", isActive ? "text-brand-bright" : "text-ink")}>
                  {n.label}
                </NavLink>
              ))}
              <a href={WEBSHOP_URL} className="border-b border-white/7 py-[18px] text-[22px] font-semibold tracking-[-.01em] text-ink">
                Webshop <span aria-hidden className="text-ink-mute">↗</span>
              </a>
            </nav>
            <div className="mt-7 flex flex-col gap-3">
              <a href={SHOP.phoneHref} className="inline-flex items-center justify-center gap-[10px] rounded-full bg-white px-6 py-[15px] text-[16px] font-bold text-night">
                <Phone size={17} />
                <span className="num">Call {SHOP.phone}</span>
              </a>
              <span className="inline-flex items-center gap-[10px] px-1 text-[14.5px] text-ink-soft">
                <Clock size={16} className="text-brand-bright" /> Open today {SHOP.hours}
              </span>
              <span className="inline-flex items-center gap-[10px] px-1 text-[14.5px] text-ink-soft">
                <Pin size={16} className="text-brand-bright" /> {SHOP.address}, Tórshavn
              </span>
            </div>
          </Shell>
        </div>
      )}
    </header>
  );
}

/** "Fri 12 → Sun 14 June · 2 riders   Change" — the header's right side inside the funnel. */
export function TripSummary({ trip, changeTo = "/", tour }: { trip: Trip; changeTo?: string; tour?: { title: string; slug: string } | null }) {
  return (
    <>
      <span className="num hidden text-[14.5px] text-ink-soft sm:inline">
        {tour ? `${tour.title} · ${fmtDayTime(trip.startAt)}` : fmtRange(trip.startAt, trip.endAt)} · {plural(trip.riders, "rider")}
      </span>
      <Link to={tour ? `/tours/${tour.slug}?riders=${trip.riders}&dep=${trip.tourDepartureId ?? ""}` : tripHref(changeTo, trip)} className="text-[14.5px] font-semibold text-brand-bright hover:text-ink">
        Change
      </Link>
    </>
  );
}

/** The blue strip under the header on the catalogue: dates, pickup, riders. */
export function TripStrip({ trip, tour, pickup, dropoff }: { trip: Trip; tour?: { title: string; slug: string } | null; pickup?: string | null; dropoff?: string | null }) {
  return (
    <div className="bg-brand/14">
      <Shell className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-[13px] md:px-8">
        <span className="inline-flex items-center gap-[9px] text-[14.5px] font-semibold">
          <Calendar size={17} className="text-brand-bright" />
          <span className="num">{tour ? `${tour.title} · ${fmtDayTime(trip.startAt)}` : fmtRange(trip.startAt, trip.endAt)}</span>
        </span>
        <span className="inline-flex items-center gap-[9px] text-[14.5px] font-semibold">
          <Pin size={17} className="text-brand-bright" />
          {tour ? SHOP.address : dropoff && dropoff !== (pickup ?? SHOP.address) ? `${pickup ?? SHOP.address} → ${dropoff}` : (pickup ?? SHOP.address)}
        </span>
        <span className="text-[14.5px] text-ink-soft">
          {fmtDays(tripDays(trip))} · {plural(trip.riders, "rider")}
        </span>
        <Link to={tour ? `/tours/${tour.slug}?riders=${trip.riders}&dep=${trip.tourDepartureId ?? ""}` : tripHref("/", trip)} className="ml-auto text-[14.5px] font-semibold text-brand-bright hover:text-ink">
          Change
        </Link>
      </Shell>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <Shell className="flex flex-col gap-[18px] px-5 pb-11 pt-[22px] md:px-8">
        <div className="flex flex-col gap-[18px] border-t border-white/7 pt-[22px]">
          <span className="lbl">Supported by</span>
          <div className="flex flex-wrap items-center gap-8">
            <img src="/images/interreg-npa.svg" alt="Interreg Northern Periphery and Arctic, co-funded by the European Union" width={232} height={70} className="block h-[70px] w-auto" />
            <VisitTorshavn />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/7 pt-[18px] text-[13px] text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <span>
            {SHOP.name} · {SHOP.address}, {SHOP.town} ·{" "}
            <a href={WEBSHOP_URL} className="hover:text-ink">
              Webshop ↗
            </a>
          </span>
          <span className="num">
            {SHOP.phone} · {SHOP.email}
          </span>
        </div>
      </Shell>
    </footer>
  );
}

/**
 * Stand-in for the Visit Tórshavn mark, drawn by eye for the canvas so the
 * footer could be judged as a composition. The official artwork
 * (VisitTorshavn-Bumerki-Positivt.png, from Berit's mail of 16 April) must
 * replace this before the rentabike.fo cutover.
 */
function VisitTorshavn() {
  return (
    <div className="flex shrink-0 items-center gap-[11px]" role="img" aria-label="Visit Tórshavn">
      <svg viewBox="0 0 150 165" width="56" height="61.6" aria-hidden className="block shrink-0">
        <g fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="72" cy="66" r="50" />
          <path d="M2 120c8-7 15-7 23 0s15 7 23 0" />
          <path d="M2 136c8-7 15-7 23 0s15 7 23 0" />
          <path d="M2 152c8-7 15-7 23 0s15 7 23 0" />
          <path d="M72 2v14" />
          <circle cx="72" cy="24" r="6.5" fill="#070E15" />
          <path d="M46 52 72 28l26 24z" fill="#070E15" />
          <path d="M56 52 58 78h28l2-26z" fill="#070E15" />
          <path d="M65 56v18M79 56v18" />
          <rect x="48" y="78" width="48" height="22" rx="5" fill="#070E15" />
          <path d="M58 100 52 142h40l-6-42z" fill="#070E15" />
          <path d="M55 114h34M53 128h38" />
          <rect x="56" y="124" width="34" height="18" rx="9" fill="#070E15" />
          <rect x="94" y="124" width="26" height="18" rx="9" fill="#070E15" />
          <rect x="42" y="144" width="32" height="18" rx="9" fill="#070E15" />
          <rect x="78" y="144" width="32" height="18" rx="9" fill="#070E15" />
          <rect x="114" y="144" width="18" height="18" rx="9" fill="#070E15" />
        </g>
      </svg>
      <span className="flex flex-col whitespace-nowrap font-display text-[19px] font-medium leading-[1.05] tracking-[-.01em] text-ink">
        <span>Visit</span>
        <span>Tórshavn</span>
      </span>
    </div>
  );
}

/** "Dates ✓ — Bikes ✓ — 3 Details & payment" */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Dates", "Riders — bikes and extras", "Details & payment"];
  return (
    <div className="border-t border-white/5 bg-header">
      <Shell className="flex items-center gap-3 px-5 py-[15px] md:px-8">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = n < current;
          const active = n === current;
          return (
            <div key={label} className="flex items-center gap-3">
              {i > 0 && <div className="h-px w-9 bg-white/12" />}
              <div className="flex items-center gap-[9px]">
                <div className={cx("flex size-6 items-center justify-center rounded-full", done ? "bg-ok text-ok-ink" : active ? "border-2 border-brand text-brand-bright" : "border-2 border-ink-dim text-ink-dim")}>
                  {done ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg> : <span className="text-[12px] font-bold">{n}</span>}
                </div>
                <span className={cx("text-[14.5px]", active ? "font-semibold text-ink" : "text-ink-soft")}>{label}</span>
              </div>
            </div>
          );
        })}
      </Shell>
    </div>
  );
}

export { Chevron };
