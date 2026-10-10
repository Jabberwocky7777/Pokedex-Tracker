import { useMemo } from "react";
import type { Pokemon, GameVersion, DexMode, MetaData, AvailabilityMode } from "../types";
import { getGenSprite, getGenShinySprite } from "../lib/pokemon-display";
import { hasNonTradeEncounter, hasNpcTrade } from "../lib/npc-trades";
import { parseSearch, matchesSearch } from "../lib/pokemon-search";
import { uncaughtEvolutions, isTradeEvolution } from "../lib/evolution-status";

interface FilteredPokemon extends Pokemon {
  displayNumber: number;
  isHighlighted: boolean;     // bright vs dimmed based on activeGames
  isVersionExclusive: boolean;
  exclusiveGames: string[];   // which selected games have this pokemon (non-empty only when isVersionExclusive)
  genSprite: string | null;   // generation-resolved sprite (gen3Sprite or gen4Sprite based on activeGeneration)
  shinySprite: string;        // shiny variant of genSprite
}

/**
 * Which Pokémon can be had in a set of games.
 *
 *   catchable  — has a wild, gift, static or fossil encounter in one of the games
 *   obtainable — catchable, or received in an in-game NPC trade, or evolved (by any
 *                method, trade evolutions included) from something obtainable, or a
 *                baby whose evolved form is obtainable (breeding)
 */
export function computeAvailability(
  pokemon: Pokemon[],
  games: readonly string[],
): { catchable: Set<number>; obtainable: Set<number> } {
  const catchable = new Set<number>();
  const obtainable = new Set<number>();
  for (const p of pokemon) {
    if (hasNonTradeEncounter(p.encounters, games)) {
      catchable.add(p.id);
      obtainable.add(p.id);
    } else if (hasNpcTrade(p.encounters, games)) {
      obtainable.add(p.id);
    }
  }

  // Evolution walk: BFS from each obtainable Pokémon forward through its evolutions.
  const children = new Map<number, number[]>();
  for (const p of pokemon) {
    if (p.evolvesFrom !== null) {
      const list = children.get(p.evolvesFrom) ?? [];
      list.push(p.id);
      children.set(p.evolvesFrom, list);
    }
  }
  const queue = Array.from(obtainable);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const childId of children.get(id) ?? []) {
      if (!obtainable.has(childId)) {
        obtainable.add(childId);
        queue.push(childId);
      }
    }
  }

  // Breeding walk: baby Pokémon not found in these games whose evolved form is obtainable.
  // (An encounter in some other game — Pichu in Platinum's Trophy Garden — doesn't count either way.)
  for (const p of pokemon) {
    if (
      p.isBaby &&
      !obtainable.has(p.id) &&
      p.evolvesTo.some((step) => obtainable.has(step.speciesId))
    ) {
      obtainable.add(p.id);
    }
  }

  return { catchable, obtainable };
}

export interface FilterOptions {
  allPokemon: Pokemon[];
  meta: MetaData | null;
  activeGeneration: number;
  dexMode: DexMode;
  activeGames: GameVersion[];   // empty = all games in generation
  availabilityMode: AvailabilityMode;
  searchQuery: string;
  caughtIds?: number[];
  pendingIds?: number[];
  shinyIds?: number[];
  /** Species marked as sitting in their living-dex slot */
  placedIds?: number[];
}

