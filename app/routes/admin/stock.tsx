import { Form } from "react-router";
import type { Route } from "./+types/stock";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { stockList } from "~/lib/admin/queries";
import { setStock } from "~/lib/admin/actions";
import { Flash } from "~/components/admin";
import { cx } from "~/components/ui";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  return { rows: await stockList(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const form = await request.formData();
  const ok = await setStock(env.DB, String(form.get("bike") ?? ""), Number.parseInt(String(form.get("stock") ?? ""), 10), staff.actor);
  return { ok, message: ok ? "Stock saved." : "That number didn't save — whole numbers from 0 to 999." };
}

export default function Stock({ loaderData, actionData }: Route.ComponentProps) {
  const { rows } = loaderData;
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">Stock</h1>
        <p className="text-[14.5px] text-ink-soft">Units per size. "Out" is how many are booked or on the road today; a change is logged with your name.</p>
      </div>
      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="overflow-x-auto rounded-card bg-card">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                <th className="px-4 py-3 font-semibold">{category.replace("_", " ")}</th>
                <th className="px-3 py-3 font-semibold">Size</th>
                <th className="px-3 py-3 font-semibold">Rider</th>
                <th className="px-3 py-3 text-right font-semibold">Out today</th>
                <th className="px-3 py-3 text-right font-semibold">Units</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={cx("border-t border-white/6", !r.listed && "opacity-60")}>
                  <td className="px-4 py-2 font-semibold">
                    {r.name}
                    {!r.listed && <span className="ml-2 text-[11px] font-bold uppercase text-ink-mute">unlisted</span>}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{r.sizeLabel ?? "—"}</td>
                  <td className="num px-3 py-2 text-ink-soft">{r.riderMinCm && r.riderMaxCm ? `${r.riderMinCm}–${r.riderMaxCm} cm` : "—"}</td>
                  <td className={cx("num px-3 py-2 text-right", r.outToday > r.stock && "font-bold text-danger")}>{r.outToday}</td>
                  <td className="px-3 py-2 text-right" colSpan={2}>
                    <Form method="post" className="flex items-center justify-end gap-2">
                      <input type="hidden" name="bike" value={r.id} />
                      <input name="stock" type="number" min={0} max={999} defaultValue={r.stock} aria-label={`Units of ${r.name} ${r.sizeLabel ?? ""}`} className="num w-[72px] rounded-field bg-white/10 px-3 py-[6px] text-right text-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] focus:outline-2 focus:outline-brand-bright" />
                      <button className="rounded-full bg-white/10 px-3 py-[6px] text-[13px] font-semibold hover:bg-white/16">Save</button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
