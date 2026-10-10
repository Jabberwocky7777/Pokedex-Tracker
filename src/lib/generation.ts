import metaData from "../data/meta.json";
import type { GameVersion, MetaData } from "../types";

// What each supported generation covers, read from meta.json so components
// don't carry their own 386 / 493 or game lists.

const meta = metaData as MetaData;
const LATEST = meta.generations[meta.generations.length - 1];

const generationMeta = (generation: number) => meta.generations.find((g) => g.id === generation) ?? LATEST;

/** Highest National Dex number that exists in the generation (386 for Gen III, 493 for Gen IV). */
export function generationMaxId(generation: number): number {
  return generationMeta(generation).pokemonRange[1];
}

/** The games of the generation, in display order. */
export function generationVersions(generation: number): GameVersion[] {
  return generationMeta(generation).versions;
}

/** The paired version of a game (Diamond ↔ Pearl), or null when it has none (Platinum, Emerald). */
export function pairedVersion(game: GameVersion): GameVersion | null {
  for (const g of meta.generations) {
    const pair = g.versionPairs.find((p) => p.includes(game));
    if (pair) return pair[0] === game ? pair[1] : pair[0];
  }
  return null;
}
