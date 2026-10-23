import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySnapshot, buildPayload, fetchSnapshot, hasUnsyncedChanges, listSnapshots, syncOnce } from "../sync";
import { mergePayload } from "../sync-merge";
import { restoreBackupData } from "../backup";
import type { BackupData } from "../backup";
import { emptyTimestamps, useDexStore } from "../../store/useDexStore";
import { useIvStore } from "../../store/useIvStore";
import { useBoxSlotStore } from "../../store/useBoxSlotStore";
import { useDesignerStore } from "../../store/useDesignerStore";
import { useSaveStore } from "../../store/useSaveStore";
import { useRoamerStore } from "../../store/useRoamerStore";
import { useNotesStore } from "../../store/useNotesStore";
import { useHuntStore } from "../../store/useHuntStore";
import type { SaveProfile } from "../save/types";
import { useWorkingOnStore } from "../../store/useWorkingOnStore";
import { useJournalStore } from "../../store/useJournalStore";

function resetStores() {
  localStorage.clear();
  useDexStore.setState({ caughtByGen: {}, pendingByGen: {}, shinyByGen: {}, placedByGen: {}, updatedAt: emptyTimestamps() });
  useSaveStore.getState().replaceAll([], {});
  localStorage.clear();
  useIvStore.setState({ savedSessions: [] });
  useBoxSlotStore.getState().setSlotsByGen({});
}

beforeEach(resetStores);

describe("buildPayload / applySnapshot", () => {
  it("round-trips every tracker field, including shiny marks and timestamps", () => {
    const dex = useDexStore.getState();
    dex.setCaught(94, true, 4);
    dex.setCaught(1, true, 3);
    dex.setPending(93, true, 4);
    dex.setShiny(94, true, 4);
    dex.setPlaced(94, true, 4);
    const profile: SaveProfile = {
      id: "platinum-1-2", label: "Platinum", role: "living-dex", startBox: 1, fileName: "pt.sav",
      importedAt: 5, saveCount: 9, family: "platinum", trainer: { name: "Dawn", tid: 1, sid: 2 },
    };
    useSaveStore.getState().replaceAll([profile], { [profile.id]: { boxNames: ["BOX 1"], mons: [[1, 3, 94, 0, 1, 50, 0]] } });
    useBoxSlotStore.getState().assignSlot(4, "diamond", 0, 3, 94);
    useIvStore.getState().saveSession({
      id: "s1", name: "Gengar", pokemonId: 94, pokemonName: "Gengar", pokemonSprite: "", natureName: "Timid",
      evs: { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0 }, entries: [], savedAt: 1,
    });
    useDesignerStore.getState().updateSlot(0, { pokemonId: 94, nickname: "Spooky" });

    const payload: BackupData = JSON.parse(JSON.stringify(buildPayload()));
    expect(payload.version).toBe(2);
    expect(payload.tracker.shinyByGen).toEqual({ 4: [94] });
    expect(payload.tracker.updatedAt?.shiny?.[4][94]).toBeGreaterThan(0);
    expect(payload.tracker.placedByGen).toEqual({ 4: [94] });
    expect(payload.tracker.updatedAt?.placed?.[4][94]).toBeGreaterThan(0);
    expect(payload.saveSummaries?.profiles).toEqual([profile]);
    expect(payload.sectionUpdatedAt?.saveSummaries).toBeGreaterThan(0);
    // Editing the other stores stamps their sections
    expect(payload.sectionUpdatedAt?.boxSlots).toBeGreaterThan(0);
    expect(payload.sectionUpdatedAt?.ivChecker).toBeGreaterThan(0);
    expect(payload.sectionUpdatedAt?.designer).toBeGreaterThan(0);

    resetStores();
    useDesignerStore.getState().clearSlot(0);
    expect(buildPayload().tracker.caughtByGen).toEqual({});

    applySnapshot(payload);
    const after = buildPayload();
    expect(after.tracker).toEqual(payload.tracker);
    expect(after.ivChecker).toEqual(payload.ivChecker);
    expect(after.boxSlots).toEqual(payload.boxSlots);
    expect(after.designer).toEqual(payload.designer);
    expect(after.saveSummaries).toEqual(payload.saveSummaries);
    expect(after.sectionUpdatedAt).toEqual(payload.sectionUpdatedAt);
  });

  it("does not count applying a snapshot as a local edit", () => {
    const remote = buildPayload();
    remote.ivChecker = { savedSessions: [{ id: "r" } as BackupData["ivChecker"]["savedSessions"][number]] };
    remote.sectionUpdatedAt = { ivChecker: 1234 };
    applySnapshot(remote);
    // The section keeps the remote timestamp instead of being stamped "now"
    expect(buildPayload().sectionUpdatedAt?.ivChecker).toBe(1234);
  });
});

