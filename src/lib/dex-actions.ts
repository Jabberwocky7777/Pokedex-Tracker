import { useDexStore, type DexField, type GenSnapshot, type MarkChange } from "../store/useDexStore";
import { useUndoStore } from "../store/useUndoStore";

// Every caught / pending / shiny / placed toggle in the UI goes through here so it gets
// an undo toast. Undo writes the previous value back with the normal store
// setters, which stamps the entry — so sync picks the undo up like any edit.

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

/** Toggles one mark and shows "… · Undo" for a few seconds. */
export function toggleWithUndo(field: DexField, id: number, gen: number, displayName: string): void {
  const previous = read(field, id, gen);
  write(field, id, !previous, gen);
  const message = previous ? MESSAGES[field].off(displayName) : MESSAGES[field].on(displayName);
  useUndoStore.getState().show(message, () => write(field, id, previous, gen));
}

/** Clears every mark for a generation; undo restores exactly what was there. */
export function clearGenerationWithUndo(gen: number, label: string): void {
  const dex = useDexStore.getState();
  const snapshot = dex.getGenSnapshot(gen);
  dex.clearAll(gen);
  useUndoStore.getState().show(`Cleared all ${label} marks`, () => {
    useDexStore.getState().restoreGen(gen, snapshot);
  });
}

/**
 * Applies the ticked changes from a save import in one go. Undo restores the
 * generation exactly as it was. Returns that pre-import snapshot so the caller
 * can also keep it for "Revert last import".
 */
export function applyImportWithUndo(gen: number, changes: MarkChange[], label: string): GenSnapshot {
  const dex = useDexStore.getState();
  const snapshot = dex.getGenSnapshot(gen);
  dex.applyMarks(gen, changes);
  const count = changes.length;
  useUndoStore.getState().show(`Applied ${count} change${count === 1 ? "" : "s"} from ${label}`, () => {
    useDexStore.getState().restoreGen(gen, snapshot);
  });
  return snapshot;
}
