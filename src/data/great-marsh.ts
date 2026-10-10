// Great Marsh daily Pokémon (binoculars rotation mechanic).
// The daily pool comes from pokemon.json: fetch-data.ts collapses PokéAPI's
// great-marsh-daily-slot rows into one "great-marsh" location with method "safari".

// The daily pool has no area number; the six areas have their own slugs.
const GREAT_MARSH_DAILY_SLUG = "great-marsh";
const GREAT_MARSH_AREA_SLUGS = [1, 2, 3, 4, 5, 6].map((n) => `great-marsh-area-${n}`);
const GREAT_MARSH_ALL_SLUGS = [GREAT_MARSH_DAILY_SLUG, ...GREAT_MARSH_AREA_SLUGS];

export function isGreatMarshSlug(slug: string): boolean {
  return GREAT_MARSH_ALL_SLUGS.includes(slug);
}
