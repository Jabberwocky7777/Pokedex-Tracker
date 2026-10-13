import { describe, expect, it } from "vitest";
import { mergePayload, mergeSaves, mergeTracker, payloadsEqual } from "../sync-merge";
import type { SaveProfile } from "../save/types";
import type { BackupData, TrackerData } from "../backup";

const tracker = (over: Partial<TrackerData> = {}): TrackerData => ({
  caughtByGen: {},
  pendingByGen: {},
  shinyByGen: {},
  updatedAt: { caught: {}, pending: {}, shiny: {} },
  ...over,
});

const payload = (over: Partial<BackupData> = {}): BackupData => ({
  version: 2,
  exportedAt: "2026-01-01T00:00:00.000Z",
  tracker: tracker(),
  ivChecker: { savedSessions: [] },
  boxSlots: {},
  designer: [],
  sectionUpdatedAt: {},
  ...over,
});

describe("mergeTracker", () => {
  it("keeps marks made on both devices", () => {
    const local = tracker({ caughtByGen: { 4: [1] }, updatedAt: { caught: { 4: { 1: 100 } }, pending: {}, shiny: {} } });
    const remote = tracker({ caughtByGen: { 4: [2] }, updatedAt: { caught: { 4: { 2: 200 } }, pending: {}, shiny: {} } });
    const merged = mergeTracker(local, remote);
    expect(merged.caughtByGen[4]).toEqual([1, 2]);
    expect(merged.updatedAt.caught[4]).toEqual({ 1: 100, 2: 200 });
  });

  it("lets the newer timestamp win for the same entry", () => {
    // Local un-marked #1 at t=300; remote still has the older mark from t=100
    const local = tracker({ caughtByGen: { 4: [] }, updatedAt: { caught: { 4: { 1: 300 } }, pending: {}, shiny: {} } });
    const remote = tracker({ caughtByGen: { 4: [1] }, updatedAt: { caught: { 4: { 1: 100 } }, pending: {}, shiny: {} } });
    expect(mergeTracker(local, remote).caughtByGen[4]).toEqual([]);
    // …and the other way round: an older local un-mark loses to a newer remote mark
    const local2 = tracker({ caughtByGen: { 4: [] }, updatedAt: { caught: { 4: { 1: 50 } }, pending: {}, shiny: {} } });
    expect(mergeTracker(local2, remote).caughtByGen[4]).toEqual([1]);
  });

  it("propagates a remote un-mark to a device that still has the mark", () => {
    const local = tracker({ shinyByGen: { 3: [150] }, updatedAt: { caught: {}, pending: {}, shiny: { 3: { 150: 100 } } } });
    const remote = tracker({ shinyByGen: { 3: [] }, updatedAt: { caught: {}, pending: {}, shiny: { 3: { 150: 400 } } } });
    const merged = mergeTracker(local, remote);
    expect(merged.shinyByGen[3]).toEqual([]);
    expect(merged.updatedAt.shiny[3][150]).toBe(400);
  });

  it("treats missing timestamps as 0", () => {
    // Remote is an old payload: marks but no updatedAt, and no shinyByGen at all
    const remote: TrackerData = { caughtByGen: { 4: [1, 2] }, pendingByGen: { 4: [3] } };
    // Local un-marked #1 after the update, so that entry has a real timestamp
    const local = tracker({ caughtByGen: { 4: [5] }, updatedAt: { caught: { 4: { 1: 10, 5: 10 } }, pending: {}, shiny: {} } });
    const merged = mergeTracker(local, remote);
    // #1: local timestamp 10 beats remote 0 → stays un-marked. #2: tie at 0 → the mark is kept.
    expect(merged.caughtByGen[4]).toEqual([2, 5]);
    expect(merged.pendingByGen[4]).toEqual([3]);
    expect(merged.shinyByGen).toEqual({});
  });

  it("keeps the mark when both sides are untimestamped", () => {
    const merged = mergeTracker({ caughtByGen: { 3: [7] }, pendingByGen: {} }, { caughtByGen: { 3: [9] }, pendingByGen: {} });
    expect(merged.caughtByGen[3]).toEqual([7, 9]);
    expect(merged.updatedAt.caught).toEqual({});
  });

  it("is symmetric, so two devices converge on the same result", () => {
    const a = tracker({
      caughtByGen: { 4: [1, 2] }, shinyByGen: { 4: [2] },
      updatedAt: { caught: { 4: { 1: 10, 2: 30, 3: 40 } }, pending: {}, shiny: { 4: { 2: 30 } } },
    });
    const b = tracker({
      caughtByGen: { 4: [2, 3, 4] }, pendingByGen: { 4: [9] },
      updatedAt: { caught: { 4: { 2: 20, 3: 35, 4: 5 } }, pending: { 4: { 9: 50 } }, shiny: {} },
    });
    const ab = payload({ tracker: mergeTracker(a, b) });
    const ba = payload({ tracker: mergeTracker(b, a) });
    expect(payloadsEqual(ab, ba)).toBe(true);
    // #3: a un-marked it at 40, after b marked it at 35
    expect(ab.tracker.caughtByGen[4]).toEqual([1, 2, 4]);
  });
});

