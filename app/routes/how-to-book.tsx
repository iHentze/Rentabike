/**
 * The booking guide — for the customer who lands on the home page and is
 * not sure what happens after they press the white button. Every step here
 * describes the funnel as it really is (dates, then a bike and extras for
 * each rider, then checkout), in the order the customer meets it, with a
 * link into the step it describes. Linked from the hero and the menu.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/how-to-book";
import { Footer, Header, SHOP, Shell } from "~/components/site";
import { Card, Lbl, PillLink, cx } from "~/components/ui";
import { Calendar, CardIcon, Check, Child, Clock, Mountain, Phone, Pin, Shield } from "~/components/icons";
import { MAX_RIDERS } from "~/lib/trip";
import { FREE_CANCELLATION_HOURS } from "~/lib/booking/cancellation";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "How to book — Rent a Bike & Outdoor, Tórshavn" },
    { name: "description", content: "Four steps from the home page to a bike in your hands: dates and pickup, a bike for each rider, checkout, and collecting at the shop on Sverrisgøta." },
  ];
}

const STEPS: Array<{ title: string; lead: string; icon: ReactNode; href: string; cta: string; points: ReactNode[] }> = [
  {
    title: "Pick your dates, where to collect, and how many of you",
    lead: "The box at the top of the home page. Nothing is booked yet — it only decides what we show you.",
    icon: <Calendar size={22} />,
    href: "/",
    cta: "Open the dates box",
    points: [
      <>
        <b>Pick up</b> is the shop at {SHOP.address} unless you choose otherwise. We can also bring the bikes to Leynar, Oyrabakka, Leirvík, Klaksvík or Norðdepil for a fee — the fee is written next to the place in the menu.
      </>,
      <>
        <b>Return to</b> can be a different place from where you collected. That carries a fee too, and the box says so before you go on.
      </>,
      <>
        <b>From and To</b> are the day and time you collect and the day and time you bring the bikes back. The price is per day.
      </>,
      <>
        <b>Riders</b> is everyone who needs a bike, up to {MAX_RIDERS}. Children in a seat or trailer don't count — they are extras on the grown-up's bike.
      </>,
      <>
        The green line under the box tells you how many bikes are free on those dates. Press <b>Choose your bikes</b> when it looks right.
      </>,
    ],
  },
  {
    title: "A bike, and extras, for each rider",
    lead: "One rider at a time. The strip along the top shows who is done and who is next, and every finished step is a link back to it.",
    icon: <Mountain size={22} />,
    href: "/riders",
    cta: "Go to the riders",
    points: [
      <>
        Tell us the rider's <b>height</b> (a name is optional). We then only show the frames that fit them.
      </>,
      <>
        Choose a <b>bike</b> — road, gravel, mountain or electric. Every card shows the price per day and whether it is free on your dates.
      </>,
      <>
        Then the <b>extras</b> for that rider: a helmet, bags for the rack, clip-in pedals, a child seat or trailer. Skip anything you don't need.
      </>,
      <>
        The next rider follows automatically. Press <b>+ Add a rider</b> in the strip if someone joins late, or change any earlier choice by tapping it.
      </>,
      <>
        The panel on the side keeps a running total. Prices are worked out on our server, so what you see there is what you pay.
      </>,
    ],
  },
  {
    title: "Checkout: who's booking, and how you'd like to pay",
    lead: "Your name, email and phone, so we can reach you, and then one choice about money.",
    icon: <CardIcon size={22} />,
    href: "/",
    cta: "Start a booking",
    points: [
      <>
        <b>Pay when you collect</b> — card or cash at the shop. We still hold the bikes for you the moment you book, so nobody else can take them.
      </>,
      <>
        <b>Pay now by card</b> — Visa, Mastercard or Dankort through ePay. You are sent to the card page and back again; the booking is confirmed once the payment lands.
      </>,
      <>
        Either way, cancellation is free until {FREE_CANCELLATION_HOURS} hours before you collect. After that the booking is charged in full, because we have turned other people away. If the weather cancels a guided ride, everything comes back.
      </>,
      <>
        A note box is there for anything we should know — arriving by ferry, a child's age, a bike you'd rather have set up before you arrive.
      </>,
    ],
  },
  {
    title: "After you book",
    lead: "A six-letter booking code by email, and the bikes waiting for you on the day.",
    icon: <Pin size={22} />,
    href: "/booking",
    cta: "Find my booking",
    points: [
      <>
        Your confirmation email carries the <b>code</b>, the times, and a calendar file. With the code and your email you can look the booking up any time under <b>My booking</b>, and cancel it there if plans change.
      </>,
      <>
        On the day, bring the code and something with your name on it to {SHOP.address}. Allow <b>ten minutes</b> for fitting — saddle height, pedals, a quick run through the gears or the motor.
      </>,
      <>
        Bring the bikes back by the time on your booking. Someone is at the shop {SHOP.hours} every day; if you are running late, call — it's fine.
      </>,
    ],
  },
];

export default function HowToBook() {
  return (
    <>
      <Header />

      {/* the page head — a short hero in the same voice as the tours page */}
      <section className="relative h-[300px] overflow-hidden">
        <img src="/images/tour-ebike-torshavn.jpg" alt="Two riders on electric bikes on the harbour road in Tórshavn" className="absolute inset-0 size-full object-cover" style={{ objectPosition: "50% 30%" }} />
        <div className="absolute inset-x-0 bottom-0 h-[82%] bg-[linear-gradient(180deg,rgba(7,14,21,0)_0%,rgba(7,14,21,.5)_34%,rgba(7,14,21,.94)_80%,#070E15_100%)]" />
        <Shell className="relative flex h-full flex-col justify-end gap-3 px-5 pb-7 md:px-8">
          <Lbl className="text-ink-pale">The booking guide</Lbl>
          <h1 className="max-w-[720px] font-display text-[38px] font-bold leading-[1] tracking-[-.03em] [text-shadow:0_2px_26px_rgba(7,14,21,.5)] md:text-[50px]">Four steps from here to a bike in your hands</h1>
          <p className="max-w-[580px] text-[17px] leading-[1.5] text-white/88">Dates, then a bike for each of you, then a name and how you'd like to pay. Ten minutes on the site, ten at the shop, and you're off.</p>
        </Shell>
      </section>

      <Shell className="flex flex-col gap-[14px] px-5 pb-11 pt-7 md:px-8">
        {/* the four steps, in the order the customer meets them */}
        <ol className="flex flex-col gap-[14px]">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="flex flex-col gap-5 px-5 py-[22px] md:flex-row md:gap-7 md:px-7 md:py-[26px]">
                <div className="flex shrink-0 items-start gap-4 md:w-[280px] md:flex-col md:gap-[14px]">
                  <div className="relative flex size-[54px] shrink-0 items-center justify-center rounded-full bg-brand/22 text-brand-bright">
                    {s.icon}
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">{i + 1}</span>
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <h2 className="font-display text-[22px] font-bold leading-[1.15] tracking-[-.018em]">{s.title}</h2>
                    <p className="text-[14.5px] leading-[1.5] text-ink-soft">{s.lead}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4">
                  <ul className="flex flex-col gap-[10px]">
                    {s.points.map((p, j) => (
                      <li key={j} className="flex gap-3 text-[15px] leading-[1.5] text-ink-pale [&_b]:font-semibold [&_b]:text-ink">
                        <Check size={16} strokeWidth={2.6} className="mt-[5px] shrink-0 text-ok" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <PillLink to={s.href} tone="ghost" size="sm" className="self-start">
                    {s.cta} ›
                  </PillLink>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        {/* the two things people ask at the counter */}
        <div className="grid gap-[14px] md:grid-cols-2">
          <Card className="flex gap-4 px-5 py-[20px]">
            <div className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-ok/16 text-ok">
              <Shield size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[15.5px] font-semibold">Booking a guided ride instead?</span>
              <span className="text-[14px] leading-[1.5] text-ink-soft">
                Pick the ride under <Link to="/tours" className="font-semibold text-brand-bright hover:text-ink">Guided tours</Link>, choose the departure and how many of you, and the same checkout follows. The bike, helmet and guide are included; you only add your heights.
              </span>
            </div>
          </Card>
          <Card className="flex gap-4 px-5 py-[20px]">
            <div className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-white/7 text-brand-bright">
              <Child size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[15.5px] font-semibold">Bringing children?</span>
              <span className="text-[14px] leading-[1.5] text-ink-soft">
                A child who rides their own bike is a rider — add them and give their height. A child in a seat, a trailer or on a tag-along is an extra on the adult's bike, chosen in that rider's extras step.
              </span>
            </div>
          </Card>
        </div>

        {/* when the guide isn't enough: a person */}
        <Card className="flex flex-col items-start gap-5 px-6 py-6 md:flex-row md:items-center md:gap-7 md:px-7">
          <div className="flex flex-1 flex-col gap-2">
            <Lbl>Still not sure?</Lbl>
            <h2 className="font-display text-[24px] font-bold tracking-[-.018em]">We'll book it with you</h2>
            <p className="max-w-[60ch] text-[15px] leading-[1.5] text-ink-soft">
              Call, write, or come by the shop and we'll put the booking together over the counter. Same bikes, same prices, and we'll tell you honestly which bike suits the ride you have in mind.
            </p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-[14.5px] text-ink-soft">
              <span className="inline-flex items-center gap-2"><Clock size={16} className="text-brand-bright" /> Open {SHOP.hours} daily</span>
              <span className="inline-flex items-center gap-2"><Pin size={16} className="text-brand-bright" /> {SHOP.address}, {SHOP.town}</span>
              <a href={`mailto:${SHOP.email}`} className="inline-flex items-center gap-2 hover:text-ink">{SHOP.email}</a>
            </div>
          </div>
          <div className={cx("flex w-full flex-col gap-[10px] sm:flex-row md:w-auto")}>
            <a href={SHOP.phoneHref} className="inline-flex items-center justify-center gap-[10px] rounded-full bg-white/12 px-6 py-[13px] text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] hover:bg-white/16">
              <Phone size={16} />
              <span className="num">Call {SHOP.phone}</span>
            </a>
            <PillLink to="/" tone="primary" size="md">
              Start booking
            </PillLink>
          </div>
        </Card>
      </Shell>

      <Footer />
    </>
  );
}
