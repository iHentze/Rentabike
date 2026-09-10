/**
 * Heights along a line, from the same terrain tiles the map shades with.
 * Terrarium tiles encode metres in RGB: (R * 256 + G + B / 256) − 32768.
 * Browser only — decoding uses a canvas.
 */
import { TILES } from "~/components/map/style";
import { distanceM, type Coord } from "./router";

const Z = 12;
const SIZE = 256;

export interface Profile {
  /** Distance from the start, metres, one per sample. */
  d: number[];
  /** Height, metres. */
  e: number[];
  ascentM: number;
  descentM: number;
  maxM: number;
  minM: number;
}

const tileCache = new Map<string, Promise<Uint8ClampedArray | null>>();

function tileOf(lon: number, lat: number) {
  const n = 2 ** Z;
  const x = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return { tx: Math.floor(x), ty: Math.floor(y), px: Math.floor((x % 1) * SIZE), py: Math.floor((y % 1) * SIZE) };
}

function loadTile(tx: number, ty: number): Promise<Uint8ClampedArray | null> {
  const key = `${tx}/${ty}`;
  let p = tileCache.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = SIZE;
        c.height = SIZE;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, SIZE, SIZE).data);
      };
      img.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 8000);
      img.src = TILES.terrain.replace("{z}", String(Z)).replace("{x}", String(tx)).replace("{y}", String(ty));
    });
    tileCache.set(key, p);
  }
  return p;
}

/** Resample a line every `stepM` metres. */
export function resample(coords: Coord[], stepM = 40): { points: Coord[]; d: number[] } {
  const points: Coord[] = [coords[0]!];
  const d: number[] = [0];
  let carried = 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const seg = distanceM(a, b);
    let along = stepM - carried;
    while (along <= seg) {
      const t = along / seg;
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d.push(total + along);
      along += stepM;
    }
    carried = seg - (along - stepM);
    total += seg;
  }
  points.push(coords[coords.length - 1]!);
  d.push(total);
  return { points, d };
}

export async function profileFor(coords: Coord[]): Promise<Profile | null> {
  if (coords.length < 2) return null;
  const { points, d } = resample(coords);
  const tiles = new Map<string, Promise<Uint8ClampedArray | null>>();
  for (const [lon, lat] of points) {
    const { tx, ty } = tileOf(lon, lat);
    const key = `${tx}/${ty}`;
    if (!tiles.has(key)) tiles.set(key, loadTile(tx, ty));
  }
  const data = new Map<string, Uint8ClampedArray | null>();
  for (const [key, p] of tiles) data.set(key, await p);
  const e: number[] = [];
  for (const [lon, lat] of points) {
    const { tx, ty, px, py } = tileOf(lon, lat);
    const buf = data.get(`${tx}/${ty}`);
    if (!buf) return null;
    const i = (py * SIZE + px) * 4;
    e.push(Math.max(0, buf[i]! * 256 + buf[i + 1]! + buf[i + 2]! / 256 - 32768));
  }
  // Smooth over five samples (~200 m) before summing climbs, or every bump counts.
  const s = e.map((_, i) => {
    const w = e.slice(Math.max(0, i - 2), i + 3);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  let ascentM = 0;
  let descentM = 0;
  for (let i = 1; i < s.length; i++) {
    const dz = s[i]! - s[i - 1]!;
    if (dz > 0) ascentM += dz;
    else descentM -= dz;
  }
  return { d, e: s, ascentM: Math.round(ascentM), descentM: Math.round(descentM), maxM: Math.round(Math.max(...s)), minM: Math.round(Math.min(...s)) };
}
