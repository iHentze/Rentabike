/**
 * One bike type, everything staff may change about it: the name and size on
 * the card, the rider range the fit filter uses, stock, whether it is listed,
 * and the rate tiers the quote engine prices from. Tiers are saved as a set
 * and must cover every day from 1 to 365 without a gap.
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/bike";
import { cloudflareContext } from "~/context";
import { requireStaff } from "~/lib/admin/auth";
import { Flash } from "~/components/admin";
import { Card, cx } from "~/components/ui";
import { getBikeTypeAdmin, saveTiers, updateBikeType } from "~/lib/admin/catalogue";
import { CATEGORY_LABEL } from "~/lib/catalogue/bikes";
import { imageSrc } from "~/lib/catalogue/images";

const FIELD = "w-full rounded-field bg-white/10 px-[13px] py-[9px] text-[14.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";
const LABEL = "flex flex-col gap-1 text-[11.5px] uppercase tracking-[.06em] text-ink-mute";
const MAX_TIERS = 6;

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(request, env);
  const bike = await getBikeTypeAdmin(env.DB, params.id);
  if (!bike) throw new Response("Not found", { status: 404 });
  return { bike };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const staff = await requireStaff(request, env);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const num = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? null : Number.parseInt(v, 10);
  };
  if (intent === "facts") {
    const err = await updateBikeType(
      env.DB,
      params.id,
      {
        name: String(form.get("name") ?? ""),
        model: String(form.get("model") ?? "").trim() || null,
        sizeLabel: String(form.get("sizeLabel") ?? "").trim() || null,
        riderMinCm: num("riderMinCm"),
        riderMaxCm: num("riderMaxCm"),
        stock: num("stock") ?? -1,
        listed: form.get("listed") === "on",
        description: String(form.get("description") ?? "").trim() || null,
      },
      staff.actor,
    );
    return { ok: !err, message: err ?? "Saved." };
  }
  if (intent === "tiers") {
    const tiers: Array<{ minDays: number; maxDays: number; priceMinor: number; perDay: boolean }> = [];
    for (let i = 0; i < MAX_TIERS; i++) {
      const min = num(`t${i}.min`);
      const max = num(`t${i}.max`);
      const price = num(`t${i}.price`);
      if (min == null && max == null && price == null) continue;
      tiers.push({ minDays: min ?? 0, maxDays: max ?? 0, priceMinor: (price ?? -1) * 100, perDay: form.get(`t${i}.perDay`) !== "period" });
    }
    const err = await saveTiers(env.DB, params.id, tiers, staff.actor);
    return { ok: !err, message: err ?? "Prices saved." };
  }
  return { ok: false, message: "Unknown action." };
}

export default function Bike({ loaderData, actionData }: Route.ComponentProps) {
  const { bike } = loaderData;
  const rows = [...bike.tiers.map((t) => ({ ...t })), ...Array.from({ length: Math.max(0, MAX_TIERS - bike.tiers.length) }, () => null)];
  const img = imageSrc(bike.image);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/admin/stock" className="text-[14px] font-semibold text-brand-bright hover:text-ink">
          ← Stock
        </Link>
        <h1 className="font-display text-[28px] font-bold tracking-[-.02em]">{bike.name}</h1>
        <span className="rounded-full bg-white/8 px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-ink-soft">{CATEGORY_LABEL[bike.category]}</span>
        {!bike.listed && <span className="rounded-full bg-warn/16 px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-warn">unlisted</span>}
        <Link to={`/bikes/${bike.slug}`} className="text-[13.5px] text-ink-mute hover:text-ink">
          See it on the site ›
        </Link>
      </div>
      {actionData && <Flash ok={actionData.ok}>{actionData.message}</Flash>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-5">
          <Form method="post">
            <Card className="flex flex-col gap-4 p-5">
              <input type="hidden" name="intent" value="facts" />
              <h2 className="text-[16px] font-semibold">The bike</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={cx(LABEL, "sm:col-span-2")}>
                  Name on the card
                  <input name="name" required defaultValue={bike.name} className={cx(FIELD, "normal-case tracking-normal")} />
                </label>
                <label className={LABEL}>
                  Model
                  <input name="model" defaultValue={bike.model ?? ""} placeholder="Felt Doctrine" className={cx(FIELD, "normal-case tracking-normal")} />
                </label>
                <label className={LABEL}>
                  Size label
                  <input name="sizeLabel" defaultValue={bike.sizeLabel ?? ""} placeholder='17″ or 54' className={cx(FIELD, "normal-case tracking-normal")} />
                </label>
                <label className={LABEL}>
                  Rider from, cm
                  <input name="riderMinCm" type="number" min={80} max={230} defaultValue={bike.riderMinCm ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
                </label>
                <label className={LABEL}>
                  Rider to, cm
                  <input name="riderMaxCm" type="number" min={80} max={230} defaultValue={bike.riderMaxCm ?? ""} className={cx(FIELD, "num normal-case tracking-normal")} />
                </label>
                <label className={LABEL}>
                  Units in the fleet
                  <input name="stock" type="number" min={0} max={999} defaultValue={bike.stock} className={cx(FIELD, "num normal-case tracking-normal")} />
                </label>
                <label className="flex items-center gap-2 self-end pb-[9px] text-[14.5px]">
                  <input type="checkbox" name="listed" defaultChecked={bike.listed} className="size-4 accent-brand" />
                  Listed on the site
                </label>
                <label className={cx(LABEL, "sm:col-span-2")}>
                  Description
                  <textarea name="description" rows={4} defaultValue={bike.description ?? ""} className={cx(FIELD, "normal-case tracking-normal")} />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-mute">The rider range is what "frames that fit" means on the riders step. Leave both blank if the frame fits anyone.</span>
                <button className="shrink-0 rounded-full bg-white px-5 py-[9px] text-[14px] font-bold text-night hover:bg-ink-pale">Save</button>
              </div>
            </Card>
          </Form>

          <Form method="post">
            <Card className="flex flex-col gap-4 p-5">
              <input type="hidden" name="intent" value="tiers" />
              <div className="flex flex-col gap-1">
                <h2 className="text-[16px] font-semibold">Prices by length of rental</h2>
                <p className="text-[13.5px] text-ink-soft">Whole kroner. The tiers must run from day 1 to day 365 without a gap: a rental of 8 days is priced at the tier that contains day 8, on every day. Empty rows are ignored.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[14px]">
                  <thead>
                    <tr className="text-left text-[11.5px] uppercase tracking-[.06em] text-ink-mute">
                      <th className="px-2 py-2 font-semibold">From day</th>
                      <th className="px-2 py-2 font-semibold">To day</th>
                      <th className="px-2 py-2 font-semibold">Price, DKK</th>
                      <th className="px-2 py-2 font-semibold">Charged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t, i) => (
                      <tr key={i} className="border-t border-white/6">
                        <td className="px-2 py-2">
                          <input name={`t${i}.min`} type="number" min={1} max={365} defaultValue={t?.minDays ?? ""} className={cx(FIELD, "num w-[96px]")} />
                        </td>
                        <td className="px-2 py-2">
                          <input name={`t${i}.max`} type="number" min={1} max={365} defaultValue={t?.maxDays ?? ""} className={cx(FIELD, "num w-[96px]")} />
                        </td>
                        <td className="px-2 py-2">
                          <input name={`t${i}.price`} type="number" min={0} defaultValue={t ? Math.round(t.priceMinor / 100) : ""} className={cx(FIELD, "num w-[120px]")} />
                        </td>
                        <td className="px-2 py-2">
                          <select name={`t${i}.perDay`} defaultValue={t ? (t.perDay ? "day" : "period") : "day"} className={cx(FIELD, "w-[150px]")}>
                            <option value="day">per day</option>
                            <option value="period">for the period</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button className="rounded-full bg-white px-5 py-[9px] text-[14px] font-bold text-night hover:bg-ink-pale">Save prices</button>
              </div>
            </Card>
          </Form>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden">
            <div className="h-[180px] bg-white p-3">{img ? <img src={img} alt="" className="size-full object-scale-down" /> : <div className="flex size-full items-center justify-center text-[13px] text-ink-dim">No photo</div>}</div>
            <div className="flex flex-col gap-1 px-4 py-3 text-[13px] text-ink-mute">
              <span>Photos come from the shop's product listing and change there.</span>
            </div>
          </Card>
          <Card className="flex flex-col gap-3 p-4 text-[14px]">
            <div className="flex flex-col gap-1">
              <span className="lbl">Add-ons this bike can take</span>
              <span className="text-ink-soft">{bike.addons.length ? bike.addons.map((a) => a.name).join(", ") : "None"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="lbl">Tours it is allowed on</span>
              <span className="text-ink-soft">{bike.tours.length ? bike.tours.map((t) => t.title).join(", ") : "None"}</span>
            </div>
            <span className="text-[12.5px] text-ink-dim">Both lists are set per tour and per add-on; ask for that screen if they change often.</span>
          </Card>
        </div>
      </div>
    </div>
  );
}
