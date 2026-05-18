import { useMemo } from "react";
import type { Pokemon, GameVersion, DexMode, MetaData, AvailabilityMode } from "../types";
import npcTradesData from "../data/npc-trades.json";
import { getGenSprite, getGenShinySprite } from "../lib/pokemon-display";

interface NpcTrade {
  pokemonId: number;
  games: string[];
}

const npcTrades = npcTradesData as NpcTrade[];

interface FilteredPokemon extends Pokemon {
  displayNumber: number;
  isHighlighted: boolean;     // bright vs dimmed based on activeGames
  isVersionExclusive: boolean;
  exclusiveGames: string[];   // which selected games have this pokemon (non-empty only when isVersionExclusive)
  genSprite: string | null;   // generation-resolved sprite (gen3Sprite or gen4Sprite based on activeGeneration)
  shinySprite: string;        // shiny variant of genSprite
}

export function usePokemonFilter(
  allPokemon: Pokemon[],
  meta: MetaData | null,
  activeGeneration: number,
  dexMode: DexMode,
  activeGames: GameVersion[],   // empty = all games in generation
  availabilityMode: AvailabilityMode,
  searchQuery: string,
  caughtIds: number[] = []
): FilteredPokemon[] {
  return useMemo(() => {
    if (!meta) return [];

    // Step 1: filter by generation national range
    const genMeta = meta.generations.find((g) => g.id === activeGeneration);
    if (!genMeta) return [];

    const [rangeStart, rangeEnd] = genMeta.pokemonRange;
    let filtered = allPokemon.filter(
      (p) => p.id >= rangeStart && p.id <= rangeEnd
    );

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

    // Step 3a: NPC trade set — Pokémon obtainable via in-game trade for the relevant games
    const npcTradeIds = new Set<number>();
    for (const trade of npcTrades) {
      if (trade.games.some((g) => gamesToCheck.includes(g))) {
        npcTradeIds.add(trade.pokemonId);
      }
    }

    // Step 3b: "Directly catchable" — has wild/gift/static encounters in the relevant games
    const directlyCatchableIds = new Set<number>();
    for (const p of filtered) {
      if (
        p.encounters.some(
          (e) => gamesToCheck.includes(e.version) && e.locations.length > 0
        )
      ) {
        directlyCatchableIds.add(p.id);
      }
    }

    // Step 3c: "Obtainable" = catchable + NPC trades + evolution chain + breeding (babies only)
    const obtainableIds = new Set<number>(directlyCatchableIds);

    // Add NPC trade Pokémon
    for (const id of npcTradeIds) {
      obtainableIds.add(id);
    }

    if (availabilityMode === "obtainable") {
      // Evolution walk: BFS from each obtainable Pokémon forward through evolvesTo chains.
      // O(n) instead of the previous O(n × depth) while-loop.
      const evolvesToMap = new Map<number, number[]>();
      for (const p of filtered) {
        if (p.evolvesFrom !== null) {
          const children = evolvesToMap.get(p.evolvesFrom) ?? [];
          children.push(p.id);
          evolvesToMap.set(p.evolvesFrom, children);
        }
      }

      const queue = Array.from(obtainableIds); // seed BFS with already-obtainable set
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const childId of evolvesToMap.get(id) ?? []) {
          if (!obtainableIds.has(childId)) {
            obtainableIds.add(childId);
            queue.push(childId);
          }
        }
      }

      // Breeding walk: baby Pokémon (isBaby && no encounters) whose evolved form is obtainable
      for (const p of filtered) {
        if (
          p.isBaby &&
          p.encounters.length === 0 &&
          !obtainableIds.has(p.id) &&
          p.evolvesTo.some((step) => obtainableIds.has(step.speciesId))
        ) {
          obtainableIds.add(p.id);
        }
      }
    }

    // Step 4: apply search filter
    const query = searchQuery.trim().toLowerCase();

    // Step 4b: "needs-attention" set — Pokémon that warrant action
    let needsAttentionIds: Set<number> | null = null;
    if (availabilityMode === "needs-attention") {
      const caughtSet = new Set(caughtIds);
      needsAttentionIds = new Set<number>();
      for (const p of filtered) {
        // Caught but unevolved
        if (caughtSet.has(p.id) && p.evolvesTo.length > 0) {
          needsAttentionIds.add(p.id);
          continue;
        }
        // Uncaught — requires trade to evolve from already-caught base
        if (!caughtSet.has(p.id) && p.evolvesFrom != null && caughtSet.has(p.evolvesFrom)) {
          const base = allPokemon.find((x) => x.id === p.evolvesFrom);
          if (base?.evolvesTo.some((e) => e.speciesId === p.id && e.trigger === "trade")) {
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
        if (!caughtSet.has(p.id)) {
          const gamesWithEncounters =
            activeGames.length > 1
              ? activeGames.filter((g) =>
                  p.encounters.some((e) => e.version === g && e.locations.length > 0)
                )
              : [];
          if (gamesWithEncounters.length === 1 && activeGames.length > 1) {
            needsAttentionIds.add(p.id);
          }
        }
      }
    }

    // Step 5: compute per-pokemon display state
    return filtered
      .filter((p) => {
        if (needsAttentionIds !== null && !needsAttentionIds.has(p.id)) return false;
        if (!query) return true;
        return p.displayName.toLowerCase().includes(query);
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
        // all gen games when none are selected).
        const gamesWithEncounters =
          activeGames.length > 1
            ? activeGames.filter((g) =>
                p.encounters.some(
                  (e) => e.version === g && e.locations.length > 0
                )
              )
            : [];

        const isVersionExclusive =
          gamesWithEncounters.length === 1 && activeGames.length > 1;

        const exclusiveGames = isVersionExclusive ? gamesWithEncounters : [];

        const displayNumber =
          dexMode !== "national" && regionalNumberMap
            ? (regionalNumberMap.get(p.id) ?? p.id)
            : p.id;

        const genSprite = getGenSprite(p, activeGeneration) || null;
        const shinySprite = getGenShinySprite(p, activeGeneration);

        return { ...p, displayNumber, isHighlighted, isVersionExclusive, exclusiveGames, genSprite, shinySprite };
      });
  }, [allPokemon, meta, activeGeneration, dexMode, activeGames, availabilityMode, searchQuery, caughtIds]);
}

export type { FilteredPokemon };
