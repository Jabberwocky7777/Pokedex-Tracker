// HGSS overworld map point data for Leaflet imageOverlay approach.
// Map image: public/maps/hgss-johto-kanto.png — 1200×481 px
// Source image: github.com/stef-timmermans/poke-router-hgss (MIT)
//
// Coordinate system: (x, y) pixel positions on the PNG, (0,0) = top-left.
// Leaflet mapping: L.latLng(-y, x) in CRS.Simple.
//
// Confirmed anchors (from poke-router-hgss/src/data/locations.json):
//   New Bark Town:  [[530,342],[563,380]] → center (546, 361)
//   Route 29:       [[457,348],[529,374]] → center (493, 361)
// All others derived by visual inspection of the PNG.

export interface HGSSMapPoint {
  name: string;
  slug: string | null;   // null = no encounter data (unclickable label only)
  region: "johto" | "kanto";
  x: number;             // pixel X on hgss-johto-kanto.png
  y: number;             // pixel Y on hgss-johto-kanto.png
}

export const IMG_W = 1200;
export const IMG_H = 481;

// ── Johto ──────────────────────────────────────────────────────────────────────

const JOHTO_POINTS: HGSSMapPoint[] = [
  // Cities / towns
  { name: "New Bark Town",    slug: "new-bark-town-area",       region: "johto", x: 546, y: 361 },
  { name: "Cherrygrove City", slug: "cherrygrove-city-area",    region: "johto", x: 441, y: 358 },
  { name: "Violet City",      slug: "violet-city-area",         region: "johto", x: 441, y: 265 },
  { name: "Azalea Town",      slug: null,                        region: "johto", x: 406, y: 396 },
  { name: "Goldenrod City",   slug: null,                        region: "johto", x: 250, y: 285 },
  { name: "Ecruteak City",    slug: "ecruteak-city-area",        region: "johto", x: 332, y: 254 },
  { name: "Olivine City",     slug: "olivine-city-area",         region: "johto", x: 94,  y: 305 },
  { name: "Cianwood City",    slug: "cianwood-city-area",        region: "johto", x: 80,  y: 363 },
  { name: "Mahogany Town",    slug: null,                        region: "johto", x: 480, y: 243 },
  { name: "Blackthorn City",  slug: "blackthorn-city-area",      region: "johto", x: 494, y: 207 },

  // Routes
  { name: "Route 29",  slug: "johto-route-29-area",       region: "johto", x: 493, y: 361 },
  { name: "Route 30",  slug: "johto-route-30-area",       region: "johto", x: 441, y: 325 },
  { name: "Route 31",  slug: "johto-route-31-area",       region: "johto", x: 441, y: 298 },
  { name: "Route 32",  slug: "johto-route-32-area",       region: "johto", x: 453, y: 335 },
  { name: "Route 33",  slug: "johto-route-33-area",       region: "johto", x: 424, y: 390 },
  { name: "Route 34",  slug: "johto-route-34-area",       region: "johto", x: 250, y: 340 },
  { name: "Route 35",  slug: "johto-route-35-area",       region: "johto", x: 302, y: 235 },
  { name: "Route 36",  slug: "johto-route-36-area",       region: "johto", x: 376, y: 237 },
  { name: "Route 37",  slug: "johto-route-37-area",       region: "johto", x: 332, y: 270 },
  { name: "Route 38",  slug: "johto-route-38-area",       region: "johto", x: 225, y: 263 },
  { name: "Route 39",  slug: "johto-route-39-area",       region: "johto", x: 144, y: 282 },
  { name: "Route 40",  slug: "johto-sea-route-40-area",   region: "johto", x: 85,  y: 345 },
  { name: "Route 41",  slug: "johto-sea-route-41-area",   region: "johto", x: 80,  y: 390 },
  { name: "Route 42",  slug: "johto-route-42-area",       region: "johto", x: 415, y: 256 },
  { name: "Route 43",  slug: "johto-route-43-area",       region: "johto", x: 471, y: 228 },
  { name: "Route 44",  slug: "johto-route-44-area",       region: "johto", x: 459, y: 250 },
  { name: "Route 45",  slug: "johto-route-45-area",       region: "johto", x: 467, y: 300 },
  { name: "Route 46",  slug: "johto-route-46-area",       region: "johto", x: 478, y: 348 },
  { name: "Route 47",  slug: "johto-route-47-area",       region: "johto", x: 108, y: 318 },
  { name: "Route 48",  slug: "johto-route-48-area",       region: "johto", x: 134, y: 276 },

  // Natural areas
  { name: "National Park",   slug: "national-park-area",        region: "johto", x: 347, y: 92  },
  { name: "Ilex Forest",     slug: "ilex-forest-area",          region: "johto", x: 358, y: 378 },
  { name: "Lake of Rage",    slug: "lake-of-rage-area",         region: "johto", x: 474, y: 210 },
  { name: "Ruins of Alph",   slug: "ruins-of-alph-outside",     region: "johto", x: 432, y: 308 },
  { name: "Tohjo Falls",     slug: "tohjo-falls-area",          region: "johto", x: 543, y: 344 },
  { name: "Embedded Tower",  slug: "embedded-tower",            region: "johto", x: 72,  y: 358 },

  // Caves & dungeons (one marker per dungeon at the entrance floor)
  { name: "Dark Cave",       slug: "dark-cave-violet-city-entrance",      region: "johto", x: 436, y: 254 },
  { name: "Union Cave",      slug: "union-cave-1f",                        region: "johto", x: 446, y: 362 },
  { name: "Slowpoke Well",   slug: "slowpoke-well-1f",                     region: "johto", x: 406, y: 408 },
  { name: "Mt. Mortar",      slug: "mt-mortar-1f",                         region: "johto", x: 448, y: 218 },
  { name: "Ice Path",        slug: "ice-path-1f",                          region: "johto", x: 500, y: 222 },
  { name: "Dragon's Den",    slug: "dragons-den-area",                     region: "johto", x: 494, y: 216 },
  { name: "Whirl Islands",   slug: "whirl-islands-1f",                     region: "johto", x: 90,  y: 397 },

  // Towers / buildings
  { name: "Sprout Tower",    slug: "sprout-tower-2f",    region: "johto", x: 444, y: 256 },
  { name: "Bell Tower",      slug: "bell-tower-2f",      region: "johto", x: 332, y: 247 },
  { name: "Burned Tower",    slug: "burned-tower-1f",    region: "johto", x: 338, y: 259 },
  { name: "Team Rocket HQ",  slug: "team-rocket-hq-area",region: "johto", x: 480, y: 245 },

  // Safari Zone sub-zones (clustered near Route 47, far west)
  { name: "Safari Zone (Desert)",     slug: "johto-safari-zone-zone-desert",     region: "johto", x: 52,  y: 268 },
  { name: "Safari Zone (Forest)",     slug: "johto-safari-zone-zone-forest",     region: "johto", x: 66,  y: 268 },
  { name: "Safari Zone (Marshland)",  slug: "johto-safari-zone-zone-marshland",  region: "johto", x: 80,  y: 268 },
  { name: "Safari Zone (Meadow)",     slug: "johto-safari-zone-zone-meadow",     region: "johto", x: 52,  y: 280 },
  { name: "Safari Zone (Mountain)",   slug: "johto-safari-zone-zone-mountain",   region: "johto", x: 66,  y: 280 },
  { name: "Safari Zone (Peak)",       slug: "johto-safari-zone-zone-peak",       region: "johto", x: 80,  y: 280 },
  { name: "Safari Zone (Plains)",     slug: "johto-safari-zone-zone-plains",     region: "johto", x: 52,  y: 292 },
  { name: "Safari Zone (Rocky Beach)",slug: "johto-safari-zone-zone-rocky-beach",region: "johto", x: 66,  y: 292 },
  { name: "Safari Zone (Savannah)",   slug: "johto-safari-zone-zone-savannah",   region: "johto", x: 80,  y: 292 },
  { name: "Safari Zone (Swamp)",      slug: "johto-safari-zone-zone-swamp",      region: "johto", x: 52,  y: 304 },
  { name: "Safari Zone (Wasteland)",  slug: "johto-safari-zone-zone-wasteland",  region: "johto", x: 66,  y: 304 },
  { name: "Safari Zone (Wetland)",    slug: "johto-safari-zone-zone-wetland",    region: "johto", x: 80,  y: 304 },
];

