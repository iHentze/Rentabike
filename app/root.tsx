import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { Footer, Header } from "./components/site";
import { ResumeBar } from "./components/resume-bar";
import { peekBasket } from "./lib/basket";
import { readTrip } from "./lib/trip";

/** Every page: is there a booking in progress to come back to? Reads the basket cookie, nothing else. */
export async function loader({ request }: Route.LoaderArgs) {
  const resume = await peekBasket(request);
  const params = resume ? new URLSearchParams(resume.trip) : null;
  const trip = params && !params.has("tour") ? readTrip(params) : null;
  return { resume, when: trip ? { startAt: trip.startAt.getTime(), endAt: trip.endAt.getTime() } : null };
}

// Fonts are self-hosted static assets (see plan, revision 4). No third-party
// request in the render path — the Porsche CDN outage is the lesson here.
export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preload", href: "/fonts/familjen-grotesk-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/public-sans-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-full bg-ground text-ink antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Outlet />
      {loaderData.resume && <ResumeBar resume={loaderData.resume} when={loaderData.when} />}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "Please try again, or call us on +298 270 600.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    details = error.status === 404 ? "That page doesn't exist." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[50vh] max-w-2xl px-6 py-24">
        <h1 className="font-display text-3xl font-bold">{message}</h1>
        <p className="mt-3 text-ink-soft">{details}</p>
        <a href="/" className="mt-6 inline-block text-[15px] font-semibold text-brand-bright hover:text-ink">
          Back to the start ›
        </a>
      </main>
      <Footer />
    </>
  );
}
