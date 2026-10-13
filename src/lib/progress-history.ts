/**
 * Progress over time, read back from the per-entry timestamps the tracker
 * already keeps for sync (useDexStore.updatedAt.caught). Pure functions; the
 * clock comes in as an argument.
 *
 * What the timestamps can and can't say: each caught Pokémon has the time of
 * its *latest* mark. Un-marking and marking again loses the earlier time, and
 * marks made before timestamps existed (or restored from an old backup) have
 * none — those are "undated" and counted before everything else.
 */

export interface CatchEvent {
  id: number;
  at: number;
}

export interface CatchHistory {
  /** Caught Pokémon that have a time, oldest first */
  events: CatchEvent[];
  /** Caught Pokémon with no time */
  undated: number;
  /** How many Pokémon are in scope (the generation, or one regional dex) */
  total: number;
}

/**
 * @param scope  the species ids being counted
 * @param caught caught ids for the generation
 * @param stamps updatedAt.caught[generation]
 */
export function catchHistory(scope: readonly number[], caught: ReadonlySet<number>, stamps: Record<number, number> | undefined): CatchHistory {
  const events: CatchEvent[] = [];
  let undated = 0;
  for (const id of scope) {
    if (!caught.has(id)) continue;
    const at = stamps?.[id] ?? 0;
    if (at > 0) events.push({ id, at });
    else undated++;
  }
  events.sort((a, b) => a.at - b.at || a.id - b.id);
  return { events, undated, total: scope.length };
}

export const caughtCount = (history: CatchHistory) => history.undated + history.events.length;

/** The running total after each dated catch. */
export function cumulativeSeries(history: CatchHistory): { at: number; count: number; id: number }[] {
  return history.events.map((event, i) => ({ at: event.at, count: history.undated + i + 1, id: event.id }));
}

/** Caught at or after `since` (for "this week": now minus seven days). */
export function caughtSince(history: CatchHistory, since: number): number {
  return history.events.filter((event) => event.at >= since).length;
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface Milestone {
  label: string;
  /** When it was reached; null when it falls among the undated catches */
  at: number | null;
  /** The Pokémon whose catch reached it, when known */
  id: number | null;
}

const ordinal = (n: number) => {
  const tail = n % 100;
  const suffix = tail >= 11 && tail <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
};

/** 1st, 10th, 25th, 50th, then every 50 — as far as has been reached — and completion. Newest first. */
export function milestones(history: CatchHistory, scopeName: string): Milestone[] {
  const reached = caughtCount(history);
  const steps = [1, 10, 25];
  for (let n = 50; n < history.total; n += 50) steps.push(n);
  const nth = (n: number): Pick<Milestone, "at" | "id"> => {
    const event = history.events[n - history.undated - 1];
    return event ? { at: event.at, id: event.id } : { at: null, id: null };
  };
  const list: Milestone[] = steps
    .filter((n) => n <= reached && n < history.total)
    .map((n) => ({ label: `${ordinal(n)} catch`, ...nth(n) }));
  if (history.total > 0 && reached >= history.total) list.push({ label: `${scopeName} complete`, ...nth(history.total) });
  return list.reverse();
}

/** Dated catches per calendar month (local time), oldest first: the chart's table view. */
export function byMonth(history: CatchHistory): { month: string; count: number; total: number }[] {
  const months = new Map<string, number>();
  for (const { at } of history.events) {
    const date = new Date(at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, (months.get(key) ?? 0) + 1);
  }
  let total = history.undated;
  return Array.from(months, ([month, count]) => ({ month, count, total: (total += count) }));
}
