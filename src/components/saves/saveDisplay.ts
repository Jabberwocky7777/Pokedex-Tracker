import type { Pokemon } from "../../types";
import { getGenShinySprite, getGenSprite } from "../../lib/pokemon-display";
import { PARTY_BOX, SAVE_GEN, type SlimMon } from "../../lib/save/types";

// Small display helpers shared by the Saves view, the Pokémon card and the
// detail panel's "In your saves" card.

const EGG_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/egg.png";

export function monSprite(mon: Pick<SlimMon, "shiny" | "isEgg">, pokemon: Pokemon | undefined): string {
  if (mon.isEgg || !pokemon) return EGG_SPRITE;
  return mon.shiny ? getGenShinySprite(pokemon, SAVE_GEN) : getGenSprite(pokemon, SAVE_GEN);
}

/** "001-030 · slot 11" — slots are shown 1-based, as the game counts them. */
export function slotLabel(boxNames: string[], box: number, slot: number): string {
  if (box === PARTY_BOX) return `Party · slot ${slot + 1}`;
  return `${boxNames[box] || `Box ${box + 1}`} · slot ${slot + 1}`;
}

const DAY_MS = 86_400_000;
export const STALE_AFTER_DAYS = 14;

export function daysSince(timestamp: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

export function importedAgo(timestamp: number, now = Date.now()): string {
  const days = daysSince(timestamp, now);
  if (days === 0) return "imported today";
  return `imported ${days} day${days === 1 ? "" : "s"} ago`;
}
