import type { Pokemon } from "../types";

/** Returns the generation-appropriate sprite URL, falling back to the default sprite. */
export function getGenSprite(pokemon: Pokemon, activeGeneration: number): string {
  return (activeGeneration === 4 ? pokemon.gen4Sprite : pokemon.gen3Sprite) || pokemon.spriteUrl;
}

/** Formats a Pokémon ID as a zero-padded three-digit string, e.g. 7 → "007". */
export function formatDexNumber(id: number): string {
  return String(id).padStart(3, "0");
}
