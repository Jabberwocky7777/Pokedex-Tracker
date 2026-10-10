/**
 * Import history: what changed in a save between two imports. Pokémon are
 * matched by PID (plus original trainer), so an evolution shows up as the same
 * Pokémon with a new species rather than as one removed and one added.
 * Kept on the importing device only — it needs the full saves.
 */
import { analyzeSave } from "./living-dex";
import type { ParsedSave, SaveMon, SaveProfile } from "./types";

export const HISTORY_LIMIT = 20;

export interface HistoryEntry {
  /** When the import happened (epoch ms) */
  at: number;
  saveCount: number;
  /** The profile's first import: there is nothing to compare with */
  first: boolean;
  /** Pokémon in the save, eggs included */
  total: number;
  /** Species that are in their living-dex slot now and weren't before */
  placed: number[];
  /** [from, to] species of Pokémon that evolved */
  evolved: [number, number][];
  /** Species of shiny Pokémon that weren't in the save before */
  newShinies: number[];
  /** Species of Pokémon that are new to the save (hatched eggs included) */
  added: number[];
  /** Species of Pokémon that are gone from the save */
  removed: number[];
  /** Pokémon that gained at least one level */
  levelUps: number;
}

const identity = (m: SaveMon) => `${m.pid}:${m.otTid}:${m.otSid}`;

function placedIn(save: ParsedSave, profile: Pick<SaveProfile, "role" | "startBox" | "ownOnly">, maxSpecies: number): Set<number> {
  if (profile.role !== "living-dex") return new Set();
  // Placement only looks at which species sits where, so no evolution data is needed
  return analyzeSave(save.mons, profile.startBox, new Map(), maxSpecies, profile.ownOnly ?? false).placed;
}

export function diffSaves(
  previous: ParsedSave | undefined,
  next: ParsedSave,
  profile: Pick<SaveProfile, "role" | "startBox" | "ownOnly">,
  maxSpecies: number,
  at: number,
): HistoryEntry {
  const entry: HistoryEntry = {
    at, saveCount: next.saveCount, first: !previous, total: next.mons.length,
    placed: [], evolved: [], newShinies: [], added: [], removed: [], levelUps: 0,
  };
  if (!previous) return entry;

  // The same PID can occur more than once (bred or cloned Pokémon), so keep a list per identity
  const before = new Map<string, SaveMon[]>();
  for (const m of previous.mons) before.set(identity(m), [...(before.get(identity(m)) ?? []), m]);

  for (const m of next.mons) {
    const old = before.get(identity(m))?.shift();
    if (m.isEgg) continue;
    if (!old || old.isEgg) {
      entry.added.push(m.species);
      if (m.shiny) entry.newShinies.push(m.species);
      continue;
    }
    if (old.species !== m.species) entry.evolved.push([old.species, m.species]);
    if (m.level > old.level) entry.levelUps++;
  }
  for (const left of before.values()) {
    for (const m of left) if (!m.isEgg) entry.removed.push(m.species);
  }

  const placedBefore = placedIn(previous, profile, maxSpecies);
  entry.placed = [...placedIn(next, profile, maxSpecies)].filter((id) => !placedBefore.has(id)).sort((a, b) => a - b);
  for (const list of [entry.newShinies, entry.added, entry.removed]) list.sort((a, b) => a - b);
  return entry;
}

export function hasChanges(e: HistoryEntry): boolean {
  return e.first || e.placed.length + e.evolved.length + e.newShinies.length + e.added.length + e.removed.length + e.levelUps > 0;
}

/** "+5 placed, Kakuna → Beedrill, 2 new shinies" */
export function summarizeEntry(e: HistoryEntry, nameOf: (species: number) => string): string {
  if (e.first) return `First import — ${e.total} Pokémon`;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const evolved = e.evolved.length <= 2
    ? e.evolved.map(([from, to]) => `${nameOf(from)} → ${nameOf(to)}`)
    : [`${e.evolved.length} evolved`];
  const parts = [
    e.placed.length > 0 ? `+${e.placed.length} placed` : "",
    ...evolved,
    e.newShinies.length > 0 ? plural(e.newShinies.length, "new shiny", "new shinies") : "",
    e.added.length > 0 ? `${e.added.length} added` : "",
    e.removed.length > 0 ? `${e.removed.length} removed` : "",
    e.levelUps > 0 ? plural(e.levelUps, "levelled up", "levelled up") : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No changes";
}
