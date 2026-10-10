import { describe, expect, it } from "vitest";
import { decodePk4 } from "../pk4";
import { checkEvolution, checkTowards, evolutionChecks } from "../evolve";
import type { EvoStep, SaveMon, SlimMon, SpeciesInfo } from "../types";
import { buildPk4, type MonSpec } from "./build";

const full = (spec: MonSpec): SaveMon => decodePk4(buildPk4(spec), 0, 0)!;
const slimOf = (m: SaveMon, level = m.level): SlimMon =>
  ({ box: m.box, slot: m.slot, species: m.species, form: m.form, shiny: m.shiny, level, isEgg: m.isEgg });
const step = (speciesId: number, trigger: string, details: string, extra: Partial<EvoStep> = {}): EvoStep =>
  ({ speciesId, trigger, details, ...extra });
/** Checks one evolution with the full record; `level` overrides the level worked out from EXP. */
const check = (spec: MonSpec, s: EvoStep, level?: number) => {
  const m = full(spec);
  return checkEvolution(slimOf(m, level), m, s);
};

describe("checkEvolution", () => {
  it("level: ready at the level, otherwise counts the levels to go", () => {
    const toIvysaur = step(2, "level-up", "Level 16", { minLevel: 16 });
    expect(check({ species: 1 }, toIvysaur, 16)).toMatchObject({ status: "ready", method: "Level 16", text: "Ready now — level it once" });
    expect(check({ species: 1 }, toIvysaur, 40).status).toBe("ready");
    expect(check({ species: 1 }, toIvysaur, 13)).toMatchObject({ status: "waiting", text: "3 levels to go" });
    expect(check({ species: 1 }, toIvysaur, 15).text).toBe("1 level to go");
  });

  it("level works from the slim summary alone", () => {
    const slim: SlimMon = { box: 0, slot: 0, species: 1, form: 0, shiny: false, level: 20, isEgg: false };
    expect(checkEvolution(slim, undefined, step(2, "level-up", "Level 16", { minLevel: 16 })).status).toBe("ready");
  });

  it("friendship: 220 or more means level it once, with the time of day as text", () => {
    const toCrobat = step(169, "level-up", "Level up with high friendship");
    expect(check({ species: 42, friendship: 220 }, toCrobat)).toMatchObject({ status: "ready", method: "High friendship" });
    expect(check({ species: 42, friendship: 219 }, toCrobat)).toMatchObject({ status: "waiting", text: "Friendship 219/220" });
    const toUmbreon = step(197, "level-up", "Level up with high friendship (night)");
    expect(check({ species: 133, friendship: 255 }, toUmbreon).text).toBe("Friendship is high enough — level it once during the night");
    expect(check({ species: 133, friendship: 70 }, toUmbreon).text).toBe("Friendship 70/220 (then level up during the night)");
  });

  it("item: says which stone to use", () => {
    expect(check({ species: 35 }, step(36, "use-item", "Moon Stone", { item: "moon-stone" })))
      .toMatchObject({ status: "ready", method: "Moon Stone", text: "Use a Moon Stone" });
  });

  it("trade: plain trades need a trade; held-item trades are ready once the item is held", () => {
    expect(check({ species: 64 }, step(65, "trade", "Trade"))).toMatchObject({ status: "ready", text: "Needs a trade" });
    const toSteelix = step(208, "trade", "Trade holding Metal Coat");
    expect(check({ species: 95, heldItem: 233 }, toSteelix))
      .toMatchObject({ status: "ready", text: "Ready to trade — it's holding the Metal Coat" });
    expect(check({ species: 95 }, toSteelix)).toMatchObject({ status: "waiting", text: "Give it a Metal Coat, then trade" });
    // The data spells some items differently from the game ("Kings Rock" / "King's Rock", "Up Grade" / "Up-Grade")
    expect(check({ species: 61, heldItem: 221 }, step(186, "trade", "Trade holding Kings Rock")).status).toBe("ready");
    expect(check({ species: 137, heldItem: 252 }, step(233, "trade", "Trade holding Up Grade")).status).toBe("ready");
  });

  it("move: ready when the move is in its move list", () => {
    const toMamoswine = step(473, "level-up", "Level up knowing Ancient Power");
    expect(check({ species: 221, moves: [33, 246] }, toMamoswine))
      .toMatchObject({ status: "ready", text: "It knows Ancient Power — level it once" });
    expect(check({ species: 221, moves: [33] }, toMamoswine))
      .toMatchObject({ status: "waiting", text: "Teach it Ancient Power, then level up" });
  });

  it("held item while levelling: Gligar and its Razor Fang", () => {
    const toGliscor = step(472, "level-up", "Level up holding Razor Fang (night)");
    expect(check({ species: 207, heldItem: 327 }, toGliscor).text).toBe("It's holding the Razor Fang — level it once during the night");
    expect(check({ species: 207 }, toGliscor).text).toBe("Give it a Razor Fang, then level up during the night");
  });

  it("gender: rules out the wrong one", () => {
    const toMothim = step(414, "level-up", "Level 20 (male)", { minLevel: 20 });
    expect(check({ species: 412, female: true }, toMothim, 30))
      .toMatchObject({ status: "manual", text: "Only a male one can evolve this way" });
    expect(check({ species: 412 }, toMothim, 30).status).toBe("ready");
    expect(check({ species: 281, female: true }, step(475, "use-item", "Dawn Stone")).status).toBe("manual");
  });

  it("anything else is shown as the game words it", () => {
    expect(check({ species: 82 }, step(462, "level-up", "Level up at Mt. Coronet")))
      .toMatchObject({ status: "manual", text: "Level up at Mt. Coronet" });
    expect(check({ species: 236 }, step(106, "level-up", "Level 20 (Attack > Defense)", { minLevel: 20 }), 20).text)
      .toBe("Ready now — level it once (Attack > Defense)");
  });

  it("says what it can't check without the full save", () => {
    const slim: SlimMon = { box: 0, slot: 0, species: 42, form: 0, shiny: false, level: 30, isEgg: false };
    expect(checkEvolution(slim, undefined, step(169, "level-up", "Level up with high friendship")))
      .toMatchObject({ status: "manual", method: "High friendship" });
    expect(checkEvolution(slim, undefined, step(208, "trade", "Trade holding Metal Coat")).status).toBe("manual");
  });
});

