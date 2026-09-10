# Map data

The GeoJSON here is generated — do not edit by hand. It is the road network
of the Faroe Islands from OpenStreetMap, split at junctions and classified as
R Hokwerda's 2025 *Faroe cycling tour map* classifies it (reproduced with the
author's permission). The classification itself is written as routes between
villages in `scripts/map/classification.ts`; the texts, notes and points are in
`app/data/map/`.

Rebuild with `npm run map:build` (from the committed Overpass cache in
`scripts/map/cache/`) or `npm run map:build -- --fetch` to refresh from
Overpass first. The *Map data* workflow in GitHub Actions does the fetch and
commits the result.

| File | Contents |
| --- | --- |
| `roads.geojson` | one LineString per road segment: `cls` (classA, main, local, gravel, mtb), `buttercup`, `singleLane` |
| `tunnels.geojson` | tunnels as MultiLineStrings (`open`, `letter` A–G) and their portals as Points with a `bearing` |
| `ferries.geojson` | ferry routes, `bikes` true/false |
| `loops.geojson` | the named loops as MultiLineStrings |
| `tours.geojson` | our guided tours, `tourSlug` |

Road geometry © OpenStreetMap contributors, ODbL. Map design © R Hokwerda 2025.