describe("store persistence vs. sync payload", () => {
  // If a store starts persisting a new field, it must either be added to
  // buildPayload() (and listed here) or be declared device-local below.
  // Otherwise it would silently never sync or be backed up — which is how
  // shiny marks went missing.
  const payload = () => buildPayload();

  type Entry = {
    name: string;
    persisted: () => Record<string, unknown>;
    inPayload: Record<string, (p: BackupData) => unknown>;
    deviceLocal?: string[];
  };

  const dataKeys = (state: object) =>
    Object.entries(state).filter(([, v]) => typeof v !== "function").map(([k]) => k);

  const stores: Entry[] = [
    {
      name: "useDexStore",
      persisted: () => useDexStore.persist.getOptions().partialize!(useDexStore.getState()) as Record<string, unknown>,
      inPayload: {
        caughtByGen: (p) => p.tracker.caughtByGen,
        pendingByGen: (p) => p.tracker.pendingByGen,
        shinyByGen: (p) => p.tracker.shinyByGen,
        placedByGen: (p) => p.tracker.placedByGen,
        updatedAt: (p) => p.tracker.updatedAt,
      },
    },
    {
      name: "useDesignerStore",
      persisted: () => useDesignerStore.persist.getOptions().partialize!(useDesignerStore.getState()) as Record<string, unknown>,
      inPayload: { slots: (p) => p.designer },
      deviceLocal: ["activeSlotIndex"], // which slot is open — UI state, per device
    },
    {
      name: "useIvStore",
      // No partialize: the whole state is persisted
      persisted: () => useIvStore.getState() as unknown as Record<string, unknown>,
      inPayload: { savedSessions: (p) => p.ivChecker.savedSessions },
    },
    {
      name: "useBoxSlotStore",
      persisted: () => useBoxSlotStore.persist.getOptions().partialize!(useBoxSlotStore.getState()) as Record<string, unknown>,
      inPayload: { slotsByGen: (p) => p.boxSlots },
    },
    {
      name: "useSaveStore",
      persisted: () => useSaveStore.persist.getOptions().partialize!(useSaveStore.getState()) as Record<string, unknown>,
      inPayload: { profiles: (p) => p.saveSummaries?.profiles, removedProfiles: (p) => p.saveSummaries?.removed },
      deviceLocal: ["activeProfileId"], // which save is open — UI state, per device
    },
    {
      name: "useRoamerStore",
      persisted: () => useRoamerStore.persist.getOptions().partialize!(useRoamerStore.getState()) as Record<string, unknown>,
      inPayload: { entries: (p) => p.roamers },
    },
    {
      name: "useNotesStore",
      persisted: () => useNotesStore.persist.getOptions().partialize!(useNotesStore.getState()) as Record<string, unknown>,
      inPayload: { entries: (p) => p.notes },
    },
    {
      name: "useHuntStore",
      persisted: () => useHuntStore.persist.getOptions().partialize!(useHuntStore.getState()) as Record<string, unknown>,
      inPayload: { entries: (p) => p.shinyHunts },
    },
    {
      name: "useWorkingOnStore",
      persisted: () => useWorkingOnStore.persist.getOptions().partialize!(useWorkingOnStore.getState()) as Record<string, unknown>,
      inPayload: { entries: (p) => p.workingOn },
    },
    {
      name: "useJournalStore",
      persisted: () => useJournalStore.persist.getOptions().partialize!(useJournalStore.getState()) as Record<string, unknown>,
      inPayload: { entries: (p) => p.journal },
    },
    // Deliberately not synced: useSettingsStore (per-device preferences such as
    // theme, view mode and Quick mark) and useBattleCalcStore (calculator scratch state).
  ];

  for (const store of stores) {
    it(`${store.name}: every persisted field is in buildPayload()`, () => {
      const persisted = store.persisted();
      for (const key of dataKeys(persisted)) {
        if (store.deviceLocal?.includes(key)) continue;
        const locate = store.inPayload[key];
        expect(locate, `${store.name} persists "${key}" but buildPayload() does not include it`).toBeTypeOf("function");
        expect(locate(payload()), `buildPayload() is missing ${store.name}.${key}`).toBe(persisted[key]);
      }
    });
  }
});