describe("evolutionChecks / checkTowards", () => {
  const dex = new Map<number, SpeciesInfo>([
    [10, { id: 10, displayName: "Caterpie", isBaby: false, evolvesFrom: null, evolvesTo: [step(11, "level-up", "Level 7", { minLevel: 7 })] }],
    [11, { id: 11, displayName: "Metapod", isBaby: false, evolvesFrom: 10, evolvesTo: [step(12, "level-up", "Level 10", { minLevel: 10 })] }],
    [12, { id: 12, displayName: "Butterfree", isBaby: false, evolvesFrom: 11, evolvesTo: [] }],
    [133, { id: 133, displayName: "Eevee", isBaby: false, evolvesFrom: null, evolvesTo: [step(134, "use-item", "Water Stone"), step(700, "level-up", "Later generation")] }],
  ]);
  const slim = (species: number, level: number, isEgg = false): SlimMon => ({ box: 0, slot: 0, species, form: 0, shiny: false, level, isEgg });

  it("lists every evolution of the generation, and none for eggs", () => {
    expect(evolutionChecks(slim(133, 5), undefined, dex, 493).map((c) => c.target)).toEqual([134]);
    expect(evolutionChecks(slim(133, 5, true), undefined, dex, 493)).toEqual([]);
  });

  it("finds the next step towards a later stage", () => {
    expect(checkTowards(slim(10, 3), undefined, 12, dex)).toMatchObject({ target: 11, text: "4 levels to go" });
    expect(checkTowards(slim(11, 10), undefined, 12, dex)).toMatchObject({ target: 12, status: "ready" });
    expect(checkTowards(slim(12, 10), undefined, 10, dex)).toBeNull();
  });
});
