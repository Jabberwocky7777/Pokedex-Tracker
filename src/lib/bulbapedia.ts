/**
 * "View map on Bulbapedia" in Routes: the Bulbapedia page for an encounter area.
 * Only a link — map images are Nintendo's art and are never embedded or hot-linked.
 *
 * Bulbapedia names numbered routes with their region ("Kanto Route 1",
 * "Johto Route 29", "Hoenn Route 101", "Sinnoh Route 201"; sea routes too:
 * "Sinnoh Route 230"), and places by their own name ("Eterna Forest",
 * "Mt. Coronet", "Cave of Origin"), with the region in brackets where several
 * share a name ("Victory Road (Sinnoh)"). An area is part of a place (a floor, a
 * room, a side of a route), so the link goes to the place's page.
 *
 * Routes and the names below are checked page titles and link straight to them.
 * Every other place is derived from its name and links through Bulbapedia's
 * search with "go", which opens the page when the title (or a redirect) exists
 * and shows search results when it doesn't — so a near miss still lands nearby.
 */
import { areaDisplayName } from "./area-names";

export type Region = "Kanto" | "Johto" | "Hoenn" | "Sinnoh";

const WIKI = "https://bulbapedia.bulbagarden.net/wiki/";
const SEARCH = "https://bulbapedia.bulbagarden.net/w/index.php?title=Special:Search&go=Go&search=";

/** Places whose Bulbapedia page isn't simply their name. Keyed by the tidied base name. */
const OVERRIDES: Record<string, string | ((region: Region | null) => string)> = {
  "Victory Road": (r) => `Victory Road (${r === "Johto" ? "Kanto" : r ?? "Kanto"})`,
  "Safari Zone": (r) => `${r === "Johto" ? "Johto" : r === "Hoenn" ? "Hoenn" : "Kanto"} Safari Zone`,
  "Safari Zone Gate": "Johto Safari Zone",
  "Pokémon League": (r) => `Pokémon League (${r ?? "Kanto"})`,
  "Desert Tomb": "Desert Ruins",
  "Celadon City Prize Corner": "Celadon Game Corner",
  "Goldenrod City Department Store": "Goldenrod City Department Store",
  "Saffron City Silph Co": "Silph Co.",
  "Cinnabar Island Cinnabar Lab": "Pokémon Research Lab",
  "Ss Anne": "S.S. Anne",
  "Digletts Cave": "Diglett's Cave",
  "Dragons Den": "Dragon's Den",
  "Team Rocket Hq": (r) => (r === "Kanto" ? "Rocket Hideout" : "Team Rocket HQ"),
};

/** Names that are already a place, though they end like an area ("… Entrance") */
const PLACES = new Set(["Canyon Entrance"]);

/** Areas with no place to show: the roaming lists and the game's own catch-alls. */
const NO_PAGE = /^(Roaming\b|Unknown\b|Pok[eé]center$|Pok[eé]mart$)/;

/**
 * Rewrites from an area's name to its place's name, tried in order. Each takes
 * off what follows the place: floors, rooms, sides, tides, buildings in a town.
 */
