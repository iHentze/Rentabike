import { redirect } from "react-router";
import { logoutCookie } from "~/lib/admin/auth";

export async function action() {
  throw redirect("/admin/login", { headers: { "Set-Cookie": logoutCookie() } });
}

export function loader() {
  throw redirect("/admin");
}
