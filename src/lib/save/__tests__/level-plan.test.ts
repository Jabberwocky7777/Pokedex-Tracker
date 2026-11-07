import { describe, expect, it } from "vitest";
import { makePokemon } from "../../../test/fixtures";
import { buildLevelPlan, expShareHolder, levelPath } from "../level-plan";
import { wurmpleLine } from "../living-dex";
import { expForLevel } from "../tables";
import { PARTY_BOX, type ProfileMons, type SlimMon } from "../types";

// Pidgey → Pidgeotto (18) → Pidgeot (36) · Poliwag → Poliwhirl (25) → Politoed (trade) · Pikachu → Raichu (stone)
const POKEMON = [
  makePokemon(16, "Pidgey", ["normal", "flying"], {
    evolvesTo: [{ speciesId: 17, displayName: "Pidgeotto", trigger: "level-up", minLevel: 18, details: "Level 18" }],
  }),
  makePokemon(17, "Pidgeotto", ["normal", "flying"], {
    evolvesFrom: 16,
    evolvesTo: [{ speciesId: 18, displayName: "Pidgeot", trigger: "level-up", minLevel: 36, details: "Level 36" }],
  }),
  makePokemon(18, "Pidgeot", ["normal", "flying"], { evolvesFrom: 17 }),
  makePokemon(25, "Pikachu", ["electric"], {
    evolvesTo: [{ speciesId: 26, displayName: "Raichu", trigger: "use-item", details: "Thunder Stone" }],
  }),
  makePokemon(26, "Raichu", ["electric"], { evolvesFrom: 25 }),
  makePokemon(60, "Poliwag", ["water"], {
    evolvesTo: [{ speciesId: 61, displayName: "Poliwhirl", trigger: "level-up", minLevel: 25, details: "Level 25" }],
  }),
  makePokemon(61, "Poliwhirl", ["water"], {
    evolvesFrom: 60,
    evolvesTo: [{ speciesId: 186, displayName: "Politoed", trigger: "trade", details: "Trade holding King's Rock" }],
  }),
  makePokemon(186, "Politoed", ["water"], { evolvesFrom: 61 }),
];
const dex = new Map(POKEMON.map((p) => [p.id, p]));

let slot = 0;
const mon = (species: number, level: number, extra: Partial<SlimMon> = {}): SlimMon => ({
  box: 2,
  slot: slot++,
  species,
  form: 0,
  shiny: false,
  level,
  isEgg: false,
  ...extra,
});

function save(mons: SlimMon[]): ProfileMons {
  return {
    profile: {
      id: "pt",
      label: "Platinum",
      role: "playthrough",
      startBox: 0,
      fileName: "",
      importedAt: 0,
      saveCount: 1,
      family: "platinum",
      trainer: { name: "T", tid: 1, sid: 2 },
    },
    boxNames: ["A", "B", "C"],
    mons,
  };
}

describe("levelPath", () => {
  it("takes the highest level of the level steps and keeps what follows", () => {
    expect(levelPath(dex, 16, 18)).toMatchObject({
      needLevel: 36,
      steps: [
        [17, 18],
        [18, 36],
      ],
    });
    expect(levelPath(dex, 60, 186)).toMatchObject({ needLevel: 25, then: "Trade holding King's Rock" });
  });
  it("is null when the first step isn't a level", () => {
    expect(levelPath(dex, 25, 26)).toBeNull();
  });
});

describe("buildLevelPlan", () => {
  it("gives the higher copy to the higher target, which costs less in total", () => {
    const low = mon(16, 15);
    const high = mon(16, 20);
    const jobs = buildLevelPlan([save([low, high])], dex, { maxSpecies: 493 });
    const byTarget = new Map(jobs.map((j) => [j.target, j]));
    // Both Pidgey are spares; one is counted towards Pidgeotto and one towards Pidgeot
    expect(byTarget.get(18)?.pick.mon).toBe(high);
    expect(byTarget.get(17)?.pick.mon).toBe(low);
    expect(byTarget.get(18)?.levelsToGo).toBe(16);
    expect(byTarget.get(17)?.pick.expToGo).toBe(expForLevel(16, 18) - expForLevel(16, 15));
    // The other way round would need more EXP
    const chosen = byTarget.get(18)!.pick.expToGo + byTarget.get(17)!.pick.expToGo;
    const swapped = expForLevel(16, 36) - expForLevel(16, 15) + Math.max(0, expForLevel(16, 18) - expForLevel(16, 20));
    expect(chosen).toBeLessThan(swapped);
    // Neither lists the other's copy as an alternative
    expect(jobs.every((j) => j.others.length === 0)).toBe(true);
  });

  it("uses the real EXP from the full save and the traded flag", () => {
    const m = mon(60, 20, { own: false });
    const exp = expForLevel(60, 20) + 500;
    const jobs = buildLevelPlan([save([m])], dex, {
      maxSpecies: 493,
      fullSaves: { pt: { mons: [{ ...m, exp }] } as never },
    });
    expect(jobs[0]).toMatchObject({ target: 61, needLevel: 25 });
    expect(jobs[0].pick).toMatchObject({ expExact: true, traded: true, expToGo: expForLevel(60, 25) - exp });
  });

  it("marks a copy already at the level as ready, and leaves stone evolutions out", () => {
    const jobs = buildLevelPlan([save([mon(16, 19), mon(25, 30, { box: PARTY_BOX, slot: 0 })])], dex, {
      maxSpecies: 493,
    });
    expect(jobs.map((j) => j.target)).toEqual([17]);
    expect(jobs[0].readyNow).toBe(true);
    expect(jobs[0].pick.expToGo).toBe(expForLevel(16, 20) - expForLevel(16, 19));
    expect(expShareHolder(jobs)).toBeNull();
  });

  it("gives the Exp. Share to the one with the most EXP to go", () => {
    const jobs = buildLevelPlan([save([mon(16, 5), mon(60, 24)])], dex, { maxSpecies: 493 });
    expect(expShareHolder(jobs)?.target).toBe(17);
  });
});

