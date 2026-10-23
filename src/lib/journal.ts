/**
 * The run journal (store/useJournalStore.ts): ordering and filtering, the
 * "Today's catches" summary from the change log, and the actions behind the
 * Journal section (delete shows an Undo toast).
 */
import { liveEntries, type Entries, type Stamped } from "./entries";
import { mergeChanges, type LogEntry } from "./change-log";
import { useJournalStore, newJournalId, JOURNAL_TEXT_MAX_LENGTH, type JournalEntry } from "../store/useJournalStore";
import { useUndoStore } from "../store/useUndoStore";
import type { GameVersion } from "../types";

export type LiveJournalEntry = JournalEntry & Stamped & { id: string };

/** Newest day first; within a day, the newest entry first. `game` narrows it to one game. */
export function journalEntries(entries: Entries<JournalEntry> | undefined, game?: GameVersion | null): LiveJournalEntry[] {
  return liveEntries(entries)
    .map(([id, entry]) => ({ ...entry, id }))
    .filter((e) => !game || e.game === game)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/** "YYYY-MM-DD" for a time, in the device's time zone. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const list = (names: string[]) => names.join(", ");

/**
 * What the change log says happened today in one generation, as a sentence to
 * start a journal entry with: "Caught Ralts, Zigzagoon; marked Feebas pending".
 * Undone entries don't count; a mark taken back the same day cancels out.
 * Null when nothing was caught or marked.
 */
export function todaysCatches(log: readonly LogEntry[], generation: number, now: number, nameOf: (id: number) => string): string | null {
  const today = localDate(now);
  const changes = log
    .filter((e) => e.gen === generation && !e.undoneAt && localDate(e.at) === today && (e.kind === "marks" || e.kind === "import"))
    // The log is newest first; add the changes up in the order they happened
    .reverse()
    .reduce((all, e) => mergeChanges(all, e.changes), [] as LogEntry["changes"]);

  const marked = (field: "caught" | "pending" | "shiny") =>
    // In the order they were marked
    [...new Set(changes.filter((c) => c.field === field && c.value).map((c) => c.id))];
  const caught = marked("caught");
  const pending = marked("pending").filter((id) => !caught.includes(id));
  const shiny = marked("shiny");

  const parts: string[] = [];
  if (caught.length) parts.push(`Caught ${list(caught.map(nameOf))}`);
  if (pending.length) parts.push(`marked ${list(pending.map(nameOf))} pending`);
  if (shiny.length) parts.push(`marked ${list(shiny.map(nameOf))} shiny`);
  if (parts.length === 0) return null;
  const sentence = parts.join("; ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ── Actions ─────────────────────────────────────────────────────────────────

const store = () => useJournalStore.getState();
const plain = ({ date, game, text, createdAt }: JournalEntry): JournalEntry => ({ date, game, text, createdAt });

export function addJournalEntry(entry: Omit<JournalEntry, "createdAt">): string | null {
  const text = entry.text.trim().slice(0, JOURNAL_TEXT_MAX_LENGTH);
  if (!text) return null;
  const id = newJournalId();
  store().put(id, { date: entry.date, game: entry.game, text, createdAt: Date.now() });
  return id;
}

export function updateJournalEntry(id: string, patch: Partial<Omit<JournalEntry, "createdAt">>): void {
  const entry = store().entries[id];
  if (!entry || entry.removed) return;
  const next = plain({ ...entry, ...patch });
  next.text = next.text.trim().slice(0, JOURNAL_TEXT_MAX_LENGTH);
  if (next.text) store().put(id, next);
}

export function deleteJournalEntry(id: string): void {
  const entry = store().entries[id];
  if (!entry || entry.removed) return;
  store().remove(id);
  useUndoStore.getState().show(`Deleted the journal entry for ${entry.date}`, () => store().put(id, plain(entry)));
}
