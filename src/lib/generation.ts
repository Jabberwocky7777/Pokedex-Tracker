import metaData from "../data/meta.json";
import type { GameVersion, MetaData, Pokemon } from "../types";
import { abilityNames3 } from "./save/tables";

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

const plain = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The Pokémon's abilities in the generation being viewed. pokemon.json has them as
 * of Gen IV; in Gen III 89 species had one fewer (Clefable had no Magic Guard yet).
 */
export function abilitiesInGeneration(pokemon: Pokemon, generation: number): NonNullable<Pokemon["abilities"]> {
  const all = pokemon.abilities ?? [];
  if (generation !== 3) return all;
  const existed = new Set(abilityNames3(pokemon.id).map(plain));
  return all.filter((a) => existed.has(plain(a.name)));
}

/** The paired version of a game (Diamond ↔ Pearl), or null when it has none (Platinum, Emerald). */
export function pairedVersion(game: GameVersion): GameVersion | null {
  for (const g of meta.generations) {
    const pair = g.versionPairs.find((p) => p.includes(game));
    if (pair) return pair[0] === game ? pair[1] : pair[0];
  }
  return null;
}
