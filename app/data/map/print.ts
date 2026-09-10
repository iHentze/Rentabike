import type { LngLat } from "./types";

/**
 * The 2025 print as a picture over the map, for checking the redrawn roads
 * against the original. `corners` are the map coordinates of the image's
 * four corners: top-left, top-right, bottom-right, bottom-left. Tune them
 * until the coastlines line up; the picture is not a true projection, so a
 * small misfit at the edges is expected.
 */
export const PRINT_OVERLAY = {
  /** Set true once public/map/print-2025.jpg is in the repo. */
  available: false,
  url: "/map/print-2025.jpg",
  corners: [
    [-7.95, 62.52],
    [-6.02, 62.52],
    [-6.02, 61.32],
    [-7.95, 61.32],
  ] as [LngLat, LngLat, LngLat, LngLat],
  opacity: 0.65,
};