const TO_PLACE: [RegExp, string][] = [
  [/\s+B?\d+F\b.*$/, ""],                                    // Mt. Coronet 1F Route 211, Iron Island B1F Left
  [/\s+Area \d+.*$/, ""],                                     // Great Marsh Area 1
  [/\s+(Before|After) Pillar \d+$/, ""],                      // Turnback Cave Before Pillar 1
  [/\s+(Room|Pillar) \d+.*$/, ""],                            // Lost Cave Room 2, Turnback Cave Pillar 3
  [/\s+Between Pillars.*$/, ""],
  [/\s+(Before|After) Galactic Intervention$/, ""],           // Lake Verity
  [/\s+(High|Low) Tide$/, ""],                                // Shoal Cave
  [/\s+\d+(\s+\d+)?(\s+Plus)?\s+Different Unown Caught$/, ""], // Ruin Maniac Cave 0 9 Different Unown Caught
  [/\s+(Entrance|Exterior\b.*|Interior(?: [A-Z])?|Inside(?: Exit)?|Outside|Summit|Top|Mountainside|Waterfall|Back(?:small Room)?|Small Room|Upper Cave|Lower Cave|Dining Room|Cave Behind Team Rocket|Item Rooms|Mt\. Moon Square)$/, ""],
  [/^(Mt\. Ember) Cave$/, "$1"],
  [/^(Dark Cave) .*$/, "$1"],                                 // Dark Cave Violet City Entrance
  [/^(Victory Road)\b.*$/, "$1"],                             // Victory Road 1 3F (Kanto, in HG/SS)
  [/^(Safari Zone)\s+(?!Gate$).*$/, "$1"],                    // the Safari Zones' own areas
  [/^(Hall of Origin|Altering Cave)\s+\S+$/, "$1"],           // Hall of Origin 1, Altering Cave A
];

/** A building or spot inside a town is shown on the town's page */
const IN_TOWN = /^(.+? (?:City|Town|Island))\s+.+$/;

/** The region an area belongs to: from its slug, a route number, or its games. */
export function regionOf(slug: string, games: readonly string[]): Region | null {
  const prefix = slug.match(/^(kanto|johto|hoenn|sinnoh)-/)?.[1];
  if (prefix) return (prefix.charAt(0).toUpperCase() + prefix.slice(1)) as Region;
  if (games.some((g) => ["diamond", "pearl", "platinum"].includes(g))) return "Sinnoh";
  if (games.some((g) => ["ruby", "sapphire", "emerald"].includes(g))) return "Hoenn";
  if (games.some((g) => ["heartgold", "soulsilver"].includes(g))) return "Johto";
  if (games.some((g) => ["firered", "leafgreen"].includes(g))) return "Kanto";
  return null;
}

function routeRegion(n: number): Region | null {
  if (n >= 1 && n <= 28) return "Kanto";
  if (n >= 29 && n <= 48) return "Johto";
  if (n >= 101 && n <= 134) return "Hoenn";
  if (n >= 201 && n <= 230) return "Sinnoh";
  return null;
}

const wikiUrl = (title: string) => WIKI + encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":");

/** The place an area belongs to, as Bulbapedia names it, and whether that title is checked. */
export function bulbapediaPage(area: { slug: string; name: string; games: readonly string[] }): { title: string; checked: boolean } | null {
  const tidy = areaDisplayName(area.name).replace(/\bPokemon\b/g, "Pokémon");
  if (NO_PAGE.test(tidy)) return null;

  // A numbered route, or an area named after one ("Route 4 Pokémon Center", "Iceberg Ruins (Route 216)")
  const route = tidy.match(/^(?:Sea )?Route (\d+)\b/) ?? tidy.match(/\((?:Sea )?Route (\d+)\)/);
  if (route) {
    const n = Number(route[1]);
    const region = routeRegion(n) ?? regionOf(area.slug, area.games);
    if (region) return { title: `${region} Route ${n}`, checked: true };
  }

  let base = tidy.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (!PLACES.has(base)) for (const [pattern, replacement] of TO_PLACE) base = base.replace(pattern, replacement).trim();
  if (!OVERRIDES[base]) base = base.replace(IN_TOWN, "$1");

  const override = OVERRIDES[base];
  if (override) {
    return { title: typeof override === "function" ? override(regionOf(area.slug, area.games)) : override, checked: true };
  }
  return { title: base, checked: false };
}

/** The link: straight to a checked title, through Bulbapedia's "go" search otherwise. Null when there's no place. */
export function bulbapediaUrl(area: { slug: string; name: string; games: readonly string[] }): string | null {
  const page = bulbapediaPage(area);
  if (!page) return null;
  return page.checked ? wikiUrl(page.title) : SEARCH + encodeURIComponent(page.title);
}