describe("backup restore", () => {
  it("restores a version 1 file: no shiny marks, no timestamps", () => {
    // Local state that the restore should replace
    const dex = useDexStore.getState();
    dex.setCaught(5, true, 4);
    dex.setShiny(5, true, 4);

    const v1 = {
      version: 1,
      exportedAt: "2026-03-01T00:00:00.000Z",
      tracker: { caughtByGen: { 3: [1, 4, 7], 4: [25] }, pendingByGen: { 3: [2] } },
      ivChecker: { savedSessions: [] },
    };
    expect(restoreBackupData(v1)).toEqual({ ok: true });

    const state = useDexStore.getState();
    expect(new Set(state.caughtByGen[3])).toEqual(new Set([1, 4, 7]));
    expect(state.caughtByGen[4]).toEqual([25]);
    expect(state.pendingByGen[3]).toEqual([2]);
    // Missing shinyByGen means "none" — the local shiny mark is removed, not kept
    expect(state.shinyByGen[4] ?? []).toEqual([]);
    // Everything the restore changed is stamped, so it wins the next sync —
    // including the un-mark of #5
    expect(state.updatedAt.caught[4][25]).toBeGreaterThan(0);
    expect(state.updatedAt.caught[4][5]).toBeGreaterThan(0);
    expect(state.updatedAt.shiny[4][5]).toBeGreaterThan(0);

    // The next export is a version 2 file that carries the same marks
    const exported = buildPayload();
    expect(exported.version).toBe(2);
    expect(exported.tracker.shinyByGen).toBeDefined();
    expect(new Set(exported.tracker.caughtByGen[3])).toEqual(new Set([1, 4, 7]));
  });

  it("round-trips a version 2 backup with shiny marks", () => {
    useDexStore.getState().setCaught(94, true, 4);
    useDexStore.getState().setShiny(94, true, 4);
    const backup = JSON.parse(JSON.stringify(buildPayload()));

    resetStores();
    expect(restoreBackupData(backup)).toEqual({ ok: true });
    expect(useDexStore.getState().caughtByGen[4]).toEqual([94]);
    expect(useDexStore.getState().shinyByGen[4]).toEqual([94]);
  });

  it("accepts the old Export JSON shape (ivSessions, designer.slots)", () => {
    const legacy = {
      version: 2,
      exportedAt: "2026-03-01T00:00:00.000Z",
      tracker: { caughtByGen: { 4: [1] }, pendingByGen: {} },
      ivSessions: { savedSessions: [] },
      designer: { slots: useDesignerStore.getState().slots },
    };
    expect(restoreBackupData(legacy)).toEqual({ ok: true });
    expect(useDexStore.getState().caughtByGen[4]).toEqual([1]);
  });

  it("restores an older backup with 30 Designer slots into the 90-slot layout", () => {
    const old = JSON.parse(JSON.stringify(buildPayload()));
    // 30 slots, and slots from before EV tracking existed
    old.designer = old.designer.slice(0, 30).map((slot: Record<string, unknown>, i: number) => {
      const rest = { ...slot };
      delete rest.vitaminEVs;
      delete rest.knockOutLog;
      return i === 0 ? { ...rest, pokemonId: 25, nickname: "Sparky" } : rest;
    });
    expect(restoreBackupData(old)).toEqual({ ok: true });
    const { slots } = useDesignerStore.getState();
    expect(slots).toHaveLength(90);
    expect(slots[0]).toMatchObject({ pokemonId: 25, nickname: "Sparky", slotIndex: 0 });
    expect(slots[0].vitaminEVs).toEqual({ hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0 });
    expect(slots[89]).toMatchObject({ pokemonId: null, slotIndex: 89, knockOutLog: [] });
  });

  it("rejects malformed optional sections instead of storing them", () => {
    const good = () => JSON.parse(JSON.stringify(buildPayload()));
    const before = JSON.stringify(buildPayload().boxSlots);
    for (const [section, bad] of [
      ["boxSlots", { 4: { diamond: "not boxes" } }],
      ["boxSlots", { 4: { diamond: [["bulbasaur"]] } }],
      ["designer", [null, 3]],
      ["designer", "none"],
      ["saveSummaries", { profiles: "x" }],
      ["saveSummaries", { profiles: [{ id: 5 }] }],
    ] as const) {
      const result = restoreBackupData({ ...good(), [section]: bad });
      expect(result.ok, `${section} = ${JSON.stringify(bad)}`).toBe(false);
    }
    expect(JSON.stringify(buildPayload().boxSlots)).toBe(before);
  });

  it("rejects malformed files", () => {
    expect(restoreBackupData({ version: 99 }).ok).toBe(false);
    expect(restoreBackupData({ version: 2, tracker: { caughtByGen: { 4: ["x"] }, pendingByGen: {} } }).ok).toBe(false);
    expect(restoreBackupData("nope").ok).toBe(false);
  });
});

