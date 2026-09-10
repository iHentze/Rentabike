/**
 * The print map's classification, written as routes between places. The
 * build script resolves each place to its OpenStreetMap node, snaps it to
 * the road network and takes the shortest road between consecutive places;
 * "@lat,lon" pins a point where a name is ambiguous or absent.
 *
 * Read the map, not this file, when in doubt: the print is the source. The
 * comments name the print's own words where a note explains a choice.
 */
import type { RoadClass } from "../../app/data/map/types";

export interface RouteSpec {
  id: string;
  /** Place names as OSM spells them, or "@lat,lon". */
  via: string[];
  /** Roads open for the Sóljuleið buttercup route. */
  buttercup?: boolean;
  /** Single-lane road with lay-bys. */
  singleLane?: boolean;
  /** Let the route take a tunnel without the usual penalty. */
  allowTunnel?: boolean;
}

/** Class A — "scenic and bike-friendly", the thick yellow lines. */
export const CLASS_A: RouteSpec[] = [
  // Vágar
  { id: "gasadalur", via: ["Gásadalur", "Bøur", "Sørvágur"], buttercup: true, allowTunnel: true },
  { id: "vagar-south", via: ["Sørvágur", "Miðvágur", "Sandavágur"] },
  // Streymoy
  { id: "kirkjubour-loop", via: ["Tórshavn", "Velbastaður", "Kirkjubøur", "@61.9624,-6.8189", "Velbastaður", "Tórshavn"], buttercup: true },
  { id: "nordradalur", via: ["@62.0180,-6.8200", "Norðradalur"], singleLane: true },
  // "Scenic ride to nowhere": the road out to Syðradalur on Streymoy.
  { id: "sydradalur-streymoy", via: ["Velbastaður", "@62.0187,-6.9132"] },
  { id: "kaldbak", via: ["Hvítanes", "Sund", "Kaldbaksbotnur", "Kaldbak"] },
  { id: "kollafjordur-old", via: ["Kaldbaksbotnur", "Kollafjørður"] },
  { id: "leynar-vestmanna", via: ["Leynar", "Skælingur", "Kvívík", "Vestmanna"] },
  { id: "saksun", via: ["Hvalvík", "Streymnes", "Saksun"], singleLane: true },
  { id: "tjornuvik", via: ["Hvalvík", "Langasandur", "Haldórsvík", "Tjørnuvík"], buttercup: true },
  { id: "hosvik", via: ["Kollafjørður", "Hósvík", "Hvalvík"] },
  // Eysturoy
  { id: "eidi", via: ["Oyrarbakki", "Oyri", "Norðskáli", "Svínáir", "Ljósá", "Eiði"], buttercup: true },
  { id: "gjogv", via: ["Eiði", "Gjógv"], buttercup: true },
  { id: "funningur", via: ["Gjógv", "Funningur", "Funningsfjørður"], buttercup: true },
  { id: "elduvik", via: ["Funningsfjørður", "Elduvík"] },
  { id: "oyndarfjordur", via: ["Funningsfjørður", "Oyndarfjørður"] },
  { id: "skalafjordur-west", via: ["Skálafjørður", "Skála", "Strendur", "Selatrað"] },
  { id: "skalafjordur-east", via: ["Skálafjørður", "Søldarfjørður", "Glyvrar", "Runavík", "Toftir"] },
  { id: "aeduvik", via: ["Runavík", "Rituvík", "Æðuvík"], buttercup: true },
  { id: "toftir-nes", via: ["Toftir", "@62.0778,-6.7195"] },
  { id: "fuglafjordur", via: ["Leirvík", "Fuglafjørður"] },
  // "Disused highway: scenic & tranquil" — the old road over Gøtueiði, not the tunnel.
  { id: "gotueidi", via: ["Norðragøta", "Leirvík"] },
  // Norðoyar
  { id: "vidareidi", via: ["Klaksvík", "Árnafjørður", "Hvannasund", "Viðareiði"], buttercup: true, allowTunnel: true },
  { id: "kunoy", via: ["Klaksvík", "Haraldssund", "Kunoy"], allowTunnel: true },
  { id: "kalsoy", via: ["@62.2453,-6.6678", "Húsar", "Mikladalur", "Trøllanes"], singleLane: true, allowTunnel: true },
  { id: "fugloy", via: ["Kirkja", "Hattarvík"] },
  { id: "muli", via: ["Norðdepil", "Múli"] },
  // "Former main road: scenic & tranquil" — the old road up the east side of Viðoy, beside the tunnel.
  { id: "vidoy-old-road", via: ["Hvannasund", "@62.3380,-6.5220", "Viðareiði"] },
  { id: "nordoyri", via: ["Klaksvík", "Norðoyri"] },
  // Sandoy
  { id: "sandoy", via: ["Skopun", "Sandur", "Skálavík", "Húsavík", "Dalur"], buttercup: true },
  { id: "skarvanes", via: ["Sandur", "Skarvanes"] },
  // West to the bay at Søltuvík, gravel, with the buttercup.
  { id: "soltuvik", via: ["Sandur", "@61.8420,-6.8760"], buttercup: true },
  // Suðuroy
  { id: "hvalba", via: ["Sandvík", "Hvalba", "Trongisvágur", "Tvøroyri"], allowTunnel: true },
  { id: "famjin", via: ["Trongisvágur", "Fámjin"], buttercup: true },
  { id: "frodba", via: ["Tvøroyri", "Froðba"] },
  { id: "hov-vagur", via: ["Tvøroyri", "Ørðavík", "Hov", "Porkeri", "Vágur"], buttercup: true },
  // "Scenic rides to nowhere" west of Vágur.
  { id: "famara", via: ["Vágur", "Í Fámara"] },
  { id: "vikarbyrgi", via: ["Vágur", "Akrar", "Víkarbyrgi"] },
  // "Um Hestin": the old road over the mountain to Sumba; the tunnel is the bike-friendly alternative.
  { id: "sumba-hestin", via: ["Vágur", "Lopra", "@61.4308,-6.7590", "Sumba"] },
  { id: "sumba-tunnel", via: ["Lopra", "Sumba"], allowTunnel: true },
];

