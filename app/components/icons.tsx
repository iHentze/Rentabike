/**
 * The small line icons from the canvas, as components. All are 24-box strokes
 * so they scale with `size` and take their colour from `stroke`/currentColor.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const Check = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={p.strokeWidth ?? 3}><path d="M4 12.5l5 5L20 6.5" /></svg>
);
export const Chevron = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M9.5 6l6 6-6 6" /></svg>
);
export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M6 9.5l6 6 6-6" /></svg>
);
export const Phone = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4z" /></svg>
);
export const Pin = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
);
export const Bolt = (p: IconProps) => (
  <svg {...base(p)}><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" /></svg>
);
export const Mountain = (p: IconProps) => (
  <svg {...base(p)}><path d="M2 19l6-9 4 5 3-4 7 8z" /></svg>
);
export const Gravel = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 18c4-1 5-10 9-10s5 8 9 7" /><circle cx="7" cy="18" r="1.4" /><circle cx="17" cy="8" r="1.4" /></svg>
);
export const Road = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 15h18" /><path d="M6 15l3-7h6l3 7" /><circle cx="12" cy="19" r="1.4" /></svg>
);
export const Child = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="7" r="3" /><path d="M7 20c0-3 2.2-5 5-5s5 2 5 5" /></svg>
);
export const Bag = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 9h16l-1.5 9h-13z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></svg>
);
export const Shield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l7.5 3v6c0 4.6-3.2 7.9-7.5 9-4.3-1.1-7.5-4.4-7.5-9V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>
);
export const CardIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></svg>
);
export const Calendar = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const Clock = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.4l3.4 2" /></svg>
);
export const Info = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></svg>
);
export const Warning = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17v.1" /></svg>
);
export const Wind = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 8h11a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h9" /></svg>
);
export const Star = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2}><path d="M12 3l2.4 6.2 6.6.4-5.1 4.2 1.7 6.4L12 16.8 6.4 20.2l1.7-6.4L3 9.6l6.6-.4z" /></svg>
);
export const Lock = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
);
export const Minus = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.6}><path d="M5 12h14" /></svg>
);
export const Plus = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
);
export const Cross = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Download = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3v13M7 11.5l5 5 5-5M4 20h16" /></svg>
);

/** The line-drawn bike used wherever a product has no photograph yet. */
export function BikeArt({ motor = false, className = "" }: { motor?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 200 110" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="42" cy="78" r="24" />
      <circle cx="158" cy="78" r="24" />
      <path d="M42 78l30-44h34M72 34l34 44M106 78l24-40h22M126 38h18M96 30h20" />
      {motor && <rect x="120" y="58" width="26" height="16" rx="3" strokeWidth={2.2} />}
    </svg>
  );
}

/** Line drawings for extras the shop has no photo of — one per kind, all the same weight. */
export function AddonArt({ kind, className }: { kind: "helmet" | "pedal" | "bag" | "rack" | "mount" | "bottle" | "gps" | "carrier" | "storage" | "other"; className?: string }) {
  const base = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (kind) {
    case "helmet":
      return <svg {...base}><path d="M8 27a16 16 0 0 1 32 0v3H8z" /><path d="M8 30h32l-3 6H11z" /><path d="M16 12l3 15M32 12l-3 15" /></svg>;
    case "pedal":
      return <svg {...base}><path d="M10 20h28l-4 12H14z" /><path d="M24 20v-8M20 12h8" /><path d="M14 26h20" /></svg>;
    case "bag":
      return <svg {...base}><path d="M10 18h28l-2 20H12z" /><path d="M17 18v-4a7 7 0 0 1 14 0v4" /><path d="M14 26h20" /></svg>;
    case "rack":
      return <svg {...base}><path d="M8 22h32M8 22l4-10h24l4 10" /><path d="M14 22v12M34 22v12M14 30h20" /></svg>;
    case "mount":
      return <svg {...base}><rect x="16" y="6" width="16" height="30" rx="3" /><path d="M22 10h4M24 42v-6M14 42h20" /></svg>;
    case "bottle":
      return <svg {...base}><path d="M19 8h10v6l4 6v20a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V20l4-6z" /><path d="M15 26h18" /></svg>;
    case "gps":
      return <svg {...base}><rect x="14" y="8" width="20" height="26" rx="4" /><path d="M20 20l4 4 6-8M24 34v8M18 42h12" /></svg>;
    case "carrier":
      return <svg {...base}><path d="M6 30h36v6H6z" /><path d="M12 30V14l8-6h8l8 6v16" /><circle cx="14" cy="41" r="3" /><circle cx="34" cy="41" r="3" /></svg>;
    case "storage":
      return <svg {...base}><path d="M8 18l16-8 16 8v16l-16 8-16-8z" /><path d="M8 18l16 8 16-8M24 26v16" /></svg>;
    default:
      return <svg {...base}><path d="M8 12h16l16 16-12 12L8 24z" /><circle cx="15" cy="19" r="2.5" /></svg>;
  }
}
