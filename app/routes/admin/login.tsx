import { Form, data, redirect } from "react-router";
import type { Route } from "./+types/login";
import { cloudflareContext } from "~/context";
import { Card, Lbl } from "~/components/ui";
import { adminEnabled, currentStaff, login } from "~/lib/admin/auth";

const FIELD = "rounded-field bg-white/10 px-[15px] py-[12px] text-[15.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";

function safeNext(v: string | null): string {
  return v && v.startsWith("/admin") && !v.startsWith("//") ? v : "/admin";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (!adminEnabled(env)) throw data({ closed: true }, { status: 503 });
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (await currentStaff(request, env)) throw redirect(next);
  return { next, password: Boolean(env.ADMIN_PASSWORD) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const next = safeNext(String(form.get("next") ?? ""));
  const cookie = await login(env, String(form.get("password") ?? ""), String(form.get("name") ?? ""));
  if (!cookie) return { error: "That's not the password." };
  throw redirect(next, { headers: { "Set-Cookie": cookie } });
}

export default function AdminLogin({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-[420px] pt-10">
      <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">Staff login</h1>
      <p className="mt-2 text-[14.5px] text-ink-soft">{loaderData.password ? "The shop password, and your name for the log." : "Log in through Cloudflare Access to continue."}</p>
      {loaderData.password && (
        <Card className="mt-6 p-[22px]">
          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="next" value={loaderData.next} />
            <label className="flex flex-col gap-[7px]">
              <Lbl>Your name</Lbl>
              <input name="name" required maxLength={40} autoComplete="name" placeholder="Berit" className={FIELD} />
            </label>
            <label className="flex flex-col gap-[7px]">
              <Lbl>Password</Lbl>
              <input name="password" type="password" required autoComplete="current-password" className={FIELD} />
            </label>
            {actionData?.error && <span className="text-[14px] text-danger">{actionData.error}</span>}
            <button className="rounded-full bg-white px-6 py-[12px] text-[15px] font-bold text-night hover:bg-ink-pale">Log in</button>
          </Form>
        </Card>
      )}
    </div>
  );
}
