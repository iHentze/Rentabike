/**
 * Overpass with a committed cache. The raw responses live in
 * scripts/map/cache/ so the build is reproducible without the network and
 * a change in OSM is a diff we can read.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "cache");
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

export interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}
export interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  geometry: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}
export type OsmElement = OsmNode | OsmWay;

export async function overpass(key: string, query: string, fetchFresh: boolean): Promise<OsmElement[]> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${key}.json`);
  if (!fetchFresh && existsSync(file)) {
    return (JSON.parse(readFileSync(file, "utf8")) as { elements: OsmElement[] }).elements;
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": "rentabike-map-build/1.0 (https://rentabike.fo; rentabike@rentabike.fo)" },
        });
        if (res.status === 429 || res.status === 504) throw new Error(`${url} → ${res.status}, busy`);
        if (!res.ok) throw new Error(`${url} → ${res.status}`);
        const json = (await res.json()) as { elements: OsmElement[] };
        writeFileSync(file, JSON.stringify({ fetched: new Date().toISOString(), query, elements: json.elements }));
        console.log(`${key}: ${json.elements.length} elements from ${url}`);
        return json.elements;
      } catch (e) {
        lastError = e;
        console.warn(`${key}: ${String(e)}`);
      }
    }
    // The public servers rate-limit by IP; give them a moment before the next round.
    await new Promise((r) => setTimeout(r, 20000 * (attempt + 1)));
  }
  if (existsSync(file)) {
    console.warn(`${key}: every endpoint failed, using the cached copy`);
    return (JSON.parse(readFileSync(file, "utf8")) as { elements: OsmElement[] }).elements;
  }
  throw lastError;
}

export const BBOX = "61.35,-7.75,62.45,-6.2";

export const QUERIES = {
  roads: `[out:json][timeout:180];
way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track|cycleway|path)$"](${BBOX});
out geom;`,
  ferries: `[out:json][timeout:60];
way["route"="ferry"](${BBOX});
out geom;`,
  places: `[out:json][timeout:60];
(
  node["place"~"^(city|town|village|hamlet|locality|isolated_dwelling|island)$"](${BBOX});
  node["highway"="bus_stop"](${BBOX});
  node["amenity"~"^(fuel|ferry_terminal)$"](${BBOX});
  node["tourism"~"^(camp_site|caravan_site)$"](${BBOX});
  node["natural"~"^(peak|cape|bay|strait|beach)$"]["name"](${BBOX});
  node["mountain_pass"="yes"](${BBOX});
);
out tags;`,
};
