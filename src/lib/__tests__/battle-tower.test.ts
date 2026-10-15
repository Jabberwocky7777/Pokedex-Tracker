import { describe, expect, it } from "vitest";
import towerSets from "../../data/battle-tower-sets.json";
import towerTrainers from "../../data/battle-tower-trainers.json";
import { speciesKey, towerEvs, towerPokemon, towerSetToCalcPokemon, towerStats } from "../calc-from-tower";
import type { BattleTowerSet, TrainerCategory } from "../../types/battleTower";
import type { Pokemon } from "../../types";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const sets = towerSets as BattleTowerSet[];
const categories = towerTrainers as TrainerCategory[];
const set = (species: string, setNumber: number) => sets.find((s) => s.species === species && s.setNumber === setNumber)!;
const mon = (species: string) => towerPokemon({ species } as BattleTowerSet, allPokemon)!;

describe("Battle Tower sets", () => {
  it("are the game's 950, numbered as in the game, each of a known species", () => {
    expect(sets).toHaveLength(950);
    expect(sets.map((s) => s.id)).toEqual(Array.from({ length: 950 }, (_, i) => i + 1));
    expect(sets.filter((s) => !mon(s.species)).map((s) => s.species)).toEqual([]);
    // Spot checks against the game: id 406 is Abomasnow's first set
    expect(set("Abomasnow", 1)).toMatchObject({
      id: 406, nature: "Calm", item: "Lum Berry", evSpread: "HP/SpA",
      moves: ["Giga Drain", "Ice Beam", "Water Pulse", "Grass Whistle"],
    });
    expect(set("Dragonite", 1).evSpread).toBe("Atk/SpD");
  });

  it("stored stats are the level 50, 31 IV values", () => {
    const wrong = sets.filter((s) => JSON.stringify(towerStats(s, mon(s.species), 31)) !== JSON.stringify(s.stats));
    expect(wrong.map((s) => `${s.species}-${s.setNumber}`)).toEqual([]);
    expect(set("Abomasnow", 1).stats).toEqual({ hp: 197, atk: 100, def: 95, spa: 144, spd: 115, spe: 80 });
    expect(set("Shedinja", 1).stats.hp).toBe(1);
  });

  it("510 EVs are shared equally among the named stats, at most 255 each", () => {
    expect(towerEvs("HP/Atk")).toEqual({ hp: 255, atk: 255, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(towerEvs("HP/Def/SpD")).toEqual({ hp: 170, atk: 0, def: 170, spa: 0, spd: 170, spe: 0 });
    expect(towerEvs("Spe")).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 255 });
    expect(towerEvs("")).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  });

  it("a trainer's IV tier changes the stats", () => {
    const abomasnow = set("Abomasnow", 1);
    // HP: floor((2·90 + 3 + 63) · 50 / 100) + 60
    expect(towerStats(abomasnow, mon("Abomasnow"), 3).hp).toBe(183);
    expect(towerSetToCalcPokemon(abomasnow, allPokemon, 3).stats.hp).toBe(183);
    expect(towerSetToCalcPokemon(abomasnow, allPokemon).stats).toEqual(abomasnow.stats);
  });

  it("a species with only one ability gets it in the damage calc; others are left to the user", () => {
    expect(towerSetToCalcPokemon(set("Medicham", 1), allPokemon).ability).toBe("Pure Power");
    expect(towerSetToCalcPokemon(set("Togekiss", 1), allPokemon).ability).toBe("");
  });
});

describe("Battle Tower trainers", () => {
  const key = (species: string, n: number) => `${speciesKey(species)}#${n}`;
  const known = new Set(sets.map((s) => key(s.species, s.setNumber)));

  it("every trainer group has sets to show", () => {
    const empty = categories.filter((c) => !c.pokemonPool.some((e) => e.sets.some((n) => known.has(key(e.species, n)))));
    expect(empty.map((c) => c.id)).toEqual([]);
  });

  it("the only sets a roster names that the game lacks are three second sets", () => {
    const missing = new Set(categories.flatMap((c) =>
      c.pokemonPool.flatMap((e) => e.sets.filter((n) => !known.has(key(e.species, n))).map((n) => `${e.species}-${n}`))));
    expect([...missing].sort()).toEqual(["Castform-2", "Chatot-2", "Dunsparce-2"]);
  });
});
