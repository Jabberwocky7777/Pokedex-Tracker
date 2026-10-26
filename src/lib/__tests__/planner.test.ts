import { describe, expect, it } from "vitest";
import { ladderOf, planCoverage, soleSources, sourceSteps, suppliersOf, unlockPreview } from "../planner";
import { makePokemon } from "../../test/fixtures";
import type { Pokemon } from "../../types";

// Platinum: Zubat on Route 209, Kecleon only on Route 225 (National Dex), Bidoof everywhere.
// Pearl: Slowpoke only. Gastly → Haunter (evolves); Riolu hatches from Lucario.
const DEX: Pokemon[] = [
  makePokemon(41, "Zubat", ["poison"], { encounters: { platinum: { "route-209": ["walk"] } } }),
  makePokemon(352, "Kecleon", ["normal"], { encounters: { platinum: { "sinnoh-route-225-area": ["walk"] } } }),
  makePokemon(399, "Bidoof", ["normal"], { encounters: { platinum: { "route-201": ["walk"] }, pearl: { "route-201": ["walk"] } } }),
  makePokemon(79, "Slowpoke", ["water"], { encounters: { pearl: { "route-205": ["walk"] } } }),
  makePokemon(92, "Gastly", ["ghost"], { encounters: { pearl: { "old-chateau": ["walk"] } } }),
  makePokemon(93, "Haunter", ["ghost"], { evolvesFrom: 92 }),
  makePokemon(447, "Riolu", ["fighting"]),
  makePokemon(448, "Lucario", ["fighting"], { evolvesFrom: 447, encounters: { platinum: { "iron-island": ["walk"] } } }),
  makePokemon(151, "Mew", ["psychic"]),
];
DEX.find((p) => p.id === 447)!.eggGroups = ["no-eggs"];
DEX.find((p) => p.id === 151)!.eggGroups = ["no-eggs"];

describe("suppliers", () => {
  it("include what a species evolves from, and its whole family when it can breed", () => {
    const s = suppliersOf(DEX);
    expect(s.get(93)).toEqual([93, 92]);
    expect(s.get(447)).toEqual([447, 448]);
    expect(s.get(151)).toEqual([151]);
  });

  it("put National Dex areas later on the ladder", () => {
    const steps = sourceSteps(DEX, ["platinum", "pearl"]);
    const ladder = ladderOf("platinum");
    expect(ladder[steps.get(352)!.get("platinum")!].id).toBe("national-dex");
    expect(steps.get(41)!.get("platinum")).toBe(0);
    expect(steps.get(93)!.get("pearl")).toBe(0);
    expect(ladderOf("heartgold").map((s) => s.id)).toEqual(["start", "hall-of-fame", "national-dex", "kanto", "badges-16", "red"]);
  });

  it("finds the species only one game can supply", () => {
    const sole = soleSources(DEX, ["platinum", "pearl"]);
    expect(sole.get(79)).toBe("pearl");
    expect(sole.get(352)).toBe("platinum");
    expect(sole.has(399)).toBe(false);
    expect(soleSources(DEX, ["platinum"]).size).toBe(0);
  });
});

describe("planCoverage", () => {
  it("picks the games and how far into them that cover the most", () => {
    const plan = planCoverage(DEX, ["platinum", "pearl"], new Set());
    expect(plan.unavailable).toEqual([151]);
    // Platinum up to the National Dex: Zubat, Kecleon, Bidoof, Riolu, Lucario; then Pearl: Slowpoke, Gastly, Haunter
    expect(plan.picks.map((p) => [p.label, p.adds.length])).toEqual([
      ["Platinum up to National Pokédex", 5],
      ["Pearl from the start", 3],
    ]);
    expect(plan.coverage).toBeCloseTo(8 / 9);
  });

  it("starts from what is still missing", () => {
    const plan = planCoverage(DEX, ["platinum", "pearl"], new Set([79, 92, 93, 151]));
    expect(plan.picks.map((p) => p.label)).toEqual(["Platinum up to National Pokédex"]);
    expect(plan.coverage).toBe(1);
  });
});

describe("unlockPreview", () => {
  it("lists what a milestone opens", () => {
    expect(unlockPreview(DEX, "platinum", "national-dex", undefined, new Set())).toEqual([352]);
    expect(unlockPreview(DEX, "platinum", "hall-of-fame", undefined, new Set())).toEqual([]);
    const withDex = { badges: [], milestones: { "national-dex": { done: true, source: "manual" as const } } };
    expect(unlockPreview(DEX, "platinum", "national-dex", withDex, new Set())).toEqual([]);
  });
});

describe("unlockPreview credits each milestone with its own unlocks", () => {
  it("gives the Fight Area nothing that the National Dex already opened", () => {
    expect(unlockPreview(DEX, "platinum", "fight-area", undefined, new Set())).toEqual([]);
  });
});
