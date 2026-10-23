import { describe, expect, it } from "vitest";
import { findNotes, notedIdsIn, notesIn } from "../notes";

const entries = {
  "4:94": { text: "Masuda hunt", at: 30 },
  "4:25": { text: "Light Ball", at: 10 },
  "4:1": { text: "   ", at: 50 },              // empty: not a note
  "4:7": { text: "gone", at: 40, removed: true as const },
  "3:94": { text: "FireRed copy", at: 20 },
};
const names: Record<number, string> = { 94: "Gengar", 25: "Pikachu" };

describe("notes lists", () => {
  it("lists one generation's notes that have text", () => {
    expect(notesIn(entries, 4).map((n) => n.pokemonId).sort()).toEqual([25, 94]);
    expect(notedIdsIn(entries, 3)).toEqual([94]);
  });

  it("sorts by last edit or by dex number, and searches names and text", () => {
    const rows = notesIn(entries, 4);
    expect(findNotes(rows, "", "recent", (id) => names[id]).map((n) => n.pokemonId)).toEqual([94, 25]);
    expect(findNotes(rows, "", "dex", (id) => names[id]).map((n) => n.pokemonId)).toEqual([25, 94]);
    expect(findNotes(rows, "pika", "recent", (id) => names[id]).map((n) => n.pokemonId)).toEqual([25]);
    expect(findNotes(rows, "masuda", "recent", (id) => names[id]).map((n) => n.pokemonId)).toEqual([94]);
  });
});
