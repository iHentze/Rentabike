/**
 * Prices and places: what an add-on costs, and the pickup points with their
 * fees. One row per thing, each its own form, so a single change is a
 * single save and a single audit line.
 */
import { Form } from "react-router";
import type { Route } from "./+types/prices";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { Flash, Section } from "~/components/admin";
import { cx } from "~/components/ui";
import { listAddonsAdmin, listLocationsAdmin, updateAddon, updateLocation } from "~/lib/admin/catalogue";

const FIELD = "rounded-field bg-white/10 px-[11px] py-[7px] text-[13.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";
const UNIT: Record<string, string> = { per_bike: "per bike, whole rental", per_bike_per_day: "per bike, per day", per_booking: "per booking" };

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const [addons, locations] = await Promise.all([listAddonsAdmin(env.DB), listLocationsAdmin(env.DB)]);
  return { addons, locations };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");
  const kr = (k: string) => Number.parseInt(String(form.get(k) ?? "").trim() || "NaN", 10) * 100;
  if (intent === "addon") {
    const err = await updateAddon(env.DB, id, { name: String(form.get("name") ?? ""), priceMinor: kr("price") }, staff.actor);
    return { ok: !err, message: err ?? "Saved." };
  }
  if (intent === "location") {
    const err = await updateLocation(
      env.DB,
      id,
      {
        name: String(form.get("name") ?? ""),
        address: String(form.get("address") ?? "").trim() || null,
        pickupFeeMinor: kr("pickup"),
        dropoffFeeMinor: kr("dropoff"),
        active: form.get("active") === "on",
        note: String(form.get("note") ?? "").trim() || null,
      },
      staff.actor,
    );
    return { ok: !err, message: err ?? "Saved." };
  }
  return { ok: false, message: "Unknown action." };
}

export default function Prices({ loaderData, actionData }: Route.ComponentProps) {
  const { addons, locations } = loaderData;
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">Prices &amp; places</h1>
        <p className="text-[14.5px] text-ink-soft">Bike prices live on each bike under Stock. Here: what the extras cost, and the pickup points with their fees. Whole kroner; every save is logged with your name.</p>
      </div>
      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}

      <Section title="Add-ons" count={addons.length}>
        <div className="overflow-x-auto rounded-card bg-card">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                <th className="px-4 py-3 font-semibold">Add-on</th>
                <th className="px-3 py-3 font-semibold">Charged</th>
                <th className="px-3 py-3 font-semibold">On</th>
                <th className="px-3 py-3 text-right font-semibold">Price, DKK</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {addons.map((a) => (
                <tr key={a.id} className="border-t border-white/6">
                  <td className="px-4 py-2" colSpan={5}>
                    <Form method="post" className="grid items-center gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_130px_auto]">
                      <input type="hidden" name="intent" value="addon" />
                      <input type="hidden" name="id" value={a.id} />
                      <input name="name" defaultValue={a.name} aria-label="Name" className={cx(FIELD, "w-full font-semibold")} />
                      <span className="text-[13px] text-ink-soft">
                        {UNIT[a.unit] ?? a.unit}
                        {a.isSale && " · sold, not rented"}
                      </span>
                      <span className="num text-[13px] text-ink-mute">{a.bikes} {a.bikes === 1 ? "bike" : "bikes"}</span>
                      <input name="price" type="number" min={0} defaultValue={Math.round(a.priceMinor / 100)} aria-label="Price" className={cx(FIELD, "num w-full text-right")} />
                      <button className="rounded-full bg-white/10 px-4 py-[7px] text-[13px] font-semibold hover:bg-white/16">Save</button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Pickup and return points" count={locations.length}>
        <div className="flex flex-col gap-3">
          {locations.map((l) => (
            <Form key={l.id} method="post" className={cx("grid gap-3 rounded-card bg-card p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_110px_110px_auto_auto] md:items-end", !l.active && "opacity-70")}>
              <input type="hidden" name="intent" value="location" />
              <input type="hidden" name="id" value={l.id} />
              <label className="flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                Place{l.isDefault && <span className="ml-1 normal-case tracking-normal text-brand-bright">· the shop</span>}
                <input name="name" defaultValue={l.name} className={cx(FIELD, "normal-case tracking-normal font-semibold")} />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                Address
                <input name="address" defaultValue={l.address ?? ""} className={cx(FIELD, "normal-case tracking-normal")} />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                Pickup fee
                <input name="pickup" type="number" min={0} defaultValue={Math.round(l.pickupFeeMinor / 100)} className={cx(FIELD, "num normal-case tracking-normal text-right")} />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                Return fee
                <input name="dropoff" type="number" min={0} defaultValue={Math.round(l.dropoffFeeMinor / 100)} className={cx(FIELD, "num normal-case tracking-normal text-right")} />
              </label>
              <label className="flex items-center gap-2 pb-[8px] text-[14px]">
                <input type="checkbox" name="active" defaultChecked={l.active} disabled={l.isDefault} className="size-4 accent-brand" />
                Offered
              </label>
              <button className="rounded-full bg-white/10 px-4 py-[8px] text-[13.5px] font-semibold hover:bg-white/16">Save</button>
              <label className="flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute md:col-span-6">
                What the customer is told about the handover there
                <textarea name="note" rows={2} defaultValue={l.note ?? ""} placeholder="Where exactly to meet, and when." className={cx(FIELD, "normal-case tracking-normal")} />
              </label>
            </Form>
          ))}
        </div>
      </Section>
    </div>
  );
}
