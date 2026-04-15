import { useMemo } from "react";
import type { Pokemon, EncounterMethod, GameVersion } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteEntry {
  pokemonId: number;
  displayName: string;
  types: string[];
  sprite: string;
  minLevel: number;
  maxLevel: number;
  /** Sum of encounter rates for this method at this location. 0 = static/gift. */
  totalChance: number;
  isStatic: boolean;
}

/**
 * Per-route data:
 *   games → version → method → sorted list of Pokémon (by chance desc)
 */
export interface RouteData {
  slug: string;
  displayName: string;
  /** Which game versions have any encounters here */
  versions: string[];
  games: Map<string, Map<EncounterMethod, RouteEntry[]>>;
}

export type RouteIndex = Map<string, RouteData>;

// ─── Method display order ─────────────────────────────────────────────────────

export const METHOD_ORDER: EncounterMethod[] = [
  "walk",
  "surf",
  "rock-smash",
  "old-rod",
  "good-rod",
  "super-rod",
  "gift",
  "static",
  "headbutt",
  // Gen 4 methods
  "poke-radar",
  "swarm",
  "honey-tree",
  "safari",
  "slot2",
  "slot2-ruby",
  "slot2-sapphire",
  "slot2-emerald",
  "slot2-firered",
  "slot2-leafgreen",
  "radio",
  "fossil",
  "unknown",
];

export const METHOD_LABELS: Record<EncounterMethod, string> = {
  walk: "Walking / Grass",
  surf: "Surfing",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
  "rock-smash": "Rock Smash",
  gift: "Gift",
  static: "Static Encounter",
  trade: "Trade",
  egg: "Egg",
  headbutt: "Headbutt",
  "rock-climb": "Rock Climb",
  // Gen 4
  "poke-radar": "Pokéradar",
  swarm: "Mass Outbreak",
  safari: "Safari Zone",
  // Dual-Slot (Slot 2)
  "slot2":          "Slot 2 (GBA)",
  "slot2-ruby":     "Slot 2 (Ruby)",
  "slot2-sapphire": "Slot 2 (Sapphire)",
  "slot2-emerald":  "Slot 2 (Emerald)",
  "slot2-firered":  "Slot 2 (FireRed)",
  "slot2-leafgreen":"Slot 2 (LeafGreen)",
  radio: "Pokégear Radio",
  "honey-tree": "Honey Tree",
  fossil: "Fossil Revival",
  unknown: "Other",
};

export const METHOD_ICONS: Partial<Record<EncounterMethod, string>> = {
  walk: "🌿",
  surf: "🌊",
  "old-rod": "🎣",
  "good-rod": "🎣",
  "super-rod": "🎣",
  "rock-smash": "🪨",
  gift: "🎁",
  static: "⚡",
  headbutt: "🌳",
  // Slot 2 (dual-slot GBA cartridge)
  "slot2":          "🎮",
  "slot2-ruby":     "🎮",
  "slot2-sapphire": "🎮",
  "slot2-emerald":  "🎮",
  "slot2-firered":  "🎮",
  "slot2-leafgreen":"🎮",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Builds an inverted index from all Pokémon encounter data:
 *   locationAreaSlug → { displayName, games: Map<version, Map<method, entries[]>> }
 *
 * Entries per (location, game, method) are one row per Pokémon, with level
 * ranges and encounter rates merged across multiple detail rows.
 * Results are sorted by totalChance descending within each method bucket.
 */
export function useRouteIndex(
  allPokemon: Pokemon[],
  activeGames: GameVersion[]
): RouteIndex {
  return useMemo(() => {
    const index = new Map<string, RouteData>();

    for (const pokemon of allPokemon) {
      const sprite = pokemon.gen4Sprite ?? pokemon.gen3Sprite ?? pokemon.spriteUrl;

      for (const enc of pokemon.encounters) {
        // If games are filtered, skip versions not in the selection
        if (activeGames.length > 0 && !activeGames.includes(enc.version as GameVersion)) {
          continue;
        }

        for (const loc of enc.locations) {
          const slug = loc.locationAreaSlug;

          if (!index.has(slug)) {
            index.set(slug, {
              slug,
              displayName: loc.locationDisplayName,
              versions: [],
              games: new Map(),
            });
          }

          const route = index.get(slug)!;
          if (!route.versions.includes(enc.version)) {
            route.versions.push(enc.version);
          }

          if (!route.games.has(enc.version)) {
            route.games.set(enc.version, new Map());
          }
          const methodMap = route.games.get(enc.version)!;

          // Merge multiple detail rows for the same Pokémon+method into one entry
          const byMethod = new Map<
            EncounterMethod,
            { minLevel: number; maxLevel: number; totalChance: number; isStatic: boolean }
          >();

          for (const det of loc.details) {
            const method = det.method as EncounterMethod;
            const existing = byMethod.get(method);
            if (existing) {
              existing.minLevel = Math.min(existing.minLevel, det.minLevel);
              existing.maxLevel = Math.max(existing.maxLevel, det.maxLevel);
              if (!det.isStatic) existing.totalChance += det.chance;
            } else {
              byMethod.set(method, {
                minLevel: det.minLevel,
                maxLevel: det.maxLevel,
                totalChance: det.isStatic ? 0 : det.chance,
                isStatic: det.isStatic,
              });
            }
          }

          for (const [method, data] of byMethod) {
            if (!methodMap.has(method)) {
              methodMap.set(method, []);
            }
            methodMap.get(method)!.push({
              pokemonId: pokemon.id,
              displayName: pokemon.displayName,
              types: pokemon.types,
              sprite,
              ...data,
            });
          }
        }
      }
    }

    // Sort each method bucket by totalChance descending, then by pokemonId for stability
    for (const route of index.values()) {
      for (const methodMap of route.games.values()) {
        for (const entries of methodMap.values()) {
          entries.sort(
            (a, b) =>
              b.totalChance - a.totalChance || a.pokemonId - b.pokemonId
          );
        }
      }
    }

    return index;
  }, [allPokemon, activeGames]);
}
