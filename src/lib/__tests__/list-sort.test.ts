import { describe, expect, it } from "vitest";
import { listSortParam, nextSort, parseListSort, sortRows, type SortContext } from "../list-sort";
import { notesMarkdown } from "../notes-export";
import { hashOf, parseHash } from "../url-route";
import type { Pokemon } from "../../types";

const mon = (id: number, displayName: string, types: string[], availableInGames: string[] = []) =>
  ({ id, displayName, types, availableInGames }) as unknown as Pokemon;
const rows = [mon(1, "Bulbasaur", ["grass", "poison"], ["diamond"]), mon(25, "Pikachu", ["electric"], ["diamond", "pearl", "platinum"]), mon(94, "Gengar", ["ghost", "poison"])];
const ctx: SortContext = {
  displayNumber: (p) => p.id,
  caughtAt: (id) => ({ 1: 300, 94: 0 } as Record<number, number>)[id],  // Pikachu not caught, Gengar undated
  gamesCount: (p) => p.availableInGames.length,
  note: (id) => (id === 25 ? "Light Ball" : id === 94 ? "masuda" : ""),
};
const ids = (sort: string) => sortRows(rows, parseListSort(sort), ctx).map((p) => p.id);

describe("list sort", () => {
  it("reads and writes the address form", () => {
    expect(parseListSort("caught-desc")).toEqual({ key: "caught", dir: "desc" });
    expect(parseListSort("shoe-asc")).toBeNull();
    expect(parseListSort("name-sideways")).toBeNull();
    expect(listSortParam({ key: "games", dir: "asc" })).toBe("games-asc");
  });

  it("flips the same column and starts another in its usual direction", () => {
    expect(nextSort(null, "caught")).toEqual({ key: "caught", dir: "desc" });
    expect(nextSort({ key: "caught", dir: "desc" }, "caught")).toEqual({ key: "caught", dir: "asc" });
    expect(nextSort({ key: "caught", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
  });

  it("sorts by each column", () => {
    expect(ids("name-asc")).toEqual([1, 94, 25]);
    expect(ids("dex-desc")).toEqual([94, 25, 1]);
    expect(ids("games-desc")).toEqual([25, 1, 94]);
    expect(ids("type-asc")).toEqual([25, 94, 1]);
  });

  it("puts rows with no value last, whichever way", () => {
    expect(ids("caught-desc")).toEqual([1, 94, 25]);   // dated, then undated (0), then not caught
    expect(ids("caught-asc")).toEqual([94, 1, 25]);
    expect(ids("note-asc")).toEqual([25, 94, 1]);
    expect(ids("note-desc")).toEqual([94, 25, 1]);
  });

  it("rides along in the tracker's address", () => {
    expect(parseHash("#/tracker?sort=caught-desc")).toEqual({ tab: "tracker", item: null, sort: "caught-desc" });
    expect(parseHash("#/tracker?sort=nonsense")).toEqual({ tab: "tracker", item: null, sort: null });
    expect(hashOf({ tab: "tracker", item: null, sort: "note-asc" })).toBe("#/tracker?sort=note-asc");
    expect(hashOf({ tab: "routes", item: null, sort: "note-asc" })).toBe("#/routes");
  });
});

describe("notes export", () => {
  const md = notesMarkdown({
    workingOn: {
      a: { text: "Catch Feebas", status: "doing", createdAt: 1, order: 1, link: { kind: "pokemon", id: 349, generation: 3 }, at: 1 },
      b: { text: "Old Rod", status: "done", createdAt: 1, order: 2, at: 1 },
      c: { text: "gone", status: "todo", createdAt: 1, order: 3, at: 1, removed: true },
    },
    notes: { "4:94": { text: "Masuda\nTimid", at: Date.UTC(2026, 9, 20) } },
    journal: { j: { date: "2026-10-23", game: "platinum", text: "Got the Old Rod.", createdAt: 1, at: 1 } },
    generations: [3, 4],
    nameOf: (id) => ({ 349: "Feebas", 94: "Gengar" } as Record<number, string>)[id],
    now: Date.UTC(2026, 9, 23),
  });

  it("has the list with checkboxes, the notes as quotes and the journal", () => {
    expect(md).toContain("- [ ] Catch Feebas (Feebas, Gen 3)");
    expect(md).toContain("- [x] Old Rod");
    expect(md).not.toContain("gone");
    expect(md).toContain("#### #094 Gengar\n\n> Masuda\n> Timid");
    expect(md).toContain("### 2026-10-23 · Platinum\n\nGot the Old Rod.");
    expect(md.endsWith("\n")).toBe(true);
    expect(md).not.toMatch(/\n{3,}/);
  });
});