describe("useDexStore", () => {
  it("clearAll clears caught, pending and shiny for that generation only", () => {
    const dex = useDexStore.getState();
    dex.setPlaced(1, true, 4);
    dex.setCaught(1, true, 4);
    dex.setPending(2, true, 4);
    dex.setShiny(1, true, 4);
    dex.setShiny(9, true, 3);

    const snapshot = dex.getGenSnapshot(4);
    dex.clearAll(4);
    let state = useDexStore.getState();
    expect(state.caughtByGen[4]).toEqual([]);
    expect(state.pendingByGen[4]).toEqual([]);
    expect(state.shinyByGen[4]).toEqual([]);
    expect(state.placedByGen[4]).toEqual([]);
    expect(state.shinyByGen[3]).toEqual([9]);

    // Undo
    useDexStore.getState().restoreGen(4, snapshot);
    state = useDexStore.getState();
    expect(state.caughtByGen[4]).toEqual([1]);
    expect(state.pendingByGen[4]).toEqual([2]);
    expect(state.shinyByGen[4]).toEqual([1]);
    expect(state.placedByGen[4]).toEqual([1]);
  });

  it("applyMarks applies a batch of adds and removals and stamps each one", () => {
    const dex = useDexStore.getState();
    dex.setCaught(1, true, 4);
    dex.setPending(2, true, 4);
    dex.applyMarks(4, [
      { field: "caught", id: 2, value: true },
      { field: "caught", id: 1, value: false },
      { field: "pending", id: 2, value: false },
      { field: "placed", id: 2, value: true },
      { field: "shiny", id: 2, value: true },
    ]);
    const state = useDexStore.getState();
    expect(state.caughtByGen[4]).toEqual([2]);
    expect(state.pendingByGen[4]).toEqual([]);
    expect(state.placedByGen[4]).toEqual([2]);
    expect(state.shinyByGen[4]).toEqual([2]);
    expect(state.updatedAt.caught[4][1]).toBeGreaterThan(0);
    expect(state.updatedAt.placed[4][2]).toBeGreaterThan(0);
  });

  it("stamps un-marks as well as marks", () => {
    const dex = useDexStore.getState();
    dex.toggleCaught(7, 4);
    const marked = useDexStore.getState().updatedAt.caught[4][7];
    expect(marked).toBeGreaterThan(0);
    dex.toggleCaught(7, 4);
    expect(useDexStore.getState().caughtByGen[4]).toEqual([]);
    expect(useDexStore.getState().updatedAt.caught[4][7]).toBeGreaterThanOrEqual(marked);
  });
});

