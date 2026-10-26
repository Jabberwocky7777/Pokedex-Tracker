import { beforeEach, describe, expect, it } from "vitest";
import { applyProgress, badgeCount, isSet, mergeProgressChanges, milestoneWhen, proposeFromSave, type ProgressChange } from "../game-progress";
import { applyProgressFromSave, currentProgress, setProgressWithUndo } from "../progress-actions";
import { applyImportWithUndo, redoLogEntry, undoLogEntry } from "../dex-actions";
import { GAME_PROGRESS } from "../../data/game-progress";
import { useGameProgressStore } from "../../store/useGameProgressStore";
import { useChangeLogStore } from "../../store/useChangeLogStore";
import { useUndoStore } from "../../store/useUndoStore";
import { useDexStore } from "../../store/useDexStore";

const badge = (game: string, id: number, value = true): ProgressChange => ({ game, kind: "badge", id, value });
const hof = (game: string, value = true): ProgressChange => ({ game, kind: "milestone", id: "hall-of-fame", value });

beforeEach(() => {
  localStorage.clear();
  useGameProgressStore.getState().replaceAll({});
  useChangeLogStore.getState().clear();
  useUndoStore.getState().dismiss();
  useDexStore.setState({ caughtByGen: {}, pendingByGen: {}, shinyByGen: {}, placedByGen: {} });
});

describe("milestone definitions", () => {
  it("every game has 8 badges (16 in HG/SS) with distinct ids", () => {
    for (const [game, def] of Object.entries(GAME_PROGRESS)) {
      const ids = def!.badges.map((b) => b.id);
      expect(new Set(ids).size, game).toBe(ids.length);
      expect(ids.length, game).toBe(game === "heartgold" || game === "soulsilver" ? 16 : 8);
      expect(def!.milestones.some((m) => m.id === "hall-of-fame"), game).toBe(true);
    }
  });

  it("orders Platinum's badges by gym, Fantina third, keeping the game's badge ids", () => {
    expect(GAME_PROGRESS.platinum!.badges.map((b) => b.leader).slice(0, 4)).toEqual(["Roark", "Gardenia", "Fantina", "Maylene"]);
    expect(GAME_PROGRESS.platinum!.badges[2].id).toBe(4);
  });
});

describe("game progress helpers", () => {
  it("applies changes and keeps the date a milestone was first reached", () => {
    const one = applyProgress(undefined, [badge("platinum", 3), badge("platinum", 0), hof("platinum")], 100, "manual");
    expect(one).toEqual({ badges: [0, 3], milestones: { "hall-of-fame": { done: true, at: 100, source: "manual" } } });
    const two = applyProgress(one, [hof("platinum"), badge("platinum", 3, false)], 200, "save");
    expect(two.milestones["hall-of-fame"]).toEqual({ done: true, at: 100, source: "manual" });
    expect(two.badges).toEqual([0]);
    expect(applyProgress(two, [hof("platinum", false)], 300, "manual").milestones).toEqual({});
  });

  it("keeps a save's real Hall of Fame date apart from the day of the import", () => {
    const p = applyProgress(undefined, [hof("platinum"), { game: "platinum", kind: "milestone", id: "national-dex", value: true }], 500, "save", { "hall-of-fame": 100 });
    expect(p.milestones["hall-of-fame"]).toEqual({ done: true, at: 100, source: "save", exact: true });
    expect(p.milestones["national-dex"]).toEqual({ done: true, at: 500, source: "save" });
    const d = (ms: number) => String(ms);
    expect(milestoneWhen(p.milestones["hall-of-fame"]!, d)).toBe("Reached 100 (from save)");
    expect(milestoneWhen(p.milestones["national-dex"]!, d)).toBe("In a save imported 500");
    expect(milestoneWhen({ done: true, at: 7, source: "manual" }, d)).toBe("Ticked 7");
  });

  it("cancels a change that is taken back", () => {
    expect(mergeProgressChanges([badge("pearl", 1), badge("pearl", 2)], [badge("pearl", 1, false)])).toEqual([badge("pearl", 2)]);
  });

  it("counts badges out of the game's total", () => {
    expect(badgeCount("heartgold", { badges: [0, 1, 8], milestones: {} })).toEqual({ earned: 3, total: 16 });
    expect(badgeCount("platinum", undefined)).toEqual({ earned: 0, total: 8 });
  });

  it("only ever proposes moving forward", () => {
    const current = { badges: [0, 1, 2], milestones: { "national-dex": { done: true, source: "manual" as const } } };
    // The save has fewer badges and no National Dex: nothing to untick, only the new badge and the Hall of Fame
    expect(proposeFromSave("platinum", current, { badges: [0, 5], hallOfFame: true, nationalDex: false })).toEqual([
      badge("platinum", 5), hof("platinum"),
    ]);
    expect(proposeFromSave("platinum", current, {})).toEqual([]);
  });

  it("drops what the game doesn't have: Kanto badges outside HG/SS", () => {
    expect(proposeFromSave("platinum", undefined, { badges: [9] })).toEqual([]);
    expect(proposeFromSave("heartgold", undefined, { badges: [9] })).toEqual([badge("heartgold", 9)]);
  });
});

