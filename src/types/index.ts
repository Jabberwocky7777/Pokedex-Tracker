// ─── Game / Version Types ──────────────────────────────────────────────

export type Gen1Version = "red" | "blue" | "yellow";
export type Gen2Version = "gold" | "silver" | "crystal";
export type Gen3Version = "ruby" | "sapphire" | "emerald" | "firered" | "leafgreen";
export type Gen4Version = "diamond" | "pearl" | "platinum" | "heartgold" | "soulsilver";
export type Gen5Version = "black" | "white" | "black-2" | "white-2";
export type Gen6Version = "x" | "y" | "omega-ruby" | "alpha-sapphire";
export type Gen7Version = "sun" | "moon" | "ultra-sun" | "ultra-moon" | "lets-go-pikachu" | "lets-go-eevee";
export type Gen8Version = "sword" | "shield" | "brilliant-diamond" | "shining-pearl" | "legends-arceus";
export type Gen9Version = "scarlet" | "violet";

export type GameVersion =
  | Gen1Version
  | Gen2Version
  | Gen3Version
  | Gen4Version
  | Gen5Version
  | Gen6Version
  | Gen7Version
  | Gen8Version
  | Gen9Version;

export const GEN3_VERSIONS: Gen3Version[] = [
  "ruby", "sapphire", "emerald", "firered", "leafgreen",
];

export const GEN4_VERSIONS: Gen4Version[] = [
  "diamond", "pearl", "platinum", "heartgold", "soulsilver",
];

// Display column order for encounter tables and route views (one constant per generation).
// Import these instead of defining local GAME_ORDER arrays in components.
export const GEN3_GAME_ORDER: Gen3Version[] = [
  "ruby", "sapphire", "emerald", "firered", "leafgreen",
];

export const GEN4_GAME_ORDER: Gen4Version[] = [
  "diamond", "pearl", "platinum", "heartgold", "soulsilver",
];

export const GAME_LABELS: Record<GameVersion, string> = {
  red: "Red", blue: "Blue", yellow: "Yellow",
  gold: "Gold", silver: "Silver", crystal: "Crystal",
  ruby: "Ruby", sapphire: "Sapphire", emerald: "Emerald",
  firered: "FireRed", leafgreen: "LeafGreen",
  diamond: "Diamond", pearl: "Pearl", platinum: "Platinum",
  heartgold: "HeartGold", soulsilver: "SoulSilver",
  black: "Black", white: "White", "black-2": "Black 2", "white-2": "White 2",
  x: "X", y: "Y", "omega-ruby": "Omega Ruby", "alpha-sapphire": "Alpha Sapphire",
  sun: "Sun", moon: "Moon", "ultra-sun": "Ultra Sun", "ultra-moon": "Ultra Moon",
  "lets-go-pikachu": "Let's Go Pikachu", "lets-go-eevee": "Let's Go Eevee",
  sword: "Sword", shield: "Shield",
  "brilliant-diamond": "Brilliant Diamond", "shining-pearl": "Shining Pearl",
  "legends-arceus": "Legends: Arceus",
  scarlet: "Scarlet", violet: "Violet",
};

export const GAME_COLORS: Partial<Record<GameVersion, string>> = {
  red: "#ef4444", blue: "#3b82f6", yellow: "#eab308",
  gold: "#f59e0b", silver: "#94a3b8", crystal: "#06b6d4",
  ruby: "#dc2626", sapphire: "#2563eb", emerald: "#059669",
  firered: "#f97316", leafgreen: "#16a34a",
  diamond: "#818cf8", pearl: "#f9a8d4", platinum: "#94a3b8",
  heartgold: "#d97706", soulsilver: "#6366f1",
  black: "#1f2937", white: "#e5e7eb",
  "black-2": "#374151", "white-2": "#f3f4f6",
  x: "#7c3aed", y: "#dc2626",
  "omega-ruby": "#b91c1c", "alpha-sapphire": "#1d4ed8",
  scarlet: "#dc2626", violet: "#7c3aed",
};

// ─── Encounter Types ───────────────────────────────────────────────────

export type EncounterMethod =
  | "walk"
  | "surf"
  | "old-rod"
  | "good-rod"
  | "super-rod"
  | "rock-smash"
  | "gift"
  | "static"
  | "trade"
  | "egg"
  | "headbutt"
  | "rock-climb"
  // Gen 4
  | "poke-radar"
  | "swarm"
  | "safari"
  // Dual-Slot (Slot 2) — one variant per cartridge
  | "slot2"
  | "slot2-ruby"
  | "slot2-sapphire"
  | "slot2-emerald"
  | "slot2-firered"
  | "slot2-leafgreen"
  | "radio"
  | "honey-tree"
  | "fossil"
  | "unknown";

