/**
 * The thirteen tours from the 16 April 2026 catalogue, as SQL.
 *
 *   npx tsx scripts/seed-tours.ts > .wrangler/tours.sql
 *   npx wrangler d1 execute rentabike --local --file=.wrangler/tours.sql
 *
 * Prices and weekly slots follow the canonical table settled against the
 * catalogue (the 4 March weekly sheet disagreed on five of them — the catalogue
 * wins). Departures for the next sixteen weeks are emitted too, so a fresh
 * local database has something to book; in production the cron keeps them
 * rolling (see app/lib/tours/ensure.ts).
 */
import { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY, planDepartures } from "../app/lib/tours/departures";

type Cat = "bike" | "combo" | "hike" | "trail_run";
type Diff = "Easy" | "Moderate" | "Advanced";
type BikeCat = "ebike" | "mountain" | "gravel" | "road";

interface TourSeed {
  slug: string;
  title: string;
  category: Cat;
  difficulty: Diff;
  summary: string;
  body: string;
  durationMin: number;
  distanceKm: number | null;
  ascentM: number | null;
  summitM: number | null;
  image: string;
  facts: string[];
  weekday: number;
  startTime: string;
  capacity: number;
  price: number; // kr.
  privatePrice: number; // kr. per person
  inclusions: string[];
  bikes: BikeCat[];
  endPoint?: string;
}

const RIDE_INCLUDES = ["The bike", "Helmet", "Water", "A snack", "A local cycling guide", "All taxes"];
const HIKE_INCLUDES = ["Drive to the trailhead and back", "A local hiking guide", "Water"];

