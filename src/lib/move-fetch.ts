import { moveDisplayName } from "./move-names";

// Module-level caches — survive React renders and re-mounts
// All data is fetched lazily on first request, then served from cache.

/** One entry of PokéAPI's `past_values`: what a move was like *before* `versionGroup`. Null = unchanged. */
export interface PastMoveValues {
  versionGroup: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  type: string | null;
}

/**
 * Type, power, accuracy and PP are the HeartGold/SoulSilver values, not the
 * latest games' (Thunderbolt is 95, Charm is Normal). For another supported
 * game, pass the detail through moveForVersionGroup().
 */
export interface MoveDetail {
  name: string;
  displayName: string;
  type: string;
  /**
   * Gen 4+ per-move physical/special/status split (from PokéAPI damage_class).
   * Use this for Gen 4 and later version groups.
   */
  category: "physical" | "special" | "status";
  /**
   * Gen 1–3 type-based split: the category is determined solely by the move's TYPE,
   * not the individual move. Physical types: Normal, Fighting, Flying, Poison, Ground,
   * Rock, Bug, Ghost, Steel. Special types: Fire, Water, Grass, Electric, Psychic,
   * Ice, Dragon, Dark. Status moves are always "status" regardless of generation.
   */
  gen3Category: "physical" | "special" | "status";
  power: number | null;
  accuracy: number | null;
  pp: number;
  /** Hits every opponent (or everyone else) in a Double Battle */
  spread: boolean;
  /** The latest games' values and every recorded change, for moveForVersionGroup() */
  current: { type: string; power: number | null; accuracy: number | null; pp: number };
  past: PastMoveValues[];
}

/**
 * Gen 1–3: move category is determined by the move's TYPE, not the move itself.
 * Everything else (Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark) is Special.
 */
const GEN3_PHYSICAL_TYPES = new Set([
  "normal", "fighting", "flying", "poison", "ground",
  "rock", "bug", "ghost", "steel",
]);

function getGen3Category(
  type: string,
  modernCategory: "physical" | "special" | "status"
): "physical" | "special" | "status" {
  // Status moves are status in every generation
  if (modernCategory === "status") return "status";
  return GEN3_PHYSICAL_TYPES.has(type) ? "physical" : "special";
}

export type LearnMethod = "level-up" | "machine" | "egg" | "tutor" | string;

export interface LearnedMove {
  move: string;      // PokéAPI slug, e.g. "flamethrower"
  level: number;     // 0 for non-level-up methods
  method: LearnMethod;
}

export type Gen3VersionGroup = "ruby-sapphire" | "emerald" | "firered-leafgreen";
export type Gen4VersionGroup = "diamond-pearl" | "platinum" | "heartgold-soulsilver";
export type VersionGroup = Gen3VersionGroup | Gen4VersionGroup;

export type PokemonLearnset = Record<VersionGroup, LearnedMove[]>;

export const GEN3_VERSION_GROUPS: { id: Gen3VersionGroup; label: string }[] = [
  { id: "ruby-sapphire",     label: "Ruby / Sapphire" },
  { id: "emerald",           label: "Emerald" },
  { id: "firered-leafgreen", label: "FireRed / LeafGreen" },
];

export const GEN4_VERSION_GROUPS: { id: Gen4VersionGroup; label: string }[] = [
  { id: "diamond-pearl",        label: "Diamond / Pearl" },
  { id: "platinum",             label: "Platinum" },
  { id: "heartgold-soulsilver", label: "HG / SS" },
];

/** The version groups of a generation, for the game tabs above move lists. */
export function versionGroupsFor(generation: number): { id: VersionGroup; label: string }[] {
  return generation === 3 ? GEN3_VERSION_GROUPS : GEN4_VERSION_GROUPS;
}

const ALL_VG_SET = new Set<string>([
  "ruby-sapphire", "emerald", "firered-leafgreen",
  "diamond-pearl", "platinum", "heartgold-soulsilver",
]);

// Release order, for reading PokéAPI's past_values. Anything not listed is newer than all of these.
const VERSION_GROUP_ORDER = [
  "red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald", "firered-leafgreen",
  "colosseum", "xd", "diamond-pearl", "platinum", "heartgold-soulsilver",
  "black-white", "black-2-white-2", "x-y", "omega-ruby-alpha-sapphire", "sun-moon", "ultra-sun-ultra-moon",
  "lets-go-pikachu-lets-go-eevee", "sword-shield", "the-isle-of-armor", "the-crown-tundra",
  "brilliant-diamond-shining-pearl", "legends-arceus", "scarlet-violet", "the-teal-mask", "the-indigo-disk",
];
const orderOf = (versionGroup: string): number => {
  const i = VERSION_GROUP_ORDER.indexOf(versionGroup);
  return i === -1 ? VERSION_GROUP_ORDER.length : i;
};

/** The newest supported games: what a MoveDetail's own fields describe. */
const DEFAULT_VERSION_GROUP: VersionGroup = "heartgold-soulsilver";

/** The fields of PokéAPI's /move/{slug} response that the app reads. */
export interface RawMove {
  type: { name: string };
  damage_class: { name: string };
  power: number | null;
  accuracy: number | null;
  pp: number;
  target?: { name: string };
  past_values?: {
    version_group: { name: string };
    power: number | null;
    accuracy: number | null;
    pp: number | null;
    type: { name: string } | null;
  }[];
}

