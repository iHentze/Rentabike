/**
 * "Which bike suits you" — two plain-language questions, an answer in
 * bike TYPES. The type is what terrain and effort decide; the frame size
 * follows from the rider's height on the riders step, one rider at a time.
 * Shared by the chooser (which asks) and the riders step (which shows the
 * advice above the list).
 */
import type { BikeCategory } from "~/db/schema";
import type { CatalogueBike } from "./bikes";

export type Terrain = "town" | "villages" | "hills";
export type Effort = "all" | "some" | "little";

export const TERRAIN: Array<{ id: Terrain; title: string; text: string }> = [
  { id: "town", title: "Around Tórshavn", text: "Harbour, old town, the cafés. Mostly flat, short hops, back before dinner." },
  { id: "villages", title: "Out to the villages", text: "Kirkjubøur and the coast roads. Rolling, a few real climbs, 30–50 km in a day." },
  { id: "hills", title: "Up into the hills", text: "Norðadalsskarð, Núgvan, the grass tracks. Proper ascent and loose ground." },
];
export const EFFORT: Array<{ id: Effort; title: string; text: string }> = [
  { id: "all", title: "All of it", text: "I ride at home and I want the climbs." },
  { id: "some", title: "Some help on the hills", text: "Fit enough, but I'm on holiday." },
  { id: "little", title: "As little as possible", text: "I want to look at the view, not the tarmac." },
];

/** Category order for each answer pair — first that has bikes free wins. */
const PREFER: Record<Terrain, Record<Effort, BikeCategory[]>> = {
  town: { little: ["ebike", "road", "gravel"], some: ["ebike", "gravel", "road"], all: ["road", "gravel", "ebike"] },
  villages: { little: ["ebike", "gravel"], some: ["ebike", "gravel", "road"], all: ["gravel", "road", "ebike"] },
  hills: { little: ["ebike", "mountain"], some: ["ebike", "mountain", "gravel"], all: ["mountain", "gravel", "ebike"] },
};

export const REASONS: Record<BikeCategory, Record<Terrain, string[]>> = {
  ebike: {
    town: ["The motor flattens the hill up from the harbour", "Battery covers roughly 80 km — more than a day out here", "The one people pick again when they come back"],
    villages: ["Handles the coast road and the pass to Kirkjubøur without the sweat", "Battery covers roughly 80 km — more than a day out here", "A headwind on the coast road stops mattering"],
    hills: ["Motor and wide tyres for Norðadalsskarð and the grass tracks", "You arrive at the saddle with legs left for the view", "Battery covers roughly 80 km — more than a day out here"],
  },
  gravel: {
    town: ["Quick on tarmac, comfortable over cobbles", "Drop bars for the exposed stretches along the water", "Light enough to carry up the old-town steps"],
    villages: ["Handles the coast-road tarmac and the gravel stretch to Kirkjubøur", "Geared for the pass — 190 m, paved throughout", "Fast enough to make the 50 km day feel short"],
    hills: ["Wide tyres for the loose ground on the plateau tracks", "Lower gears than a road bike for the long climb", "Still quick on the tarmac back down"],
  },
  road: {
    town: ["Fastest thing on the coast road", "Paved the whole way round the capital", "Light and quick — the sightseeing loop in an hour"],
    villages: ["The Kirkjubøur road is paved from door to door", "Built for exactly this: rolling tarmac and long views", "Clip-in pedals available if you ride at home"],
    hills: ["Paved to the top of Norðadalsskarð — a proper road climb", "Fast descent home", "Skip the grass tracks; this one is for the tarmac"],
  },
  mountain: {
    town: ["Comfortable and upright for a slow look around", "Fat tyres soak up the cobbles", "Nothing to worry about on the harbour paths"],
    villages: ["Happy on the gravel stretches and farm tracks", "Suspension takes the rough patches out of the day", "Lower gears for the pass"],
    hills: ["Knobbly tyres and suspension for grass tracks and loose ground", "The bike our guides ride on the Sunday tours", "Built to be ridden hard and washed afterwards"],
  },
  extra: { town: [], villages: [], hills: [] },
};

/** "An e-bike", "a gravel bike" — the type as it reads in a sentence. */
export const CATEGORY_NOUN: Record<BikeCategory, string> = {
  ebike: "an e-bike",
  gravel: "a gravel bike",
  road: "a road bike",
  mountain: "a mountain bike",
  extra: "an extra",
};

/** Which types to suggest, best first, for what was answered so far. */
export function preferredCategories(terrain: Terrain | null, effort: Effort | null): BikeCategory[] {
  if (terrain && effort) return PREFER[terrain][effort];
  if (terrain) return PREFER[terrain].some;
  if (effort) return PREFER.villages[effort];
  return [];
}

export interface CategoryAdvice {
  category: BikeCategory;
  reasons: string[];
  /** A bike of this type to show — the one with the most free on these dates, so the picture is of something they can actually get. */
  sample: Pick<CatalogueBike, "image" | "name" | "category"> | null;
  /** Bikes of this type free on the dates, all sizes. */
  free: number;
  /** Distinct frame sizes among the free ones. */
  sizes: number;
  fromMinor: number | null;
}

/** The types worth suggesting, best first, with what the fleet has of each on these dates. */
export function adviseCategories(bikes: CatalogueBike[], terrain: Terrain | null, effort: Effort | null): CategoryAdvice[] {
  return preferredCategories(terrain, effort)
    .map((category) => {
      const free = bikes.filter((b) => b.category === category && b.free > 0);
      const sample = [...free].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || b.free - a.free)[0] ?? null;
      return {
        category,
        reasons: REASONS[category][terrain ?? "villages"],
        sample: sample ? { image: sample.image, name: sample.name, category: sample.category } : null,
        free: free.reduce((n, b) => n + b.free, 0),
        sizes: new Set(free.map((b) => b.sizeLabel ?? b.id)).size,
        fromMinor: free.length ? Math.min(...free.map((b) => b.rateMinor)) : null,
      };
    })
    .filter((a) => a.free > 0);
}

export function isTerrain(v: string | null): v is Terrain {
  return TERRAIN.some((t) => t.id === v);
}
export function isEffort(v: string | null): v is Effort {
  return EFFORT.some((e) => e.id === v);
}
