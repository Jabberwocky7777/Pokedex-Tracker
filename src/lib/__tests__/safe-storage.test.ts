import { afterEach, describe, expect, it, vi } from "vitest";
import { useStorageHealth, safeSetItem } from "../safe-storage";
import { useDexStore } from "../../store/useDexStore";
import { useNotesStore } from "../../store/useNotesStore";

afterEach(() => {
  vi.restoreAllMocks();
  useStorageHealth.setState({ writeFailed: false });
});

const failWrites = () =>
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException("full", "QuotaExceededError");
  });

describe("a refused localStorage write", () => {
  it("doesn't throw out of a store action, and is reported", () => {
    failWrites();
    expect(() => useDexStore.getState().setCaught(25, true, 4)).not.toThrow();
    expect(() => useNotesStore.getState().put("4:25", { text: "x" })).not.toThrow();
    expect(useStorageHealth.getState().writeFailed).toBe(true);
    // The change is still made in memory for this session
    expect(useDexStore.getState().caughtByGen[4]).toContain(25);
  });

  it("safeSetItem says whether the value was written", () => {
    expect(safeSetItem("k", "v")).toBe(true);
    expect(useStorageHealth.getState().writeFailed).toBe(false);
    failWrites();
    expect(safeSetItem("k", "w")).toBe(false);
    expect(useStorageHealth.getState().writeFailed).toBe(true);
  });
});
