import type { LoopInfo } from "./types";

/** The rides the print names in circles. Which roads they follow is in scripts/map/classification.ts. */
export const LOOPS: LoopInfo[] = [
  {
    id: "northern-eysturoy",
    name: "Northern Eysturoy Loop",
    description: "Eiði, Gjógv and Funningur in one ride: the Sóljuleið buttercup route around the north of Eysturoy, with the country's highest mountains for company and a long descent into Funningsfjørður.",
    color: "#e8862b",
    at: [-6.98, 62.28],
  },
  {
    id: "great-central",
    name: "Great Central Loop",
    description: "Tórshavn to Skálafjørður the quiet way: the old Kaldbak road, Kollafjørður, the Sundini bridge and the west shore of the fjord to Strendur. Back to town on the SSL 450 bus through the Eysturoy tunnel, which does not take cyclists.",
    includesBus: true,
    color: "#2a9d8f",
    at: [-6.88, 62.13],
  },
  {
    id: "kirkjubour",
    name: "Kirkjubøur Loop",
    description: "Out over the hill to Velbastaður, down to the medieval church at Kirkjubøur and back along the sound. Short, paved, and the first ride most people take from the shop.",
    color: "#8e5aa6",
    at: [-6.78, 61.97],
    tourSlugs: ["historical-kirkjubour"],
  },
  {
    id: "sornfelli",
    name: "Mount Sornfelli",
    description: "The paved road up to the old radar station on Sornfelli, 749 m above the sea, from the pass at Norðradalsskarð. Steep, exposed, and the biggest view on Streymoy.",
    color: "#c2453a",
    at: [-6.94, 62.06],
    tourSlugs: ["westward-journey"],
  },
];
