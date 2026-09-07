/**
 * "Anything else?" — helmets first, then the rest of the allowlist, each with
 * a stepper. The same panel on the catalogue, the riders page and checkout,
 * because the upsell has to be wherever the customer is when they decide.
 */
import { Form } from "react-router";
import { Minus, Plus } from "./icons";
import { cx } from "./ui";
import { formatDKKCode } from "~/lib/money";

export const HELMET_ID = "addon-helmet-for-rent";

export interface PanelAddon {
  id: string;
  name: string;
  priceMinor: number;
  unit: "per_bike" | "per_bike_per_day" | "per_booking";
  qty: number;
  isSale?: boolean;
}

export function unitLabel(unit: PanelAddon["unit"]): string {
  return unit === "per_booking" ? "per booking" : unit === "per_bike_per_day" ? "per bike per day" : "each";
}

export function AddonsPanel({ addons, action, riders, heading, helmetsIncluded, hidden = {} }: {
  addons: PanelAddon[];
  action: string;
  /** Number of riders — drives the "a helmet for everyone" shortcut. */
  riders: number;
  heading?: string;
  helmetsIncluded?: boolean;
  /** Extra hidden fields every form in the panel carries (e.g. the current rider). */
  hidden?: Record<string, string | number>;
}) {
  const helmet = addons.find((a) => a.id === HELMET_ID);
  const rest = addons.filter((a) => a.id !== HELMET_ID);
  const hiddenInputs = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[19px] font-semibold tracking-[-.012em]">{heading ?? (riders > 1 ? `Anything else for the ${riders} of you?` : "Anything else?")}</h2>
        {helmetsIncluded ? (
          <span className="text-[13.5px] font-semibold text-ok">Helmets included</span>
        ) : helmet ? (
          <span className="num text-[13.5px] font-semibold text-ok">Helmet {formatDKKCode(helmet.priceMinor)} per bike</span>
        ) : null}
      </div>

      {/* the helmet, prominently — the one upsell that matters */}
      {helmet && !helmetsIncluded && (
        <div className={cx("flex flex-col gap-3 rounded-field px-[18px] py-4 sm:flex-row sm:items-center", helmet.qty > 0 ? "bg-ok/12 shadow-[inset_0_0_0_1.5px_rgba(46,212,122,.6)]" : "bg-warn/10 shadow-[inset_0_0_0_1.5px_rgba(255,176,32,.35)]")}>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="text-[15.5px] font-semibold">{helmet.qty > 0 ? `${helmet.qty} ${helmet.qty === 1 ? "helmet" : "helmets"} added` : "Helmets are not included with rentals"}</span>
            <span className="num text-[13.5px] text-ink-soft">
              {formatDKKCode(helmet.priceMinor)} each for the whole rental. {helmet.qty === 0 ? `Ride safe — add one for ${riders === 1 ? "yourself" : "everyone"}.` : "Fitted at the shop when you collect."}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {helmet.qty < riders && (
              <Form method="post" action={action}>
                {hiddenInputs}
                <input type="hidden" name="intent" value="addon" />
                <input type="hidden" name="addon" value={helmet.id} />
                <button name="delta" value={riders - helmet.qty} className="rounded-full bg-white px-[18px] py-[9px] text-[14px] font-bold text-night hover:bg-ink-pale">
                  {helmet.qty === 0 ? (riders === 1 ? "Add a helmet" : `Add ${riders} helmets`) : "One for everyone"}
                </button>
              </Form>
            )}
            <Stepper addon={helmet} action={action} hidden={hidden} />
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <div key={a.id} className={cx("flex items-center gap-3 rounded-field px-[15px] py-[14px]", a.qty > 0 ? "bg-brand/18 shadow-[inset_0_0_0_1.5px_#0A78D6]" : "bg-white/5")}>
              <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                <span className="truncate text-[14.5px] font-semibold">{a.name}</span>
                <span className={cx("num text-[12.5px]", a.qty > 0 ? "font-semibold text-brand-bright" : "text-ink-mute")}>
                  {formatDKKCode(a.priceMinor)} {unitLabel(a.unit)}
                  {a.isSale && " · yours to keep"}
                  {a.qty > 0 && ` · ${a.qty} added`}
                </span>
              </div>
              <Stepper addon={a} action={action} hidden={hidden} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stepper({ addon, action, hidden }: { addon: PanelAddon; action: string; hidden: Record<string, string | number> }) {
  return (
    <Form method="post" action={action} className="flex shrink-0 items-center gap-1">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="intent" value="addon" />
      <input type="hidden" name="addon" value={addon.id} />
      <button name="delta" value="-1" aria-label={`Remove ${addon.name}`} disabled={addon.qty === 0} className="flex size-8 items-center justify-center rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30">
        <Minus size={13} />
      </button>
      {addon.qty > 0 && <span className="num w-5 text-center text-[14px] font-bold">{addon.qty}</span>}
      <button name="delta" value="1" aria-label={`Add ${addon.name}`} disabled={addon.unit === "per_booking" && addon.qty > 0} className="flex size-8 items-center justify-center rounded-full bg-white/8 hover:bg-white/14 disabled:opacity-30">
        <Plus size={13} />
      </button>
    </Form>
  );
}
