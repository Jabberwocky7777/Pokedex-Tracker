// Great Marsh daily Pokémon (binoculars rotation mechanic).
// The daily pool itself comes from pokemon.json: fetch-data.ts collapses PokéAPI's
// great-marsh-daily-slot rows into one "great-marsh" location with method "safari".
// This file supplements it with a few extras entered by hand before PokéAPI had
// that data. NOTE: PokéAPI's ROM-derived pool does not list Bonsly, Mime Jr. or
// Munchlax in the Great Marsh — these entries are unverified and worth re-checking.

export type MarshGame = "diamond" | "pearl" | "platinum";

export interface ExtraMarshPokemon {
  id: number;
  games: MarshGame[];
  /** Approximate encounter rate during daily rotation, as a percentage */
  chance: number;
}

// Verified missing from PokéAPI Great Marsh data:
export const GREAT_MARSH_EXTRA_DAILY: ExtraMarshPokemon[] = [
  { id: 115, games: ["diamond", "pearl"],              chance: 10 }, // Kangaskhan
  { id: 438, games: ["diamond", "pearl", "platinum"],  chance: 10 }, // Bonsly
  { id: 439, games: ["diamond", "pearl", "platinum"],  chance: 10 }, // Mime Jr.
  { id: 446, games: ["diamond", "pearl", "platinum"],  chance: 5  }, // Munchlax
];

// These Pokémon appear only in the Great Marsh via daily rotation (safari method,
// locationAreaSlug "great-marsh" with no area number) — they are NOT area-specific.
// Use this slug to detect the daily pool in encounter data.
export const GREAT_MARSH_DAILY_SLUG = "great-marsh";
export const GREAT_MARSH_AREA_SLUGS = [1, 2, 3, 4, 5, 6].map((n) => `great-marsh-area-${n}`);
export const GREAT_MARSH_ALL_SLUGS = [GREAT_MARSH_DAILY_SLUG, ...GREAT_MARSH_AREA_SLUGS];

export function isGreatMarshSlug(slug: string): boolean {
  return GREAT_MARSH_ALL_SLUGS.includes(slug);
}