describe("progress with undo and the change log", () => {
  it("ticks a badge, logs it, and Undo takes it back and cancels the log entry", () => {
    setProgressWithUndo(badge("platinum", 0));
    expect(isSet(currentProgress("platinum"), badge("platinum", 0))).toBe(true);
    const [entry] = useChangeLogStore.getState().entries;
    expect(entry).toMatchObject({ kind: "progress", gen: 4, progress: [badge("platinum", 0)] });
    expect(useUndoStore.getState().toast?.message).toBe("Coal Badge (Pt) ticked");
    useUndoStore.getState().toast!.undo();
    expect(currentProgress("platinum")?.badges).toEqual([]);
    expect(useChangeLogStore.getState().entries).toEqual([]);
  });

  it("groups hand-made changes and undoes or redoes them from the log", () => {
    setProgressWithUndo(badge("emerald", 0));
    setProgressWithUndo(badge("emerald", 1));
    const [entry] = useChangeLogStore.getState().entries;
    expect(entry.gen).toBe(3);
    expect(entry.progress).toHaveLength(2);
    expect(undoLogEntry(entry.id)).toEqual({ reverted: 2, skipped: 0 });
    expect(currentProgress("emerald")?.badges).toEqual([]);
    redoLogEntry(entry.id);
    expect(currentProgress("emerald")?.badges).toEqual([0, 1]);
  });

  it("doesn't undo a change that has been changed again since", () => {
    setProgressWithUndo(badge("pearl", 0));
    const id = useChangeLogStore.getState().entries[0].id;
    useGameProgressStore.getState().put("pearl", { badges: [], milestones: {} });
    expect(undoLogEntry(id)).toEqual({ reverted: 0, skipped: 1 });
  });

  it("an import's progress rides on its log entry, so undoing the import takes it back too", () => {
    const { entryId } = applyImportWithUndo(4, [{ field: "caught", id: 1, value: true }], "Platinum");
    applyProgressFromSave([badge("platinum", 0), hof("platinum")], entryId);
    const [entry] = useChangeLogStore.getState().entries;
    expect(entry.kind).toBe("import");
    expect(entry.progress).toHaveLength(2);
    expect(currentProgress("platinum")?.milestones["hall-of-fame"]?.source).toBe("save");
    undoLogEntry(entry.id);
    expect(currentProgress("platinum")).toEqual({ badges: [], milestones: {} });
    expect(useDexStore.getState().isCaught(1, 4)).toBe(false);
  });

  it("progress from a save with no mark changes gets its own entry", () => {
    const { entryId } = applyImportWithUndo(4, [], "Platinum");
    expect(entryId).toBeNull();
    const result = applyProgressFromSave([badge("platinum", 0)], entryId);
    expect(result.entryId).not.toBeNull();
    expect(useChangeLogStore.getState().entries[0].kind).toBe("progress");
  });
});
