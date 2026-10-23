/**
 * Converts move display names (Battle Tower / designer format) to PokéAPI slugs
 * and looks up power / type / category for each move in the generated move data.
 *
 * Examples:
 *   "GrassWhistle"  → "grass-whistle"
 *   "ThunderPunch"  → "thunder-punch"
 *   "Hi Jump Kick"  → "hi-jump-kick"
 *   "Will-O-Wisp"   → "will-o-wisp"
 *
 * A few moves were spelled differently in Generation IV than PokéAPI spells
 * them now ("Hi Jump Kick", "Faint Attack"); GEN4_SPELLINGS maps those.
 */

import { fetchMoveDetail } from "./move-fetch";
import type { CalcMove } from "../types/battleTower";
import { moveNameToSlug } from "./move-slug";

// The name → slug conversion has no data behind it, so it lives on its own
// (lib/navigate.ts needs it without loading the move tables)
export { moveNameToSlug } from "./move-slug";

/** Try to fill in power/type/category for one move. Returns the move unchanged on failure. */
async function tryEnrichMove(move: CalcMove): Promise<CalcMove> {
  const name = move.name.trim();
  // Nothing to do if empty or already has real power data
  if (!name) return move;
  if (move.power > 0) return move;

  try {
    const slug = moveNameToSlug(name);
    const detail = await fetchMoveDetail(slug);
    return {
      ...move,
      power: detail.power ?? 0,
      type: detail.type,
      category: detail.category,
      spread: detail.spread,
      notFound: false,
    };
  } catch {
    // Not a Gen I–IV move (or the data file didn't load) — say so rather than showing no damage
    return { ...move, notFound: true };
  }
}

/**
 * Enrich all moves in the array with power/type/category from the move data.
 * Already-enriched moves (power > 0) are skipped.
 * Silently skips moves that can't be resolved.
 */
export async function enrichCalcMoves(moves: CalcMove[]): Promise<CalcMove[]> {
  return Promise.all(moves.map(tryEnrichMove));
}
