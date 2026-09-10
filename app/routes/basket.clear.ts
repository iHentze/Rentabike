/** "Start over" on the resume bar: drop the basket cookie and stay where you were. */
import { redirect } from "react-router";
import type { Route } from "./+types/basket.clear";
import { clearBasketHeaders } from "~/lib/basket";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const back = String(form.get("back") ?? "/");
  // Only a path on this site — never an absolute URL from the form.
  const to = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  return redirect(to, { headers: await clearBasketHeaders() });
}

export function loader() {
  return redirect("/");
}