const TOURS: TourSeed[] = [
  {
    slug: "viewpoint-nordadalsskard",
    title: "Viewpoint Norðadalsskarð",
    category: "bike",
    difficulty: "Moderate",
    summary: "Up past the turbines to the saddle, then all of Streymoy opens below you.",
    body:
      "Along the coastal road, then up to the pass at 225 m for the panorama across Koltur and the village of Norðadalur far below.\n\n" +
      "We leave the shop on the old road and climb steadily out of town. The first hour is the hardest, and after that it opens up — you pass under the wind turbines on the ridge, which is where most people stop pedalling and just look. From the saddle at Norðadalsskarð the whole of Streymoy drops away in front of you. Then a rewarding descent home, which takes about a quarter of the time.",
    durationMin: 180,
    distanceKm: 27,
    ascentM: 684,
    summitM: 225,
    image: "/images/tour-nordadalsskard.jpg",
    facts: ["225 m pass", "684 m climbing", "E-bike, MTB or road"],
    weekday: TUESDAY,
    startTime: "10:15",
    capacity: 6,
    price: 940,
    privatePrice: 1465,
    inclusions: RIDE_INCLUDES,
    bikes: ["ebike", "mountain", "road", "gravel"],
  },
  {
    slug: "historical-kirkjubour",
    title: "Historical Kirkjubøur",
    category: "bike",
    difficulty: "Moderate",
    summary: "Over the pass and down to the turf roofs and the roofless cathedral.",
    body:
      "Over the pass at 190 m to Saint Olav's Church, the ruins of Magnus Cathedral and Kirkjubøargarður — the oldest continuously inhabited wooden house in Europe. Home via Velbastaður. Paved throughout, on a road, gravel or e-bike.",
    durationMin: 180,
    distanceKm: 30,
    ascentM: 190,
    summitM: 190,
    image: "/images/tour-kirkjubour.jpg",
    facts: ["190 m pass", "Paved throughout", "Road, gravel or e-bike"],
    weekday: THURSDAY,
    startTime: "10:15",
    capacity: 6,
    price: 940,
    privatePrice: 1465,
    inclusions: RIDE_INCLUDES,
    bikes: ["road", "gravel", "ebike", "mountain"],
  },
  {
    slug: "city-sightseeing-ebike",
    title: "City Sightseeing E-bike",
    category: "bike",
    difficulty: "Easy",
    summary: "The old town, the fort and the coast path — on a motor, so the hills don't matter.",
    body:
      "The world's smallest capital at a relaxed pace — harbour, old streets, viewpoints — with the motor doing the hills. Our most popular tour since 2020, and a good first ride if you haven't been on a bike for a while.",
    durationMin: 120,
    distanceKm: 15,
    ascentM: null,
    summitM: null,
    image: "/images/tour-ebike-torshavn.jpg",
    facts: ["Easy", "E-bike", "Good first ride"],
    weekday: WEDNESDAY,
    startTime: "10:15",
    capacity: 6,
    price: 810,
    privatePrice: 1160,
    inclusions: ["E-bike", "Helmet", "Water", "A snack", "A local cycling guide", "All taxes"],
    bikes: ["ebike"],
  },
  {
    slug: "city-sightseeing-ebike-photoshoot",
    title: "City Sightseeing E-bike — Photoshoot",
    category: "bike",
    difficulty: "Easy",
    summary: "The same loop, with a guide who stops at the good light and knows the angles.",
    body:
      "The same city loop, with a guide who stops at the good light and knows the angles. You leave with up to ten professionally edited photographs of your day.",
    durationMin: 120,
    distanceKm: 10,
    ascentM: null,
    summitM: null,
    image: "/images/tour-city-ebike-photoshoot.jpg",
    facts: ["10 edited photos", "Easy", "E-bike"],
    weekday: SATURDAY,
    startTime: "16:15",
    capacity: 6,
    price: 940,
    privatePrice: 1465,
    inclusions: ["E-bike", "Helmet", "Water", "A snack", "A local cycling guide", "Up to ten edited photographs", "All taxes"],
    bikes: ["ebike"],
  },
  {
    slug: "adventure-mtb-light",
    title: "Adventure Mountain Biking with a Local",
    category: "bike",
    difficulty: "Moderate",
    summary: "Grass tracks, river crossings and weather. Bring a change of clothes.",
    body:
      "Past the beach and onto small paths into a valley of streams and little bridges, then an old horse trail with the whole capital below you. Off road, playful, with short climbs.",
    durationMin: 120,
    distanceKm: 18,
    ascentM: null,
    summitM: null,
    image: "/images/tour-adventure-mtb-light.jpg",
    facts: ["Off road", "Mountain bike", "Playful, short climbs"],
    weekday: SUNDAY,
    startTime: "10:15",
    capacity: 6,
    price: 940,
    privatePrice: 1465,
    inclusions: ["Mountain bike", "Helmet", "Water", "A snack", "A local guide", "All taxes"],
    bikes: ["mountain"],
  },
  {
    slug: "adventure-mtb-epic",
    title: "Epic Mountain Bike Tour",
    category: "bike",
    difficulty: "Advanced",
    summary: "Deeper into the valleys with a certified MTB instructor — the longest ride we run.",
    body:
      "Deeper into the valleys with a certified MTB instructor — a network of local trails, riding technique along the way, and hillside paths above the fjords. Some experience helps; this is the longest ride we run.",
    durationMin: 240,
    distanceKm: 37,
    ascentM: null,
    summitM: null,
    image: "/images/tour-mtb.jpg",
    facts: ["Certified instructor", "Experience helps", "Longest ride"],
    weekday: WEDNESDAY,
    startTime: "10:15",
    capacity: 6,
    price: 1345,
    privatePrice: 1845,
    inclusions: ["Mountain bike", "Helmet", "Water", "A snack", "A certified MTB instructor", "All taxes"],
    bikes: ["mountain"],
  },
  {
    slug: "hike-bike-pilgrims-path",
    title: "The Pilgrims' Route to Kirkjubøur",
    category: "combo",
    difficulty: "Moderate",
    summary: "Cycle to the edge of town, walk the old village path over the ridge, bus back.",
    body:
      "Cycle to the edge of town, then walk the old village path over a 260 m ridge to Magnus Cathedral and the royal farmhouse. Bus back, then a last easy ride home.",
    durationMin: 300,
    distanceKm: 18,
    ascentM: 260,
    summitM: 260,
    image: "/images/tour-pilgrims-path-medieval.jpg",
    facts: ["260 m ridge", "Bike + walk + bus"],
    weekday: SATURDAY,
    startTime: "13:15",
    capacity: 6,
    price: 1665,
    privatePrice: 2155,
    inclusions: ["The bike", "Helmet", "Water", "A snack", "The bus back", "A local guide", "All taxes"],
    bikes: ["ebike", "gravel", "mountain"],
  },
  {
    slug: "hike-bike-viewpoint-mountain-plateau",
    title: "Viewpoint & Mountain Plateau",
    category: "combo",
    difficulty: "Moderate",
    summary: "Ride to Norðadalsskarð, leave the bikes, climb to the 667 m summit of Núgvan.",
    body:
      "Ride the coast road up to Norðadalsskarð, leave the bikes, then climb a shepherd's trail to the 667 m summit of Núgvan for 360° over Streymoy. Downhill all the way back.",
    durationMin: 300,
    distanceKm: 27,
    ascentM: 225,
    summitM: 667,
    image: "/images/tour-viewpoint-mountain-plateau.jpg",
    facts: ["667 m summit", "225 m by bike"],
    weekday: SUNDAY,
    startTime: "10:15",
    capacity: 6,
    price: 1665,
    privatePrice: 2155,
    inclusions: ["The bike", "Helmet", "Water", "A snack", "A local guide", "All taxes"],
    bikes: ["ebike", "mountain", "road"],
  },
  {
    slug: "skyline-summit-streymoy",
    title: "Skyline Summit of Streymoy (Núgvan)",
    category: "hike",
    difficulty: "Moderate",
    summary: "Núgvan, 667 m. An old shepherd's trail to a 360° panorama.",
    body: "Núgvan, 667 m. Open moorland on an old shepherd's trail to a 360° panorama, with seabirds working the wind.",
    durationMin: 240,
    distanceKm: 6,
    ascentM: null,
    summitM: 667,
    image: "/images/tour-skyline-nugvan.jpg",
    facts: ["667 m"],
    weekday: THURSDAY,
    startTime: "15:15",
    capacity: 8,
    price: 1045,
    privatePrice: 1410,
    inclusions: HIKE_INCLUDES,
    bikes: [],
  },
  {
    slug: "clifftop-bliss-sandoy",
    title: "The Clifftop Bliss on Sandoy (Gleðin)",
    category: "hike",
    difficulty: "Easy",
    summary: "Through the subsea tunnel, then up Gleðin for the sea stacks and Trøllkonufingur.",
    body:
      "Through the subsea tunnel — Edward Fuglø's artwork, Sunleif Rasmussen's music — then up Gleðin for the sea stacks and Trøllkonufingur, with seabird cliffs the whole way along.",
    durationMin: 240,
    distanceKm: 4,
    ascentM: null,
    summitM: 271,
    image: "/images/tour-clifftop-sandoy.jpg",
    facts: ["271 m", "Seabird cliffs"],
    weekday: FRIDAY,
    startTime: "10:15",
    capacity: 8,
    price: 1045,
    privatePrice: 1560,
    inclusions: ["Drive through the Sandoy tunnel and back", "A local hiking guide", "Water"],
    bikes: [],
  },
  {
    slug: "westward-journey",
    title: "Westward Journey — Fyri Vestan",
    category: "hike",
    difficulty: "Moderate",
    summary: "From the Sornfelli plateau down past glacial boulders and cairns to remote Norðadalur.",
    body:
      "From the Sornfelli plateau down past glacial boulders and cairns to remote Norðadalur, with Koltur out in the Atlantic. A downhill route; we drive you back.",
    durationMin: 300,
    distanceKm: 6,
    ascentM: null,
    summitM: null,
    image: "/images/tour-westward-journey.jpg",
    facts: ["Downhill route", "Drive back"],
    weekday: MONDAY,
    startTime: "10:15",
    capacity: 8,
    price: 1225,
    privatePrice: 1695,
    inclusions: HIKE_INCLUDES,
    bikes: [],
  },
  {
    slug: "pilgrims-path-medieval-heart",
    title: "Pilgrims' Path to the Medieval Heart",
    category: "hike",
    difficulty: "Easy",
    summary: "The route farmers, priests and travellers walked to the bishop's seat.",
    body:
      "The route farmers, priests and travellers walked to the bishop's seat. Over the ridge, down through turf-roofed farmland to Kirkjubøur, and the bus back to town.",
    durationMin: 240,
    distanceKm: 7,
    ascentM: 260,
    summitM: 260,
    image: "/images/tour-pilgrims-path-kirkjubo.jpg",
    facts: ["260 m ridge", "Bus back"],
    weekday: TUESDAY,
    startTime: "15:15",
    capacity: 8,
    price: 1045,
    privatePrice: 1410,
    inclusions: ["A local hiking guide", "Water", "The bus back"],
    bikes: [],
  },
  {
    slug: "run-pilgrims-path",
    title: "Run the Pilgrims' Path to Kirkjubøur",
    category: "trail_run",
    difficulty: "Moderate",
    summary: "The same historic route, at running pace, with a guide.",
    body:
      "The same historic route, at running pace. Quiet roads out of town, then the village path climbing to a 260 m ridge with the fjords and islands opening either side. Time in Kirkjubøur for the cathedral ruins and Kirkjubøargarður before you choose: run back, or take the bus.",
    durationMin: 180,
    distanceKm: 18,
    ascentM: 260,
    summitM: 260,
    image: "/images/tour-pilgrims-run.jpg",
    facts: ["260 m ridge", "Run back or bus", "Guided"],
    weekday: SATURDAY,
    startTime: "10:15",
    capacity: 8,
    price: 1045,
    privatePrice: 1410,
    inclusions: ["A local running guide", "Water", "The bus back if you want it"],
    bikes: [],
  },
];

