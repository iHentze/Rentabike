/**
 * The way back into an unfinished booking. The basket lives in a cookie and
 * the trip in the URL, so a customer who wanders off to the tours page, the
 * home page, or comes back tomorrow, had no thread to pull. This bar sits at
 * the foot of every page outside the funnel while there is something in the
 * basket: what they have so far, and one button to the step they were on.
 * Inside the funnel the strip along the top already does this job.
 */
import { Form, Link, useLocation } from "react-router";
import { Chevron } from "./icons";
import { cx } from "./ui";
import type { BasketPeek } from "~/lib/basket";
import { fmtRange, plural } from "~/lib/format";

/** Pages that carry their own progress strip or must not be interrupted. */
const QUIET = ["/riders", "/checkout", "/pay/", "/booked/", "/admin", "/bikes", "/choose"];

export function ResumeBar({ resume, when }: { resume: BasketPeek; when: { startAt: number; endAt: number } | null }) {
  const { pathname } = useLocation();
  if (QUIET.some((p) => pathname.startsWith(p))) return null;

  const progress = resume.ownBike
    ? "Own bike — helmets and extras chosen"
    : resume.withBike === 0
      ? `${plural(resume.riders, "rider")} · no bikes chosen yet`
      : resume.ridersReady === resume.riders
        ? `${plural(resume.riders, "bike")} chosen`
        : resume.withBike < resume.riders
          ? `${resume.withBike} of ${resume.riders} bikes picked`
          : `${resume.riders - resume.ridersReady} of ${resume.riders} riders still need a name and height`;
  const cta = resume.ownBike || resume.href.startsWith("/checkout") ? "Continue to checkout" : "Continue booking";

  return (
    <>
      {/* room under the page so the footer is never hidden behind the bar */}
      <div aria-hidden className="h-[96px] sm:h-[84px]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-5 sm:pb-4">
        <div className="pointer-events-auto mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-[rgba(11,20,28,.94)] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.45),inset_0_0_0_1px_rgba(255,255,255,.08)] backdrop-blur-[6px] sm:px-5">
          <span className="flex size-[10px] shrink-0 rounded-full bg-brand-bright shadow-[0_0_0_4px_rgba(79,166,232,.18)]" />
          <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
            <span className="text-[14.5px] font-semibold">You have a booking on the go</span>
            <span className="num truncate text-[13px] text-ink-soft">
              {when ? `${fmtRange(when.startAt, when.endAt)} · ` : ""}
              {progress}
            </span>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <Form method="post" action="/basket/clear" preventScrollReset>
              <input type="hidden" name="back" value={pathname} />
              <button className="text-[13.5px] font-semibold text-ink-mute hover:text-ink">Start over</button>
            </Form>
            <Link to={resume.href} className={cx("inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-[11px] text-[14.5px] font-bold text-night hover:bg-ink-pale")}>
              {cta}
              <Chevron size={15} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
