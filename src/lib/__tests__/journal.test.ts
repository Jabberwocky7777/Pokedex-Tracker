import { beforeEach, describe, expect, it } from "vitest";
import { addJournalEntry, deleteJournalEntry, journalEntries, localDate, todaysCatches, updateJournalEntry } from "../journal";
import { mergePayload } from "../sync-merge";
import { restoreBackupData, type BackupData } from "../backup";
import type { LogEntry } from "../change-log";
import { useJournalStore } from "../../store/useJournalStore";
import { useUndoStore } from "../../store/useUndoStore";

const names: Record<number, string> = { 280: "Ralts", 263: "Zigzagoon", 349: "Feebas", 25: "Pikachu" };
const nameOf = (id: number) => names[id];
const NOW = new Date(2026, 9, 23, 18, 0).getTime();
const log = (at: number, changes: LogEntry["changes"], extra: Partial<LogEntry> = {}): LogEntry =>
  ({ id: String(at), at, gen: 3, kind: "marks", label: "", changes, ...extra });

describe("todaysCatches", () => {
  it("sums up today's marks in one generation", () => {
    const entries = [
      log(NOW - 1000, [{ field: "pending", id: 349, value: true }]),
      log(NOW - 2000, [{ field: "caught", id: 280, value: true }, { field: "caught", id: 263, value: true }]),
    ];
    expect(todaysCatches(entries, 3, NOW, nameOf)).toBe("Caught Ralts, Zigzagoon; marked Feebas pending");
  });

  it("leaves out other days, other generations, undone entries and marks taken back", () => {
    const yesterday = NOW - 24 * 3600e3;
    const entries = [
      log(NOW - 500, [{ field: "caught", id: 25, value: false }]),            // taken back…
      log(NOW - 1000, [{ field: "caught", id: 25, value: true }]),            // …after this
      log(NOW - 2000, [{ field: "caught", id: 280, value: true }], { gen: 4 }),
      log(NOW - 3000, [{ field: "caught", id: 263, value: true }], { undoneAt: NOW }),
      log(yesterday, [{ field: "caught", id: 349, value: true }]),
    ];
    expect(todaysCatches(entries, 3, NOW, nameOf)).toBeNull();
    expect(todaysCatches(entries, 4, NOW, nameOf)).toBe("Caught Ralts");
  });

  it("says pending only for what wasn't caught as well", () => {
    const entries = [log(NOW, [{ field: "caught", id: 280, value: true }, { field: "pending", id: 280, value: true }])];
    expect(todaysCatches(entries, 3, NOW, nameOf)).toBe("Caught Ralts");
  });
});

describe("journal entries", () => {
  beforeEach(() => { useJournalStore.setState({ entries: {} }); useUndoStore.setState({ toast: null }); });

  it("lists the newest day first and filters by game", () => {
    addJournalEntry({ date: "2026-10-20", game: "emerald", text: "older" });
    addJournalEntry({ date: "2026-10-23", game: "platinum", text: "newest" });
    addJournalEntry({ date: "2026-10-21", game: "emerald", text: "middle" });
    const entries = useJournalStore.getState().entries;
    expect(journalEntries(entries).map((e) => e.text)).toEqual(["newest", "middle", "older"]);
    expect(journalEntries(entries, "emerald").map((e) => e.text)).toEqual(["middle", "older"]);
  });

  it("edits, and deletes with Undo", () => {
    const id = addJournalEntry({ date: "2026-10-23", game: "platinum", text: "first" })!;
    updateJournalEntry(id, { text: "edited", game: "pearl" });
    expect(useJournalStore.getState().entries[id]).toMatchObject({ text: "edited", game: "pearl" });
    deleteJournalEntry(id);
    expect(journalEntries(useJournalStore.getState().entries)).toEqual([]);
    useUndoStore.getState().toast!.undo();
    expect(journalEntries(useJournalStore.getState().entries).map((e) => e.text)).toEqual(["edited"]);
  });

  it("refuses empty text", () => {
    expect(addJournalEntry({ date: "2026-10-23", game: "platinum", text: "  " })).toBeNull();
  });

  it("formats local dates", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
  });
});

describe("journal in sync and backups", () => {
  const withJournal = (journal: BackupData["journal"]): BackupData => ({
    version: 2, exportedAt: "", tracker: { caughtByGen: {}, pendingByGen: {} }, ivChecker: { savedSessions: [] }, journal,
  });
  const entry = (text: string, at: number) => ({ date: "2026-10-23", game: "platinum" as const, text, createdAt: 1, at });

  it("keeps entries from both devices and the newer edit of the same one", () => {
    const merged = mergePayload(withJournal({ a: entry("phone", 10), c: entry("old", 5) }), withJournal({ b: entry("pc", 20), c: entry("new", 30) }));
    expect(Object.keys(merged.journal ?? {}).sort()).toEqual(["a", "b", "c"]);
    expect(merged.journal?.c.text).toBe("new");
  });

  it("restores good entries and rejects bad ones", () => {
    expect(restoreBackupData(withJournal({ a: entry("x", 1) })).ok).toBe(true);
    expect(restoreBackupData(withJournal({ a: { ...entry("x", 1), date: "23/10/2026" } })).ok).toBe(false);
    expect(restoreBackupData(withJournal({ a: { ...entry("x", 1), text: 5 } as never })).ok).toBe(false);
  });
});
