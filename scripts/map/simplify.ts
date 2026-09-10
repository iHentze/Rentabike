/** Douglas–Peucker in degrees, then five decimals (about a metre). */
export type Coord = [number, number];

function perpendicular(p: Coord, a: Coord, b: Coord): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function simplify(coords: Coord[], tolerance: number): Coord[] {
  if (coords.length <= 2) return coords;
  let maxD = 0;
  let idx = 0;
  const a = coords[0]!;
  const b = coords[coords.length - 1]!;
  for (let i = 1; i < coords.length - 1; i++) {
    const d = perpendicular(coords[i]!, a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > tolerance) {
    const left = simplify(coords.slice(0, idx + 1), tolerance);
    const right = simplify(coords.slice(idx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [a, b];
}

export const round5 = (c: Coord): Coord => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];
