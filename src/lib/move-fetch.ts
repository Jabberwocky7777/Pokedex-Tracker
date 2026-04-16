// Module-level caches — survive React renders and re-mounts
// All data is fetched lazily on first request, then served from cache.

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

const ALL_VG_SET = new Set<string>([
  "ruby-sapphire", "emerald", "firered-leafgreen",
  "diamond-pearl", "platinum", "heartgold-soulsilver",
]);

const learnsetCache = new Map<number, PokemonLearnset>();
const moveDetailCache = new Map<string, MoveDetail>();

function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

/** Fetch details for a single move. Results are cached for the session. */
export async function fetchMoveDetail(slug: string): Promise<MoveDetail> {
  if (moveDetailCache.has(slug)) return moveDetailCache.get(slug)!;

  const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
  if (!res.ok) throw new Error(`PokéAPI: failed to fetch move "${slug}" (${res.status})`);
  const data = await res.json() as {
    type: { name: string };
    damage_class: { name: string };
    power: number | null;
    accuracy: number | null;
    pp: number;
  };

  const modernCategory = data.damage_class.name as MoveDetail["category"];
  const detail: MoveDetail = {
    name: slug,
    displayName: slugToDisplayName(slug),
    type: data.type.name,
    category: modernCategory,
    gen3Category: getGen3Category(data.type.name, modernCategory),
    power: data.power,
    accuracy: data.accuracy,
    pp: data.pp,
  };

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
