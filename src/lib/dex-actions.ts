import { useDexStore, type DexField, type GenSnapshot, type MarkChange } from "../store/useDexStore";
import { useUndoStore } from "../store/useUndoStore";
import { useChangeLogStore } from "../store/useChangeLogStore";
import { diffSnapshots, isApplied, type LogKind } from "./change-log";
import { completeLinkedItems } from "./working-on";

// Every caught / pending / shiny / placed change in the UI goes through here so it gets
// an undo toast and a line in the change log. Undo writes the previous value back with
// the normal store setters, which stamps the entry — so sync picks the undo up like any edit.

const MESSAGES: Record<DexField, { on: (name: string) => string; off: (name: string) => string }> = {
  caught:  { on: (n) => `Marked ${n} caught`,  off: (n) => `Unmarked ${n}` },
  pending: { on: (n) => `Marked ${n} pending`, off: (n) => `${n} no longer pending` },
  shiny:   { on: (n) => `Marked ${n} shiny`,   off: (n) => `${n} no longer shiny` },
  placed:  { on: (n) => `Marked ${n} placed`,  off: (n) => `${n} no longer placed` },
};

function read(field: DexField, id: number, gen: number): boolean {
  const s = useDexStore.getState();
  if (field === "caught") return s.isCaught(id, gen);
  if (field === "pending") return s.isPending(id, gen);
  if (field === "shiny") return s.isShiny(id, gen);
  return s.isPlaced(id, gen);
}

function write(field: DexField, id: number, value: boolean, gen: number): void {
  const s = useDexStore.getState();
  if (field === "caught") s.setCaught(id, value, gen);
  else if (field === "pending") s.setPending(id, value, gen);
  else if (field === "shiny") s.setShiny(id, value, gen);
  else s.setPlaced(id, value, gen);
}

/**
 * Runs a change to one generation's marks and logs whatever actually differs
 * afterwards. Returns the log entry's id (null when nothing changed), the
 * marks as they were before, and the changes themselves.
 */
function logged(gen: number, kind: LogKind, label: string, change: () => void): { entryId: string | null; before: GenSnapshot; changes: MarkChange[] } {
  const before = useDexStore.getState().getGenSnapshot(gen);
  change();
  const changes = diffSnapshots(before, useDexStore.getState().getGenSnapshot(gen));
  return { entryId: useChangeLogStore.getState().record(gen, kind, label, changes), before, changes };
}

/**
 * The Undo for a bulk change (a clear, an import, a revert): takes back that
 * entry's changes, each only while it still has the value the entry gave it.
 * Restoring the whole "before" snapshot instead would also undo marks made
 * since — on this device or synced in from another — and push that everywhere.
 */
function undoEntry(entryId: string | null): void {
  if (entryId) undoLogEntry(entryId);
}

/** Toggles one mark and shows "… · Undo" for a few seconds. */
export function toggleWithUndo(field: DexField, id: number, gen: number, displayName: string): void {
  const previous = read(field, id, gen);
  logged(gen, "marks", "", () => write(field, id, !previous, gen));
  // Catching a Pokémon finishes the "Working on" items linked to it
  const completed = field === "caught" && !previous ? completeLinkedItems(id, gen) : null;
  const message = previous ? MESSAGES[field].off(displayName) : MESSAGES[field].on(displayName);
  // Logged like any mark: taking a mark straight back cancels it out of its log entry
  useUndoStore.getState().show(completed ? `Caught ${displayName} — ${completed.note}` : message, () => {
    logged(gen, "marks", "", () => write(field, id, previous, gen));
    completed?.undo();
  });
}

/**
 * Makes a generation match a snapshot, logs it, and returns the function that
 * takes it back (restoring exactly what was there and marking the entry undone).
 */
export function restoreGenLogged(gen: number, snapshot: GenSnapshot, kind: LogKind, label: string): () => void {
  const { entryId } = logged(gen, kind, label, () => useDexStore.getState().restoreGen(gen, snapshot));
  return () => undoEntry(entryId);
}

export interface RevertResult {
  /** Marks put back */
  reverted: number;
  /** Marks left alone because they have been changed again since */
  skipped: number;
  /** Takes the revert back (the same way: only marks still as the revert left them) */
  undo: () => void;
}

/**
 * Takes back a set of changes — what an import did — logged as a "revert".
 * A mark is only put back while it still has the value the change gave it, so
 * everything changed since (by hand, by another import, or by sync) is kept.
 */
export function revertChangesLogged(gen: number, changes: MarkChange[], label: string): RevertResult {
  const current = useDexStore.getState().getGenSnapshot(gen);
  const revertible = changes.filter((c) => isApplied(c, current));
  const { entryId } = logged(gen, "revert", label, () =>
    useDexStore.getState().applyMarks(gen, revertible.map((c) => ({ ...c, value: !c.value }))));
  return { reverted: revertible.length, skipped: changes.length - revertible.length, undo: () => undoEntry(entryId) };
}

/** Clears every mark for a generation; Undo puts back every cleared mark that hasn't been set again since. */
export function clearGenerationWithUndo(gen: number, label: string): void {
  const message = `Cleared all ${label} marks`;
  const undo = restoreGenLogged(gen, { caught: [], pending: [], shiny: [], placed: [] }, "clear", message);
  useUndoStore.getState().show(message, undo);
}

/**
 * Applies the ticked changes from a save import in one go; Undo takes those
 * changes back. Returns the pre-import snapshot and the changes that really
 * happened, which the caller keeps for "Revert last import".
 */
export function applyImportWithUndo(gen: number, changes: MarkChange[], label: string): { before: GenSnapshot; applied: MarkChange[] } {
  const { entryId, before, changes: applied } = logged(gen, "import", `Imported ${label}`, () => useDexStore.getState().applyMarks(gen, changes));
  const count = changes.length;
  useUndoStore.getState().show(`Applied ${count} change${count === 1 ? "" : "s"} from ${label}`, () => undoEntry(entryId));
  return { before, applied };
}

// ── Undo and redo from the change log ─────────────────────────────────────────

export interface LogUndoResult {
  /** Marks put back */
  reverted: number;
  /** Marks left alone because they have been changed again since */
  skipped: number;
}

/**
 * Takes back a log entry — or, with `pokemonId`, just that Pokémon's part of it.
 * A mark is only put back while it still has the value the entry gave it; one
 * that has been changed again since is left as it is and counted as skipped.
 */
export function undoLogEntry(entryId: string, pokemonId?: number): LogUndoResult {
  const log = useChangeLogStore.getState();
  const entry = log.entries.find((e) => e.id === entryId);
  if (!entry || entry.undoneAt !== undefined) return { reverted: 0, skipped: 0 };
  const current = useDexStore.getState().getGenSnapshot(entry.gen);
  const wanted = entry.changes.filter((c) => pokemonId === undefined || c.id === pokemonId);
  const revertible = wanted.filter((c) => isApplied(c, current));
  useDexStore.getState().applyMarks(entry.gen, revertible.map((c) => ({ ...c, value: !c.value })));
  if (pokemonId === undefined) log.setUndone(entryId, true);
  else log.removePokemon(entryId, pokemonId);
  return { reverted: revertible.length, skipped: wanted.length - revertible.length };
}

/** Applies an undone entry again. */
export function redoLogEntry(entryId: string): void {
  const log = useChangeLogStore.getState();
  const entry = log.entries.find((e) => e.id === entryId);
  if (!entry || entry.undoneAt === undefined) return;
  useDexStore.getState().applyMarks(entry.gen, entry.changes);
  log.setUndone(entryId, false);
}
