import type { Pokemon } from "../types";

/** Returns the generation-appropriate sprite URL, falling back to the default sprite. */
export function getGenSprite(pokemon: Pokemon, activeGeneration: number): string {
  return (activeGeneration === 4 ? pokemon.gen4Sprite : pokemon.gen3Sprite) || pokemon.spriteUrl;
}

/** Returns the generation-appropriate shiny sprite URL, derived from the normal sprite path. */
export function getGenShinySprite(pokemon: Pokemon, activeGeneration: number): string {
  const base = activeGeneration === 4 ? pokemon.gen4Sprite : pokemon.gen3Sprite;
  if (base) return base.replace(/\/(\d+\.png)$/, '/shiny/$1');
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemon.id}.png`;
}

/** Formats a Pokémon ID as a zero-padded three-digit string, e.g. 7 → "007". */
export function formatDexNumber(id: number): string {
  return String(id).padStart(3, "0");
}