/** Roads the print draws as "other main road" though OSM would rank them lower, or the reverse. */
export const MAIN: RouteSpec[] = [{ id: "hellur", via: ["Fuglafjørður", "Hellurnar"] }];

/** "Local or semi-public road with bike access" — the white lines the print picks out. */
export const LOCAL: RouteSpec[] = [
  // "SEV hydro station service roads: wild, steep, tranquil"
  { id: "sev", via: ["Vestmanna", "@62.1350,-7.1250"] },
];

/** Where the print marks the road as gravel or an MTB track. */
export const GRAVEL: RouteSpec[] = [];
export const MTB: RouteSpec[] = [];

/**
 * Tunnels closed to cyclists (dashed on the print). Every other tunnel drawn
 * is open, with care. The old Hvalba tunnel is "fenced off for all traffic".
 */
export const TUNNELS_CLOSED = ["Eysturoyartunnilin", "Sandoyartunnilin", "Hvalbiartunnilin"];

/** Tunnels the print draws as open (solid). Listed so the build only warns about tunnels new to us. */
export const TUNNELS_KNOWN_OPEN = [
  "Hovs Tunnilin",
  "Sandvíkartunnilin",
  "Leynartunnilin",
  "Leirvíkartunnilin",
  "Hvannasundstunnilin",
  "Árnafjarðartunnilin",
  "Gásadalstunnilin",
  "Kunoyartunnilin",
  "Sumbiartunnilin",
  "Viðareiðistunnilin",
  "Nýggjur Hvalbiartunnilin",
  "Húsareynstunnilin",
  "Dalstunnilin",
  "Fámjinstunnilin",
];

/** Anything shorter is an underpass or a building passage, not a tunnel the print draws. */
export const TUNNEL_MIN_M = 120;

/** Ferries that do not take bikes. */
export const FERRIES_NO_BIKES = ["Mykines"];

/** What a road is when no route claims it. `null` leaves it off the map. */
export const HIGHWAY_DEFAULT: Record<string, RoadClass | null> = {
  trunk: "main",
  trunk_link: "main",
  primary: "main",
  primary_link: "main",
  secondary: "main",
  secondary_link: "main",
  tertiary: "local",
  tertiary_link: "local",
  unclassified: "local",
  residential: null,
  living_street: null,
  service: null,
  track: null,
  cycleway: null,
  path: null,
};

/** The named loops, as closed routes. Names and colours live in app/data/map/loops.ts. */
export const LOOP_ROUTES: RouteSpec[] = [
  { id: "northern-eysturoy", via: ["Oyrarbakki", "Eiði", "Gjógv", "Funningur", "Funningsfjørður", "Skálafjørður", "Oyrarbakki"] },
  { id: "great-central", via: ["Tórshavn", "Kaldbak", "Kollafjørður", "Hósvík", "Hvalvík", "Oyrarbakki", "Skálafjørður", "Skála", "Strendur"] },
  { id: "kirkjubour", via: ["Tórshavn", "Velbastaður", "Kirkjubøur", "@61.9624,-6.8189", "Velbastaður", "Tórshavn"] },
  { id: "sornfelli", via: ["Tórshavn", "@62.0180,-6.8200", "@62.0600,-6.9700"] },
];

/** Our guided tours on the map. Slugs match scripts/seed-tours.ts. */
export const TOUR_ROUTES: RouteSpec[] = [
  { id: "historical-kirkjubour", via: ["Tórshavn", "Velbastaður", "Kirkjubøur", "@61.9624,-6.8189", "Velbastaður", "Tórshavn"] },
  { id: "viewpoint-nordadalsskard", via: ["Tórshavn", "@62.0180,-6.8200", "Norðradalur"] },
  { id: "westward-journey", via: ["@62.0640,-6.9640", "@62.0330,-6.8900", "Norðradalur"] },
  { id: "clifftop-bliss-sandoy", via: ["Skopun", "Sandur", "Skálavík"] },
  // The city loops: south along the shore to Argir, back through town and out to Hoyvík.
  { id: "city-sightseeing-ebike", via: ["Tórshavn", "Argir", "Tórshavn", "Hoyvík", "Tórshavn"] },
  { id: "city-sightseeing-ebike-photoshoot", via: ["Tórshavn", "Argir", "Tórshavn", "Hoyvík", "Tórshavn"] },
  // The hike-and-bike days: the ride is drawn, the walk is not a road.
  { id: "hike-bike-pilgrims-path", via: ["Tórshavn", "@62.0080,-6.8130"] },
  { id: "hike-bike-viewpoint-mountain-plateau", via: ["Tórshavn", "@62.0180,-6.8200", "@62.0330,-6.8900"] },
];
