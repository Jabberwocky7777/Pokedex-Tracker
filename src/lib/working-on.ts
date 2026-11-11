/**
 * The "Working on" list (store/useWorkingOnStore.ts): ordering, the shortcuts
 * from the tracker, and the actions that show an Undo toast. The order and
 * matching helpers are pure; the actions write to the store.
 */
import { liveEntries, type Entries, type Stamped } from "./entries";
import {
  useWorkingOnStore,
  newWorkItemId,
  WORK_MAX_LINKS,
  WORK_NOTE_MAX_LENGTH,
  WORK_TEXT_MAX_LENGTH,
  type WorkItem,
  type WorkLink,
  type WorkStatus,
} from "../store/useWorkingOnStore";
import { useUndoStore } from "../store/useUndoStore";
import type { GameVersion } from "../types";

export type LiveItem = WorkItem & Stamped & { id: string };

/** The items that exist, in list order (manual order, then oldest first). */
export function orderedItems(entries: Entries<WorkItem> | undefined): LiveItem[] {
  return liveEntries(entries)
    .map(([id, item]) => ({ ...item, id }))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** An order value after every item, for a new item at the end of the list. */
function orderAtEnd(items: readonly LiveItem[]): number {
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

// ── Links ───────────────────────────────────────────────────────────────────

/** Every link of an item, in the order they were added */
export const linksOf = (item: Pick<WorkItem, "link" | "extraLinks">): WorkLink[] =>
  item.link ? [item.link, ...(item.extraLinks ?? [])] : [];

function sameLink(a: WorkLink, b: WorkLink): boolean {
  if (a.kind === "pokemon" && b.kind === "pokemon") return a.id === b.id && a.generation === b.generation;
  if (a.kind === "route" && b.kind === "route") return a.slug === b.slug;
  if (a.kind === "game" && b.kind === "game") return a.game === b.game;
  return false;
}

/** `links` with `link` added at the end — unless it is already there or the item has as many as it can take. */
export function addLink(links: readonly WorkLink[], link: WorkLink): WorkLink[] {
  if (links.length >= WORK_MAX_LINKS || links.some((l) => sameLink(l, link))) return [...links];
  return [...links, link];
}

/** A list of links as the item's fields: the first in `link`, the rest in `extraLinks` */
function linkFields(links: readonly WorkLink[]): Pick<WorkItem, "link" | "extraLinks"> {
  const [first, ...rest] = links.slice(0, WORK_MAX_LINKS);
  return { ...(first ? { link: first } : {}), ...(rest.length > 0 ? { extraLinks: rest } : {}) };
}

/** Open items (not done) linked to this Pokémon — in this generation, or with no generation named. */
function openItemsFor(items: readonly LiveItem[], pokemonId: number, generation: number): LiveItem[] {
  return items.filter(
    (item) =>
      item.status !== "done" &&
      linksOf(item).some(
        (link) =>
          link.kind === "pokemon" &&
          link.id === pokemonId &&
          (link.generation === undefined || link.generation === generation),
      ),
  );
}

/** Whether an open item is linked to this Pokémon in this generation. */
export const isOnList = (items: readonly LiveItem[], pokemonId: number, generation: number): boolean =>
  openItemsFor(items, pokemonId, generation).length > 0;

/** Whether an open item is linked to both this Pokémon (in this generation) and this route. */
export const isOnListAt = (
  items: readonly LiveItem[],
  pokemonId: number,
  generation: number,
  routeSlug: string,
): boolean =>
  openItemsFor(items, pokemonId, generation).some((item) =>
    linksOf(item).some((link) => link.kind === "route" && link.slug === routeSlug),
  );

export interface EncounterSpot {
  pokemonId: number;
  displayName: string;
  generation: number;
  route: { slug: string; name: string };
  /** The games it is found in there; more than fit on one item are left off */
  games: readonly GameVersion[];
  /** "Super Rod", "Grass" */
  method?: string;
  /** "5%", "1×" — as the row shows it */
  rate?: string;
  /** A second copy, caught to evolve into this (What's next): named and linked too, so catching it finishes the item */
  evolveTo?: { id: number; displayName: string };
}

/** The text and links of a Working on item for catching a Pokémon at one spot: "Catch Feebas on Route 119 (Super Rod, 5%)". */
export function encounterItem(spot: EncounterSpot): { text: string; links: WorkLink[] } {
  const extra = [spot.method, spot.rate].filter(Boolean).join(", ");
  const text = spot.evolveTo
    ? `Catch another ${spot.displayName} on ${spot.route.name}${extra ? ` (${extra})` : ""} for ${spot.evolveTo.displayName}`
    : `Catch ${spot.displayName} on ${spot.route.name}${extra ? ` (${extra})` : ""}`;
  let links: WorkLink[] = [
    { kind: "pokemon", id: spot.pokemonId, generation: spot.generation },
    { kind: "route", slug: spot.route.slug, name: spot.route.name },
  ];
  if (spot.evolveTo) links = addLink(links, { kind: "pokemon", id: spot.evolveTo.id, generation: spot.generation });
  for (const game of spot.games) links = addLink(links, { kind: "game", game });
  return { text, links };
}

const nextStatus: Record<WorkStatus, WorkStatus> = { todo: "doing", doing: "done", done: "todo" };
export const STATUS_LABELS: Record<WorkStatus, string> = { todo: "To do", doing: "Doing", done: "Done" };

// ── Actions ─────────────────────────────────────────────────────────────────

const store = () => useWorkingOnStore.getState();
const items = () => orderedItems(store().entries);
/** The item's fields without the sync stamps, ready for put() */
const plain = ({ text, status, link, extraLinks, note, createdAt, order }: WorkItem): WorkItem => ({
  text,
  status,
  createdAt,
  order,
  ...linkFields(linksOf({ link, extraLinks })),
  ...(note ? { note } : {}),
});

export function addItem(text: string, links: readonly WorkLink[] = []): string | null {
  const trimmed = text.trim().slice(0, WORK_TEXT_MAX_LENGTH);
  if (!trimmed) return null;
  const id = newWorkItemId();
  store().put(id, {
    text: trimmed,
    status: "todo",
    createdAt: Date.now(),
    order: orderAtEnd(items()),
    ...linkFields(links),
  });
  return id;
}

export function updateItem(id: string, patch: Partial<WorkItem>): void {
  const entry = store().entries[id];
  if (!entry || entry.removed) return;
  const next = plain({ ...entry, ...patch });
  if ("link" in patch && patch.link === undefined) delete next.link;
  if ("extraLinks" in patch && !patch.extraLinks?.length) delete next.extraLinks;
  store().put(id, next);
}

/** Replaces an item's links (none removes them all) */
export function setItemLinks(id: string, links: readonly WorkLink[]): void {
  updateItem(id, { link: undefined, extraLinks: undefined, ...linkFields(links) });
}

/** Sets an item's note; an empty note removes it. Unchanged text writes nothing. */
export function setItemNote(id: string, note: string): void {
  const entry = store().entries[id];
  if (!entry || entry.removed) return;
  const trimmed = note.trim().slice(0, WORK_NOTE_MAX_LENGTH);
  if (trimmed === (entry.note ?? "")) return;
  updateItem(id, { note: trimmed || undefined });
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
    for (const [id, entry] of removed) store().put(id, plain(entry));
  });
}

export function deleteItem(id: string): void {
  const entry = store().entries[id];
  if (entry) removeWithUndo([id], `Deleted “${entry.text}”`);
}

export function clearDone(): void {
  const done = items().filter((i) => i.status === "done");
  removeWithUndo(
    done.map((i) => i.id),
    `Cleared ${done.length} done item${done.length === 1 ? "" : "s"}`,
  );
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
    undo: () => {
      for (const item of open) updateItem(item.id, { status: item.status });
    },
  };
}
