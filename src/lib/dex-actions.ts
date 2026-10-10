import { useDexStore, type DexField } from "../store/useDexStore";
import { useUndoStore } from "../store/useUndoStore";

// Every caught / pending / shiny toggle in the UI goes through here so it gets
// an undo toast. Undo writes the previous value back with the normal store
// setters, which stamps the entry — so sync picks the undo up like any edit.

const MESSAGES: Record<DexField, { on: (name: string) => string; off: (name: string) => string }> = {
  caught:  { on: (n) => `Marked ${n} caught`,  off: (n) => `Unmarked ${n}` },
  pending: { on: (n) => `Marked ${n} pending`, off: (n) => `${n} no longer pending` },
  shiny:   { on: (n) => `Marked ${n} shiny`,   off: (n) => `${n} no longer shiny` },
};

function read(field: DexField, id: number, gen: number): boolean {
  const s = useDexStore.getState();
  return field === "caught" ? s.isCaught(id, gen) : field === "pending" ? s.isPending(id, gen) : s.isShiny(id, gen);
}

function write(field: DexField, id: number, value: boolean, gen: number): void {
  const s = useDexStore.getState();
  if (field === "caught") s.setCaught(id, value, gen);
  else if (field === "pending") s.setPending(id, value, gen);
  else s.setShiny(id, value, gen);
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
