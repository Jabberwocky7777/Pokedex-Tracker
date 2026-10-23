/**
 * Moves and learnsets for the Pokédex, Attackdex, Designer and damage calc.
 * Everything comes from the generated files in public/data (see move-data.ts);
 * the functions are async because those files load on first use, not because
 * anything is fetched from PokéAPI.
 */
import { englishSlug, moveDisplayName } from "./move-names";
import {
  loadLearnsetsFile, loadMovesFile, VERSION_GROUPS,
  type Gen3VersionGroup, type Gen4VersionGroup, type MoveRecord, type VersionGroup,
} from "./move-data";
import type { MoveValues } from "./move-values";

export type { Gen3VersionGroup, Gen4VersionGroup, VersionGroup } from "./move-data";

/**
 * Type, power, accuracy and PP are the HeartGold/SoulSilver values, not the
 * latest games' (Thunderbolt is 95, Charm is Normal). For another supported
 * game, pass the detail through moveForVersionGroup().
 */
export interface MoveDetail extends MoveValues {
  name: string;
  displayName: string;
  /**
   * Gen 4+ per-move physical/special/status split.
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
  /** Hits every opponent (or everyone else) in a Double Battle */
  spread: boolean;
  /** The HeartGold/SoulSilver values, and where an older supported game differs — for moveForVersionGroup() */
  hgss: MoveValues;
  byVersionGroup: Partial<Record<VersionGroup, Partial<MoveValues>>>;
}

/**
 * Gen 1–3: move category is determined by the move's TYPE, not the move itself.
 * Everything else (Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark) is Special.
 */
const GEN3_PHYSICAL_TYPES = new Set([
  "normal", "fighting", "flying", "poison", "ground",
  "rock", "bug", "ghost", "steel",
]);

/** Gen III had no physical/special split: the type decided it. */
export function getGen3Category(
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

/** The same move as it is in another supported game (Outrage is 90 power in Gen III, 120 in Gen IV). */
export function moveForVersionGroup<T extends MoveDetail>(detail: T, versionGroup: VersionGroup): T {
  const values = { ...detail.hgss, ...detail.byVersionGroup[versionGroup] };
  return { ...detail, ...values, gen3Category: getGen3Category(values.type, detail.category) };
}

/** Builds a MoveDetail from a moves.json record, with the HeartGold/SoulSilver values up front. */
export function buildMoveDetail(record: MoveRecord): MoveDetail {
  const hgss: MoveValues = { type: record.type, power: record.power, accuracy: record.accuracy, pp: record.pp };
  return {
    name: record.slug,
    displayName: moveDisplayName(record.slug),
    ...hgss,
    category: record.category,
    gen3Category: getGen3Category(record.type, record.category),
    spread: record.spread === true,
    hgss,
    byVersionGroup: record.by ?? {},
  };
}

// ── Moves ────────────────────────────────────────────────────────────────────

interface MoveIndex {
  /** In move-id order */
  records: MoveRecord[];
  bySlug: Map<string, MoveRecord>;
}

let moveIndex: Promise<MoveIndex> | null = null;
const moveDetailCache = new Map<string, MoveDetail>();

export function loadMoveIndex(): Promise<MoveIndex> {
  if (!moveIndex) {
    moveIndex = loadMovesFile().then((file) => {
      const bySlug = new Map<string, MoveRecord>();
      for (const record of file.moves) {
        bySlug.set(record.slug, record);
        // Also under the slug of its English name: "vise-grip" for PokéAPI's "vice-grip"
        bySlug.set(englishSlug(record.slug), record);
      }
      return { records: file.moves, bySlug };
    });
    moveIndex.catch(() => { moveIndex = null; });
  }
  return moveIndex;
}

/** Details for a single move. Rejects for a slug that isn't a Gen I–IV move. */
export async function fetchMoveDetail(slug: string): Promise<MoveDetail> {
  const cached = moveDetailCache.get(slug);
  if (cached) return cached;
  const record = (await loadMoveIndex()).bySlug.get(slug);
  if (!record) throw new Error(`Unknown move "${slug}"`);
  const detail = buildMoveDetail(record);
  moveDetailCache.set(slug, detail);
  return detail;
}

/** Details for a batch of moves, as a Map keyed by slug. */
export async function fetchAllMoveDetails(slugs: string[]): Promise<Map<string, MoveDetail>> {
  const unique = [...new Set(slugs)];
  const details = await Promise.all(unique.map((s) => fetchMoveDetail(s)));
  return new Map(unique.map((s, i) => [s, details[i]]));
}

// ── Learnsets ────────────────────────────────────────────────────────────────

const learnsetCache = new Map<number, PokemonLearnset>();

/** The learnset of a Pokémon in every Gen III–IV version group (empty lists for games it isn't in). */
export async function fetchLearnset(pokemonId: number): Promise<PokemonLearnset> {
  const cached = learnsetCache.get(pokemonId);
  if (cached) return cached;

  const file = await loadLearnsetsFile();
  const lists = file.pokemon[pokemonId] ?? [];
  const learnset = {} as PokemonLearnset;
  VERSION_GROUPS.forEach((versionGroup, i) => {
    const flat = lists[i] ?? [];
    const moves: LearnedMove[] = [];
    for (let j = 0; j < flat.length; j += 3) {
      moves.push({ move: file.moves[flat[j]], method: file.methods[flat[j + 1]], level: flat[j + 2] });
    }
    learnset[versionGroup] = moves;
  });

  learnsetCache.set(pokemonId, learnset);
  return learnset;
}

export function fetchLearnsets(pokemonIds: number[]): Promise<PokemonLearnset[]> {
  return Promise.all(pokemonIds.map(fetchLearnset));
}

let learnerIndex: Promise<Map<string, number[]>> | null = null;

/** Species ids (ascending) that learn the move, by any method, in at least one Gen III–IV game. */
export async function fetchLearners(slug: string): Promise<number[]> {
  if (!learnerIndex) {
    learnerIndex = loadLearnsetsFile().then((file) => {
      const byMove = new Map<string, Set<number>>();
      for (const [speciesId, lists] of Object.entries(file.pokemon)) {
        for (const flat of lists) {
          for (let j = 0; j < flat.length; j += 3) {
            const move = file.moves[flat[j]];
            let learners = byMove.get(move);
            if (!learners) byMove.set(move, (learners = new Set()));
            learners.add(Number(speciesId));
          }
        }
      }
      return new Map(Array.from(byMove, ([move, ids]) => [move, [...ids].sort((a, b) => a - b)]));
    });
    learnerIndex.catch(() => { learnerIndex = null; });
  }
  return (await learnerIndex).get(slug) ?? [];
}
