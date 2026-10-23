/**
 * The "Working on" list (store/useWorkingOnStore.ts): ordering, the shortcuts
 * from the tracker, and the actions that show an Undo toast. The order and
 * matching helpers are pure; the actions write to the store.
 */
import { liveEntries, type Entries, type Stamped } from "./entries";
import { useWorkingOnStore, newWorkItemId, WORK_TEXT_MAX_LENGTH, type WorkItem, type WorkLink, type WorkStatus } from "../store/useWorkingOnStore";
import { useUndoStore } from "../store/useUndoStore";

export type LiveItem = WorkItem & Stamped & { id: string };

/** The items that exist, in list order (manual order, then oldest first). */
export function orderedItems(entries: Entries<WorkItem> | undefined): LiveItem[] {
  return liveEntries(entries)
    .map(([id, item]) => ({ ...item, id }))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** An order value after every item, for a new item at the end of the list. */
export function orderAtEnd(items: readonly LiveItem[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map((i) => i.order)) + 1;
}

/**
 * The order value that puts `id` at position `index` among `items` (the list
 * without the moved item counts positions). Only the moved item changes, so
 * two devices reordering different items don't fight over the rest.
 */
export function orderForMove(items: readonly LiveItem[], id: string, index: number): number {
  const others = items.filter((i) => i.id !== id);
  const clamped = Math.max(0, Math.min(index, others.length));
  const before = others[clamped - 1];
  const after = others[clamped];
  if (!before && !after) return 1;
  if (!before) return after.order - 1;
  if (!after) return before.order + 1;
  return (before.order + after.order) / 2;
}

/** Open items (not done) linked to this Pokémon — in this generation, or with no generation named. */
export function openItemsFor(items: readonly LiveItem[], pokemonId: number, generation: number): LiveItem[] {
  return items.filter((item) =>
    item.status !== "done" &&
    item.link?.kind === "pokemon" &&
    item.link.id === pokemonId &&
    (item.link.generation === undefined || item.link.generation === generation));
}

/** Whether an open item is linked to this Pokémon in this generation. */
export const isOnList = (items: readonly LiveItem[], pokemonId: number, generation: number): boolean =>
  openItemsFor(items, pokemonId, generation).length > 0;

const nextStatus: Record<WorkStatus, WorkStatus> = { todo: "doing", doing: "done", done: "todo" };
export const STATUS_LABELS: Record<WorkStatus, string> = { todo: "To do", doing: "Doing", done: "Done" };

// ── Actions ─────────────────────────────────────────────────────────────────

const store = () => useWorkingOnStore.getState();
const items = () => orderedItems(store().entries);
/** The item's fields without the sync stamps, ready for put() */
const plain = ({ text, status, link, createdAt, order }: WorkItem): WorkItem =>
  ({ text, status, createdAt, order, ...(link ? { link } : {}) });

export function addItem(text: string, link?: WorkLink): string | null {
  const trimmed = text.trim().slice(0, WORK_TEXT_MAX_LENGTH);
  if (!trimmed) return null;
  const id = newWorkItemId();
  store().put(id, { text: trimmed, status: "todo", createdAt: Date.now(), order: orderAtEnd(items()), ...(link ? { link } : {}) });
  return id;
}

export function updateItem(id: string, patch: Partial<WorkItem>): void {
  const entry = store().entries[id];
  if (!entry || entry.removed) return;
  const next = plain({ ...entry, ...patch });
  if ("link" in patch && patch.link === undefined) delete next.link;
  store().put(id, next);
}

export const cycleStatus = (id: string) => {
  const entry = store().entries[id];
  if (entry && !entry.removed) updateItem(id, { status: nextStatus[entry.status] });
};

/** Moves an item to `index` among `within` (the list as shown — the open items, say), or the whole list. */
export function moveItem(id: string, index: number, within: readonly LiveItem[] = items()): void {
  updateItem(id, { order: orderForMove(within, id, index) });
}

/** Removes items and offers Undo, which puts them back as they were. */
function removeWithUndo(ids: string[], message: string): void {
  const removed = ids.map((id) => [id, store().entries[id]] as const).filter(([, e]) => e && !e.removed);
  if (removed.length === 0) return;
  for (const [id] of removed) store().remove(id);
  useUndoStore.getState().show(message, () => {
    for (const [id, entry] of removed) store().put(id, plain(entry!));
  });
}

export function deleteItem(id: string): void {
  const entry = store().entries[id];
  if (entry) removeWithUndo([id], `Deleted “${entry.text}”`);
}

export function clearDone(): void {
  const done = items().filter((i) => i.status === "done");
  removeWithUndo(done.map((i) => i.id), `Cleared ${done.length} done item${done.length === 1 ? "" : "s"}`);
}

/**
 * When a Pokémon is marked caught: sets the open items linked to it to Done.
 * Returns the toast's extra words and the function that takes it back.
 */
export function completeLinkedItems(pokemonId: number, generation: number): { note: string; undo: () => void } | null {
  const open = openItemsFor(items(), pokemonId, generation);
  if (open.length === 0) return null;
  for (const item of open) updateItem(item.id, { status: "done" });
  const note = open.length === 1 ? `“${open[0].text}” done` : `${open.length} Working on items done`;
  return {
    note,
    undo: () => { for (const item of open) updateItem(item.id, { status: item.status }); },
  };
}
