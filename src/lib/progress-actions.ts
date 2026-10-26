import { useGameProgressStore } from "../store/useGameProgressStore";
import { useChangeLogStore } from "../store/useChangeLogStore";
import { useUndoStore } from "../store/useUndoStore";
import type { MilestoneId } from "../data/game-progress";
import { applyProgress, changeName, isProgressApplied, type GameProgress, type ProgressChange, type ProgressSource } from "./game-progress";
import { generationOfVersion } from "./generation";
import { GAME_ABBR, type GameVersion } from "../types";

// Every Game Progress change goes through here, like marks go through
// dex-actions.ts: an undo toast, and a line in the change log (kind "progress").

export function currentProgress(game: string): GameProgress | undefined {
  const entry = useGameProgressStore.getState().entries[game];
  return entry && !entry.removed ? { badges: entry.badges, milestones: entry.milestones } : undefined;
}

/** Writes changes to the store, game by game, leaving out any that are already so. Returns what changed. */
export function writeProgress(
  changes: readonly ProgressChange[],
  source: ProgressSource,
  reachedAt?: Partial<Record<MilestoneId, number>>,
): ProgressChange[] {
  const applied: ProgressChange[] = [];
  const byGame = new Map<string, ProgressChange[]>();
  for (const c of changes) {
    if (isProgressApplied(c, currentProgress(c.game))) continue;
    byGame.set(c.game, [...(byGame.get(c.game) ?? []), c]);
    applied.push(c);
  }
  for (const [game, list] of byGame) {
    useGameProgressStore.getState().put(game, applyProgress(currentProgress(game), list, Date.now(), source, reachedAt));
  }
  return applied;
}

/** Takes back changes that still have the value they gave; returns how many were and weren't. */
export function revertProgress(changes: readonly ProgressChange[]): { reverted: number; skipped: number } {
  const revertible = changes.filter((c) => isProgressApplied(c, currentProgress(c.game)));
  writeProgress(revertible.map((c) => ({ ...c, value: !c.value }) as ProgressChange), "manual");
  return { reverted: revertible.length, skipped: changes.length - revertible.length };
}

const genOf = (game: string) => generationOfVersion(game) ?? 4;
const abbr = (game: string) => GAME_ABBR[game as GameVersion] ?? game;

/** Ticks or unticks one badge or milestone by hand: "Coal Badge (Pt) ticked · Undo". */
export function setProgressWithUndo(change: ProgressChange): void {
  const applied = writeProgress([change], "manual");
  if (applied.length === 0) return;
  useChangeLogStore.getState().recordProgress(genOf(change.game), applied);
  const message = `${changeName(change)} (${abbr(change.game)}) ${change.value ? "ticked" : "unticked"}`;
  useUndoStore.getState().show(message, () => {
    const back = applied.map((c) => ({ ...c, value: !c.value }) as ProgressChange);
    // Logged like any change: taking it straight back cancels it out of its log entry
    useChangeLogStore.getState().recordProgress(genOf(change.game), writeProgress(back, "manual"));
  });
}

/**
 * Applies the progress ticked in an import review. Logged on the import's own
 * entry when there is one (so undoing the import takes it back too), else as
 * its own progress entry.
 */
export function applyProgressFromSave(
  changes: readonly ProgressChange[],
  importEntryId: string | null,
  reachedAt?: Partial<Record<MilestoneId, number>>,
): { applied: ProgressChange[]; entryId: string | null } {
  const applied = writeProgress(changes, "save", reachedAt);
  if (applied.length === 0) return { applied, entryId: importEntryId };
  if (importEntryId) {
    useChangeLogStore.getState().attachProgress(importEntryId, applied);
    return { applied, entryId: importEntryId };
  }
  return { applied, entryId: useChangeLogStore.getState().recordProgress(genOf(applied[0].game), applied) };
}
