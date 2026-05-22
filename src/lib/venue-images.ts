/**
 * Static map of venue (Room) code → public image path.
 *
 * Images live under /public/venues/ and are committed to the repo so the app
 * runs without any external CDN. To add a new venue image:
 *   1. Drop the file in /public/venues/ (kebab-case filename)
 *   2. Add a row here keyed by the Room.code
 *   3. (Optional) re-run `npm run db:seed` so the imagePath column is updated
 *
 * The seed script copies these values into Room.imagePath at seed time so the
 * UI can read them straight off the DB. This helper is also used as a
 * fallback by the venue card component for rooms whose imagePath is empty.
 */
export const VENUE_IMAGES: Record<string, string> = {
  // UPC
  TNG: "/venues/town-and-gown.jpg",
  VINEYARD: "/venues/vineyard-and-patio.jpg",
  MORETON: "/venues/moreton-fig-patio.jpg",
  TROJAN: "/venues/trojan-grand-ballroom.jpg",
  FRANKLIN: "/venues/the-franklin-suite.jpg",
  FORUM: "/venues/the-forum.jpg",
  // HSC
  "HSC-CC": "/venues/health-science-conference-center.jpg",
  // UClub
  UCLUB: "/venues/university-club.jpg",
  SCRIPTORIUM: "/venues/scriptorium.jpg",
  // USC Hotel
  "HOTEL-MR": "/venues/usc-hotel-meeting-rooms.jpg",
  "HOTEL-GARDEN": "/venues/usc-hotel-garden.jpg",
  "HOTEL-1880": "/venues/usc-hotel-1880-founders.jpg",
  "HOTEL-GBR": "/venues/usc-hotel-grand-ballroom.png",
  MCKAYS: "/venues/mckays.jpg",
  "THE-LAB": "/venues/the-lab-gastropub.png",
  EDMONDSON: "/venues/the-edmondson.webp",
};

export function venueImageFor(roomCode: string | null | undefined): string | null {
  if (!roomCode) return null;
  return VENUE_IMAGES[roomCode] ?? null;
}
