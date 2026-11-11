import { beforeEach, describe, expect, it } from "vitest";
import {
  applyRestore,
  compareForRestore,
  MAX_BACKUP_BYTES,
  prepareRestore,
  readBackupFile,
  restoreBackupData,
  restoreUndoPoint,
  sanitizeRemote,
  undoRestore,
  type BackupData,
} from "../backup";
import { buildPayload } from "../sync";
import { emptyTimestamps, useDexStore } from "../../store/useDexStore";
import { useDesignerStore, normalizeSlots, isDesignerSlot } from "../../store/useDesignerStore";
import { useJournalStore } from "../../store/useJournalStore";
import { useNotesStore } from "../../store/useNotesStore";
import { useSaveStore } from "../../store/useSaveStore";
import { useIvStore } from "../../store/useIvStore";
import { useHuntStore } from "../../store/useHuntStore";
import type { SaveProfile } from "../save/types";

function reset() {
  localStorage.clear();
  useDexStore.setState({
    caughtByGen: {},
    pendingByGen: {},
    shinyByGen: {},
    placedByGen: {},
    updatedAt: emptyTimestamps(),
  });
  useSaveStore.getState().replaceAll([], {});
  useIvStore.setState({ savedSessions: [] });
  useDesignerStore.getState().setSlots([]);
  useJournalStore.setState({ entries: {} });
  useNotesStore.setState({ entries: {} });
  useHuntStore.setState({ entries: {} });
}
beforeEach(reset);

const copy = (): BackupData => JSON.parse(JSON.stringify(buildPayload())) as BackupData;
/** The payload without its export time, which changes on every call */
const state = () => JSON.stringify({ ...buildPayload(), exportedAt: "" });

const profile: SaveProfile = {
  id: "platinum-1-2",
  label: "Platinum",
  role: "living-dex",
  startBox: 0,
  fileName: "pt.sav",
  importedAt: 1000,
  saveCount: 5,
  family: "platinum",
  trainer: { name: "Dawn", tid: 1, sid: 2 },
};

describe("a restore is checked, shown, then applied — and can be undone", () => {
  it("prepareRestore changes nothing", () => {
    useDexStore.getState().setCaught(25, true, 4);
    const backup = copy();
    useDexStore.getState().setCaught(25, false, 4);
    const prepared = prepareRestore(backup);
    expect(prepared.ok).toBe(true);
    expect(useDexStore.getState().caughtByGen[4] ?? []).not.toContain(25);
  });

  it("the comparison names what the restore removes, section by section", () => {
    useJournalStore.getState().put("old", { date: "2026-11-01", game: "platinum", text: "old", createdAt: 1 });
    useDexStore.getState().setCaught(1, true, 4);
    const backup = copy();
    // Written after the backup was made
    for (const id of ["a", "b", "c"])
      useJournalStore.getState().put(id, { date: "2026-11-09", game: "platinum", text: id, createdAt: 2 });
    useDexStore.getState().setCaught(2, true, 4);
    useNotesStore.getState().put("4:94", { text: "new note" });

    const rows = compareForRestore(buildPayload(), backup);
    const row = (label: string) => rows.find((r) => r.label === label)!;
    expect(row("Journal entries")).toEqual({ label: "Journal entries", now: 4, then: 1, lost: 3 });
    expect(row("Caught, Gen 4")).toEqual({ label: "Caught, Gen 4", now: 2, then: 1, lost: 1 });
    expect(row("Pokémon notes").lost).toBe(1);
    expect(row("Imported saves").lost).toBe(0);
  });

  it("applyRestore keeps an undo point, and undo puts the device back", async () => {
    useJournalStore.getState().put("j", { date: "2026-11-01", game: "platinum", text: "before", createdAt: 1 });
    const empty = copy();
    useJournalStore.getState().put("k", { date: "2026-11-02", game: "platinum", text: "written later", createdAt: 2 });
    useDexStore.getState().setCaught(7, true, 4);

    const prepared = prepareRestore(empty);
    if (!prepared.ok) throw new Error(prepared.error);
    const { undoKept } = await applyRestore(prepared.data, "the test backup");
    expect(undoKept).toBe(true);
    expect(
      Object.keys(Object.fromEntries(Object.entries(useJournalStore.getState().entries).filter(([, e]) => !e.removed))),
    ).toEqual(["j"]);
    expect(useDexStore.getState().caughtByGen[4] ?? []).not.toContain(7);
    expect((await restoreUndoPoint())?.label).toBe("the test backup");

    const undone = await undoRestore();
    expect(undone.ok).toBe(true);
    const live = Object.entries(useJournalStore.getState().entries).filter(([, e]) => !e.removed);
    expect(live.map(([k]) => k).sort()).toEqual(["j", "k"]);
    expect(useDexStore.getState().caughtByGen[4]).toContain(7);
    expect(await restoreUndoPoint()).toBeNull();
  });

  it("a file over 10 MB is refused before it is read", async () => {
    let read = false;
    const huge = {
      size: MAX_BACKUP_BYTES + 1,
      text: () => {
        read = true;
        return Promise.resolve("{}");
      },
    } as unknown as File;
    const result = await readBackupFile(huge);
    expect(result.ok).toBe(false);
    expect(read).toBe(false);
  });

  it("a file that isn't JSON, or isn't a backup, is refused with a reason", async () => {
    const file = (text: string) => ({ size: text.length, text: () => Promise.resolve(text) }) as unknown as File;
    expect(await readBackupFile(file("{not json"))).toMatchObject({ ok: false, error: expect.stringMatching(/JSON/) });
    expect(await readBackupFile(file('{"version":2}'))).toMatchObject({ ok: false });
    expect((await readBackupFile(file(JSON.stringify(copy())))).ok).toBe(true);
  });
});