describe("restoring a server snapshot", () => {
  // What Settings → Server snapshots does: fetchSnapshot(), then restoreBackupData()
  const serve = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status }));
  afterEach(() => vi.unstubAllGlobals());

  it("goes through the same validation as a backup file", async () => {
    useDexStore.getState().setCaught(94, true, 4);
    const snapshot = JSON.parse(JSON.stringify(buildPayload()));
    useDexStore.getState().setCaught(94, false, 4);
    useDexStore.getState().setCaught(1, true, 4);

    serve({ ok: true, id: "2026-10-11T14", data: snapshot, savedAt: "2026-10-11T14:05:00.000Z" });
    expect(restoreBackupData(await fetchSnapshot("2026-10-11T14"))).toEqual({ ok: true });
    expect(useDexStore.getState().caughtByGen[4]).toEqual([94]);

    // A snapshot that isn't a valid payload is refused and changes nothing
    serve({ ok: true, id: "x", data: { version: 2, tracker: { caughtByGen: { 4: ["x"] }, pendingByGen: {} } } });
    const bad = restoreBackupData(await fetchSnapshot("x"));
    expect(bad.ok).toBe(false);
    expect(useDexStore.getState().caughtByGen[4]).toEqual([94]);
  });

  it("gives nothing to restore when the server has no such snapshot or is unreachable", async () => {
    serve({ error: "No such snapshot" }, 404);
    expect(await fetchSnapshot("2026-10-11T09")).toBeNull();
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    expect(await fetchSnapshot("2026-10-11T09")).toBeNull();
    expect(await listSnapshots()).toBeNull();
    // restoreBackupData(null) is a refusal, not a wipe
    expect(restoreBackupData(null).ok).toBe(false);
  });

  it("brings back a save that was removed after the snapshot was taken", () => {
    const profile: SaveProfile = {
      id: "platinum-1-2", label: "Platinum", role: "living-dex", startBox: 1, fileName: "pt.sav",
      importedAt: 1000, saveCount: 9, family: "platinum", trainer: { name: "Dawn", tid: 1, sid: 2 },
    };
    useSaveStore.getState().replaceAll([profile], { [profile.id]: { boxNames: ["BOX 1"], mons: [] } });
    const snapshot = JSON.parse(JSON.stringify(buildPayload()));

    // Removed since: a tombstone newer than the profile's import
    useSaveStore.getState().replaceAll([], {});
    const tombstone = useSaveStore.getState().removedProfiles[profile.id];
    expect(tombstone).toBeGreaterThan(profile.importedAt);

    expect(restoreBackupData(snapshot)).toEqual({ ok: true });
    const restored = buildPayload();
    expect(restored.saveSummaries?.profiles.map((p) => p.id)).toEqual([profile.id]);
    // ...and it survives the merge with a server that still has the tombstone
    const merged = mergePayload(restored, { ...restored, saveSummaries: { profiles: [], summaries: {}, removed: { [profile.id]: tombstone } } });
    expect(merged.saveSummaries?.profiles.map((p) => p.id)).toEqual([profile.id]);
  });
});

describe("syncOnce against a server", () => {
  // A tiny stand-in for sync-server: one stored copy and a version number
  let server: { data: Record<string, unknown> | null; version: number; pushes: number };
  beforeEach(() => {
    server = { data: null, version: 0, pushes: 0 };
    localStorage.setItem("pokedex_sync_token", "test-token");
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/pull")) {
        return new Response(JSON.stringify({ ok: true, data: server.data, version: server.version, savedAt: null }));
      }
      const { data, baseVersion } = JSON.parse(String(init?.body));
      if (baseVersion !== undefined && baseVersion !== server.version) return new Response("{}", { status: 409 });
      server = { data: JSON.parse(JSON.stringify(data)), version: server.version + 1, pushes: server.pushes + 1 };
      return new Response(JSON.stringify({ ok: true, savedAt: "2026-10-14T00:00:00.000Z", version: server.version }));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reports a change only when something was sent or brought in", async () => {
    useDexStore.getState().setCaught(1, true, 4);
    expect(await syncOnce()).toMatchObject({ ok: true, changed: true });
    expect(server.pushes).toBe(1);

    // Nothing new on either side: no push, nothing to tell the user
    expect(await syncOnce()).toMatchObject({ ok: true, changed: false });
    expect(server.pushes).toBe(1);
    expect(hasUnsyncedChanges()).toBe(false);

    // Another device marks Bulbasaur's neighbour: brought in, without pushing back
    const other = server.data as unknown as BackupData;
    other.tracker.caughtByGen[4] = [1, 2];
    other.tracker.updatedAt!.caught![4] = { ...other.tracker.updatedAt!.caught![4], 2: Date.now() + 1000 };
    server.version++;
    expect(await syncOnce()).toMatchObject({ ok: true, changed: true });
    expect(useDexStore.getState().caughtByGen[4]).toEqual([1, 2]);
    expect(server.pushes).toBe(1);
    expect(hasUnsyncedChanges()).toBe(false);
  });

  it("keeps a section a newer version of the app added, instead of stripping it", async () => {
    useDexStore.getState().setCaught(1, true, 4);
    await syncOnce();
    server.data = { ...server.data, futureSection: { kept: true } };
    server.version++;

    // Nothing this version knows about changed, so it doesn't push over the newer copy
    expect(await syncOnce()).toMatchObject({ ok: true, changed: false });
    expect(server.pushes).toBe(1);

    // A real local change is pushed with the unknown section still in it
    useDexStore.getState().setCaught(4, true, 4);
    expect(await syncOnce()).toMatchObject({ ok: true, changed: true });
    expect(server.data?.futureSection).toEqual({ kept: true });
  });
});