/**
 * A move's values in one game. Each past entry says what a field was before
 * its version group, so the value in `versionGroup` is the one from the
 * earliest later entry that mentions the field — or today's value if none does.
 */
export function moveValuesIn(
  current: MoveDetail["current"],
  past: PastMoveValues[],
  versionGroup: string,
): MoveDetail["current"] {
  const later = past
    .filter((p) => orderOf(p.versionGroup) > orderOf(versionGroup))
    .sort((a, b) => orderOf(a.versionGroup) - orderOf(b.versionGroup));
  const pick = <K extends "type" | "power" | "accuracy" | "pp">(field: K): MoveDetail["current"][K] => {
    const entry = later.find((p) => p[field] != null);
    return (entry ? entry[field] : current[field]) as MoveDetail["current"][K];
  };
  return { type: pick("type"), power: pick("power"), accuracy: pick("accuracy"), pp: pick("pp") };
}

/** The same move as it is in another supported game (Outrage is 90 power in Gen III, 120 in Gen IV). */
export function moveForVersionGroup<T extends MoveDetail>(detail: T, versionGroup: VersionGroup): T {
  const values = moveValuesIn(detail.current, detail.past, versionGroup);
  return { ...detail, ...values, gen3Category: getGen3Category(values.type, detail.category) };
}

/** Builds a MoveDetail from PokéAPI's response, with the HeartGold/SoulSilver values up front. */
export function buildMoveDetail(slug: string, data: RawMove): MoveDetail {
  const category = data.damage_class.name as MoveDetail["category"];
  const current = { type: data.type.name, power: data.power, accuracy: data.accuracy, pp: data.pp };
  const past: PastMoveValues[] = (data.past_values ?? []).map((p) => ({
    versionGroup: p.version_group.name, power: p.power, accuracy: p.accuracy, pp: p.pp, type: p.type?.name ?? null,
  }));
  const values = moveValuesIn(current, past, DEFAULT_VERSION_GROUP);
  return {
    name: slug,
    displayName: moveDisplayName(slug),
    ...values,
    category,
    gen3Category: getGen3Category(values.type, category),
    spread: data.target?.name === "all-opponents" || data.target?.name === "all-other-pokemon",
    current,
    past,
  };
}

const learnsetCache = new Map<number, PokemonLearnset>();
const moveDetailCache = new Map<string, MoveDetail>();

/** Fetch the learnset for a Pokémon across all Gen III–IV version groups. Results are cached for the session. */
export async function fetchLearnset(pokemonId: number): Promise<PokemonLearnset> {
  if (learnsetCache.has(pokemonId)) return learnsetCache.get(pokemonId)!;

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
  if (!res.ok) throw new Error(`PokéAPI: failed to fetch Pokémon #${pokemonId} (${res.status})`);
  const data = await res.json() as {
    moves: Array<{
      move: { name: string };
      version_group_details: Array<{
        level_learned_at: number;
        move_learn_method: { name: string };
        version_group: { name: string };
      }>;
    }>;
  };

  const learnset: PokemonLearnset = {
    "ruby-sapphire": [],
    "emerald": [],
    "firered-leafgreen": [],
    "diamond-pearl": [],
    "platinum": [],
    "heartgold-soulsilver": [],
  };

  for (const entry of data.moves) {
    const moveName = entry.move.name;
    for (const vgd of entry.version_group_details) {
      const vg = vgd.version_group.name;
      if (!ALL_VG_SET.has(vg)) continue;
      learnset[vg as VersionGroup].push({
        move: moveName,
        level: vgd.level_learned_at,
        method: vgd.move_learn_method.name,
      });
    }
  }

  learnsetCache.set(pokemonId, learnset);
  return learnset;
}

const LEARNSET_CONCURRENCY = 10;

/** Fetch several learnsets, a few at a time so a long list doesn't open hundreds of requests at once. */
export async function fetchLearnsets(pokemonIds: number[]): Promise<PokemonLearnset[]> {
  const results: PokemonLearnset[] = new Array(pokemonIds.length);
  let next = 0;
  async function worker() {
    while (next < pokemonIds.length) {
      const i = next++;
      results[i] = await fetchLearnset(pokemonIds[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(LEARNSET_CONCURRENCY, pokemonIds.length) }, worker));
  return results;
}

/** Fetch details for a single move. Results are cached for the session. */
export async function fetchMoveDetail(slug: string): Promise<MoveDetail> {
  if (moveDetailCache.has(slug)) return moveDetailCache.get(slug)!;

  const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
  if (!res.ok) throw new Error(`PokéAPI: failed to fetch move "${slug}" (${res.status})`);
  const detail = buildMoveDetail(slug, await res.json() as RawMove);

  moveDetailCache.set(slug, detail);
  return detail;
}

/**
 * Fetch details for a batch of moves, returning a Map keyed by slug.
 * Already-cached moves are returned immediately; only missing ones hit the network.
 * Requests are fired in parallel (PokéAPI tolerates this for typical learnset sizes).
 */
export async function fetchAllMoveDetails(slugs: string[]): Promise<Map<string, MoveDetail>> {
  const unique = [...new Set(slugs)];
  const missing = unique.filter((s) => !moveDetailCache.has(s));
  if (missing.length > 0) {
    await Promise.all(missing.map((s) => fetchMoveDetail(s)));
  }
  return new Map(unique.map((s) => [s, moveDetailCache.get(s)!]));
}