describe("mergePayload", () => {
  const sessionA = { id: "a" } as BackupData["ivChecker"]["savedSessions"][number];
  const sessionB = { id: "b" } as BackupData["ivChecker"]["savedSessions"][number];

  it("returns local unchanged when the server has nothing yet", () => {
    const local = payload({ tracker: tracker({ caughtByGen: { 4: [1] } }) });
    expect(mergePayload(local, null)).toBe(local);
  });

  it("takes the newer side per section, independently", () => {
    const local = payload({
      ivChecker: { savedSessions: [sessionA] },
      boxSlots: { 4: { diamond: [[1]] } },
      sectionUpdatedAt: { ivChecker: 500, boxSlots: 100 },
    });
    const remote = payload({
      ivChecker: { savedSessions: [sessionB] },
      boxSlots: { 4: { diamond: [[2]] } },
      sectionUpdatedAt: { ivChecker: 200, boxSlots: 300 },
    });
    const merged = mergePayload(local, remote);
    expect(merged.ivChecker.savedSessions).toEqual([sessionA]); // local newer
    expect(merged.boxSlots).toEqual({ 4: { diamond: [[2]] } });  // remote newer
    expect(merged.sectionUpdatedAt).toMatchObject({ ivChecker: 500, boxSlots: 300 });
  });

  it("does not let a stale device overwrite a section it never touched", () => {
    // The stale device has old sessions and no timestamp; the server copy is newer
    const stale = payload({ ivChecker: { savedSessions: [sessionA] } });
    const remote = payload({ ivChecker: { savedSessions: [sessionB] }, sectionUpdatedAt: { ivChecker: 900 } });
    expect(mergePayload(stale, remote).ivChecker.savedSessions).toEqual([sessionB]);
  });

  it("keeps untimestamped local data when the server copy is empty (first sign-in)", () => {
    const local = payload({ ivChecker: { savedSessions: [sessionA] } });
    const remote = payload({ ivChecker: { savedSessions: [] } });
    expect(mergePayload(local, remote).ivChecker.savedSessions).toEqual([sessionA]);
  });
});

describe("mergeSaves", () => {
  const profile = (id: string, importedAt: number, label = id): SaveProfile => ({
    id, label, role: "playthrough", startBox: 0, fileName: `${id}.sav`, importedAt, saveCount: 1,
    family: "platinum", trainer: { name: "Tester", tid: 1, sid: 2 },
  });
  const saves = (profiles: SaveProfile[], removed: Record<string, number> = {}) => ({
    profiles,
    summaries: Object.fromEntries(profiles.map((p) => [p.id, { boxNames: [p.label], mons: [] }])),
    removed,
  });
  const ids = (merged: ReturnType<typeof mergeSaves>) => merged!.profiles.map((p) => p.id).sort();

  it("keeps a save imported on each device", () => {
    const merged = mergeSaves(saves([profile("pt", 100)]), saves([profile("ss", 200)]), true);
    expect(ids(merged)).toEqual(["pt", "ss"]);
    expect(Object.keys(merged!.summaries).sort()).toEqual(["pt", "ss"]);
  });

  it("takes the newer import of the same save, with its summary", () => {
    const merged = mergeSaves(saves([profile("pt", 100, "old")]), saves([profile("pt", 300, "new")]), false);
    expect(merged!.profiles[0].label).toBe("new");
    expect(merged!.summaries.pt.boxNames).toEqual(["new"]);
  });

  it("lets the section timestamp settle a rename of the same import", () => {
    const local = saves([profile("pt", 100, "mine")]);
    const remote = saves([profile("pt", 100, "theirs")]);
    expect(mergeSaves(local, remote, true)!.profiles[0].label).toBe("theirs");
    expect(mergeSaves(local, remote, false)!.profiles[0].label).toBe("mine");
  });

  it("carries a removal to a device that still has the save, until it is imported again", () => {
    const stillHasIt = saves([profile("pt", 100)]);
    const removedIt = saves([], { pt: 150 });
    expect(ids(mergeSaves(stillHasIt, removedIt, false))).toEqual([]);
    expect(ids(mergeSaves(removedIt, stillHasIt, true))).toEqual([]);
    // Imported again after the removal
    expect(ids(mergeSaves(saves([profile("pt", 200)]), removedIt, false))).toEqual(["pt"]);
  });

  it("gives the same result from either side, through mergePayload", () => {
    const a = payload({ saveSummaries: saves([profile("pt", 100)]), sectionUpdatedAt: { saveSummaries: 100 } });
    const b = payload({ saveSummaries: saves([profile("ss", 200)]), sectionUpdatedAt: { saveSummaries: 200 } });
    expect(payloadsEqual(mergePayload(a, b), mergePayload(b, a))).toBe(true);
    expect(mergePayload(a, b).saveSummaries!.profiles).toHaveLength(2);
  });

  it("reads payloads from before removals were recorded", () => {
    const old = { profiles: [profile("pt", 100)], summaries: {} };
    expect(ids(mergeSaves(old, old, true))).toEqual(["pt"]);
  });
});

