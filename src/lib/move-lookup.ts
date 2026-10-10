/**
 * Converts move display names (Battle Tower / designer format) to PokéAPI slugs
 * and batch-fetches power / type / category for each move.
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

/** Generation IV spelling (as a slug) → PokéAPI's slug. */
const GEN4_SPELLINGS: Record<string, string> = {
  "hi-jump-kick": "high-jump-kick",
  "faint-attack": "feint-attack",
  "selfdestruct": "self-destruct",
  "softboiled": "soft-boiled",
  "smoke-screen": "smokescreen",
  "vice-grip": "vise-grip",
  "smelling-salt": "smelling-salts",
};

/** Convert a move display name to a PokéAPI slug. */
export function moveNameToSlug(name: string): string {
  const slug = (
    name
      // camelCase → hyphenated  ("GrassWhistle" → "Grass-Whistle")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // Remove apostrophes  ("King's Rock" → "Kings Rock")
      .replace(/'/g, "")
      // Spaces → hyphens
      .replace(/\s+/g, "-")
      .toLowerCase()
      // Collapse consecutive hyphens
      .replace(/-+/g, "-")
      .trim()
  );
  return GEN4_SPELLINGS[slug] ?? slug;
}

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
    // Move not in PokéAPI (or network error) — say so rather than showing no damage
    return { ...move, notFound: true };
  }
}

/**
 * Enrich all moves in the array with power/type/category fetched from PokéAPI.
 * Already-enriched moves (power > 0) are skipped.
 * Silently skips moves that can't be resolved.
 */
export async function enrichCalcMoves(moves: CalcMove[]): Promise<CalcMove[]> {
  return Promise.all(moves.map(tryEnrichMove));
}
