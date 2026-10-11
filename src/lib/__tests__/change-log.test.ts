import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { describeChanges, diffSnapshots, groupByPokemon, mergeChanges, summarizeChanges } from "../change-log";
import { useDexStore, type GenSnapshot } from "../../store/useDexStore";
import { useChangeLogStore, GROUP_WINDOW_MS, MAX_LOG_ENTRIES } from "../../store/useChangeLogStore";
import { useUndoStore } from "../../store/useUndoStore";
import { applyImportWithUndo, clearGenerationWithUndo, redoLogEntry, toggleWithUndo, undoLogEntry } from "../dex-actions";

const snap = (s: Partial<GenSnapshot>): GenSnapshot => ({ caught: [], pending: [], shiny: [], placed: [], ...s });
const entries = () => useChangeLogStore.getState().entries;
const marks = (gen = 4) => useDexStore.getState().getGenSnapshot(gen);

describe("change-log helpers", () => {
  it("diffs two snapshots into the value each mark ended up with", () => {
    expect(diffSnapshots(snap({ caught: [1], pending: [4] }), snap({ caught: [1, 4], shiny: [1] }))).toEqual([
      { field: "shiny", id: 1, value: true },
      { field: "caught", id: 4, value: true },
      { field: "pending", id: 4, value: false },
    ]);
  });

  it("cancels a change that is taken back", () => {
    const first = [{ field: "caught" as const, id: 1, value: true }, { field: "caught" as const, id: 2, value: true }];
    expect(mergeChanges(first, [{ field: "caught", id: 1, value: false }, { field: "shiny", id: 2, value: true }])).toEqual([
      { field: "caught", id: 2, value: true },
      { field: "shiny", id: 2, value: true },
    ]);
  });

  it("describes a Pokémon's change as from → to", () => {
    expect(describeChanges([{ field: "caught", id: 1, value: true }])).toBe("Not caught → Caught");
    expect(describeChanges([{ field: "caught", id: 1, value: true }, { field: "pending", id: 1, value: false }])).toBe("Pending → Caught");
    expect(describeChanges([{ field: "caught", id: 1, value: false }, { field: "shiny", id: 1, value: false }]))
      .toBe("Caught → Not caught · Shiny → Not shiny");
  });

  it("summarises and groups an entry", () => {
    const changes = [
      { field: "caught" as const, id: 2, value: true }, { field: "caught" as const, id: 1, value: true },
      { field: "pending" as const, id: 2, value: false },
    ];
    expect(summarizeChanges(changes)).toBe("2 caught · 1 no longer pending");
    expect(groupByPokemon(changes).map((g) => [g.id, g.changes.length])).toEqual([[1, 1], [2, 2]]);
  });
});

