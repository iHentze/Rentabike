import type { LngLat } from "./types";

/**
 * The 2025 print as a picture over the map, for checking the redrawn roads
 * against the original. `corners` are the map coordinates of the image's
 * four corners: top-left, top-right, bottom-right, bottom-left. Tune them
 * until the coastlines line up; the picture is not a true projection, so a
 * small misfit at the edges is expected.
 */
export const PRINT_OVERLAY = {
  /** The 1707×2048 export of the print, public/map/print-2025.webp. */
  available: true,
  url: "/map/print-2025.webp",
  corners: [
    // Fitted from thirteen villages read off the print; good to a kilometre or two.
    [-7.8999, 62.4181],
    [-6.1826, 62.4121],
    [-6.1394, 61.3721],
    [-7.8567, 61.3781],
  ] as [LngLat, LngLat, LngLat, LngLat],
  opacity: 0.65,
};
