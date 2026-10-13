/**
 * Small synced collections that merge entry by entry, the way the tracker's
 * marks do: each entry carries the time it was last changed, the newer copy
 * wins, and a removal is kept as a tombstone so it reaches other devices.
 * Used by the roamer statuses, the per-Pokémon notes and the shiny hunts.
 * Pure functions; the clock comes in as an argument.
 */

export interface Stamped {
  /** When this entry was last changed (epoch ms) */
  at: number;
  /** Set on an entry that was deleted */
  removed?: true;
}

export type Entries<T> = Record<string, T & Stamped>;

/** Entry by entry: the newer `at` wins. On a tie the entry that still exists wins, then the local one. */
export function mergeEntries<T>(local: Entries<T> | undefined, remote: Entries<T> | undefined): Entries<T> {
  const merged: Entries<T> = { ...(local ?? {}) };
  for (const [key, theirs] of Object.entries(remote ?? {})) {
    const ours = merged[key];
    if (!ours || theirs.at > ours.at || (theirs.at === ours.at && ours.removed && !theirs.removed)) merged[key] = theirs;
  }
  return merged;
}

/** The entries that exist (not removed). */
export function liveEntries<T>(entries: Entries<T> | undefined): [string, T & Stamped][] {
  return Object.entries(entries ?? {}).filter(([, entry]) => !entry.removed);
}

/**
 * Makes the collection look like `incoming` (a backup being restored): what is
 * in it is written with the time `now`, and everything else is removed at
 * `now` — so the restore wins the next sync instead of being merged away.
 */
export function restoreEntries<T>(current: Entries<T>, incoming: Entries<T> | undefined, now: number): Entries<T> {
  const restored: Entries<T> = {};
  for (const [key, entry] of Object.entries(current)) restored[key] = { ...entry, at: now, removed: true };
  for (const [key, entry] of liveEntries(incoming)) restored[key] = { ...entry, at: now };
  return restored;
}

/** A plain object of plain objects, each with a numeric `at` — for validating a backup. */
export function isEntries(value: unknown): value is Entries<unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((entry) =>
    typeof entry === "object" && entry !== null && !Array.isArray(entry) && typeof (entry as Stamped).at === "number");
}

/** The same data in a fixed key order, so two copies compare equal whichever device wrote them. */
export function canonicalEntries(entries: Entries<unknown> | undefined): unknown {
  return Object.keys(entries ?? {}).sort().map((key) => {
    const entry = entries![key] as unknown as Record<string, unknown>;
    return [key, Object.keys(entry).sort().map((field) => [field, entry[field]])];
  });
}
