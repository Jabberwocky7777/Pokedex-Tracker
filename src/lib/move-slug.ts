/**
 * A move's name as the games or Battle Tower sets write it → PokéAPI's slug.
 * Pure string work, no move data, so it can be imported from anywhere without
 * pulling in the move tables. (Spelling notes are in lib/move-lookup.ts.)
 */

/** Generation IV spelling (as a slug) → PokéAPI's slug. */
const GEN4_SPELLINGS: Record<string, string> = {
  "hi-jump-kick": "high-jump-kick",
  "faint-attack": "feint-attack",
  "selfdestruct": "self-destruct",
  "softboiled": "soft-boiled",
  "smoke-screen": "smokescreen",
  "vice-grip": "vise-grip",
  "smelling-salt": "smelling-salts",
};

/** Convert a move display name to a PokéAPI slug. */
export function moveNameToSlug(name: string): string {
  const slug = (
    name
      // camelCase → hyphenated  ("GrassWhistle" → "Grass-Whistle")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // Remove apostrophes  ("King's Rock" → "Kings Rock")
      .replace(/'/g, "")
      // Spaces → hyphens
      .replace(/\s+/g, "-")
      .toLowerCase()
      // Collapse consecutive hyphens
      .replace(/-+/g, "-")
      .trim()
  );
  return GEN4_SPELLINGS[slug] ?? slug;
}