// ── Kanto ──────────────────────────────────────────────────────────────────────

const KANTO_POINTS: HGSSMapPoint[] = [
  // Cities / towns
  { name: "Pallet Town",     slug: "pallet-town-area",      region: "kanto", x: 638, y: 403 },
  { name: "Viridian City",   slug: "viridian-city-area",    region: "kanto", x: 638, y: 363 },
  { name: "Pewter City",     slug: null,                     region: "kanto", x: 638, y: 247 },
  { name: "Cerulean City",   slug: "cerulean-city-area",    region: "kanto", x: 778, y: 206 },
  { name: "Vermilion City",  slug: "vermilion-city-area",   region: "kanto", x: 754, y: 362 },
  { name: "Lavender Town",   slug: null,                     region: "kanto", x: 900, y: 268 },
  { name: "Celadon City",    slug: "celadon-city-area",     region: "kanto", x: 728, y: 290 },
  { name: "Fuchsia City",    slug: "fuchsia-city-area",     region: "kanto", x: 710, y: 380 },
  { name: "Saffron City",    slug: null,                     region: "kanto", x: 808, y: 290 },
  { name: "Cinnabar Island", slug: "cinnabar-island-area",  region: "kanto", x: 638, y: 445 },

  // Border routes (geographically between Johto & Kanto, use kanto slugs)
  { name: "Route 26", slug: "kanto-route-26-area", region: "kanto", x: 572, y: 312 },
  { name: "Route 27", slug: "kanto-route-27-area", region: "kanto", x: 557, y: 336 },
  { name: "Route 28", slug: "kanto-route-28-area", region: "kanto", x: 542, y: 318 },

  // Main Kanto routes
  { name: "Route 1",    slug: "kanto-route-1-area",                           region: "kanto", x: 638, y: 384 },
  { name: "Route 2 S",  slug: "kanto-route-2-south-towards-viridian-city",    region: "kanto", x: 638, y: 322 },
  { name: "Route 2 N",  slug: "kanto-route-2-north-towards-pewter-city",      region: "kanto", x: 638, y: 292 },
  { name: "Route 3",    slug: "kanto-route-3-area",   region: "kanto", x: 680, y: 247 },
  { name: "Route 4",    slug: "kanto-route-4-area",   region: "kanto", x: 744, y: 233 },
  { name: "Route 5",    slug: "kanto-route-5-area",   region: "kanto", x: 778, y: 252 },
  { name: "Route 6",    slug: "kanto-route-6-area",   region: "kanto", x: 778, y: 325 },
  { name: "Route 7",    slug: "kanto-route-7-area",   region: "kanto", x: 760, y: 290 },
  { name: "Route 8",    slug: "kanto-route-8-area",   region: "kanto", x: 855, y: 290 },
  { name: "Route 9",    slug: "kanto-route-9-area",   region: "kanto", x: 827, y: 240 },
  { name: "Route 10",   slug: "kanto-route-10-area",  region: "kanto", x: 858, y: 256 },
  { name: "Route 11",   slug: "kanto-route-11-area",  region: "kanto", x: 858, y: 356 },
  { name: "Route 12",   slug: "kanto-route-12-area",  region: "kanto", x: 900, y: 325 },
  { name: "Route 13",   slug: "kanto-route-13-area",  region: "kanto", x: 878, y: 368 },
  { name: "Route 14",   slug: "kanto-route-14-area",  region: "kanto", x: 848, y: 382 },
  { name: "Route 15",   slug: "kanto-route-15-area",  region: "kanto", x: 808, y: 376 },
  { name: "Route 16",   slug: "kanto-route-16-area",  region: "kanto", x: 694, y: 308 },
  { name: "Route 17",   slug: "kanto-route-17-area",  region: "kanto", x: 694, y: 344 },
  { name: "Route 18",   slug: "kanto-route-18-area",  region: "kanto", x: 710, y: 366 },
  { name: "Route 19",   slug: "kanto-sea-route-19-area", region: "kanto", x: 710, y: 408 },
  { name: "Route 20",   slug: "kanto-sea-route-20-area", region: "kanto", x: 750, y: 432 },
  { name: "Route 21",   slug: "kanto-sea-route-21-area", region: "kanto", x: 638, y: 424 },
  { name: "Route 22",   slug: "kanto-route-22-area",  region: "kanto", x: 610, y: 352 },
  { name: "Route 24",   slug: "kanto-route-24-area",  region: "kanto", x: 778, y: 184 },
  { name: "Route 25",   slug: "kanto-route-25-area",  region: "kanto", x: 818, y: 176 },

  // Natural areas
  { name: "Viridian Forest", slug: "viridian-forest-area", region: "kanto", x: 638, y: 306 },
  { name: "Diglett's Cave",  slug: "digletts-cave-area",   region: "kanto", x: 674, y: 322 },
  { name: "Power Plant",     slug: "power-plant",           region: "kanto", x: 886, y: 233 },

  // Caves & dungeons
  { name: "Mt. Moon",        slug: "mt-moon-1f",              region: "kanto", x: 714, y: 244 },
  { name: "Rock Tunnel",     slug: "rock-tunnel-1f",          region: "kanto", x: 870, y: 262 },
  { name: "Cerulean Cave",   slug: "cerulean-cave-1f",        region: "kanto", x: 772, y: 200 },
  { name: "Seafoam Islands", slug: "seafoam-islands-1f",      region: "kanto", x: 738, y: 436 },
  { name: "Victory Road",    slug: "kanto-victory-road-1-1f", region: "kanto", x: 620, y: 316 },
  { name: "Mt. Silver",      slug: "mt-silver-outside",       region: "kanto", x: 528, y: 314 },
];

export const HGSS_MAP_POINTS: HGSSMapPoint[] = [...JOHTO_POINTS, ...KANTO_POINTS];
