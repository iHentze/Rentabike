/**
 * The counter. Everything under /admin renders inside this frame, and every
 * loader below it asks requireStaff first — the frame's own check is the
 * first line, not the only one.
 */
import { Form, Link, NavLink, Outlet, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/layout";
import { cloudflareContext } from "~/context";
import { Plaque, SHOP } from "~/components/site";
import { cx } from "~/components/ui";
import { adminEnabled, currentStaff } from "~/lib/admin/auth";

export function meta() {
  return [{ title: "Counter — Rent a Bike & Outdoor" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (!adminEnabled(env)) throw data({ closed: true }, { status: 503 });
  const staff = await currentStaff(request, env);
  return { staff, epay: Boolean(env.EPAY_API_KEY && env.EPAY_POS_ID), email: Boolean(env.EMAIL) };
}

const NAV = [
  { to: "/admin", label: "Today", end: true },
  { to: "/admin/bookings", label: "Bookings" },
  { to: "/admin/tours", label: "Tours" },
  { to: "/admin/stock", label: "Stock" },
  { to: "/admin/new", label: "+ New booking" },
];

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { staff, epay, email } = loaderData;
  return (
    <div className="min-h-full">
      <header className="border-b border-white/8 bg-night">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Plaque size={26} />
            <span className="text-[13px] font-bold uppercase tracking-[.08em] text-ink-mute">Counter</span>
          </div>
          {staff && (
            <nav className="flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("rounded-full px-4 py-[7px] text-[14.5px] font-semibold", isActive ? "bg-white text-night" : "text-ink-soft hover:bg-white/8 hover:text-ink")}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4 text-[13px] text-ink-mute">
            <span className="hidden sm:inline">{epay ? "ePay on" : "Pay at the counter only"} · {email ? "email on" : "email off"}</span>
            {staff && (
              <>
                <span className="font-semibold text-ink-soft">{staff.actor}</span>
                {staff.via === "password" && (
                  <Form method="post" action="/admin/logout">
                    <button className="text-[13px] font-semibold text-brand-bright hover:text-ink">Log out</button>
                  </Form>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const closed = isRouteErrorResponse(error) && error.status === 503;
  return (
    <div className="mx-auto max-w-[560px] px-6 py-24">
      <Plaque size={30} />
      <h1 className="mt-8 font-display text-[30px] font-bold tracking-[-.02em]">{closed ? "The counter is not switched on" : "Something went wrong"}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.55] text-ink-soft">
        {closed
          ? "Set ADMIN_PASSWORD as a secret on the Worker, or put /admin behind Cloudflare Access and set ACCESS_TEAM_DOMAIN and ACCESS_AUD. Until then nobody can log in here."
          : isRouteErrorResponse(error)
            ? `${error.status} ${error.statusText}`
            : error instanceof Error
              ? error.message
              : "Unknown error"}
      </p>
      <p className="mt-6 text-[14px] text-ink-mute">
        <Link to="/" className="font-semibold text-brand-bright hover:text-ink">
          Back to the site
        </Link>{" "}
        · {SHOP.phone}
      </p>
    </div>
  );
}
