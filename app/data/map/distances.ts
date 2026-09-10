import type { DistanceLabel } from "./types";

/**
 * "Road distance between pins", in km, as the print numbers the legs.
 * Positioned midway along the leg. Read off the 2025 print; a leg the print
 * does not number is not here.
 */
export const DISTANCES: DistanceLabel[] = [
  // Vágar
  { id: "gasadalur-bour", at: [-7.40, 62.09], km: 5 },
  { id: "bour-sorvagur", at: [-7.335, 62.075], km: 4 },
  { id: "sorvagur-midvagur", at: [-7.22, 62.05], km: 9 },
  { id: "midvagur-sandavagur", at: [-7.155, 62.06], km: 3 },
  { id: "sandavagur-tunnel", at: [-7.10, 62.075], km: 7 },
  // Streymoy
  { id: "torshavn-velbastadur", at: [-6.83, 61.99], km: 5 },
  { id: "velbastadur-kirkjubour", at: [-6.80, 61.965], km: 3 },
  { id: "kirkjubour-torshavn", at: [-6.77, 61.98], km: 6 },
  { id: "torshavn-nordradalur", at: [-6.90, 62.035], km: 11 },
  { id: "torshavn-kaldbak", at: [-6.78, 62.07], km: 7 },
  { id: "kaldbak-kollafjordur", at: [-6.88, 62.10], km: 9 },
  { id: "kollafjordur-hosvik", at: [-6.94, 62.13], km: 5 },
  { id: "hosvik-hvalvik", at: [-7.00, 62.165], km: 5 },
  { id: "hvalvik-saksun", at: [-7.10, 62.22], km: 11 },
  { id: "hvalvik-tjornuvik", at: [-7.05, 62.26], km: 9 },
  { id: "leynar-kvivik", at: [-7.06, 62.115], km: 5 },
  { id: "kvivik-vestmanna", at: [-7.13, 62.14], km: 6 },
  { id: "oyggjarvegur", at: [-6.87, 62.06], km: 11 },
  // Eysturoy
  { id: "oyrarbakki-eidi", at: [-7.05, 62.27], km: 9 },
  { id: "eidi-gjogv", at: [-7.02, 62.315], km: 10 },
  { id: "gjogv-funningur", at: [-6.97, 62.30], km: 5 },
  { id: "funningur-funningsfjordur", at: [-6.97, 62.27], km: 6 },
  { id: "funningsfjordur-elduvik", at: [-6.92, 62.29], km: 5 },
  { id: "funningsfjordur-oyndarfjordur", at: [-6.90, 62.25], km: 8 },
  { id: "skalabotnur-strendur", at: [-6.80, 62.15], km: 11 },
  { id: "strendur-selatrad", at: [-6.83, 62.185], km: 6 },
  { id: "skalabotnur-runavik", at: [-6.73, 62.16], km: 9 },
  { id: "runavik-toftir", at: [-6.72, 62.10], km: 5 },
  { id: "toftir-aeduvik", at: [-6.68, 62.09], km: 5 },
  { id: "leirvik-fuglafjordur", at: [-6.76, 62.235], km: 6 },
  // Norðoyar
  { id: "klaksvik-arnafjordur", at: [-6.55, 62.245], km: 5 },
  { id: "arnafjordur-hvannasund", at: [-6.53, 62.285], km: 6 },
  { id: "hvannasund-vidareidi", at: [-6.52, 62.33], km: 8 },
  { id: "klaksvik-kunoy", at: [-6.62, 62.28], km: 10 },
  { id: "husar-mikladalur", at: [-6.77, 62.31], km: 8 },
  { id: "mikladalur-trollanes", at: [-6.78, 62.35], km: 3 },
  // Sandoy
  { id: "skopun-sandur", at: [-6.80, 61.88], km: 5 },
  { id: "sandur-skalavik", at: [-6.72, 61.85], km: 8 },
  { id: "skalavik-husavik", at: [-6.67, 61.82], km: 3 },
  { id: "husavik-dalur", at: [-6.69, 61.79], km: 3 },
  { id: "sandur-skarvanes", at: [-6.80, 61.82], km: 6 },
  // Suðuroy
  { id: "sandvik-hvalba", at: [-6.95, 61.585], km: 6 },
  { id: "hvalba-tvoroyri", at: [-6.90, 61.565], km: 7 },
  { id: "tvoroyri-famjin", at: [-6.87, 61.535], km: 9 },
  { id: "tvoroyri-hov", at: [-6.80, 61.52], km: 8 },
  { id: "hov-porkeri", at: [-6.76, 61.49], km: 3 },
  { id: "porkeri-vagur", at: [-6.78, 61.48], km: 5 },
  { id: "vagur-lopra", at: [-6.78, 61.45], km: 5 },
  { id: "lopra-sumba", at: [-6.73, 61.42], km: 6 },
  { id: "sumba-akrar", at: [-6.71, 61.40], km: 2 },
];
