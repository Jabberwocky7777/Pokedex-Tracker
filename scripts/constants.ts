export const GEN3_VERSION_NAMES = [
  "ruby", "sapphire", "emerald", "firered", "leafgreen",
] as const;

export const GEN4_VERSION_NAMES = [
  "diamond", "pearl", "platinum", "heartgold", "soulsilver",
] as const;

// All supported version names (Gen 3 + Gen 4)
export const ALL_VERSION_NAMES = [
  ...GEN3_VERSION_NAMES,
  ...GEN4_VERSION_NAMES,
] as const;

// PokéAPI version IDs for Gen 3 games
export const GEN3_VERSION_IDS: Record<string, number> = {
  ruby: 7,
  sapphire: 8,
  emerald: 9,
  firered: 10,
  leafgreen: 11,
};

// PokéAPI version IDs for Gen 4 games
export const GEN4_VERSION_IDS: Record<string, number> = {
  diamond: 12,
  pearl: 13,
  platinum: 14,
  heartgold: 15,
  soulsilver: 16,
};

// Version exclusive pairs (Ruby/Sapphire, FireRed/LeafGreen, Diamond/Pearl, HG/SS)
export const VERSION_PAIRS: [string, string][] = [
  ["ruby", "sapphire"],
  ["firered", "leafgreen"],
  ["diamond", "pearl"],
  ["heartgold", "soulsilver"],
];

// Generation definitions for meta.json
export const GENERATION_META = [
  {
    id: 3,
    name: "Generation III",
    versions: ["ruby", "sapphire", "emerald", "firered", "leafgreen"],
    pokemonRange: [1, 386] as [number, number],
    versionPairs: [["ruby", "sapphire"], ["firered", "leafgreen"]] as [string, string][],
  },
  {
    id: 4,
    name: "Generation IV",
    versions: ["diamond", "pearl", "platinum", "heartgold", "soulsilver"],
    pokemonRange: [1, 493] as [number, number],
    versionPairs: [["diamond", "pearl"], ["heartgold", "soulsilver"]] as [string, string][],
  },
];

export const REGIONAL_DEXES = [
  {
    id: "hoenn",
    name: "RSE Pokédex",
    games: ["ruby", "sapphire", "emerald"],
    size: 202,
  },
  {
    id: "kanto",
    name: "FRLG Pokédex",
    games: ["firered", "leafgreen"],
    size: 151,
  },
  {
    id: "sinnoh-dp",
    name: "DP Pokédex",
    games: ["diamond", "pearl"],
    size: 151,
  },
  {
    id: "sinnoh-pt",
    name: "Platinum Pokédex",
    games: ["platinum"],
    size: 210,
  },
  {
    id: "johto-hgss",
    name: "HGSS Pokédex",
    games: ["heartgold", "soulsilver"],
    size: 256,
  },
];

// Rate limiting
export const FETCH_DELAY_MS = 250;
export const BATCH_SIZE = 10;
export const POKEAPI_BASE = "https://pokeapi.co/api/v2";
