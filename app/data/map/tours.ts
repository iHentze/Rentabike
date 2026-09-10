import type { TourLink } from "./types";

/**
 * Our guided tours drawn on the map. Which roads each follows is in
 * scripts/map/classification.ts (TOUR_ROUTES); here is where the map flies
 * when a tour is picked. Slugs match scripts/tours-data.ts.
 */
export const TOUR_LINKS: TourLink[] = [
  { slug: "historical-kirkjubour", at: [-6.815, 61.975], zoom: 11.6 },
  { slug: "viewpoint-nordadalsskard", at: [-6.87, 62.03], zoom: 11.6 },
  { slug: "westward-journey", at: [-6.9, 62.05], zoom: 11.2 },
  { slug: "clifftop-bliss-sandoy", at: [-6.76, 61.84], zoom: 11.4 },
];
