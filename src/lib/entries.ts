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

/**
 * A removed entry: its stamp and nothing else, so the text of a deleted note
 * or journal entry doesn't live on in storage, the server, snapshots and
 * backups. (Typed as an entry so collections stay one type; anything that
 * reads an entry checks `removed` first, as `liveEntries` does.)
 */
export function tombstone<T>(at: number): T & Stamped {
  return { at, removed: true } as T & Stamped;
}

/** True for a tombstone that still carries the content it had (written before tombstones were bare). */
function hasContent(entry: Stamped): boolean {
  return Object.keys(entry).some((key) => key !== "at" && key !== "removed");
}

/**
 * Entry by entry: the newer `at` wins. On a tie the entry that still exists wins, then the local one.
 * Tombstones come out bare, so older data that kept the content shrinks.
 */
export function mergeEntries<T>(local: Entries<T> | undefined, remote: Entries<T> | undefined): Entries<T> {
  const merged: Entries<T> = { ...(local ?? {}) };
  for (const [key, theirs] of Object.entries(remote ?? {})) {
    const ours = merged[key];
    if (!ours || theirs.at > ours.at || (theirs.at === ours.at && ours.removed && !theirs.removed))
      merged[key] = theirs;
  }
  for (const [key, entry] of Object.entries(merged)) {
    if (entry.removed && hasContent(entry)) merged[key] = tombstone<T>(entry.at);
  }
  return merged;
}

/**
 * How long a tombstone is kept. After that it is dropped at sync time, so the
 * synced data doesn't only ever grow. The trade-off: a device that was offline
 * for longer than this and still has the entry brings it back on its next sync.
 */
export const TOMBSTONE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/** Drops tombstones older than `maxAge` at `now`. Returns the same object when nothing was dropped. */
export function pruneTombstones<T>(
  entries: Entries<T> | undefined,
  now: number,
  maxAge = TOMBSTONE_MAX_AGE_MS,
): Entries<T> | undefined {
  if (!entries) return entries;
  const old = Object.keys(entries).filter((key) => entries[key].removed && now - entries[key].at > maxAge);
  if (old.length === 0) return entries;
  const kept = { ...entries };
  for (const key of old) delete kept[key];
  return kept;
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
  for (const key of Object.keys(current)) restored[key] = tombstone<T>(now);
  for (const [key, entry] of liveEntries(incoming)) restored[key] = { ...entry, at: now };
  return restored;
}

/** A plain object of plain objects, each with a numeric `at` — for validating a backup. */
export function isEntries(value: unknown): value is Entries<unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry) && typeof (entry as Stamped).at === "number",
  );
}

/** The same data in a fixed key order, so two copies compare equal whichever device wrote them. */
export function canonicalEntries(entries: Entries<unknown> | undefined): unknown {
  return Object.keys(entries ?? {})
    .sort()
    .map((key) => {
      const entry = entries![key] as unknown as Record<string, unknown>;
      return [
        key,
        Object.keys(entry)
          .sort()
          .map((field) => [field, entry[field]]),
      ];
    });
}
