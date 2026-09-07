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

// Fonts are self-hosted static assets (see plan, revision 4). No third-party
// request in the render path — the Porsche CDN outage is the lesson here.
export const links: Route.LinksFunction = () => [
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

export default function App() {
  return <Outlet />;
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
