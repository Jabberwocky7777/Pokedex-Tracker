import { describe, expect, it } from "vitest";
import { isSampleData, loadSampleData, sampleCollection } from "../sample-data";

describe("sample data", () => {
  it("is the same collection every time, mostly early numbers caught", () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    const a = sampleCollection(now);
    expect(sampleCollection(now)).toEqual(a);
    const early = a.caught.filter((id) => id <= 151).length / 151;
    const late = a.caught.filter((id) => id > 387).length / 106;
    expect(early).toBeGreaterThan(late);
    expect(a.caught.length).toBeGreaterThan(200);
    for (const id of a.shiny) expect(a.caught).toContain(id);
    for (const id of a.pending) expect(a.caught).not.toContain(id);
  });

  it("is flagged while it is on the device", () => {
    localStorage.clear();
    expect(isSampleData()).toBe(false);
    loadSampleData();
    expect(isSampleData()).toBe(true);
    expect(JSON.parse(localStorage.getItem("pokedex-tracker-v2")!).state.caughtByGen[4].length).toBeGreaterThan(200);
    expect(JSON.parse(localStorage.getItem("pokedex-settings-v1")!).state.activeGeneration).toBe(4);
    localStorage.clear();
  });
});
