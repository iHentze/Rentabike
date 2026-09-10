/**
 * An extra, presented like a bike: photo on its plate, name, what the price
 * covers, and the button. Helmets, pedals, bags and racks have the shop's own
 * photo; the rest get a line drawing of their kind, so the grid stays one
 * grid. The same card serves a rider's own extras and the booking's.
 */
import { Form } from "react-router";
import { AddonArt, Check, Minus, Plus } from "./icons";
import { Price, cx } from "./ui";
import { imageSrc } from "~/lib/catalogue/images";

export interface CardAddon {
  id: string;
  name: string;
  priceMinor: number;
  unit: "per_bike" | "per_bike_per_day" | "per_booking";
  qty: number;
  isSale?: boolean;
  image?: string | null;
}

/** "Pedals for MTB (SPD) for rent" → "Pedals for MTB (SPD)": the shop's names carry their own small print. */
export function addonTitle(name: string): string {
  return name
    .replace(/\s+for (rent|sale)\b.*$/i, "")
    .replace(/\.\s*Max device.*$/i, "")
    .replace(/\s*compatibel med GoPro/i, "")
    .replace(/storrage/i, "storage")
    .trim();
}

export function addonKind(name: string): "helmet" | "pedal" | "bag" | "rack" | "mount" | "bottle" | "gps" | "carrier" | "storage" | "other" {
  const n = name.toLowerCase();
  if (n.includes("helmet")) return "helmet";
  if (n.includes("pedal")) return "pedal";
  if (n.includes("storrage") || n.includes("storage")) return "storage";
  if (n.includes("carrier")) return "carrier";
  if (n.includes("smartphone") || n.includes("phone")) return "mount";
  if (n.includes("gps") || n.includes("garmin")) return "gps";
  if (n.includes("bottle")) return "bottle";
  if (n.includes("rear rack") && !n.includes("bag") && !n.includes("basket")) return "rack";
  if (n.includes("bag") || n.includes("basket")) return "bag";
  return "other";
}

function coverage(a: CardAddon): string {
  if (a.isSale) return "Yours to keep";
  if (a.unit === "per_booking") return "Once for the whole booking";
  if (a.unit === "per_bike_per_day") return "Per day";
  return "For the whole rental";
}

export function AddonCard({ addon, action, intent, hidden = {}, forLabel, max = 5 }: {
  addon: CardAddon;
  action: string;
  /** "raddon" for a rider's own extra, "addon" for one that belongs to the booking. */
  intent: "raddon" | "addon";
  hidden?: Record<string, string | number>;
  /** Whose it is — "Add for Jóhanna". */
  forLabel?: string;
  max?: number;
}) {
  const on = addon.qty > 0;
  const cap = addon.unit === "per_booking" ? 1 : max;
  const hiddenInputs = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const src = imageSrc(addon.image ?? null);
  return (
    <div className={cx("overflow-hidden rounded-card bg-card", on && "shadow-[inset_0_0_0_2px_#0A78D6]")}>
      <div className="flex">
        <div className={cx("relative h-[108px] w-[130px] shrink-0 overflow-hidden", src ? "bg-white p-2" : on ? "bg-brand/18" : "bg-white/5")}>
          {src ? (
            <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-scale-down p-[inherit]" />
          ) : (
            <div className="flex size-full items-center justify-center text-brand-bright">
              <AddonArt kind={addonKind(addon.name)} className="size-[52px] opacity-85" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-[5px] px-[15px] py-[13px]">
          <span className="text-[16px] font-semibold leading-[1.22]">{addonTitle(addon.name)}</span>
          <span className="text-[13px] text-ink-mute">{coverage(addon)}</span>
          {on && (
            <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ok">
              <Check size={12} strokeWidth={3.4} /> {addon.qty > 1 ? `${addon.qty} added` : forLabel ? `Added for ${forLabel}` : "Added"}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between bg-white/4 px-[15px] py-3">
        <Price minor={addon.priceMinor} per={addon.unit === "per_bike_per_day" ? "/day" : ""} size="sm" />
        <Form method="post" action={action} preventScrollReset className="flex items-center gap-1">
          {hiddenInputs}
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="addon" value={addon.id} />
          {on ? (
            <>
              <button name="delta" value="-1" aria-label={`Remove ${addon.name}`} className="flex size-9 items-center justify-center rounded-full bg-white/8 hover:bg-white/14">
                <Minus size={14} />
              </button>
              <span className="num w-6 text-center text-[14px] font-bold">{addon.qty}</span>
              <button name="delta" value="1" aria-label={`Add another ${addon.name}`} disabled={addon.qty >= cap} className="flex size-9 items-center justify-center rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30">
                <Plus size={14} />
              </button>
            </>
          ) : (
            <button name="delta" value="1" className="rounded-full bg-white px-[18px] py-[9px] text-[14px] font-bold text-night hover:bg-ink-pale">
              {forLabel ? `Add for ${forLabel}` : "Add"}
            </button>
          )}
        </Form>
      </div>
    </div>
  );
}
