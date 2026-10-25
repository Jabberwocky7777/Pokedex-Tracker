/**
 * English move names, keyed by PokéAPI slug. The one place a slug becomes a
 * name: the names come from save-tables.json (generated from PokéAPI's CSVs),
 * so "u-turn" is "U-turn" and "will-o-wisp" is "Will-O-Wisp" rather than a
 * guess made from the slug.
 */
import { moves } from "../data/save-tables.json";

/** "Wake-Up Slap" → "wake-up-slap", the way PokéAPI builds its identifiers. */
function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/['’.]/g, "").replace(/\s+/g, "-");
}

// Slugs that don't follow from the English name
const OTHER_SLUGS: Record<string, string> = {
  "vice-grip": "Vise Grip", // PokéAPI's identifier before it was respelled
};

const NAME_BY_SLUG = new Map<string, string>([
  ...moves.filter(Boolean).map((name): [string, string] => [nameToSlug(name), name]),
  ...Object.entries(OTHER_SLUGS),
]);

/** The slug PokéAPI would give the move's English name — the same slug for all but a few respelled moves. */
export function englishSlug(slug: string): string {
  return nameToSlug(moveDisplayName(slug));
}

/** The move's English name, or a capitalised version of the slug for a move the table doesn't have. */
export function moveDisplayName(slug: string): string {
  return NAME_BY_SLUG.get(slug)
    ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
