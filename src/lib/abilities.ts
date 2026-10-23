/**
 * Kept apart from lib/generation.ts, which every screen loads: this needs the
 * save tables (~60 kB), which only the Pokédex and the Designer should pull in.
 */
import type { Pokemon } from "../types";
import { abilityNames3 } from "./save/tables";

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
