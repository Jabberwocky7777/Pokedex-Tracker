import { describe, expect, it } from "vitest";
import { parseGen4Save } from "../gen4";
import { diffSaves, hasChanges, summarizeEntry } from "../history";
import { buildSave, type MonSpec } from "./build";

const NAMES: Record<number, string> = { 14: "Kakuna", 15: "Beedrill", 10: "Caterpie", 11: "Metapod", 16: "Pidgey" };
const nameOf = (id: number) => NAMES[id] ?? `#${id}`;
const LIVING = { role: "living-dex" as const, startBox: 1 };
const save = (boxes: Record<string, MonSpec>, saveCount = 10) => parseGen4Save(buildSave({ boxes, saveCount }));
const diff = (before: Record<string, MonSpec>, after: Record<string, MonSpec>, profile = LIVING) =>
  diffSaves(save(before), save(after, 11), profile, 493, 1000);

// Slots in box 1 (the first dex box): Caterpie #10 → slot 9, Kakuna #14 → slot 13, Beedrill #15 → slot 14
const KAKUNA: MonSpec = { species: 14, pid: 0x00aa1111, exp: 500 };

describe("diffSaves", () => {
  it("records a first import without a diff", () => {
    const first = diffSaves(undefined, save({ "0:0": KAKUNA }), LIVING, 493, 1000);
    expect(first).toMatchObject({ first: true, total: 1, at: 1000, saveCount: 10 });
    expect(hasChanges(first)).toBe(true);
    expect(summarizeEntry(first, nameOf)).toBe("First import — 1 Pokémon");
  });

  it("recognises an evolution by PID, even when the Pokémon moved", () => {
    const entry = diff({ "0:0": KAKUNA }, { "1:14": { ...KAKUNA, species: 15, exp: 2000 } });
    expect(entry.evolved).toEqual([[14, 15]]);
    expect(entry.added).toEqual([]);
    expect(entry.removed).toEqual([]);
    expect(entry.levelUps).toBe(1);
    // …and it landed in Beedrill's slot
    expect(entry.placed).toEqual([15]);
    expect(summarizeEntry(entry, nameOf)).toBe("+1 placed, Kakuna → Beedrill, 1 levelled up");
  });

  it("lists added and removed Pokémon and new shinies", () => {
    const entry = diff(
      { "0:0": KAKUNA, "0:1": { species: 16, pid: 0x00bb2222 } },
      { "0:0": KAKUNA, "0:2": { species: 10, pid: 0x00cc3333, shiny: true }, "0:3": { species: 11, pid: 0x00dd4444 } },
    );
    expect(entry.added).toEqual([10, 11]);
    expect(entry.removed).toEqual([16]);
    expect(entry.newShinies).toEqual([10]);
    expect(entry.evolved).toEqual([]);
    expect(summarizeEntry(entry, nameOf)).toBe("1 new shiny, 2 added, 1 removed");
  });

  it("counts a hatched egg as added, and ignores eggs otherwise", () => {
    const egg: MonSpec = { species: 16, pid: 0x00ee5555, isEgg: true };
    expect(diff({ "0:0": egg }, { "0:0": { ...egg, isEgg: false } }).added).toEqual([16]);
    const newEgg = diff({}, { "0:0": egg });
    expect(newEgg.added).toEqual([]);
    expect(hasChanges(newEgg)).toBe(false);
  });

  it("copes with several Pokémon sharing a PID", () => {
    const twin: MonSpec = { species: 10, pid: 0x00ff6666 };
    const entry = diff({ "0:0": twin, "0:1": twin }, { "0:0": twin, "0:1": { ...twin, species: 11 }, "0:2": twin });
    expect(entry.evolved).toEqual([[10, 11]]);
    expect(entry.added).toEqual([10]);
    expect(entry.removed).toEqual([]);
  });

  it("only reports placement for a living-dex save", () => {
    const before = { "0:0": { species: 10, pid: 0x00111111 } };
    const after = { "1:9": { species: 10, pid: 0x00111111 } };
    expect(diff(before, after).placed).toEqual([10]);
    expect(diff(before, after, { role: "playthrough", startBox: 1 } as never).placed).toEqual([]);
  });

  it("says so when nothing changed, and shortens long lists of evolutions", () => {
    const same = diff({ "0:0": KAKUNA }, { "0:0": KAKUNA });
    expect(hasChanges(same)).toBe(false);
    expect(summarizeEntry(same, nameOf)).toBe("No changes");
    expect(summarizeEntry({ ...same, evolved: [[10, 11], [14, 15], [16, 17]] }, nameOf)).toBe("3 evolved");
  });
});
