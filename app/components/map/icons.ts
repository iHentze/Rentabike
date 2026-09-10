/**
 * The legend symbols, drawn once as SVG and rasterised into the map's sprite
 * at runtime (no sprite sheet to host). The same strings draw the legend rows.
 * All on a 48×48 box; colours are baked in, so these are plain images, not SDFs.
 */
export const ICON_IDS = [
  "buttercup",
  "portal",
  "bus",
  "busStop",
  "ferryPort",
  "trailhead",
  "scenicVillage",
  "petrol",
  "campTent",
  "campNoTent",
  "webcam",
  "noCycling",
  "busyRoad",
  "demanding",
  "steep",
  "noteDot",
  "loopRing",
] as const;
export type IconId = (typeof ICON_IDS)[number];

const RED = "#d8323c";
const INK = "#1d2429";
const ORANGE = "#e0731c";

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">${body}</svg>`;

const petal = (deg: number) => `<ellipse cx="24" cy="11" rx="6.5" ry="9" fill="#f5c400" stroke="#8a6a12" stroke-width="1.6" transform="rotate(${deg} 24 24)"/>`;

export const ICONS: Record<IconId, string> = {
  buttercup: svg(`${[0, 72, 144, 216, 288].map(petal).join("")}<circle cx="24" cy="24" r="6" fill="#2f7d32" stroke="#8a6a12" stroke-width="1.4"/>`),
  // A short bar across the road at a tunnel mouth; rotated to the tunnel's bearing.
  portal: svg(`<rect x="8" y="21" width="32" height="6" rx="1.5" fill="${INK}"/>`),
  bus: svg(
    `<rect x="4" y="10" width="40" height="26" rx="6" fill="#6b7178"/><rect x="8" y="15" width="32" height="10" rx="2" fill="#dfe6d6"/><circle cx="14" cy="38" r="4" fill="${INK}"/><circle cx="34" cy="38" r="4" fill="${INK}"/><rect x="9" y="28" width="6" height="4" rx="1" fill="#f5c400"/><rect x="33" y="28" width="6" height="4" rx="1" fill="#f5c400"/>`,
  ),
  busStop: svg(`<rect x="12" y="16" width="24" height="16" rx="3" fill="#f5c400" stroke="#6b7178" stroke-width="2.5"/><rect x="16" y="20" width="16" height="8" rx="1" fill="#6b7178"/>`),
  ferryPort: svg(
    `<path d="M6 30h36l-5 9H11z" fill="#ffffff" stroke="${INK}" stroke-width="2"/><rect x="14" y="20" width="20" height="10" rx="1.5" fill="#ffffff" stroke="${INK}" stroke-width="2"/><rect x="20" y="13" width="8" height="7" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`,
  ),
  trailhead: svg(
    `<path d="M11 33c-1-6 2-11 2-16 0-3 3-4 6-3l3 8c1 3 3 4 6 5 2 1 2 4 0 5H13c-1 0-2 0-2 1z" fill="${INK}"/><path d="M27 31c-1-5 1-9 1-13 0-2 2-3 5-2l2 7c1 2 3 3 5 4 2 1 2 3 0 4H28z" fill="${INK}" opacity=".78"/>`,
  ),
  scenicVillage: svg(
    `<path d="M24 8 6 24h6v14h24V24h6z" fill="${ORANGE}"/><path d="M6 24 24 8l18 16" fill="none" stroke="#8a4a10" stroke-width="2.4" stroke-linejoin="round"/><rect x="20" y="27" width="8" height="11" fill="#fff5e6"/>`,
  ),
  petrol: svg(
    `<rect x="11" y="8" width="18" height="32" rx="3" fill="${INK}"/><rect x="14" y="12" width="12" height="9" rx="1.5" fill="#dfe6d6"/><path d="M29 16h4v16a3 3 0 0 0 6 0V18l-4-4" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
  ),
  campTent: svg(`<path d="M24 8 4 40h40z" fill="${INK}"/><path d="M24 20 16 40h16z" fill="#dfe6d6"/>`),
  campNoTent: svg(`<path d="M24 9 5 39h38z" fill="none" stroke="#a04a3a" stroke-width="3" stroke-linejoin="round"/><path d="M24 20 17 38h14z" fill="none" stroke="#a04a3a" stroke-width="2.2"/>`),
  webcam: svg(
    `<circle cx="24" cy="18" r="10" fill="${INK}"/><circle cx="24" cy="18" r="4" fill="#dfe6d6"/><path d="M24 28v8M14 40h20" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  ),
  noCycling: svg(
    `<circle cx="24" cy="24" r="17" fill="#ffffff" stroke="${RED}" stroke-width="4"/><circle cx="15" cy="29" r="5" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="33" cy="29" r="5" fill="none" stroke="${INK}" stroke-width="2"/><path d="M15 29l7-11h6l5 11M22 18l4 11" fill="none" stroke="${INK}" stroke-width="2"/><path d="M12 12l24 24" stroke="${RED}" stroke-width="4" stroke-linecap="round"/>`,
  ),
  busyRoad: svg(
    `<path d="M24 6 45 42H3z" fill="#ffffff" stroke="${RED}" stroke-width="4" stroke-linejoin="round"/><path d="M24 17v13" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="36" r="2.4" fill="${INK}"/>`,
  ),
  demanding: svg(`<path d="M24 6 44 42H4z" fill="${INK}"/><path d="M24 6l6 11-3 3-3-3-3 3-3-3z" fill="#ffffff"/>`),
  steep: svg(`<path d="M24 16 38 40H10z" fill="${INK}"/><path d="M24 16l3 6-3 2-3-2z" fill="#ffffff"/>`),
  noteDot: svg(`<circle cx="24" cy="24" r="6" fill="${INK}"/><circle cx="24" cy="24" r="3" fill="#ffffff"/>`),
  loopRing: svg(`<circle cx="24" cy="24" r="17" fill="none" stroke="${INK}" stroke-width="3.5" stroke-dasharray="9 5"/>`),
};

/** A legend swatch as a data URL — the same drawing the map uses. */
export function iconDataUrl(id: IconId): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(ICONS[id])}`;
}
