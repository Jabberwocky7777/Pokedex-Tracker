/**
 * The generated move and learnset files (public/data/moves.json and
 * learnsets.json, written by scripts/moves-data.ts): their shapes, and the
 * loader. Each file is fetched once, the first time something needs it, so
 * the first page load doesn't pay for them. Nothing here talks to PokéAPI.
 */
import type { MoveValues } from "./move-values";

export type Gen3VersionGroup = "ruby-sapphire" | "emerald" | "firered-leafgreen";
export type Gen4VersionGroup = "diamond-pearl" | "platinum" | "heartgold-soulsilver";
export type VersionGroup = Gen3VersionGroup | Gen4VersionGroup;

/** Oldest first. The order learnsets.json stores a Pokémon's lists in. */
export const VERSION_GROUPS: VersionGroup[] = [
  "ruby-sapphire", "emerald", "firered-leafgreen", "diamond-pearl", "platinum", "heartgold-soulsilver",
];

export type MoveCategory = "physical" | "special" | "status";

/** One move in moves.json. Type, power, accuracy and PP are the HeartGold/SoulSilver values. */
export interface MoveRecord extends MoveValues {
  id: number;
  /** PokéAPI identifier, e.g. "u-turn" */
  slug: string;
  /** Generation that introduced the move (1–4) */
  gen: number;
  category: MoveCategory;
  /** Hits every opponent (or everyone else) in a Double Battle */
  spread?: true;
  /** Only where an older supported game differs from HeartGold/SoulSilver */
  by?: Partial<Record<VersionGroup, Partial<MoveValues>>>;
  shortEffect: string;
  effect: string;
  contest: string | null;
  /** The in-game description, per game that has the move */
  flavor: Partial<Record<VersionGroup, string>>;
}

export interface MovesFile {
  pokeapiCommit: string;
  moves: MoveRecord[];
}

export interface LearnsetsFile {
  pokeapiCommit: string;
  /** Learn-method names; entries refer to them by index */
  methods: string[];
  /** Move slug by move id (index 0 is unused) */
  moves: string[];
  /**
   * Species id → one list per VERSION_GROUPS entry, each a flat run of
   * [move id, method index, level] triples (level 0 for anything but level-up).
   */
  pokemon: Record<string, number[][]>;
}

const loading = new Map<string, Promise<unknown>>();

function loadData<T>(file: string): Promise<T> {
  let promise = loading.get(file) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(`/data/${file}`).then((res) => {
      if (!res.ok) throw new Error(`Could not load /data/${file} (${res.status})`);
      return res.json() as Promise<T>;
    });
    // A failed load is not remembered, so the next call tries again
    promise.catch(() => loading.delete(file));
    loading.set(file, promise);
  }
  return promise;
}

export const loadMovesFile = () => loadData<MovesFile>("moves.json");
export const loadLearnsetsFile = () => loadData<LearnsetsFile>("learnsets.json");