describe("payloadsEqual", () => {
  it("ignores exportedAt, mark order and empty generations", () => {
    const a = payload({ exportedAt: "x", tracker: tracker({ caughtByGen: { 4: [2, 1], 3: [] } }) });
    const b = payload({ exportedAt: "y", tracker: tracker({ caughtByGen: { 4: [1, 2] } }) });
    expect(payloadsEqual(a, b)).toBe(true);
  });

  it("notices a different mark or timestamp", () => {
    const a = payload({ tracker: tracker({ caughtByGen: { 4: [1] } }) });
    expect(payloadsEqual(a, payload({ tracker: tracker({ caughtByGen: { 4: [1, 2] } }) }))).toBe(false);
    expect(payloadsEqual(a, payload({
      tracker: tracker({ caughtByGen: { 4: [1] }, updatedAt: { caught: { 4: { 1: 5 } }, pending: {}, shiny: {} } }),
    }))).toBe(false);
  });
});

// ── Per-Pokémon notes: an entry-merged section ───────────────────────────────

describe("notes", () => {
  const withNotes = (notes: BackupData["notes"]): BackupData => ({
    version: 2, exportedAt: "", tracker: { caughtByGen: {}, pendingByGen: {} }, ivChecker: { savedSessions: [] }, notes,
  });
  const note = (text: string, at: number, removed = false) => ({ text, at, ...(removed ? { removed: true as const } : {}) });

  it("keeps notes written on different Pokémon on two devices", () => {
    const merged = mergePayload(withNotes({ "4:94": note("shiny hunt target", 10) }), withNotes({ "4:448": note("needs Timid", 20) }));
    expect(merged.notes).toEqual({ "4:94": note("shiny hunt target", 10), "4:448": note("needs Timid", 20) });
  });

  it("takes the newer text when both devices edited the same note", () => {
    const phone = withNotes({ "4:94": note("old", 10) });
    const pc = withNotes({ "4:94": note("new", 20) });
    expect(mergePayload(phone, pc).notes?.["4:94"].text).toBe("new");
    expect(mergePayload(pc, phone).notes?.["4:94"].text).toBe("new");
  });

  it("keeps the same Pokémon's notes apart per generation", () => {
    const merged = mergePayload(withNotes({ "3:25": note("FireRed", 5) }), withNotes({ "4:25": note("Platinum", 5) }));
    expect(Object.keys(merged.notes ?? {}).sort()).toEqual(["3:25", "4:25"]);
  });

  it("carries a deleted note to the other device, unless it was edited there later", () => {
    expect(mergePayload(withNotes({ "4:94": note("keep?", 10) }), withNotes({ "4:94": note("keep?", 20, true) })).notes?.["4:94"].removed).toBe(true);
    const edited = mergePayload(withNotes({ "4:94": note("edited after", 30) }), withNotes({ "4:94": note("x", 20, true) }));
    expect(edited.notes?.["4:94"]).toEqual(note("edited after", 30));
  });

  it("loses nothing when the other device's payload has no notes at all (an older client)", () => {
    const local = withNotes({ "4:94": note("mine", 10) });
    expect(mergePayload(local, withNotes(undefined)).notes).toEqual(local.notes);
    expect(mergePayload(withNotes(undefined), local).notes).toEqual(local.notes);
  });

  it("makes two payloads unequal when a note differs, and equal after merging", () => {
    const a = withNotes({ "4:94": note("a", 10) });
    const b = withNotes({ "4:94": note("b", 20), "4:1": note("c", 5) });
    expect(payloadsEqual(a, b)).toBe(false);
    expect(payloadsEqual(mergePayload(a, b), mergePayload(b, a))).toBe(true);
    // Key order doesn't matter
    expect(payloadsEqual(withNotes({ "4:1": note("c", 5), "4:94": note("b", 20) }), b)).toBe(true);
  });
});
