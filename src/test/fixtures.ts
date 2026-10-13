import type { EncounterMethod, EvolutionStep, GameVersion, MetaData, Pokemon } from "../types";

// A tiny hand-built Pokédex for tests. Encounters are written as
// { game: { locationSlug: [methods] } } to keep the fixtures readable.

type EncounterSpec = Partial<Record<GameVersion, Record<string, EncounterMethod[]>>>;

export function makePokemon(
  id: number,
  displayName: string,
  types: string[],
  opts: {
    encounters?: EncounterSpec;
    evolvesFrom?: number | null;
    evolvesTo?: Partial<EvolutionStep>[];
    isBaby?: boolean;
    regional?: Record<string, number>;
  } = {},
): Pokemon {
  const encounters = Object.entries(opts.encounters ?? {}).map(([version, locations]) => ({
    version: version as GameVersion,
    locations: Object.entries(locations ?? {}).map(([slug, methods]) => ({
      locationAreaSlug: slug,
      locationDisplayName: slug,
      details: methods.map((method) => ({ method, minLevel: 5, maxLevel: 10, chance: 20, isStatic: false })),
    })),
  }));
  return {
    id,
    name: displayName.toLowerCase(),
    displayName,
    types,
    spriteUrl: `sprite/${id}.png`,
    gen3Sprite: null,
    gen4Sprite: null,
    isLegendary: false,
    isMythical: false,
    isBaby: opts.isBaby ?? false,
    evolutionChainId: 1,
    evolvesFrom: opts.evolvesFrom ?? null,
    evolvesTo: (opts.evolvesTo ?? []).map((s) => ({
      speciesId: 0,
      speciesName: "",
      displayName: "",
      trigger: "level-up",
      minLevel: null,
      item: null,
      details: "",
      ...s,
    })),
    eggGroups: ["monster"],
    genderRate: 4,
    catchRate: 45,
    baseStats: { hp: 50, atk: 50, def: 50, spAtk: 50, spDef: 50, spe: 50 },
    encounters,
    availableInGames: encounters.map((e) => e.version),
    hasStaticEncounter: false,
    regionalDexEntries: Object.entries(opts.regional ?? {}).map(([dexId, regionalNumber]) => ({
      dexId,
      dexName: dexId,
      regionalNumber,
    })),
  };
}

export const META: MetaData = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  totalPokemon: 493,
  activeGenerations: [4],
  generations: [
    {
      id: 4,
      name: "Generation IV",
      versions: ["diamond", "pearl"],
      pokemonRange: [1, 493],
      versionPairs: [["diamond", "pearl"]],
    },
  ],
  regionalDexes: [{ id: "sinnoh-dp", name: "DP Pokédex", games: ["diamond", "pearl"], size: 151 }],
};

/**
 * Gastly (wild, both games) → Haunter (wild in Diamond; NPC trade in Pearl) → Gengar (trade evolution)
 * Seel (Diamond only) · Slowpoke (Pearl only) · Abra (NPC trade only)
 * Pichu (baby, no encounters) → Pikachu (wild, both games)
 * Bulbasaur (no encounters at all in these games)
 */
export const POKEDEX: Pokemon[] = [
  makePokemon(1, "Bulbasaur", ["grass", "poison"]),
  makePokemon(25, "Pikachu", ["electric"], {
    encounters: { diamond: { "trophy-garden": ["walk"] }, pearl: { "trophy-garden": ["walk"] } },
    evolvesFrom: 172,
    regional: { "sinnoh-dp": 104 },
  }),
  makePokemon(63, "Abra", ["psychic"], {
    encounters: { diamond: { "oreburgh-house": ["trade"] }, pearl: { "oreburgh-house": ["trade"] } },
    regional: { "sinnoh-dp": 20 },
  }),
  makePokemon(79, "Slowpoke", ["water", "psychic"], { encounters: { pearl: { "route-205": ["walk"] } } }),
  makePokemon(86, "Seel", ["water"], { encounters: { diamond: { "route-226": ["surf"] } } }),
  makePokemon(92, "Gastly", ["ghost", "poison"], {
    encounters: { diamond: { "old-chateau": ["walk"] }, pearl: { "old-chateau": ["walk"] } },
    evolvesTo: [{ speciesId: 93, displayName: "Haunter", trigger: "level-up", minLevel: 25, details: "Level 25" }],
    regional: { "sinnoh-dp": 69 },
  }),
  makePokemon(93, "Haunter", ["ghost", "poison"], {
    encounters: {
      diamond: { "turnback-cave": ["walk"] },
      pearl: { "snowpoint-house": ["trade"] },
    },
    evolvesFrom: 92,
    evolvesTo: [{ speciesId: 94, displayName: "Gengar", trigger: "trade", details: "Trade" }],
    regional: { "sinnoh-dp": 70 },
  }),
  makePokemon(94, "Gengar", ["ghost", "poison"], { evolvesFrom: 93, regional: { "sinnoh-dp": 71 } }),
  makePokemon(172, "Pichu", ["electric"], {
    isBaby: true,
    evolvesTo: [{ speciesId: 25, displayName: "Pikachu", trigger: "level-up", details: "Level up with high friendship" }],
    regional: { "sinnoh-dp": 103 },
  }),
];
