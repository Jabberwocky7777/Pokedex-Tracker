import { beforeEach, describe, expect, it } from "vitest";
import { mergePayload } from "../sync-merge";
import { restoreBackupData, type BackupData } from "../backup";
import { addItem, clearDone, completeLinkedItems, cycleStatus, deleteItem, isOnList, moveItem, orderForMove, orderedItems, setItemNote, updateItem, type LiveItem } from "../working-on";
import { useWorkingOnStore, type WorkItem } from "../../store/useWorkingOnStore";
import { useUndoStore } from "../../store/useUndoStore";
import { toggleWithUndo } from "../dex-actions";
import { useDexStore } from "../../store/useDexStore";

const withList = (workingOn: BackupData["workingOn"]): BackupData => ({
  version: 2, exportedAt: "", tracker: { caughtByGen: {}, pendingByGen: {} }, ivChecker: { savedSessions: [] }, workingOn,
});
const item = (text: string, at: number, extra: Partial<WorkItem> & { removed?: true } = {}) =>
  ({ text, status: "todo" as const, createdAt: 1, order: 1, at, ...extra });
const list = () => orderedItems(useWorkingOnStore.getState().entries);

beforeEach(() => {
  useWorkingOnStore.setState({ entries: {} });
  useUndoStore.setState({ toast: null });
});

describe("Working on in sync", () => {
  it("keeps items added on two devices", () => {
    const merged = mergePayload(withList({ a: item("Catch Feebas", 10) }), withList({ b: item("Breed Ralts", 20) }));
    expect(Object.keys(merged.workingOn ?? {}).sort()).toEqual(["a", "b"]);
  });

  it("takes the newer edit of the same item, either way round", () => {
    const phone = withList({ a: item("Catch Feebas", 10) });
    const pc = withList({ a: item("Catch Feebas", 20, { status: "done" }) });
    expect(mergePayload(phone, pc).workingOn?.a.status).toBe("done");
    expect(mergePayload(pc, phone).workingOn?.a.status).toBe("done");
  });

  it("carries a deletion across unless the item was edited later", () => {
    expect(mergePayload(withList({ a: item("x", 10) }), withList({ a: item("x", 20, { removed: true }) })).workingOn?.a.removed).toBe(true);
    expect(mergePayload(withList({ a: item("edited", 30) }), withList({ a: item("x", 20, { removed: true }) })).workingOn?.a.text).toBe("edited");
  });

  it("loses nothing against an older client that has no list", () => {
    const local = withList({ a: item("mine", 10) });
    expect(mergePayload(local, withList(undefined)).workingOn).toEqual(local.workingOn);
  });
});

