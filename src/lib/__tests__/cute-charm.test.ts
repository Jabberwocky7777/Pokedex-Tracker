import { describe, expect, it } from "vitest";
import { cuteCharmAffects, cuteCharmInfo, hex, MALE_LEAD_PIDS } from "../cute-charm";
import { genderBar, genderText } from "../gender";
import allPokemon from "../../../public/data/pokemon.json";

describe("Cute Charm glitch", () => {
  it("doesn't affect genderless or single-gender species", () => {
    for (const rate of [-1, 0, 8]) expect(cuteCharmAffects(rate)).toBe(false);
  });

  it("gives each mixed ratio its female-lead table (the published ranges)", () => {
    const table = (rate: number) => {
      const info = cuteCharmInfo(rate);
      return info.affected ? info.femaleLeadPids.map(hex) : null;
    };
    expect(table(1)).toEqual(["0x32", "0x4A"]); // 87.5% male
    expect(table(2)).toEqual(["0x4B", "0x63"]); // 75% male
    expect(table(4)).toEqual(["0x96", "0xAE"]); // 50%
    expect(table(6)).toEqual(["0xC8", "0xE0"]); // 25% male
    expect(cuteCharmInfo(6)).toMatchObject({ ratioLabel: "25% male" });
  });

  it("keeps the male-lead table female for every mixed ratio", () => {
    // The gender byte must be below each ratio's threshold for the target to be female
    for (const threshold of [31, 63, 127, 191]) expect(MALE_LEAD_PIDS[1]).toBeLessThan(threshold);
  });

  it("covers every gender ratio in the Gen I–IV data", () => {
    const rates = new Set((allPokemon as { id: number; genderRate: number }[]).filter((p) => p.id <= 493).map((p) => p.genderRate));
    for (const rate of rates) expect([-1, 0, 8, 1, 2, 4, 6]).toContain(rate);
  });
});

describe("gender ratio text", () => {
  it("reads like the games' Pokédex", () => {
    expect(genderText(1)).toBe("87.5% ♂ · 12.5% ♀");
    expect(genderText(4)).toBe("50% ♂ · 50% ♀");
    expect(genderText(8)).toBe("Always female");
    expect(genderText(0)).toBe("Always male");
    expect(genderText(-1)).toBe("Genderless");
    expect(genderBar(2)).toEqual({ male: 75, female: 25 });
    expect(genderBar(-1)).toBeNull();
  });
});
