/**
 * Rental conditions and booking terms. The rental conditions are the shop's
 * own, carried over from rentabike.fo with the English tidied. The booking
 * terms say what the checkout and the refund code actually do — rules D1 and
 * D2 in app/lib/booking/cancellation.ts — so the small print and the screen
 * that takes the money never disagree.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/terms";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, Lbl } from "~/components/ui";
import { FREE_CANCELLATION_HOURS } from "~/lib/booking/cancellation";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Rental conditions & booking terms — Rent a Bike & Outdoor" },
    { name: "description", content: "What you agree to when you rent a bike or book a guided tour with Rent a Bike & Outdoor in Tórshavn: risk, damage, insurance, payment and cancellation." },
  ];
}

export default function Terms() {
  return (
    <>
      <Header />
      <Shell className="flex flex-col gap-6 px-5 pb-12 pt-9 md:px-8">
        <div className="flex max-w-[720px] flex-col gap-3">
          <Lbl>The small print</Lbl>
          <h1 className="font-display text-[36px] font-bold leading-[1.02] tracking-[-.028em] md:text-[46px]">Rental conditions &amp; booking terms</h1>
          <p className="text-[16.5px] leading-[1.55] text-ink-soft">
            Short, and in plain words. Questions before you book? Call {SHOP.phone} or write to {SHOP.email}.
          </p>
        </div>

        <div className="grid gap-[14px] lg:grid-cols-2 lg:items-start">
          <Section title="Rental conditions" lead="For every bike we rent out, whether you ride on your own or on a guided tour.">
            <Clause title="At your own risk">Renting and riding a bicycle is at your own risk. Should the rider, another person or anything else come to harm, no claim can be made against rentabike.fo; only the rider's own insurance applies.</Clause>
            <Clause title="Check the bike when you collect it">Any complaint about the bike must be raised with us immediately at handover. If a bike turns out to be defective through a fault of ours, it is exchanged or repaired at no charge.</Clause>
            <Clause title="Damage, breakdown and loss">
              If the bike breaks or goes missing during the rental, call {SHOP.phone} at once. The renter is liable for damage or deterioration during the rental period and covers our loss on request. A lost bike or accessory is charged at its full replacement value.
            </Clause>
            <Clause title="Insurance included in the rent">
              The rent includes theft cover, valid when the bike was properly locked, and damage cover, valid when the bike was ridden properly and an accident, fall or collapse damaged it. Both carry an excess of DKK 1,000 per claim. The cover costs DKK 50 per bike and is already in the price.
            </Clause>
            <Clause title="Shorter than planned">Rent already paid is not refunded if the rental ends earlier than agreed, including when the renter falls ill and has to stop. Bad weather during the rental does not entitle you to a reduction. We recommend that you carry your own travel insurance.</Clause>
            <Clause title="Helmets and the road">We recommend a helmet. Helmets are included on guided rides and rented separately for rentals. Keeping to the traffic rules is the rider's own responsibility.</Clause>
          </Section>

          <Section title="Booking terms" lead="How the money works, and what happens if plans change.">
            <Clause title="Payment">Pay by card when you book, or pay at the shop when you collect. Either way the bikes are held for you from the moment you book. Card payments go through ePay; we never see your card details.</Clause>
            <Clause title={`Cancelling a bike rental or a guided day tour`}>
              Free cancellation until {FREE_CANCELLATION_HOURS} hours before the start. Cancel before then and nothing is owed; anything already paid is refunded to the card. Within {FREE_CANCELLATION_HOURS} hours of the start the booking is charged in full, because we have turned other people away for those bikes or seats.
              Cancel under{" "}
              <Link to="/booking" className="font-semibold text-brand-bright hover:text-ink">
                My booking
              </Link>{" "}
              with your code and email, or write to {SHOP.email}.
            </Clause>
            <Clause title="Cancelling a package tour">Packages of several days follow their own line: 50% of the price is kept if you cancel 8 to 21 days before the start, and 100% within 7 days of the start. Package cancellations must be made in writing to {SHOP.email}.</Clause>
            <Clause title="When we cancel">If we cancel, everything comes back, whatever the timing: weather, a mechanical problem, a guide who cannot make it, or a tour that did not reach its minimum. We check the forecast the evening before a ride and call you by 20:00.</Clause>
            <Clause title="Travel insurance">Every participant must hold valid travel insurance. If an incident is not covered by it, the cost stays with the participant.</Clause>
            <Clause title="Health and fitness">Cycling, hiking and trail running carry an inherent risk of injury that cannot be removed. We do our utmost to keep the risk acceptable, but accidents can happen, and neither rentabike.fo nor its staff can be held responsible for incidents on its trips. The activities need at least an average level of fitness and good health; it is your responsibility to be prepared and to seek medical advice where needed.</Clause>
            <Clause title="Your belongings">Personal belongings are entirely at your own risk during a trip; rentabike.fo holds no liability for their loss or damage.</Clause>
          </Section>
        </div>

        <Card className="flex flex-col gap-2 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <span className="text-[14.5px] text-ink-soft">
            {SHOP.name} · {SHOP.address}, {SHOP.town} · {SHOP.email} · {SHOP.phone}
          </span>
          <Link to="/privacy" className="text-[14.5px] font-semibold text-brand-bright hover:text-ink">
            How we handle your data ›
          </Link>
        </Card>
      </Shell>
      <Footer />
    </>
  );
}

function Section({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 px-6 py-6 md:px-7">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[24px] font-bold tracking-[-.018em]">{title}</h2>
        <p className="text-[14.5px] text-ink-soft">{lead}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function Clause({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/7 pt-4 first:border-0 first:pt-0">
      <h3 className="text-[15.5px] font-semibold">{title}</h3>
      <p className="text-[14.5px] leading-[1.55] text-ink-pale">{children}</p>
    </div>
  );
}
