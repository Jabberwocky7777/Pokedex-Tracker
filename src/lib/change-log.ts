import type { DexField, GenSnapshot, MarkChange } from "../store/useDexStore";
import type { ProgressChange } from "./game-progress";

// Pure helpers behind the tracker's change log (store/useChangeLogStore,
// components/tracker/ChangeLogView). A log entry is a list of MarkChange —
// "this mark became this value" — so what it was before is always the opposite.

export type LogKind = "marks" | "import" | "clear" | "revert" | "progress";

export interface LogEntry {
  id: string;
  /** When the entry was made, or last added to (hand-made marks are grouped) */
  at: number;
  gen: number;
  kind: LogKind;
  /** What happened, for everything except hand-made marks, which are described from their changes */
  label: string;
  changes: MarkChange[];
  /** Game Progress changes (badges, milestones) — kind "progress", or an import that also moved progress on */
  progress?: ProgressChange[];
  /** Set while the entry is undone; cleared again by redo */
  undoneAt?: number;
}

const FIELDS: DexField[] = ["caught", "pending", "shiny", "placed"];

/** Every mark that differs between two snapshots of a generation, as the value it has in `after`. */
export function diffSnapshots(before: GenSnapshot, after: GenSnapshot): MarkChange[] {
  const changes: MarkChange[] = [];
  for (const field of FIELDS) {
    const was = new Set(before[field] ?? []);
    const is = new Set(after[field] ?? []);
    for (const id of is) if (!was.has(id)) changes.push({ field, id, value: true });
    for (const id of was) if (!is.has(id)) changes.push({ field, id, value: false });
  }
  return changes.sort((a, b) => a.id - b.id);
}

/**
 * Adds later changes to earlier ones. A mark that is changed and then changed
 * back cancels out, so marking a Pokémon and un-marking it leaves nothing.
 */
export function mergeChanges(earlier: MarkChange[], later: MarkChange[]): MarkChange[] {
  const merged = [...earlier];
  for (const change of later) {
    const at = merged.findIndex((c) => c.field === change.field && c.id === change.id);
    if (at === -1) merged.push(change);
    else if (merged[at].value !== change.value) merged.splice(at, 1);
  }
  return merged;
}

/** True while the mark still has the value this change gave it — only then can undoing it be right. */
export function isApplied(change: MarkChange, current: GenSnapshot): boolean {
  return (current[change.field] ?? []).includes(change.id) === change.value;
}

/** The changes of one entry, per Pokémon, in dex order. */
export function groupByPokemon(changes: MarkChange[]): { id: number; changes: MarkChange[] }[] {
  const byId = new Map<number, MarkChange[]>();
  for (const change of changes) byId.set(change.id, [...(byId.get(change.id) ?? []), change]);
  return [...byId.entries()].sort((a, b) => a[0] - b[0]).map(([id, list]) => ({ id, changes: list }));
}

const STATUS: Record<DexField, [off: string, on: string]> = {
  caught: ["Not caught", "Caught"],
  pending: ["Not pending", "Pending"],
  shiny: ["Not shiny", "Shiny"],
  placed: ["Not placed", "Placed"],
};

/** One Pokémon's changes as "from → to", e.g. "Pending → Caught" or "Not shiny → Shiny". */
export function describeChanges(changes: MarkChange[]): string {
  const value = new Map(changes.map((c) => [c.field, c.value]));
  const parts: string[] = [];
  // Pending and caught are one status to the person marking, so read them together
  if (value.get("caught") === true && value.get("pending") === false) {
    parts.push("Pending → Caught");
    value.delete("caught");
    value.delete("pending");
  } else if (value.get("caught") === false && value.get("pending") === true) {
    parts.push("Caught → Pending");
    value.delete("caught");
    value.delete("pending");
  }
  for (const field of FIELDS) {
    const to = value.get(field);
    if (to === undefined) continue;
    parts.push(`${STATUS[field][to ? 0 : 1]} → ${STATUS[field][to ? 1 : 0]}`);
  }
  return parts.join(" · ");
}

const COUNT_WORDS: Record<DexField, [off: string, on: string]> = {
  caught: ["un-caught", "caught"],
  pending: ["no longer pending", "pending"],
  shiny: ["no longer shiny", "shiny"],
  placed: ["no longer placed", "placed"],
};

/** A whole entry in a few words: "12 caught · 3 no longer pending". */
export function summarizeChanges(changes: MarkChange[]): string {
  const parts: string[] = [];
  for (const field of FIELDS) {
    for (const value of [true, false]) {
      const count = changes.filter((c) => c.field === field && c.value === value).length;
      if (count > 0) parts.push(`${count} ${COUNT_WORDS[field][value ? 1 : 0]}`);
    }
  }
  return parts.join(" · ");
}
