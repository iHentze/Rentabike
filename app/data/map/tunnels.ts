import type { TunnelInfo } from "./types";

/**
 * "Special tunnels" A–G, as printed on the 2025 map. The text is the
 * author's; keep it as written. `aliases` are the names OSM gives the
 * tunnels, where they differ.
 */
export const TUNNELS: TunnelInfo[] = [
  {
    letter: "A",
    name: "Vágatunnilin",
    lengthKm: 4.9,
    profile: "W–E profile +43 to −105 to +11 m",
    status: "open",
    cycling: "Open to cyclists, but unpleasant and often unsafe. Poor ventilation, steep towards the ends, speeding traffic, sometimes busy in connection with flights at Vágar Airport.",
    bus: "SSL 300. Stops in Tórshavn, Kollafj. Tunnil, Effo, Leynar, Fútaklett, Sandavágur, Giljanes, Miðvágur, Vatnsoyrar, Airport, Sørvágur. Can be busy in connection with flights at Vágar Airport. To avoid lack of space in the luggage hold, embark at the first stop or consider an airport taxi shuttle.",
    at: [-7.04, 62.083],
  },
  {
    letter: "B",
    name: "Norðskálatunnilin",
    lengthKm: 2.5,
    profile: "W–E profile +192 to +135 m",
    status: "open",
    cycling: "Open to cyclists. With appropriate precautions generally safe. The approaches are steep.",
    bus: "SSL 400. Stops in Tórshavn, Kollafj. Tunnil, all villages en route, Oyrarbakki, road junctions in Millum Fjarða valley, Skálafj., Effo, Søldarfj., Klaksvík. Alternatively, cycle to Strendur or Runavík and take SSL 450 or 401 to Tórshavn.",
    at: [-6.985, 62.205],
  },
  {
    letter: "C",
    name: "Norðoyatunnilin",
    lengthKm: 6.2,
    profile: "W–E profile +20 to −150 to +10 m",
    status: "open",
    cycling: "Open to cyclists, but not recommended. Unpleasant and often unsafe. Poor air quality, steep towards the ends, speeding traffic, busy in the rush hour. Easy to underestimate in length.",
    bus: "SSL 400, 401, 410. Stops in Klaksvík, Leirvík, Norðragøta. SSL 410 often operated by minibus, not accepting bikes.",
    at: [-6.66, 62.24],
  },
  {
    letter: "D",
    name: "Kalsoy tunnels",
    lengthKm: 5.2,
    profile: "Húsar–Mikladalur 3 tunnels totalling 3.0 km, profile S–N +50 to +173 m. Mikladalur–Trøllanes 2.2 km, S–N +149 to +185 m.",
    status: "open",
    cycling: "Suitable and safe for cyclists with due precaution. Tunnels are single laned and unlit. Yield in lay-bys to all other traffic, also from behind. Mount powerful head and rear light. Wear high-visibility vests. Do not wear headphones. Tunnels are constructed at an incline (magnetic hill effect). Unique experience.",
    bus: "SSL 506 does in principle not accept bikes.",
    aliases: ["Húsatunnilin", "Ritudalstunnilin", "Mikladalstunnilin", "Trøllanestunnilin", "Villingardalstunnilin", "Teigatunnilin"],
    at: [-6.74, 62.30],
  },
  {
    letter: "E",
    name: "Eysturoyartunnilin",
    lengthKm: 11.3,
    status: "closed",
    cycling: "Closed for cyclists. CCTV is closely monitored and cyclists will get arrested.",
    bus: "SSL 450 Tórshavn, Strendur and Runavík. SSL 401 Tórshavn, Runavík, Søldarfj., Norðragøta, Klaksvík. SSL 400 Tórshavn, Kollafj., Oyrarbakki, Skálafj., Effo, Søldarfj., Norðragøta, Klaksvík.",
    at: [-6.80, 62.10],
  },
  {
    letter: "F",
    name: "Kollafjarðartunnilin",
    aliases: ["Kollfjarðartunnilin"],
    lengthKm: 2.8,
    profile: "Profile S–N +49 to +74 m",
    status: "open",
    cycling: "Open to cyclists. This tunnel is part of the country's busiest artery, subject to bumper-to-bumper traffic in the rush hour and speeding.",
    bus: "SSL 100, 300, 350, 400. Stops: Tórshavn, Kollafj. Tunnil. SSL 100, 300, 350 branch off westward via Effo. SSL 400 eastward via highway that bypasses village, stopping in SW, at church and N. í Sundum. Note that buses run a non-stop express service between Hoyvík and Kollafj. Tunnel bus stop, with no stops at Kaldbaksbotnur and Hvítanes. The free municipal buses (Bussleiðin 5, 6, 7) do stop here, but don't take bicycles.",
    at: [-6.875, 62.095],
  },
  {
    letter: "G",
    name: "Sandoyartunnilin",
    lengthKm: 10.8,
    status: "closed",
    cycling: "Closed for cyclists. CCTV is closely monitored and cyclists will get arrested.",
    bus: "SSL 650 stops in Tórshavn, Norðasta Horni, Velbastaður junction, Gamlarætt, Inni í Dal, Sandur. High chance of hitching a ride at entrances.",
    at: [-6.83, 61.98],
  },
];
