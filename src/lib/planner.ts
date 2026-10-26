import type { GameVersion, Pokemon } from "../types";
import { GAME_PROGRESS, type MilestoneId } from "../data/game-progress";
import { GAME_ABBR, GAME_LABELS } from "../types";
import type { UnlockRequirement } from "../data/route-unlocks";
import { isReached, requirementsFor } from "./unlocks";
import type { GameProgress } from "./game-progress";

// "What do I actually need?": which games, and how far into each, can supply
// the Pokémon you haven't caught — and the few that cover the most.
//
// A species is supplied by its own encounters (NPC trades included), those of
// what it evolves from, and — when its family can breed — those of any family
// member, since breeding gives the base form. Daily Pokémon (Trophy Garden,
// Great Marsh) are taken as their area allows; their extra National Pokédex
// condition isn't applied here.

/** For each species, the species whose encounters can supply it (itself first) */
export function suppliersOf(pokemon: readonly Pokemon[]): Map<number, number[]> {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const rootOf = (p: Pokemon): Pokemon => {
    let at = p;
    for (let guard = 0; at.evolvesFrom !== null && byId.has(at.evolvesFrom) && guard < 5; guard++) at = byId.get(at.evolvesFrom)!;
    return at;
  };
  const family = new Map<number, Pokemon[]>();
  for (const p of pokemon) family.set(rootOf(p).id, [...(family.get(rootOf(p).id) ?? []), p]);
  const out = new Map<number, number[]>();
  for (const p of pokemon) {
    const members = family.get(rootOf(p).id) ?? [p];
    const ids = [p.id];
    if (members.some((m) => !m.eggGroups.includes("no-eggs"))) {
      for (const m of members) if (m.id !== p.id) ids.push(m.id);
    } else {
      for (let at = p.evolvesFrom !== null ? byId.get(p.evolvesFrom) : undefined, guard = 0; at && guard < 5; guard++) {
        ids.push(at.id);
        at = at.evolvesFrom !== null ? byId.get(at.evolvesFrom) : undefined;
      }
    }
    out.set(p.id, ids);
  }
  return out;
}

/** A game's progress ladder: from the start, then each milestone in story order (HG/SS: all 16 badges before Red). */
export interface Step { id: "start" | MilestoneId | "badges-16"; label: string }

export function ladderOf(game: string): Step[] {
  const def = GAME_PROGRESS[game as GameVersion];
  const steps: Step[] = [{ id: "start", label: "the start" }];
  for (const m of def?.milestones ?? []) {
    if (m.id === "red") steps.push({ id: "badges-16", label: "all 16 badges" });
    steps.push({ id: m.id, label: m.label });
  }
  return steps;
}

/** The ladder step a set of requirements needs (assumes the milestones come in story order) */
function stepFor(ladder: Step[], reqs: UnlockRequirement[]): number {
  let at = 0;
  for (const r of reqs) {
    const id = "badges" in r ? `badges-${r.badges}` : r.milestone;
    const i = ladder.findIndex((s) => s.id === id);
    if (i > at) at = i;
  }
  return at;
}

/** Per species, per game: the earliest ladder step at which the game can supply it */
export function sourceSteps(pokemon: readonly Pokemon[], games: readonly string[]): Map<number, Map<string, number>> {
  const ladders = new Map(games.map((g) => [g, ladderOf(g)]));
  // Each species' own earliest step per game
  const own = new Map<number, Map<string, number>>();
  for (const p of pokemon) {
    const m = new Map<string, number>();
    for (const e of p.encounters) {
      if (!games.includes(e.version)) continue;
      for (const l of e.locations) {
        for (const d of l.details) {
          const step = stepFor(ladders.get(e.version)!, requirementsFor(e.version, l.locationAreaSlug, d.method));
          if (step < (m.get(e.version) ?? Infinity)) m.set(e.version, step);
        }
      }
    }
    own.set(p.id, m);
  }
  const suppliers = suppliersOf(pokemon);
  const out = new Map<number, Map<string, number>>();
  for (const p of pokemon) {
    const m = new Map<string, number>();
    for (const id of suppliers.get(p.id) ?? [p.id]) {
      for (const [g, step] of own.get(id) ?? []) if (step < (m.get(g) ?? Infinity)) m.set(g, step);
    }
    out.set(p.id, m);
  }
  return out;
}

/** Species exactly one of the games can supply, at any point in it: id → that game */
export function soleSources(pokemon: readonly Pokemon[], games: readonly string[]): Map<number, string> {
  const out = new Map<number, string>();
  if (games.length < 2) return out;
  for (const [id, byGame] of sourceSteps(pokemon, games)) if (byGame.size === 1) out.set(id, [...byGame.keys()][0]);
  return out;
}

