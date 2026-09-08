/**
 * The kit. Every customer screen is built from these few pieces so the rules
 * from the canvas hold everywhere: cards are #131C25 at 20px with no border,
 * actions are pills (one white primary per screen), labels are small muted
 * caps, numbers are tabular in the display face.
 */
import { Link } from "react-router";
import type { ComponentProps, ReactNode } from "react";
import { formatDKKCode } from "~/lib/money";

export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(" ");
}

// --- pills -----------------------------------------------------------------

export type PillTone = "primary" | "ghost" | "brand" | "disabled";
export type PillSize = "sm" | "md" | "lg";

const TONE: Record<PillTone, string> = {
  primary: "bg-white text-night font-bold hover:bg-ink-pale",
  ghost: "bg-white/12 text-ink font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] hover:bg-white/16",
  brand: "bg-brand text-ink font-bold hover:bg-brand-bright",
  disabled: "bg-white/7 text-ink-dim font-bold cursor-not-allowed",
};
const SIZE: Record<PillSize, string> = {
  sm: "px-[18px] py-[8px] text-[14px]",
  md: "px-6 py-[13px] text-[15px]",
  lg: "px-7 py-4 text-[16px]",
};

function pillClass(tone: PillTone, size: PillSize, className?: string, block?: boolean) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright",
    TONE[tone],
    SIZE[size],
    block && "w-full",
    className,
  );
}

type PillBase = { tone?: PillTone; size?: PillSize; block?: boolean; className?: string; children: ReactNode };

export function PillLink({ tone = "ghost", size = "md", block, className, children, ...rest }: PillBase & ComponentProps<typeof Link>) {
  return (
    <Link className={pillClass(tone, size, className, block)} {...rest}>
      {children}
    </Link>
  );
}

export function PillButton({ tone = "ghost", size = "md", block, className, children, ...rest }: PillBase & ComponentProps<"button">) {
  const disabled = rest.disabled || tone === "disabled";
  return (
    <button type={rest.type ?? "button"} className={pillClass(disabled ? "disabled" : tone, size, className, block)} {...rest} disabled={disabled}>
      {children}
    </button>
  );
}

/** Small uppercase tag pill — day of week on a tour card, a category badge. */
export function Tag({ tone = "brand", className, children }: { tone?: "brand" | "dark" | "ok" | "ghost"; className?: string; children: ReactNode }) {
  const t = {
    brand: "bg-brand text-ink",
    dark: "bg-ground/75 text-ink",
    ok: "bg-ok/90 text-ok-ink",
    ghost: "bg-white/16 text-ink",
  }[tone];
  return (
    <span className={cx("inline-flex items-center rounded-full px-[11px] py-1 text-[10.5px] font-bold tracking-[.06em] uppercase", t, className)}>
      {children}
    </span>
  );
}

// --- surfaces --------------------------------------------------------------

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-card bg-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Lbl({ className, children, ...rest }: ComponentProps<"span">) {
  return (
    <span className={cx("lbl", className)} {...rest}>
      {children}
    </span>
  );
}

/** A row inside a list card. Hairlines only between rows, never around. */
export function Row({ icon, iconTone = "ghost", title, sub, right, className }: {
  icon?: ReactNode;
  iconTone?: "ghost" | "brand" | "ok" | "warn";
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  const disc = {
    ghost: "bg-white/7 text-brand-bright",
    brand: "bg-brand/22 text-brand-bright",
    ok: "bg-ok/16 text-ok",
    warn: "bg-warn/18 text-warn",
  }[iconTone];
  return (
    <div className={cx("flex items-center gap-[15px] px-[14px] py-[15px]", className)}>
      {icon && <div className={cx("flex size-[42px] shrink-0 items-center justify-center rounded-full", disc)}>{icon}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-[15.5px] font-semibold">{title}</span>
        {sub && <span className="text-[13.5px] text-ink-mute">{sub}</span>}
      </div>
      {right}
    </div>
  );
}

// --- money -----------------------------------------------------------------

/** "DKK 2,550" in the display face, tabular. `per` adds a muted unit after. */
export function Price({ minor, per, size = "md", className }: { minor: number; per?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { sm: "text-[19px]", md: "text-[20px]", lg: "text-[27px] tracking-[-.02em]", xl: "text-[36px] tracking-[-.024em]" }[size];
  return (
    <span className={cx("inline-flex items-baseline gap-[5px]", className)}>
      <span className={cx("num font-display font-bold", s)}>{formatDKKCode(minor)}</span>
      {per && <span className="text-[12.5px] text-ink-mute">{per}</span>}
    </span>
  );
}

/** Bare amount for summary rails: "1,200". */
export function Amount({ minor, className }: { minor: number; className?: string }) {
  return <span className={cx("num font-semibold", className)}>{new Intl.NumberFormat("en-GB").format(Math.round(minor / 100))}</span>;
}

// --- form fields -----------------------------------------------------------

const FIELD = "w-full rounded-field bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] px-[15px] py-[13px] text-[15.5px] text-ink placeholder:text-ink-mute focus:outline-2 focus:outline-brand-bright";

export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-[7px]", className)}>
      <Lbl>{label}</Lbl>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(FIELD, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(FIELD, "appearance-none", props.className)} />;
}

/** A callout on an amber wash — the wind note, the drop-off fee, the lost bike. */
export function Note({ icon, title, children, className }: { icon?: ReactNode; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-[14px] rounded-card bg-warn/10 px-5 py-[18px]", className)}>
      {icon && <div className="mt-[2px] shrink-0 text-warn">{icon}</div>}
      <div className="flex flex-col gap-1">
        {title && <span className="text-[15.5px] font-semibold text-warn-ink">{title}</span>}
        <span className="text-[14.5px] leading-[1.5] text-warn-soft">{children}</span>
      </div>
    </div>
  );
}
