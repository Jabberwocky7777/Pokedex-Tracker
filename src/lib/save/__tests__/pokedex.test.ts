import { describe, expect, it } from "vitest";
import { decodeDex, encodeDex, readGen4Pokedex } from "../pokedex";
import { toSummary } from "../summary";

describe("the save's Pokédex", () => {
  it("encodes and decodes species as a bit string", () => {
    const species = [1, 8, 9, 151, 386, 493];
    const hex = encodeDex(species);
    expect(hex).toHaveLength(124);
    expect(decodeDex(hex)).toEqual(species);
    expect(decodeDex("not hex")).toEqual([]);
    expect(decodeDex("")).toEqual([]);
  });

  it("reads the caught and seen bits after the magic, and nothing without it", () => {
    const bytes = new Uint8Array(0x2000);
    const at = 0x1328; // Platinum
    bytes.set([0xfe, 0xca, 0xef, 0xbe], at);
    bytes[at + 4] = 0b101; // caught #1 and #3
    bytes[at + 4 + 64] = 0b111; // seen #1–#3
    bytes[at + 4 + 64 + 61] = 0b10000; // seen #493
    expect(readGen4Pokedex(bytes, 0, "platinum")).toEqual({ caught: [1, 3], seen: [1, 2, 3, 493] });
    expect(readGen4Pokedex(bytes, 0, "hgss")).toBeUndefined();
  });

  it("travels in the synced summary when the save has it", () => {
    const summary = toSummary({ boxNames: [], mons: [], pokedex: { caught: [25], seen: [25, 26] } });
    expect(decodeDex(summary.pokedex!.caught)).toEqual([25]);
    expect(decodeDex(summary.pokedex!.seen)).toEqual([25, 26]);
    expect(toSummary({ boxNames: [], mons: [] }).pokedex).toBeUndefined();
  });
});
