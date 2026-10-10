import type { EncounterMethod, Pokemon } from "../types";

// "What can I get next": locations ranked by how many uncaught Pokémon they hold.

/** Encounter methods that need extra setup (a daily outbreak, the Poké Radar, a GBA cartridge, the radio). */
const SETUP_METHODS: ReadonlySet<string> = new Set([
  "swarm", "poke-radar", "radio",
  "slot2", "slot2-ruby", "slot2-sapphire", "slot2-emerald", "slot2-firered", "slot2-leafgreen",
]);

export interface NextTarget {
  pokemon: Pokemon;
  minLevel: number;
  maxLevel: number;
  /** Empty when the encounter isn't tied to a time of day. */
  times: ("morning" | "day" | "night")[];
  games: string[];
}

export interface NextLocation {
  slug: string;
  displayName: string;
  /** Distinct uncaught species found here. */
  count: number;
  byMethod: { method: EncounterMethod; targets: NextTarget[] }[];
}

const TIME_ORDER = ["morning", "day", "night"] as const;

/**
 * @param pokemon      the Pokémon of the active generation
 * @param games        the games to look in
 * @param caught       caught ids for the active generation
 * @param includeSetup include outbreak / Poké Radar / Slot 2 / radio encounters
 */
export function buildNextLocations(
  pokemon: Pokemon[],
  games: readonly string[],
  caught: ReadonlySet<number>,
  includeSetup: boolean,
): NextLocation[] {
  const locations = new Map<
    string,
    { displayName: string; species: Set<number>; methods: Map<string, Map<number, NextTarget>> }
  >();

  for (const p of pokemon) {
    if (caught.has(p.id)) continue;
    for (const enc of p.encounters) {
      if (!games.includes(enc.version)) continue;
      for (const loc of enc.locations) {
        for (const d of loc.details) {
          // NPC trades aren't something you find at a location
          if (d.method === "trade") continue;
          if (!includeSetup && SETUP_METHODS.has(d.method)) continue;

          let entry = locations.get(loc.locationAreaSlug);
          if (!entry) {
            entry = { displayName: loc.locationDisplayName, species: new Set(), methods: new Map() };
            locations.set(loc.locationAreaSlug, entry);
          }
          entry.species.add(p.id);

          let targets = entry.methods.get(d.method);
          if (!targets) entry.methods.set(d.method, (targets = new Map()));
          const target = targets.get(p.id);
          if (!target) {
            targets.set(p.id, {
              pokemon: p,
              minLevel: d.minLevel,
              maxLevel: d.maxLevel,
              times: d.timeOfDay ? [d.timeOfDay] : [],
              games: [enc.version],
            });
          } else {
            target.minLevel = Math.min(target.minLevel, d.minLevel);
            target.maxLevel = Math.max(target.maxLevel, d.maxLevel);
            if (d.timeOfDay && !target.times.includes(d.timeOfDay)) target.times.push(d.timeOfDay);
            if (!target.games.includes(enc.version)) target.games.push(enc.version);
          }
        }
      }
    }
  }

  return Array.from(locations, ([slug, entry]) => ({
    slug,
    displayName: entry.displayName,
    count: entry.species.size,
    byMethod: Array.from(entry.methods, ([method, targets]) => ({
      method: method as EncounterMethod,
      targets: Array.from(targets.values())
        .map((t) => ({
          ...t,
          // Available at every time of day is the same as no restriction
          times: t.times.length === TIME_ORDER.length ? [] : TIME_ORDER.filter((x) => t.times.includes(x)),
        }))
        .sort((a, b) => a.pokemon.id - b.pokemon.id),
    })),
  })).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
}
