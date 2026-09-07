import { Form, Link } from "react-router";
import type { CatalogueBike } from "~/lib/catalogue/bikes";
import { CATEGORY_LABEL } from "~/lib/catalogue/bikes";
import { BikeArt, Minus, Plus } from "./icons";
import { Price, Tag, cx } from "./ui";

/** "5 available", "Only 1 left", "All out on your dates" — green, amber, red. */
export function Availability({ free, className }: { free: number; className?: string }) {
  if (free <= 0) return <span className={cx("text-[13px] font-semibold text-danger", className)}>All out on your dates</span>;
  if (free === 1) return <span className={cx("text-[13px] font-semibold text-warn", className)}>Only 1 left</span>;
  return <span className={cx("text-[13px] font-semibold text-ok", className)}>{free} available</span>;
}

export function riderRange(b: Pick<CatalogueBike, "sizeLabel" | "riderMinCm" | "riderMaxCm">): string {
  const parts: string[] = [];
  if (b.sizeLabel) parts.push(`Frame ${b.sizeLabel}`);
  if (b.riderMinCm != null && b.riderMaxCm != null) parts.push(`rider ${b.riderMinCm}–${b.riderMaxCm} cm`);
  return parts.join(" · ");
}

export function BikeImage({ bike, className }: { bike: Pick<CatalogueBike, "image" | "name" | "category">; className?: string }) {
  return bike.image ? (
    <img src={bike.image} alt="" loading="lazy" className={cx("size-full object-cover", className)} />
  ) : (
    <div className={cx("flex size-full items-center justify-center bg-white/5 text-brand-bright", className)}>
      <BikeArt motor={bike.category === "ebike"} className="h-[70%] opacity-85" />
    </div>
  );
}

/**
 * A product card on the catalogue: photo, category, name, fit, availability,
 * price per day for these dates, and Add — or the stepper once it is in.
 */
export function BikeCard({ bike, inBasket, href, disabled }: { bike: CatalogueBike; inBasket: number; href: string; disabled?: boolean }) {
  const isExtra = bike.category === "extra";
  return (
    <div className={cx("flex flex-col overflow-hidden rounded-card bg-card", inBasket > 0 && "shadow-[inset_0_0_0_2px_#0A78D6]", bike.free <= 0 && "opacity-70")}>
      <Link to={href} className="relative block h-[140px] bg-white/5">
        <BikeImage bike={bike} />
        <Tag tone="dark" className="absolute left-3 top-3">
          {CATEGORY_LABEL[bike.category]}
        </Tag>
        {inBasket > 0 && (
          <Tag className="absolute right-3 top-3">{isExtra ? `${inBasket} in basket` : inBasket === 1 ? "In basket" : `${inBasket} riders`}</Tag>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-[11px] px-4 pb-4 pt-[15px]">
        <h3 className="font-sans text-[17px] font-semibold leading-snug">
          <Link to={href} className="hover:text-brand-bright">
            {bike.name}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {riderRange(bike) && <span className="text-[13px] text-ink-mute">{riderRange(bike)}</span>}
          <Availability free={bike.free} />
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-white/6 pt-[11px]">
          <Price minor={bike.rateMinor} per={bike.perDay ? "/day" : "for the period"} />
          {bike.free <= 0 ? (
            <span className="text-[13px] text-ink-dim">Unavailable</span>
          ) : inBasket > 0 ? (
            <Form method="post" className="flex items-center gap-[11px] rounded-full bg-white/8 px-3 py-[6px]">
              <input type="hidden" name="bike" value={bike.id} />
              <button name="intent" value="remove" aria-label={`Remove one ${bike.name}`} className="rounded-full p-1 hover:bg-white/10">
                <Minus size={13} />
              </button>
              <span className="num text-[14px] font-bold">{inBasket}</span>
              <button name="intent" value="add" aria-label={`Add another ${bike.name}`} disabled={inBasket >= bike.free || disabled} className="rounded-full p-1 hover:bg-white/10 disabled:opacity-30">
                <Plus size={13} />
              </button>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="bike" value={bike.id} />
              <button name="intent" value="add" disabled={disabled} className="rounded-full bg-white px-[18px] py-2 text-[14px] font-bold text-night hover:bg-ink-pale disabled:cursor-not-allowed disabled:bg-white/7 disabled:text-ink-dim">
                Add
              </button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