// ── D4: every synced field, the wrong type ──────────────────────────────────

const slot = (patch: Record<string, unknown>) => ({ ...normalizeSlots([])[0], ...patch });

/** [what, a payload with one malformed field] — each must be refused by a backup restore and cleaned by sync */
const MALFORMED: [string, (p: BackupData) => unknown][] = [
  ["designer slot moves", (p) => ({ ...p, designer: [slot({ selectedMoves: 5 })] })],
  ["designer slot level", (p) => ({ ...p, designer: [slot({ level: "fifty" })] })],
  ["designer slot pokemonId", (p) => ({ ...p, designer: [slot({ pokemonId: "94" })] })],
  ["designer slot EVs", (p) => ({ ...p, designer: [slot({ evAllocation: { hp: "x" } })] })],
  ["designer slot IV points", (p) => ({ ...p, designer: [slot({ ivDataPoints: [{ level: "5" }] })] })],
  ["designer slot knock-outs", (p) => ({ ...p, designer: [slot({ knockOutLog: [{ speciesId: 1 }] })] })],
  ["designer slot presets", (p) => ({ ...p, designer: [slot({ routePresets: [{ name: 1, species: [] }] })] })],
  ["designer slot pokerus", (p) => ({ ...p, designer: [slot({ pokerusActive: "yes" })] })],
  ["save profile role", (p) => ({ ...p, saveSummaries: { profiles: [{ ...profile, role: "boss" }], summaries: {} } })],
  [
    "save profile trainer",
    (p) => ({ ...p, saveSummaries: { profiles: [{ ...profile, trainer: { name: 5 } }], summaries: {} } }),
  ],
  [
    "save profile importedAt",
    (p) => ({ ...p, saveSummaries: { profiles: [{ ...profile, importedAt: "today" }], summaries: {} } }),
  ],
  [
    "summary tuple length",
    (p) => ({
      ...p,
      saveSummaries: { profiles: [profile], summaries: { [profile.id]: { boxNames: ["Box 1"], mons: [[0, 1, 25]] } } },
    }),
  ],
  [
    "summary tuple types",
    (p) => ({
      ...p,
      saveSummaries: {
        profiles: [profile],
        summaries: { [profile.id]: { boxNames: ["Box 1"], mons: [[0, 1, "pikachu", 0, 0, 5, 0, 1]] } },
      },
    }),
  ],
  [
    "summary box names",
    (p) => ({
      ...p,
      saveSummaries: { profiles: [profile], summaries: { [profile.id]: { boxNames: [7], mons: [] } } },
    }),
  ],
  [
    "hunt method",
    (p) => ({ ...p, shinyHunts: { h: { generation: 4, pokemonId: 1, count: 3, method: 5, startedAt: 1, at: 1 } } }),
  ],
  [
    "hunt startedAt",
    (p) => ({ ...p, shinyHunts: { h: { generation: 4, pokemonId: 1, count: 3, method: "masuda", at: 1 } } }),
  ],
  ["IV session", (p) => ({ ...p, ivChecker: { savedSessions: [{ name: "no id" }] } })],
  ["IV session entries", (p) => ({ ...p, ivChecker: { savedSessions: [{ id: "a", entries: "x" }] } })],
];

describe("malformed fields never reach a store", () => {
  it.each(MALFORMED)("a backup file with a bad %s is refused", (_, make) => {
    const before = state();
    expect(restoreBackupData(make(copy())).ok).toBe(false);
    expect(state()).toBe(before);
  });

  it.each(MALFORMED)("sync leaves a bad %s out, and keeps the rest", (what, make) => {
    const clean = sanitizeRemote(make(copy()));
    expect(clean.dropped.length + Object.keys(clean.passThrough).length, what).toBeGreaterThan(0);
    const data = clean.data!;
    // What is left is well formed: a strict restore of it succeeds
    expect(restoreBackupData(JSON.parse(JSON.stringify(data))).ok, what).toBe(true);
    for (const s of useDesignerStore.getState().slots) expect(isDesignerSlot(s)).toBe(true);
  });

  it("a bad Designer slot is reset on its own; the good ones are kept", () => {
    const good = slot({ pokemonId: 94, nickname: "Gengar" });
    const clean = sanitizeRemote({ ...copy(), designer: [good, slot({ selectedMoves: 5 })] });
    expect(clean.dropped).toEqual(["designer[1]"]);
    expect((clean.data!.designer as unknown[])[0]).toEqual(good);
  });

  it("normalizeSlots replaces a field of the wrong type, whatever its source", () => {
    const [first] = normalizeSlots([{ selectedMoves: 5, nickname: "Kept" }]);
    expect(first.selectedMoves).toEqual([null, null, null, null]);
    expect(first.nickname).toBe("Kept");
  });

  it("a bad save profile or summary row is dropped, not the whole section", () => {
    const other = { ...profile, id: "pearl-3-4", trainer: { name: 3 } };
    const clean = sanitizeRemote({
      ...copy(),
      saveSummaries: {
        profiles: [profile, other],
        summaries: { [profile.id]: { boxNames: ["Box 1"], mons: [[0, 0, 25, 0, 0, 5, 0, 1], ["bad"]] } },
      },
    });
    expect(clean.data!.saveSummaries!.profiles.map((p) => p.id)).toEqual([profile.id]);
    expect(clean.data!.saveSummaries!.summaries[profile.id].mons).toEqual([[0, 0, 25, 0, 0, 5, 0, 1]]);
  });
});