export interface PlanPick {
  game: string;
  /** Index into ladderOf(game) */
  step: number;
  /** "Platinum up to National Pokédex", "Pearl from the start" */
  label: string;
  /** Uncaught species this pick adds, beyond the picks before it */
  adds: number[];
}

export interface Plan {
  /** Uncaught species of the generation */
  missing: number[];
  picks: PlanPick[];
  /** Covered by the picks, as a share of `missing` (0–1) */
  coverage: number;
  /** Uncaught species none of the games can supply */
  unavailable: number[];
}

export function pickLabel(game: string, step: number): string {
  const ladder = ladderOf(game);
  const name = GAME_LABELS[game as GameVersion] ?? game;
  return step === 0 ? `${name} from the start` : `${name} up to ${ladder[step].label}`;
}

/**
 * A small set of (game, how far) choices that together supply the most of
 * what you're missing: greedy set cover, each time taking the choice that adds
 * the most (ties: the earlier step, then the earlier game). Going further in a
 * game already picked replaces that pick. Stops when nothing more is gained.
 */
export function planCoverage(pokemon: readonly Pokemon[], games: readonly string[], caught: ReadonlySet<number>, maxPicks = 6): Plan {
  const steps = sourceSteps(pokemon, games);
  const missing = pokemon.filter((p) => !caught.has(p.id)).map((p) => p.id);
  const coverable = missing.filter((id) => (steps.get(id)?.size ?? 0) > 0);
  const unavailable = missing.filter((id) => (steps.get(id)?.size ?? 0) === 0);
  const covered = new Set<number>();
  const chosen = new Map<string, PlanPick>();

  for (let round = 0; round < maxPicks + games.length; round++) {
    let best: { game: string; step: number; adds: number[] } | null = null;
    for (const game of games) {
      const ladder = ladderOf(game);
      const from = chosen.get(game)?.step ?? -1;
      for (let step = from + 1; step < ladder.length; step++) {
        const adds = coverable.filter((id) => !covered.has(id) && (steps.get(id)!.get(game) ?? Infinity) <= step);
        if (adds.length > (best?.adds.length ?? 0)) best = { game, step, adds };
      }
    }
    if (!best) break;
    const previous = chosen.get(best.game);
    if (!previous && chosen.size >= maxPicks) break;
    for (const id of best.adds) covered.add(id);
    chosen.set(best.game, {
      game: best.game,
      step: best.step,
      label: pickLabel(best.game, best.step),
      adds: [...(previous?.adds ?? []), ...best.adds],
    });
  }
  // In the order they were first chosen, which is by what they add
  const picks = [...chosen.values()];
  return { missing, picks, coverage: missing.length ? covered.size / missing.length : 1, unavailable };
}

/** Uncaught species a game can supply with this progress (encounters, evolution, breeding) */
export function suppliedNow(pokemon: readonly Pokemon[], game: string, progress: GameProgress | undefined, caught: ReadonlySet<number>): Set<number> {
  const open = new Set<number>();
  for (const p of pokemon) {
    for (const e of p.encounters) {
      if (e.version !== game) continue;
      if (e.locations.some((l) => l.details.some((d) => requirementsFor(game, l.locationAreaSlug, d.method).every((r) => isReached(r, progress))))) {
        open.add(p.id);
      }
    }
  }
  const out = new Set<number>();
  const suppliers = suppliersOf(pokemon);
  for (const p of pokemon) if (!caught.has(p.id) && (suppliers.get(p.id) ?? []).some((id) => open.has(id))) out.add(p.id);
  return out;
}

/**
 * What reaching a milestone opens in a game: the uncaught species it can
 * supply once that milestone is reached that it couldn't with everything
 * before it on the ladder — so each milestone is credited only with its own unlocks.
 */
export function unlockPreview(
  pokemon: readonly Pokemon[],
  game: string,
  milestone: MilestoneId,
  progress: GameProgress | undefined,
  caught: ReadonlySet<number>,
): number[] {
  const ladder = ladderOf(game);
  const at = ladder.findIndex((s) => s.id === milestone);
  if (at < 0) return [];
  const upTo = (end: number): GameProgress => {
    const milestones = { ...(progress?.milestones ?? {}) };
    const steps = ladder.slice(1, end + 1);
    for (const s of steps) if (s.id !== "badges-16") milestones[s.id as MilestoneId] = { done: true, source: "manual" };
    const badges = steps.some((s) => s.id === "badges-16")
      ? (GAME_PROGRESS[game as GameVersion]?.badges.map((b) => b.id) ?? [])
      : progress?.badges ?? [];
    return { badges, milestones };
  };
  const before = suppliedNow(pokemon, game, upTo(at - 1), caught);
  return [...suppliedNow(pokemon, game, upTo(at), caught)].filter((id) => !before.has(id)).sort((a, b) => a - b);
}

export const gameAbbr = (game: string) => GAME_ABBR[game as GameVersion] ?? game;
