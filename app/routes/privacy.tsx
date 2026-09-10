/**
 * Privacy. Written for what this site actually does: one booking cookie, a
 * booking record kept for the bookkeeping law, card payments through ePay,
 * confirmation mail through Cloudflare. No accounts, no comments, no
 * analytics — so none of the WordPress boilerplate from the old page.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/privacy";
import { Footer, Header, SHOP, Shell, WEBSHOP_URL } from "~/components/site";
import { Card, Lbl } from "~/components/ui";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Privacy — Rent a Bike & Outdoor" },
    { name: "description", content: "What Rent a Bike & Outdoor stores when you book, why, for how long, and how to ask for it or have it removed." },
  ];
}

const OWNERS = "Bartal í Gongini and Berit Unn Petersen";

export default function Privacy() {
  return (
    <>
      <Header />
      <Shell className="flex flex-col gap-6 px-5 pb-12 pt-9 md:px-8">
        <div className="flex max-w-[720px] flex-col gap-3">
          <Lbl>Privacy</Lbl>
          <h1 className="font-display text-[36px] font-bold leading-[1.02] tracking-[-.028em] md:text-[46px]">What we keep, and why</h1>
          <p className="text-[16.5px] leading-[1.55] text-ink-soft">We store what a booking needs and nothing for its own sake. No accounts, no tracking, no selling of anything to anyone.</p>
        </div>

        <div className="grid gap-[14px] lg:grid-cols-2 lg:items-start">
          <Card className="flex flex-col gap-4 px-6 py-6 md:px-7">
            <Clause title="Who we are">
              Rent a Bike &amp; Outdoor, {SHOP.address}, {SHOP.town}, Faroe Islands. Owners: {OWNERS}. Write to {SHOP.email} about anything on this page.
            </Clause>
            <Clause title="What we store when you book">
              Your name, email address and phone number, the riders' first names and heights, any note you leave us, and the booking itself: bikes, extras, dates, pickup and return points, what was paid and how. We use it to hold the bikes, size them to each rider, send your confirmation and reach you if something changes, for instance the weather.
            </Clause>
            <Clause title="How long">
              Faroese bookkeeping law obliges us to keep purchase records for at least five years. That is how long a booking stays. Nothing about you is kept beyond what that requires.
            </Clause>
            <Clause title="Card payments">
              Card payments run through ePay. Your card details go to ePay, never to our servers; we receive a payment reference and the amount. ePay's own privacy terms apply to the card transaction.
            </Clause>
            <Clause title="Email">
              Your confirmation, and any change to it, goes out by email from booking@rentabike.fo through Cloudflare's email service. We do not send newsletters from this site.
            </Clause>
          </Card>

          <Card className="flex flex-col gap-4 px-6 py-6 md:px-7">
            <Clause title="Cookies">
              One cookie, rb_basket, remembers a booking you have started so you can come back to it. It holds bike choices, rider names and heights, and your dates; never a price and never a card. It lives seven days, or until you book or press "Start over". Staff who sign in to the counter get a session cookie for that. There are no analytics, advertising or third-party cookies on this site.
            </Clause>
            <Clause title="Where it lives">
              The site runs on Cloudflare, and bookings are stored in a Cloudflare database. Cloudflare may process requests in data centres outside the Faroe Islands and the EEA under its own data-protection terms.
            </Clause>
            <Clause title="Your rights">
              Ask us for a copy of what we hold about you, or to have it corrected or deleted, at {SHOP.email}. We delete everything we are not legally obliged to keep. You can look up and cancel a booking yourself under{" "}
              <Link to="/booking" className="font-semibold text-brand-bright hover:text-ink">
                My booking
              </Link>
              .
            </Clause>
            <Clause title="If something goes wrong">
              Should we learn of a breach involving your data, we tell you without delay, along with what we are doing about it. We make no automated decisions about you and never sell or share your details with anyone beyond the payment and email services named above.
            </Clause>
            <Clause title="The webshop">
              Purchases in the{" "}
              <a href={WEBSHOP_URL} className="font-semibold text-brand-bright hover:text-ink">
                webshop
              </a>{" "}
              on rentabike.fo are handled by that shop and its own privacy policy.
            </Clause>
          </Card>
        </div>

        <Card className="flex flex-col gap-2 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <span className="text-[14.5px] text-ink-soft">Last revised September 2026.</span>
          <Link to="/terms" className="text-[14.5px] font-semibold text-brand-bright hover:text-ink">
            Rental conditions &amp; booking terms ›
          </Link>
        </Card>
      </Shell>
      <Footer />
    </>
  );
}

function Clause({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/7 pt-4 first:border-0 first:pt-0">
      <h2 className="text-[15.5px] font-semibold">{title}</h2>
      <p className="text-[14.5px] leading-[1.55] text-ink-pale">{children}</p>
    </div>
  );
}
