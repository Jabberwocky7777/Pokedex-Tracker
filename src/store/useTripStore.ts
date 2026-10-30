import { createEntryStore } from "./createEntryStore";
import { liveEntries } from "../lib/entries";

/** A printed What's next selection, so another device can check it off in the same order. */
export interface Trip {
  /** The printed routes, in the order they were printed */
  slugs: string[];
  generation: number;
  /** The games the sheet had columns for */
  games: string[];
  /** Printed as a trip sheet (grouped by time of day) */
  grouped: boolean;
  /** Outbreak / Poké Radar / Slot 2 / radio encounters were included */
  setup?: boolean;
  /** Only these method groups were printed (`METHOD_GROUPS` ids); missing or empty = every method */
  methods?: string[];
  /** false: the HG/SS Safari Zone and Bug-Catching Contest were left out; missing = included */
  special?: boolean;
  printedAt: number;
}

/** Printed trips, keyed by a generated id. Synced as the `trips` section, merged trip by trip. */
export const useTripStore = createEntryStore<Trip>("pokedex-trips-v1");

/** How many printed trips are kept; older ones are removed (a tombstone each, so it syncs) */
export const MAX_TRIPS = 5;

export function saveTrip(trip: Omit<Trip, "printedAt">): string {
  const id = `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const store = useTripStore.getState();
  store.put(id, { ...trip, printedAt: Date.now() });
  const live = liveEntries(useTripStore.getState().entries).sort((a, b) => b[1].printedAt - a[1].printedAt);
  for (const [old] of live.slice(MAX_TRIPS)) store.remove(old);
  return id;
}

/** Newest first */
export const tripsNewestFirst = () =>
  liveEntries(useTripStore.getState().entries).map(([id, t]) => ({ ...t, id })).sort((a, b) => b.printedAt - a.printedAt);