describe("logging and undoing marks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    useDexStore.getState().importTracker({ caughtByGen: {}, pendingByGen: {}, shinyByGen: {}, placedByGen: {} });
    useChangeLogStore.getState().clear();
    useUndoStore.getState().dismiss();
  });
  afterEach(() => vi.useRealTimers());

  it("groups marks made close together and starts a new entry after a pause", () => {
    toggleWithUndo("caught", 1, 4, "Bulbasaur");
    toggleWithUndo("caught", 2, 4, "Ivysaur");
    expect(entries()).toHaveLength(1);
    expect(entries()[0].changes).toHaveLength(2);

    vi.advanceTimersByTime(GROUP_WINDOW_MS + 1000);
    toggleWithUndo("pending", 3, 4, "Venusaur");
    expect(entries()).toHaveLength(2);
    expect(entries()[0].changes).toEqual([{ field: "pending", id: 3, value: true }]);
  });

  it("keeps generations apart", () => {
    toggleWithUndo("caught", 1, 3, "Bulbasaur");
    toggleWithUndo("caught", 1, 4, "Bulbasaur");
    expect(entries().map((e) => e.gen)).toEqual([4, 3]);
  });

  it("drops a mark from the log when the toast's Undo takes it straight back", () => {
    toggleWithUndo("caught", 1, 4, "Bulbasaur");
    toggleWithUndo("caught", 2, 4, "Ivysaur");
    useUndoStore.getState().toast!.undo();
    expect(marks().caught).toEqual([1]);
    expect(entries()[0].changes).toEqual([{ field: "caught", id: 1, value: true }]);

    toggleWithUndo("caught", 1, 4, "Bulbasaur"); // un-mark the other one by hand
    expect(entries()).toHaveLength(0);
  });

  it("logs an import with what really changed, and undoes and redoes it", () => {
    useDexStore.getState().setPending(4, true, 4);
    useDexStore.getState().setCaught(7, true, 4);
    applyImportWithUndo(4, [
      { field: "caught", id: 4, value: true }, { field: "pending", id: 4, value: false },
      { field: "caught", id: 7, value: true }, // already caught: not a change
      { field: "shiny", id: 25, value: true },
    ], "Platinum");
    const [entry] = entries();
    expect(entry).toMatchObject({ kind: "import", label: "Imported Platinum", gen: 4 });
    expect(entry.changes).toHaveLength(3);

    expect(undoLogEntry(entry.id)).toEqual({ reverted: 3, skipped: 0 });
    expect(marks()).toEqual(snap({ caught: [7], pending: [4] }));
    expect(entries()[0].undoneAt).toBeDefined();

    redoLogEntry(entry.id);
    expect(marks()).toEqual(snap({ caught: [7, 4], shiny: [25] }));
    expect(entries()[0].undoneAt).toBeUndefined();
  });

  it("leaves alone a mark that was changed again after the entry", () => {
    applyImportWithUndo(4, [{ field: "caught", id: 1, value: true }, { field: "caught", id: 2, value: true }], "Platinum");
    const importId = entries()[0].id;
    vi.advanceTimersByTime(1000);
    toggleWithUndo("caught", 2, 4, "Ivysaur"); // un-caught by hand afterwards
    expect(undoLogEntry(importId)).toEqual({ reverted: 1, skipped: 1 });
    expect(marks().caught).toEqual([]);
  });

  it("undoes one Pokémon out of an entry", () => {
    applyImportWithUndo(4, [{ field: "caught", id: 1, value: true }, { field: "caught", id: 2, value: true }], "Platinum");
    const id = entries()[0].id;
    undoLogEntry(id, 2);
    expect(marks().caught).toEqual([1]);
    expect(entries()[0].changes).toEqual([{ field: "caught", id: 1, value: true }]);
    undoLogEntry(id, 1);
    expect(entries()).toHaveLength(0);
  });

  it("logs a clear, and the toast's Undo marks it undone", () => {
    useDexStore.getState().setCaught(1, true, 4);
    useDexStore.getState().setShiny(1, true, 4);
    clearGenerationWithUndo(4, "Gen 4");
    expect(entries()[0]).toMatchObject({ kind: "clear", label: "Cleared all Gen 4 marks" });
    expect(entries()[0].changes).toHaveLength(2);
    useUndoStore.getState().toast!.undo();
    expect(marks()).toEqual(snap({ caught: [1], shiny: [1] }));
    expect(entries()[0].undoneAt).toBeDefined();
  });

  it("stamps an undo so sync treats it as a newer edit", () => {
    applyImportWithUndo(4, [{ field: "caught", id: 1, value: true }], "Platinum");
    const stamped = useDexStore.getState().updatedAt.caught[4][1];
    vi.advanceTimersByTime(5000);
    undoLogEntry(entries()[0].id);
    expect(useDexStore.getState().updatedAt.caught[4][1]).toBeGreaterThan(stamped);
  });

  it("keeps only the newest entries", () => {
    for (let i = 1; i <= MAX_LOG_ENTRIES + 5; i++) {
      useChangeLogStore.getState().record(4, "import", `Import ${i}`, [{ field: "caught", id: i, value: true }]);
    }
    expect(entries()).toHaveLength(MAX_LOG_ENTRIES);
    expect(entries()[0].label).toBe(`Import ${MAX_LOG_ENTRIES + 5}`);
  });
});
