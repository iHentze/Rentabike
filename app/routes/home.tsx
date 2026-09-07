import type { Route } from "./+types/home";
import { cloudflareContext } from "~/context";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Rent a Bike & Outdoor — Tórshavn" },
    { name: "description", content: "Bike rental and guided tours in the Faroe Islands. Sverrisgøta 20, Tórshavn." },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  // Proof the server path is wired: the env reaches the loader, not the browser.
  const { env } = context.get(cloudflareContext);
  return { env: env.APP_ENV };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">Rent a Bike &amp; Outdoor</h1>
      <p className="mt-3 text-ink-soft">Skeleton is up. Environment: {loaderData.env}</p>
    </main>
  );
}
