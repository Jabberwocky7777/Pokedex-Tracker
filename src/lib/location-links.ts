/**
 * Turning a place written as free text ("Mt. Ember (found in cave)", "Route 229")
 * into something the Routes tab can open. TM/HM locations and the daily
 * checklist are hand-written; the encounter areas come from PokéAPI and spell
 * things their own way ("Mt Ember", "Sea Route 226"), so both sides are
 * normalised before they are compared. The Routes search uses the same rule.
 */
import type { Pokemon } from "../types";

/** Lower case, no accents or punctuation, no possessive 's, and "Sea Route" as "Route". */
export function normalizePlace(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsea route\b/g, "route")
    .trim();
}

export interface PlaceArea {
  slug: string;
  name: string;
  /** normalizePlace(name) */
  key: string;
  versions: Set<string>;
}

const areaCache = new WeakMap<readonly Pokemon[], PlaceArea[]>();

/** Every encounter area in the data, built once per loaded pokemon.json. */
export function encounterAreas(allPokemon: readonly Pokemon[]): PlaceArea[] {
  let areas = areaCache.get(allPokemon);
  if (!areas) {
    const bySlug = new Map<string, PlaceArea>();
    for (const pokemon of allPokemon) {
      for (const enc of pokemon.encounters) {
        for (const loc of enc.locations) {
          let area = bySlug.get(loc.locationAreaSlug);
          if (!area) {
            area = { slug: loc.locationAreaSlug, name: loc.locationDisplayName, key: normalizePlace(loc.locationDisplayName), versions: new Set() };
            bySlug.set(area.slug, area);
          }
          area.versions.add(enc.version);
        }
      }
    }
    areas = [...bySlug.values()];
    areaCache.set(allPokemon, areas);
  }
  return areas;
}

/** The place itself, without what follows it: "Mt. Ember (found in cave)" → "Mt. Ember". */
export function placeName(text: string): string {
  return text.split(/[(/,–—]|\s-\s/)[0].trim();
}

export type PlaceTarget =
  /** Exactly one area: open it */
  | { kind: "route"; slug: string }
  /** Several areas (the floors of a cave): open the Routes search for them */
  | { kind: "search"; text: string }
  | null;

/**
 * Where a free-text place leads, looking only at areas that exist in `games`.
 * Areas named exactly like the place win; failing that, areas whose name starts
 * with it as whole words ("Mt. Coronet" → its floors, but "Route 32" never "Route 320").
 * Null when nothing matches — a city, shop or gym with no encounters.
 */
export function resolvePlace(text: string, games: readonly string[], allPokemon: readonly Pokemon[]): PlaceTarget {
  const name = placeName(text);
  const key = normalizePlace(name);
  if (!key) return null;

  const areas = encounterAreas(allPokemon).filter((area) => games.some((g) => area.versions.has(g)));
  const exact = areas.filter((area) => area.key === key);
  const matches = exact.length > 0 ? exact : areas.filter((area) => area.key.startsWith(`${key} `));

  if (matches.length === 0) return null;
  if (matches.length === 1) return { kind: "route", slug: matches[0].slug };
  return { kind: "search", text: name };
}