const q = (v: string | number | null): string => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const now = Date.now();
const out: string[] = [];
const horizonWeeks = Number(process.argv.find((a) => a.startsWith("--weeks="))?.slice(8) ?? 16);
const today = new Date(now).toISOString().slice(0, 10);
const horizon = new Date(now + horizonWeeks * 7 * 86_400_000).toISOString().slice(0, 10);

for (const t of TOURS) {
  const id = `tour-${t.slug}`;
  const sid = `sch-${t.slug}`;
  const requiresBike = t.category === "bike" || t.category === "combo" ? 1 : 0;
  out.push(
    `INSERT INTO tours (id, slug, title, category, difficulty, summary, body, duration_min, distance_km, ascent_m, summit_m, meeting_point, end_point, pricing_mode, requires_bike, image, facts, published, created_at, updated_at) VALUES (` +
      [id, t.slug, t.title, t.category, t.difficulty, t.summary, t.body, t.durationMin, t.distanceKm, t.ascentM, t.summitM, "Sverrisgøta 20, Tórshavn", t.endPoint ?? null, "per_person", requiresBike, t.image, t.facts.join(" | "), 1, now, now].map(q).join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, category=excluded.category, difficulty=excluded.difficulty, summary=excluded.summary, body=excluded.body, duration_min=excluded.duration_min, distance_km=excluded.distance_km, ascent_m=excluded.ascent_m, summit_m=excluded.summit_m, requires_bike=excluded.requires_bike, image=excluded.image, facts=excluded.facts, published=excluded.published, updated_at=excluded.updated_at;`,
  );
  out.push(
    `INSERT INTO tour_schedules (id, tour_id, season_start, season_end, weekday_mask, start_time, capacity, price_minor, private_price_minor, min_participants, booking_cutoff_hours, active) VALUES (` +
      [sid, id, "2026-01-01", "2027-12-31", t.weekday, t.startTime, t.capacity, t.price * 100, t.privatePrice * 100, 0, 12, 1].map(q).join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET weekday_mask=excluded.weekday_mask, start_time=excluded.start_time, capacity=excluded.capacity, price_minor=excluded.price_minor, private_price_minor=excluded.private_price_minor, active=excluded.active;`,
  );
  out.push(`DELETE FROM tour_inclusions WHERE tour_id = ${q(id)};`);
  t.inclusions.forEach((label, i) => {
    out.push(`INSERT INTO tour_inclusions (id, tour_id, seq, label, included) VALUES (${q(`${id}-inc${i + 1}`)}, ${q(id)}, ${i + 1}, ${q(label)}, 1);`);
  });
  out.push(`DELETE FROM tour_bike_types WHERE tour_id = ${q(id)};`);
  if (t.bikes.length) {
    out.push(
      `INSERT OR IGNORE INTO tour_bike_types (tour_id, bike_type_id) SELECT ${q(id)}, id FROM bike_types WHERE listed = 1 AND category IN (${t.bikes.map(q).join(", ")});`,
    );
  }
  // Departures for the near future, so a fresh database has something to book.
  const planned = planDepartures({
    id: sid,
    tourId: id,
    seasonStart: today,
    seasonEnd: horizon,
    weekdayMask: t.weekday,
    startTime: t.startTime,
    capacity: t.capacity,
    priceMinor: t.price * 100,
    durationMin: t.durationMin,
  }).filter((p) => p.startsAt.getTime() > now);
  for (const p of planned) {
    const did = `dep-${t.slug}-${p.startsAt.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
    out.push(
      `INSERT OR IGNORE INTO tour_departures (id, tour_id, schedule_id, starts_at, ends_at, capacity, seats_taken, price_minor, min_participants, status, is_private, created_at) VALUES (` +
        [did, id, sid, p.startsAt.getTime(), p.endsAt.getTime(), p.capacity, 0, p.priceMinor, p.minParticipants, "open", 0, now].map(q).join(", ") +
        `);`,
    );
  }
}

process.stdout.write(out.join("\n") + "\n");
process.stderr.write(`${TOURS.length} tours, ${out.length} statements, departures through ${horizon}\n`);
