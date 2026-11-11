import { describe, expect, it } from "vitest";
import { lotteryHits, matchingDigits } from "../lottery";
import type { SaveMon } from "../types";

describe("the lottery", () => {
  it("matches digits from the right, as five-digit numbers", () => {
    expect(matchingDigits(12345, 99345)).toBe(3);
    expect(matchingDigits(12345, 12345)).toBe(5);
    expect(matchingDigits(12345, 12344)).toBe(0);
    expect(matchingDigits(7, 10007)).toBe(4); // 00007 and 10007
  });

  it("lists matching Pokémon across saves, best first, eggs left out", () => {
    const mon = (species: number, otTid: number, isEgg = false) => ({ species, otTid, isEgg }) as SaveMon;
    const hits = lotteryHits(12345, [
      { profileId: "a", mons: [mon(1, 11111), mon(25, 99945), mon(26, 12345, true)] },
      { profileId: "b", mons: [mon(94, 22345)] },
    ]);
    expect(hits.map((h) => [h.profileId, h.mon.species, h.digits])).toEqual([
      ["b", 94, 4],
      ["a", 25, 2],
    ]);
  });
});