describe("Working on in backups", () => {
  it("accepts good items and tombstones", () => {
    expect(restoreBackupData(withList({ a: item("x", 1, { link: { kind: "pokemon", id: 349, generation: 3 } }), b: { at: 2, removed: true } as never })).ok).toBe(true);
  });

  it("rejects bad shapes", () => {
    for (const bad of [
      { a: { text: "x", at: 1 } },                                            // no status, order, createdAt
      { a: item("x", 1, { status: "later" as never }) },                       // unknown status
      { a: item("x", 1, { link: { kind: "pokemon", id: "349" } as never }) },  // id is not a number
      { a: item("x", 1, { link: { kind: "planet" } as never }) },              // unknown link
      { a: item("x", 1, { note: 5 as never }) },                               // note is not text
    ]) {
      expect(restoreBackupData(withList(bad as never)).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("item notes", () => {
  it("adds, edits and clears a note, and keeps it through other edits", () => {
    const id = addItem("Gyarados")!;
    setItemNote(id, "  Lake of Rage\nBring Ultra Balls  ");
    expect(list()[0].note).toBe("Lake of Rage\nBring Ultra Balls");
    cycleStatus(id);
    updateItem(id, { text: "Red Gyarados" });
    expect(list()[0]).toMatchObject({ text: "Red Gyarados", status: "doing", note: "Lake of Rage\nBring Ultra Balls" });
    setItemNote(id, "   ");
    expect("note" in useWorkingOnStore.getState().entries[id]).toBe(false);
  });

  it("writes nothing when the note didn't change", () => {
    const id = addItem("Gyarados")!;
    setItemNote(id, "x");
    const before = useWorkingOnStore.getState().entries[id];
    setItemNote(id, "x ");
    expect(useWorkingOnStore.getState().entries[id]).toBe(before);
  });

  it("comes back with Undo after a delete", () => {
    const id = addItem("Gyarados")!;
    setItemNote(id, "Lake of Rage");
    deleteItem(id);
    useUndoStore.getState().toast!.undo();
    expect(list()[0].note).toBe("Lake of Rage");
  });

  it("is accepted in backups", () => {
    expect(restoreBackupData(withList({ a: item("x", 1, { note: "Lake of Rage" }) })).ok).toBe(true);
  });
});

describe("ordering", () => {
  const live = (id: string, order: number): LiveItem => ({ ...item(id, 1), id, order });
  const three = [live("a", 1), live("b", 2), live("c", 3)];

  it("moves an item by changing only its own order", () => {
    expect(orderForMove(three, "c", 0)).toBe(0);
    expect(orderForMove(three, "a", 2)).toBe(4);
    expect(orderForMove(three, "a", 1)).toBe(2.5);
    expect(orderForMove(three, "c", 1)).toBe(1.5);
  });

  it("adds new items at the end and reorders them", () => {
    addItem("one"); addItem("two"); addItem("three");
    const id = list()[2].id;
    moveItem(id, 0);
    expect(list().map((i) => i.text)).toEqual(["three", "one", "two"]);
  });

  it("ignores empty text", () => {
    expect(addItem("   ")).toBeNull();
    expect(list()).toEqual([]);
  });
});

describe("actions", () => {
  it("cycles To do → Doing → Done → To do", () => {
    const id = addItem("x")!;
    const status = () => useWorkingOnStore.getState().entries[id].status;
    cycleStatus(id); expect(status()).toBe("doing");
    cycleStatus(id); expect(status()).toBe("done");
    cycleStatus(id); expect(status()).toBe("todo");
  });

  it("deletes with Undo", () => {
    const id = addItem("Catch Feebas")!;
    deleteItem(id);
    expect(list()).toEqual([]);
    useUndoStore.getState().toast!.undo();
    expect(list().map((i) => i.text)).toEqual(["Catch Feebas"]);
  });

  it("clears only done items, with Undo", () => {
    const a = addItem("a")!; addItem("b");
    cycleStatus(a); cycleStatus(a);
    clearDone();
    expect(list().map((i) => i.text)).toEqual(["b"]);
    expect(useUndoStore.getState().toast!.message).toBe("Cleared 1 done item");
    useUndoStore.getState().toast!.undo();
    expect(list().map((i) => i.text)).toEqual(["a", "b"]);
  });

  it("finishes the open items linked to a caught Pokémon, in its generation or with none named", () => {
    addItem("Catch Feebas", { kind: "pokemon", id: 349, generation: 3 });
    addItem("Feebas anywhere", { kind: "pokemon", id: 349 });
    addItem("Feebas in Gen 4", { kind: "pokemon", id: 349, generation: 4 });
    expect(isOnList(list(), 349, 3)).toBe(true);
    const done = completeLinkedItems(349, 3)!;
    expect(done.note).toBe("2 Working on items done");
    expect(list().filter((i) => i.status === "done").map((i) => i.text)).toEqual(["Catch Feebas", "Feebas anywhere"]);
    done.undo();
    expect(list().every((i) => i.status === "todo")).toBe(true);
    expect(completeLinkedItems(25, 3)).toBeNull();
  });
});

describe("marking caught from the tracker", () => {
  it("says which item it finished, and Undo takes both back", () => {
    useDexStore.setState({ caughtByGen: {}, pendingByGen: {} });
    addItem("Catch Feebas", { kind: "pokemon", id: 349 });
    toggleWithUndo("caught", 349, 3, "Feebas");
    expect(useUndoStore.getState().toast!.message).toBe("Caught Feebas — “Catch Feebas” done");
    expect(list()[0].status).toBe("done");
    useUndoStore.getState().toast!.undo();
    expect(list()[0].status).toBe("todo");
    expect(useDexStore.getState().caughtByGen[3] ?? []).not.toContain(349);
  });
});
