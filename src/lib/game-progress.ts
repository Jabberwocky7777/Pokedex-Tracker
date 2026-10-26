import type { GameVersion } from "../types";
import { GAME_PROGRESS, type MilestoneId } from "../data/game-progress";

// Game Progress (badges and story milestones per game) — the pure part. The store
// is store/useGameProgressStore.ts; changes with undo and the change log are
// lib/progress-actions.ts. Not to be confused with the catch-count milestones of
// lib/progress-history.ts.

export type ProgressSource = "manual" | "save";

export interface MilestoneState {
  done: boolean;
  /** When it was reached (epoch ms) — when it was ticked, or the save's Hall of Fame date */
  at?: number;
  source: ProgressSource;
}

/** One game's progress. Synced as an entry of the `gameProgress` section, keyed by game. */
export interface GameProgress {
  /** Earned badge ids (data/game-progress.ts), ascending */
  badges: number[];
  milestones: Partial<Record<MilestoneId, MilestoneState>>;
}

/** One change: a badge or a milestone set to a value. What it was before is the opposite. */
export type ProgressChange =
  | { game: string; kind: "badge"; id: number; value: boolean }
  | { game: string; kind: "milestone"; id: MilestoneId; value: boolean };

export const EMPTY_PROGRESS: GameProgress = { badges: [], milestones: {} };

/** Whether a game's badge or milestone is set */
export function isSet(progress: GameProgress | undefined, change: Pick<ProgressChange, "kind" | "id">): boolean {
  if (!progress) return false;
  return change.kind === "badge"
    ? progress.badges.includes(change.id as number)
    : progress.milestones[change.id as MilestoneId]?.done === true;
}

/** True while the change still has the value it gave — only then can undoing it be right. */
export const isProgressApplied = (change: ProgressChange, current: GameProgress | undefined) =>
  isSet(current, change) === change.value;

/** A game's progress with some changes applied. Milestones keep the date they were first reached. */
export function applyProgress(
  progress: GameProgress | undefined,
  changes: readonly ProgressChange[],
  now: number,
  source: ProgressSource,
  /** When a milestone was really reached, if known (a save's Hall of Fame date) */
  reachedAt?: Partial<Record<MilestoneId, number>>,
): GameProgress {
  const badges = new Set(progress?.badges ?? []);
  const milestones = { ...(progress?.milestones ?? {}) };
  for (const c of changes) {
    if (c.kind === "badge") {
      if (c.value) badges.add(c.id); else badges.delete(c.id);
    } else if (c.value) {
      const was = milestones[c.id];
      milestones[c.id] = was?.done ? was : { done: true, at: reachedAt?.[c.id] ?? now, source };
    } else {
      delete milestones[c.id];
    }
  }
  return { badges: [...badges].sort((a, b) => a - b), milestones };
}

/** Changes cancel out when one takes back another (ticking a badge and unticking it). */
export function mergeProgressChanges(earlier: ProgressChange[], later: ProgressChange[]): ProgressChange[] {
  const merged = [...earlier];
  for (const change of later) {
    const at = merged.findIndex((c) => c.game === change.game && c.kind === change.kind && c.id === change.id);
    if (at === -1) merged.push(change);
    else if (merged[at].value !== change.value) merged.splice(at, 1);
  }
  return merged;
}

/** "Coal Badge", "National Pokédex" */
export function changeName(change: ProgressChange): string {
  const def = GAME_PROGRESS[change.game as GameVersion];
  if (change.kind === "badge") return def?.badges.find((b) => b.id === change.id)?.name ?? `Badge ${change.id + 1}`;
  return def?.milestones.find((m) => m.id === change.id)?.label ?? change.id;
}

/** "5/8" — earned badges of the game's badges (16 in HG/SS) */
export function badgeCount(game: string, progress: GameProgress | undefined): { earned: number; total: number } {
  const def = GAME_PROGRESS[game as GameVersion];
  const total = def?.badges.length ?? 8;
  const ids = new Set(def?.badges.map((b) => b.id) ?? []);
  return { earned: (progress?.badges ?? []).filter((id) => ids.has(id)).length, total };
}

/**
 * Proposed changes from a save's progress: only ever forward (a badge or
 * milestone the save has and the tracker doesn't), never unticking anything —
 * an older dump or a second save of the same game must not take progress back.
 */
export function proposeFromSave(
  game: string,
  current: GameProgress | undefined,
  read: { badges?: number[]; hallOfFame?: boolean; nationalDex?: boolean },
): ProgressChange[] {
  const def = GAME_PROGRESS[game as GameVersion];
  if (!def) return [];
  const out: ProgressChange[] = [];
  for (const id of read.badges ?? []) {
    if (def.badges.some((b) => b.id === id) && !isSet(current, { kind: "badge", id })) out.push({ game, kind: "badge", id, value: true });
  }
  const milestone = (id: MilestoneId, on: boolean | undefined) => {
    if (on && def.milestones.some((m) => m.id === id) && !isSet(current, { kind: "milestone", id })) out.push({ game, kind: "milestone", id, value: true });
  };
  milestone("hall-of-fame", read.hallOfFame);
  milestone("national-dex", read.nationalDex);
  return out;
}

/** "12h 05m" */
export function playTimeText(t: { hours: number; minutes: number }): string {
  return `${t.hours}h ${String(t.minutes).padStart(2, "0")}m`;
}
