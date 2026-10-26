import type { GameVersion, Pokemon } from "../types";
import { AREA_UNLOCKS, METHOD_UNLOCKS, type UnlockRequirement } from "../data/route-unlocks";
import { milestoneLabel } from "../data/game-progress";
import type { GameProgress } from "./game-progress";

// Whether an encounter can be reached with the Game Progress you have, from
// data/route-unlocks.ts. Pure: progress is passed in.

/** Everything an encounter needs in one game: its area's requirement and its method's */
export function requirementsFor(
  game: string,
  slug: string,
  method: string,
  /** Daily Pokémon (Trophy Garden, Great Marsh) — see `dailyNeedsNationalDex` */
  daily?: "trophy-garden" | "great-marsh",
): UnlockRequirement[] {
  const out: UnlockRequirement[] = [];
  const area = AREA_UNLOCKS[game as GameVersion]?.[slug];
  if (area) out.push(area);
  const byMethod = METHOD_UNLOCKS[game as GameVersion]?.[method];
  if (byMethod) out.push(byMethod);
  if (daily && dailyNeedsNationalDex(game, daily)) out.push({ milestone: "national-dex" });
  return out;
}

/**
 * Trophy Garden's daily Pokémon only appear with the National Pokédex in all
 * three Sinnoh games (Mr. Backlot); the Great Marsh's binoculars Pokémon only
 * with it in Platinum (pret/pokeplatinum src/overlay006/wild_encounters.c,
 * great_marsh_daily_encounters.c). Diamond and Pearl's marsh isn't confirmed.
 */
function dailyNeedsNationalDex(game: string, daily: "trophy-garden" | "great-marsh"): boolean {
  if (daily === "trophy-garden") return ["diamond", "pearl", "platinum"].includes(game);
  return game === "platinum";
}

export function isReached(req: UnlockRequirement, progress: GameProgress | undefined): boolean {
  if ("badges" in req) return (progress?.badges.length ?? 0) >= req.badges;
  return progress?.milestones[req.milestone]?.done === true;
}

/** "National Pokédex", "All 16 badges" */
export function requirementText(req: UnlockRequirement, game: string): string {
  return "badges" in req ? `All ${req.badges} badges` : milestoneLabel(game, req.milestone);
}

export const sameRequirement = (a: UnlockRequirement, b: UnlockRequirement) =>
  ("badges" in a && "badges" in b && a.badges === b.badges) ||
  ("milestone" in a && "milestone" in b && a.milestone === b.milestone);

/**
 * Of the selected games where an encounter happens, whether any is reachable
 * now — and, when none is, what the nearest one needs (the first game in the list).
 */
export function reachability(
  games: readonly string[],
  needs: (game: string) => UnlockRequirement[],
  progressOf: (game: string) => GameProgress | undefined,
): { reachable: true } | { reachable: false; game: string; missing: UnlockRequirement[] } {
  let first: { game: string; missing: UnlockRequirement[] } | null = null;
  for (const game of games) {
    const missing = needs(game).filter((r) => !isReached(r, progressOf(game)));
    if (missing.length === 0) return { reachable: true };
    first ??= { game, missing };
  }
  return first ? { reachable: false, ...first } : { reachable: true };
}

/** Every encounter area of a game, for listing the ones without unlock data */
export function areasOf(pokemon: readonly Pokemon[], game: string): Set<string> {
  const out = new Set<string>();
  for (const p of pokemon) for (const e of p.encounters) if (e.version === game) for (const l of e.locations) out.add(l.locationAreaSlug);
  return out;
}