describe("Wurmple", () => {
  // Wurmple → Silcoon (7) → Beautifly (10) or Cascoon (7) → Dustox (10), by personality value
  const BUGS = [
    makePokemon(265, "Wurmple", ["bug"], {
      evolvesTo: [
        { speciesId: 266, displayName: "Silcoon", trigger: "level-up", minLevel: 7, details: "Level 7" },
        { speciesId: 268, displayName: "Cascoon", trigger: "level-up", minLevel: 7, details: "Level 7" },
      ],
    }),
    makePokemon(266, "Silcoon", ["bug"], { evolvesFrom: 265 }),
    makePokemon(268, "Cascoon", ["bug"], { evolvesFrom: 265 }),
  ];
  const bugs = new Map(BUGS.map((p) => [p.id, p]));
  // Upper half % 10: 0 → Silcoon, 7 → Cascoon
  const SILCOON_PID = 0x0000_1234;
  const CASCOON_PID = 0x0007_1234;

  it("knows the line from the personality value", () => {
    expect(wurmpleLine(SILCOON_PID)).toEqual([266, 267]);
    expect(wurmpleLine(CASCOON_PID)).toEqual([268, 269]);
    expect(wurmpleLine(0xffff_0000)).toEqual([268, 269]); // 65535 % 10 = 5
  });

  it("counts a Cascoon-bound Wurmple towards Cascoon, not the lower-numbered Silcoon", () => {
    const w = mon(265, 5);
    const full = { pt: { mons: [{ ...w, pid: CASCOON_PID, exp: 0 }] } as never };
    const jobs = buildLevelPlan([save([w])], bugs, { maxSpecies: 493, fullSaves: full });
    expect(jobs.map((j) => j.target)).toEqual([268]);
    expect(jobs[0].pick.branchUnknown).toBeUndefined();
    // Without the full save it is a guess, and says so
    const guess = buildLevelPlan([save([w])], bugs, { maxSpecies: 493 });
    expect(guess[0].pick.branchUnknown).toBe(true);
  });
});

describe("keeping copies where they sit", () => {
  // Caterpie → Metapod (7) → Butterfree (10)
  const BUGS = [
    makePokemon(10, "Caterpie", ["bug"], {
      evolvesTo: [{ speciesId: 11, displayName: "Metapod", trigger: "level-up", minLevel: 7, details: "Level 7" }],
    }),
    makePokemon(11, "Metapod", ["bug"], {
      evolvesFrom: 10,
      evolvesTo: [{ speciesId: 12, displayName: "Butterfree", trigger: "level-up", minLevel: 10, details: "Level 10" }],
    }),
    makePokemon(12, "Butterfree", ["bug"], { evolvesFrom: 11 }),
  ];
  const bugs = new Map(BUGS.map((p) => [p.id, p]));

  it("leaves placeholders in their slots when moving them saves no EXP", () => {
    // Living dex from box 0: Caterpie in its own slot, a Lv 5 one in Metapod's slot, a Lv 3 one in Butterfree's.
    // Lv 5 → 7 + Lv 3 → 10 costs exactly as much as Lv 3 → 7 + Lv 5 → 10, so nothing needs to move.
    const own = { ...mon(10, 5), box: 0, slot: 9 };
    const inMetapod = { ...mon(10, 5), box: 0, slot: 10 };
    const inButterfree = { ...mon(10, 3), box: 0, slot: 11 };
    const living = save([own, inMetapod, inButterfree]);
    living.profile = { ...living.profile, role: "living-dex", startBox: 0 };
    const jobs = buildLevelPlan([living], bugs, { maxSpecies: 493 });
    const byTarget = new Map(jobs.map((j) => [j.target, j]));
    expect(byTarget.get(11)?.pick.mon).toBe(inMetapod);
    expect(byTarget.get(12)?.pick.mon).toBe(inButterfree);
  });
});