/** The tracker's filter, as a plain function so it can be tested without React. */
export function filterPokemon({
  allPokemon,
  meta,
  activeGeneration,
  dexMode,
  activeGames,
  availabilityMode,
  searchQuery,
  caughtIds = [],
  pendingIds = [],
  shinyIds = [],
  placedIds = [],
}: FilterOptions): FilteredPokemon[] {
  if (!meta) return [];

  // Step 1: filter by generation national range
  const genMeta = meta.generations.find((g) => g.id === activeGeneration);
  if (!genMeta) return [];

  const [rangeStart, rangeEnd] = genMeta.pokemonRange;
  const inGeneration = allPokemon.filter((p) => p.id >= rangeStart && p.id <= rangeEnd);
  let filtered = inGeneration;

  // Step 2: if regional dex mode, filter + sort by regional number
  let regionalNumberMap: Map<number, number> | null = null;

  if (dexMode !== "national") {
    const withRegional = filtered
      .map((p) => {
        const entry = p.regionalDexEntries.find((e) => e.dexId === dexMode);
        return entry ? { pokemon: p, regionalNumber: entry.regionalNumber } : null;
      })
      .filter((x): x is { pokemon: Pokemon; regionalNumber: number } => x !== null);

    withRegional.sort((a, b) => a.regionalNumber - b.regionalNumber);
    filtered = withRegional.map((x) => x.pokemon);

    regionalNumberMap = new Map(
      withRegional.map((x) => [x.pokemon.id, x.regionalNumber])
    );
  }

  // Step 3: determine which games to use for availability checks.
  // When no specific games are selected, check across ALL games in this generation.
  // The "All" availability-mode button is what forces everything bright — not the game selector.
  const gamesToCheck: string[] =
    activeGames.length > 0
      ? (activeGames as string[])
      : (genMeta.versions as string[]);

  // Availability is computed over the whole generation, not just the regional dex,
  // so a Pokémon still counts as obtainable when its pre-evolution isn't in that dex.
  const { catchable: directlyCatchableIds, obtainable: obtainableIds } =
    computeAvailability(inGeneration, gamesToCheck);

  const caughtSet = new Set(caughtIds);
  const pendingSet = new Set(pendingIds);
  const shinySet = new Set(shinyIds);
  const placedSet = new Set(placedIds);

  // Step 4: "needs-attention" set — Pokémon that warrant action
  let needsAttentionIds: Set<number> | null = null;
  if (availabilityMode === "needs-attention") {
    const byId = new Map(allPokemon.map((p) => [p.id, p]));
    needsAttentionIds = new Set<number>();
    for (const p of filtered) {
      // Marked pending (an earlier stage is waiting to evolve) and still not caught
      if (pendingSet.has(p.id) && !caughtSet.has(p.id)) {
        needsAttentionIds.add(p.id);
        continue;
      }
      // Living dex in use (some placed marks exist): caught, but not in its slot yet
      if (placedSet.size > 0 && caughtSet.has(p.id) && !placedSet.has(p.id)) {
        needsAttentionIds.add(p.id);
        continue;
      }
      // Caught, with an evolution (that exists in this generation) still uncaught
      if (caughtSet.has(p.id) && uncaughtEvolutions(p, caughtSet, rangeEnd).length > 0) {
        needsAttentionIds.add(p.id);
        continue;
      }
      // Uncaught — requires trade to evolve from already-caught base
      if (!caughtSet.has(p.id) && p.evolvesFrom != null && caughtSet.has(p.evolvesFrom)) {
        const base = byId.get(p.evolvesFrom);
        if (base && uncaughtEvolutions(base, caughtSet, rangeEnd).some((e) => e.speciesId === p.id && isTradeEvolution(e))) {
          needsAttentionIds.add(p.id);
          continue;
        }
      }
      // Baby Pokémon not yet caught (breeding required)
      if (p.isBaby && !caughtSet.has(p.id)) {
        needsAttentionIds.add(p.id);
        continue;
      }
      // Uncaught version exclusive
      if (!caughtSet.has(p.id) && activeGames.length > 1) {
        const gamesWithEncounters = activeGames.filter((g) => hasNonTradeEncounter(p.encounters, [g]));
        if (gamesWithEncounters.length === 1) needsAttentionIds.add(p.id);
      }
    }
  }

  // Step 5: search, then compute per-pokemon display state
  const searchTerms = parseSearch(searchQuery);
  const displayNumberOf = (p: Pokemon) =>
    dexMode !== "national" && regionalNumberMap ? (regionalNumberMap.get(p.id) ?? p.id) : p.id;

  return filtered
    .filter((p) => {
      if (needsAttentionIds !== null && !needsAttentionIds.has(p.id)) return false;
      if (searchTerms.length === 0) return true;
      return matchesSearch(p, searchTerms, {
        displayNumber: displayNumberOf(p),
        caught: caughtSet,
        pending: pendingSet,
        shiny: shinySet,
      });
    })
    .map((p) => {
      let isHighlighted: boolean;
      if (availabilityMode === "all" || availabilityMode === "needs-attention") {
        isHighlighted = true;
      } else if (availabilityMode === "obtainable") {
        isHighlighted = obtainableIds.has(p.id);
      } else {
        // "catchable"
        isHighlighted = directlyCatchableIds.has(p.id);
      }

      // Version exclusive: computed dynamically from encounter data vs selected games.
      //
      // A Pokémon is "exclusive" (in the current selection context) when it is
      // catchable in exactly 1 of the selected games. This means:
      //   - Ruby+Sapphire selected → Zangoose (Ruby only) = exclusive
      //   - FireRed+LeafGreen selected → Growlithe (FR only) = exclusive, even if it
      //     were also in Ruby/Sapphire/Emerald
      //   - 0 or 1 game selected → nothing is exclusive (no counterpart to compare)
      //
      // We check encounters in `activeGames` only (not gamesToCheck which falls back to
      // all gen games when none are selected). NPC trades don't count as an encounter.
      const gamesWithEncounters =
        activeGames.length > 1
          ? activeGames.filter((g) => hasNonTradeEncounter(p.encounters, [g]))
          : [];

      const isVersionExclusive =
        gamesWithEncounters.length === 1 && activeGames.length > 1;

      const exclusiveGames = isVersionExclusive ? gamesWithEncounters : [];

      const genSprite = getGenSprite(p, activeGeneration) || null;
      const shinySprite = getGenShinySprite(p, activeGeneration);

      return { ...p, displayNumber: displayNumberOf(p), isHighlighted, isVersionExclusive, exclusiveGames, genSprite, shinySprite };
    });
}

export function usePokemonFilter(
  allPokemon: Pokemon[],
  meta: MetaData | null,
  activeGeneration: number,
  dexMode: DexMode,
  activeGames: GameVersion[],   // empty = all games in generation
  availabilityMode: AvailabilityMode,
  searchQuery: string,
  caughtIds: number[] = [],
  pendingIds: number[] = [],
  shinyIds: number[] = [],
  placedIds: number[] = [],
): FilteredPokemon[] {
  return useMemo(
    () =>
      filterPokemon({
        allPokemon, meta, activeGeneration, dexMode, activeGames,
        availabilityMode, searchQuery, caughtIds, pendingIds, shinyIds, placedIds,
      }),
    [allPokemon, meta, activeGeneration, dexMode, activeGames, availabilityMode, searchQuery, caughtIds, pendingIds, shinyIds, placedIds],
  );
}

export type { FilteredPokemon };