export const ENCOUNTER_METHOD_LABELS: Record<EncounterMethod, string> = {
  "walk": "Walking",
  "surf": "Surfing",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
  "rock-smash": "Rock Smash",
  "gift": "Gift",
  "static": "Static Encounter",
  "trade": "In-Game Trade",
  "egg": "Egg / Starter",
  "headbutt": "Headbutt",
  "rock-climb": "Rock Climb",
  // Gen 4
  "poke-radar": "Pokéradar",
  "swarm": "Mass Outbreak",
  "safari": "Safari Zone",
  // Dual-Slot (Slot 2) — generic fallback + per-cartridge variants
  "slot2":          "Slot 2 (GBA)",
  "slot2-ruby":     "Slot 2 (Ruby)",
  "slot2-sapphire": "Slot 2 (Sapphire)",
  "slot2-emerald":  "Slot 2 (Emerald)",
  "slot2-firered":  "Slot 2 (FireRed)",
  "slot2-leafgreen":"Slot 2 (LeafGreen)",
  "radio": "Pokégear Radio",
  "honey-tree": "Honey Tree",
  "fossil": "Fossil Revival",
  "unknown": "Unknown",
};

export interface EncounterDetail {
  method: EncounterMethod;
  minLevel: number;
  maxLevel: number;
  chance: number;    // 0–100; 0 = N/A (gift/static)
  isStatic: boolean; // one-time encounter flag
  timeOfDay?: "morning" | "day" | "night"; // Gen 4 HGSS time-based encounters
  // Override-injected fields (may be absent on PokéAPI-sourced encounters)
  requirement?: string;           // e.g. "Requires Surf and Strength"
  eventItem?: string;             // e.g. "MysticTicket"
  respawnsAfterEliteFour?: boolean;
  isRoaming?: boolean;
}

export interface LocationEncounter {
  locationAreaSlug: string;
  locationDisplayName: string;
  details: EncounterDetail[];
}

export interface GameEncounters {
  version: GameVersion;
  locations: LocationEncounter[];
}

// ─── Evolution Types ────────────────────────────────────────────────────

export type EvolutionTrigger = "level-up" | "use-item" | "trade" | "other";

export interface EvolutionStep {
  speciesId: number;
  speciesName: string;
  displayName: string;
  trigger: EvolutionTrigger;
  minLevel: number | null;
  item: string | null;
  details: string; // human-readable: "Level 16", "Fire Stone", "Trade"
}

// ─── Regional Dex ──────────────────────────────────────────────────────

export interface RegionalDexEntry {
  dexId: string;          // e.g. "hoenn", "kanto"
  dexName: string;        // e.g. "Hoenn Pokédex"
  regionalNumber: number;
}

// ─── Core Pokemon Type ──────────────────────────────────────────────────

export interface Pokemon {
  id: number;               // National Dex number
  name: string;             // e.g. "bulbasaur"
  displayName: string;      // e.g. "Bulbasaur"
  types: string[];
  spriteUrl: string;
  gen3Sprite: string | null; // Gen 3 style sprite (FR/LG or R/S)
  gen4Sprite: string | null; // Gen 4 style sprite (HGSS or D/P)

  // Classification
  isLegendary: boolean;
  isMythical: boolean;
  isBaby: boolean;

  // Evolution
  evolutionChainId: number;
  evolvesFrom: number | null;
  evolvesTo: EvolutionStep[];

  // Catch rate & base stats (merged from pokemon-stats.json)
  catchRate: number;
  abilities?: { name: string; displayName: string; isHidden: boolean }[];
  baseStats: BaseStats;
  evYield?: BaseStats; // populated after running npm run generate-data

  // Encounters
  encounters: GameEncounters[];
  availableInGames: GameVersion[];
  hasStaticEncounter: boolean;

  // Regional dex entries
  regionalDexEntries: RegionalDexEntry[];
}

// ─── Box Layout ────────────────────────────────────────────────────────

export interface DexBox {
  boxNumber: number;
  label: string;
  pokemonIds: number[];
}

// ─── Meta / Config ─────────────────────────────────────────────────────

export interface GenerationMeta {
  id: number;
  name: string;
  versions: GameVersion[];
  pokemonRange: [number, number]; // [start, end] inclusive
  versionPairs: [GameVersion, GameVersion][]; // pairs for version exclusives
}

export interface RegionalDexMeta {
  id: string;
  name: string;
  games: GameVersion[];
  size: number;
}

export interface MetaData {
  generatedAt: string;
  totalPokemon: number;
  activeGenerations: number[];
  generations: GenerationMeta[];
  regionalDexes: RegionalDexMeta[];
}

// ─── Store / UI Types ───────────────────────────────────────────────────

export type ViewMode = "box" | "list" | "slots";

export type DexMode = "national" | string; // "national" or a regionalDexId like "hoenn"

export type AvailabilityMode = "all" | "obtainable" | "catchable" | "needs-attention";

export type AppTab = "tracker" | "catch-calc" | "designer" | "routes" | "pokedex";

// ─── Base Stats ─────────────────────────────────────────────────────────────

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spe: number;
}
