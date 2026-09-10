import type { Note } from "./types";

/**
 * The advice written on the 2025 print, word for word. Positions are the
 * point the print's leader line touches. `dated` marks the lines that
 * describe 2025 and will need a second look.
 */
export const NOTES: Note[] = [
  // Northern Isles
  { id: "kalsoy-tunnels", at: [-6.755, 62.315], text: "Kalsoy tunnels: all single lane, unlit, on an incline. Bus does not accept bikes. See note D.", refTunnel: "D", anchor: "right" },
  { id: "vidoy-old-road", at: [-6.535, 62.32], text: "Former main road: scenic & tranquil", anchor: "left" },
  { id: "hvannasund-tunnel", at: [-6.545, 62.295], text: "Tunnel 2.0 km, unlit, single lane. For precautions, see Kalsoy tunnels.", refTunnel: "D", anchor: "left" },
  { id: "muli", at: [-6.52, 62.36], text: "Scenic ride to nowhere", anchor: "left" },
  { id: "fugloy", at: [-6.31, 62.335], text: "Bringing a bike is possible but makes little practical sense. The ferry timetable leaves ample time to walk both road and footpath.", anchor: "left" },
  { id: "svinoy", at: [-6.35, 62.27], text: "Bringing a bike is possible but makes little practical sense", anchor: "left" },
  { id: "gotueidi", at: [-6.72, 62.215], text: "Disused highway: scenic & tranquil", anchor: "top" },
  // Eysturoy
  { id: "skalafjordur-west", at: [-6.79, 62.185], text: "Northern part of fjord scenic but quite busy for a narrow road", anchor: "right" },
  { id: "skalafjordur-east", at: [-6.735, 62.15], text: "Relatively flat route", anchor: "left" },
  { id: "selatrad", at: [-6.83, 62.195], text: "Scenic ride to nowhere", anchor: "right" },
  { id: "windfarm", at: [-6.70, 62.10], text: "Windfarm and view point", anchor: "left" },
  // Streymoy
  { id: "sev", at: [-7.135, 62.165], text: "SEV hydro station service roads: wild, steep, tranquil", anchor: "right" },
  { id: "vestmannavegur", at: [-7.09, 62.125], text: "Beautiful and exciting, but northern section unsheltered from traffic and wind", anchor: "right" },
  { id: "gravel", at: [-7.03, 62.105], text: "Gravel road", anchor: "top" },
  { id: "oyrargjogv", at: [-7.05, 62.09], text: "Tranquil road to former ferry pier", anchor: "right" },
  { id: "leynavatn", at: [-7.01, 62.125], text: "Piece of former highway, now quiet lakeside", anchor: "bottom" },
  { id: "skaelingur", at: [-7.045, 62.115], text: "Steep climb, unique vistas", anchor: "bottom" },
  { id: "oyggjarvegur", at: [-6.865, 62.05], text: "Oyggjarvegurin ridge road is very scenic and quiet, yet often shrouded in clouds or battered by wind", anchor: "right" },
  { id: "nordradalur", at: [-6.935, 62.035], text: "Scenic ride to nowhere", anchor: "right" },
  { id: "park", at: [-6.785, 62.015], text: "Park area with good bikepaths", anchor: "left" },
  { id: "mtb", at: [-6.765, 62.03], text: "MTB track", anchor: "right" },
  { id: "nolsoy", at: [-6.655, 61.99], text: "Bringing a bike is possible but makes little practical sense", anchor: "left" },
  { id: "hestur", at: [-6.885, 61.955], text: "Bringing a bike is possible but makes little practical sense", anchor: "top" },
  // Vágar and Mykines
  { id: "gasadalur-tunnel", at: [-7.41, 62.10], text: "Tunnel 1.4 km, single lane, lit. Precautions: see Kalsoy tunnels.", refTunnel: "D", anchor: "bottom" },
  { id: "mykines", at: [-7.55, 62.09], text: "Bikes not accepted", anchor: "top" },
  // Sandoy and Skúgvoy
  { id: "sandoy", at: [-6.73, 61.88], text: "Sandoy is relatively flat and makes for fantastic pedalling. Bringing your bike to the island requires other transport.", anchor: "left" },
  { id: "skarvanes", at: [-6.80, 61.80], text: "Scenic ride to nowhere", anchor: "top" },
  { id: "skalavik", at: [-6.66, 61.83], text: "Scenic ride to nowhere", anchor: "left" },
  { id: "dalur", at: [-6.68, 61.79], text: "Scenic old cliffside road soon to be replaced by tunnel", anchor: "left", dated: true },
  { id: "skuvoy", at: [-6.80, 61.77], text: "Skúgvoy has no roads or paths suitable for bikes", anchor: "top" },
  // Suðuroy
  { id: "hvalba-tunnel", at: [-6.93, 61.60], text: "Tunnel is unlit, single lane and constructed on an incline. For precautions, see Kalsoy tunnels.", refTunnel: "D", anchor: "left" },
  { id: "hvalba-old-tunnel", at: [-6.90, 61.575], text: "The old tunnel is fenced off for all traffic. The access roads, now turned into cul-de-sacs, make for tranquil exploring.", anchor: "right" },
  { id: "sandvik", at: [-6.955, 61.595], text: "Exciting profile and landscape, windy. Calm traffic. Tunnel opens mid-2025.", anchor: "right", dated: true },
  { id: "famjin", at: [-6.88, 61.53], text: "Scenic ride to nowhere", anchor: "right" },
  { id: "hov", at: [-6.77, 61.51], text: "Former cliffside highway now rarely used, exciting ascends", anchor: "left" },
  { id: "vagur", at: [-6.81, 61.47], text: "Scenic rides to nowhere", anchor: "right" },
  { id: "hestin", at: [-6.72, 61.425], text: "Um Hestin: steep, hairpins, single lane, often fog. The tunnel route is a bike-friendly alternative.", anchor: "right" },
  { id: "sumba", at: [-6.71, 61.40], text: "Scenic ride to nowhere", anchor: "left" },
];
