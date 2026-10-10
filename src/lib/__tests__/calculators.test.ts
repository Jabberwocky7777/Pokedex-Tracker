import { describe, expect, it } from "vitest";
import { calcCatchRate } from "../catch-rate";
import { calcDamage, calcDamageRolls, computeStat, entryHazardDamage, typeEffectiveness, weatherDamage } from "../damage-calc";
import { moveNameToSlug } from "../move-lookup";
import towerSets from "../../data/battle-tower-sets.json";
import saveTables from "../../data/save-tables.json";
import type { CalcMove, CalcPokemon } from "../../types/battleTower";

describe("calcCatchRate (Gen III/IV)", () => {
  it("catch rate 45 at full HP with a Poké Ball is about 5.9%", () => {
    const r = calcCatchRate({ catchRate: 45, maxHP: 100, currentHP: 100, ballBonus: 1, statusMultiplier: 1 });
    expect(r.a).toBe(15); // (3·100 − 2·100) · 45 / (3·100)
    expect(r.b).toBe(32275); // floor(65536 / (255/15)^(1/4))
    expect(r.guaranteed).toBe(false);
    expect(r.catchChance).toBeCloseTo(0.0588, 3);
  });

  it("low HP, sleep and an Ultra Ball raise the rate as the formula says", () => {
    // a = floor((300 − 2) · 45 · 2 · 2 / 300) = floor(178.8) = 178
    const r = calcCatchRate({ catchRate: 45, maxHP: 100, currentHP: 1, ballBonus: 2, statusMultiplier: 2 });
    expect(r.a).toBe(178);
    expect(r.catchChance).toBeCloseTo(0.698, 2);
  });

  it("is guaranteed once the modified rate reaches 255", () => {
    const r = calcCatchRate({ catchRate: 255, maxHP: 50, currentHP: 1, ballBonus: 1.5, statusMultiplier: 1 });
    expect(r.guaranteed).toBe(true);
    expect(r.catchChance).toBe(1);
  });

  it("a legendary (catch rate 3) at full HP in an Ultra Ball is under 1%", () => {
    const r = calcCatchRate({ catchRate: 3, maxHP: 200, currentHP: 200, ballBonus: 2, statusMultiplier: 1 });
    expect(r.a).toBe(2);
    expect(r.catchChance).toBeGreaterThan(0.007);
    expect(r.catchChance).toBeLessThan(0.009);
  });

  it("clamps HP and handles zero max HP", () => {
    const over = calcCatchRate({ catchRate: 45, maxHP: 100, currentHP: 500, ballBonus: 1, statusMultiplier: 1 });
    expect(over.a).toBe(15);
    expect(calcCatchRate({ catchRate: 45, maxHP: 0, currentHP: 0, ballBonus: 1, statusMultiplier: 1 }).catchChance).toBe(0);
  });
});

function mon(over: Partial<CalcPokemon> = {}): CalcPokemon {
  return {
    source: "custom",
    species: "Test",
    types: ["normal"],
    level: 50,
    nature: "Hardy",
    ability: "",
    item: "",
    status: "none" as CalcPokemon["status"],
    stats: { hp: 150, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    moves: [],
    currentHp: 150,
    ...over,
  };
}

const move = (over: Partial<CalcMove> = {}): CalcMove => ({
  name: "Test Move", power: 80, type: "fighting", category: "physical", ...over,
});

describe("calcDamageRolls (Gen IV)", () => {
  // Level 50, 80 power, 100 Atk vs 100 Def:
  //   floor(floor(22 · 80 · 100 / 100) / 50) + 2 = 37 before the random roll
  it("neutral, no STAB: 31–37", () => {
    const rolls = calcDamageRolls({ attacker: mon(), defender: mon({ types: ["water"] }), move: move(), weather: "none" });
    expect(rolls).toHaveLength(16);
    expect(rolls[0]).toBe(31);  // floor(37 · 85 / 100)
    expect(rolls[15]).toBe(37);
  });

  it("STAB multiplies by 1.5: 46–55", () => {
    const rolls = calcDamageRolls({
      attacker: mon({ types: ["fighting"] }), defender: mon({ types: ["water"] }), move: move(), weather: "none",
    });
    expect([rolls[0], rolls[15]]).toEqual([46, 55]);
  });

  it("super effective doubles, resisted halves, immune is zero", () => {
    const vs = (types: CalcPokemon["types"]) =>
      calcDamageRolls({ attacker: mon(), defender: mon({ types }), move: move(), weather: "none" })[15];
    expect(vs(["normal"])).toBe(74);
    expect(vs(["psychic"])).toBe(18);
    expect(vs(["ghost"])).toBe(0);
  });

  it("a critical hit doubles and rain boosts Water moves", () => {
    const base = { attacker: mon(), defender: mon({ types: ["water"] }), weather: "none" as const };
    expect(calcDamageRolls({ ...base, move: move(), isCrit: true })[15]).toBe(74);
    // Weather applies before the +2: floor(35 · 1.5) + 2 = 54, not floor(37 · 1.5) = 55
    const surf = move({ type: "water", category: "special" });
    expect(calcDamageRolls({ ...base, defender: mon({ types: ["normal"] }), move: surf, weather: "rain" })[15]).toBe(54);
  });

  it("screens halve damage in Singles and take a third off in Doubles", () => {
    const base = { attacker: mon(), defender: mon({ types: ["water"] }), move: move(), weather: "none" as const, reflect: true };
    // floor(35 / 2) + 2 = 19; floor(35 · 2/3) + 2 = 25
    expect(calcDamageRolls({ ...base, isSingles: true })[15]).toBe(19);
    expect(calcDamageRolls({ ...base, isSingles: false })[15]).toBe(25);
    // Reflect does nothing against special moves or critical hits
    expect(calcDamageRolls({ ...base, move: move({ category: "special" }) })[15]).toBe(37);
    expect(calcDamageRolls({ ...base, isCrit: true })[15]).toBe(74);
  });

  it("only spread moves lose a quarter in Doubles", () => {
    const base = { attacker: mon(), defender: mon({ types: ["water"] }), weather: "none" as const, isSingles: false };
    expect(calcDamageRolls({ ...base, move: move() })[15]).toBe(37);
    expect(calcDamageRolls({ ...base, move: move({ spread: true }) })[15]).toBe(28); // floor(35 · 3/4) + 2
  });

  it("applies items where Generation IV applies them", () => {
    const vs = (item: string, over: Partial<CalcPokemon> = {}) =>
      calcDamageRolls({ attacker: mon({ item, ...over }), defender: mon({ types: ["water"] }), move: move(), weather: "none" })[15];
    expect(vs("Muscle Band")).toBe(40);  // base power 88
    expect(vs("Black Belt")).toBe(44);   // base power 96
    expect(vs("Life Orb")).toBe(48);     // floor(37 · 1.3)
    expect(vs("Choice Band")).toBe(54);  // Attack 150
    // Thick Club only works for Cubone and Marowak
    expect(vs("Thick Club")).toBe(37);
    expect(vs("Thick Club", { species: "Marowak" })).toBe(72);
  });

  it("handles the abilities that change damage", () => {
    const hit = (attacker: Partial<CalcPokemon>, defender: Partial<CalcPokemon>, m: Partial<CalcMove> = {}) =>
      calcDamageRolls({ attacker: mon(attacker), defender: mon({ types: ["water"], ...defender }), move: move(m), weather: "none" })[15];
    expect(hit({ ability: "Huge Power" }, {})).toBe(72);
    expect(hit({ ability: "Technician" }, {}, { power: 60 })).toBe(41);
    expect(hit({ ability: "Guts", status: "burn" }, {})).toBe(54);
    expect(hit({ status: "burn" }, {})).toBe(19);
    expect(hit({}, { ability: "Volt Absorb" }, { type: "electric", category: "special" })).toBe(0);
    expect(hit({}, { ability: "levitate", types: ["poison"] }, { type: "ground" })).toBe(0);
    expect(hit({}, { ability: "Thick Fat", types: ["normal"] }, { type: "ice", category: "special" })).toBe(19); // base power 40
    expect(hit({}, { ability: "Solid Rock", types: ["normal"] })).toBe(55); // floor(74 · 3/4)
  });

  it("a sandstorm raises a Rock type's Sp. Def by half", () => {
    const base = { attacker: mon(), defender: mon({ types: ["rock"] }), move: move({ type: "dragon", category: "special" }) };
    expect(calcDamageRolls({ ...base, weather: "none" })[15]).toBe(37);
    expect(calcDamageRolls({ ...base, weather: "sand" })[15]).toBe(25); // floor(3520 / 150) + 2
  });

  it("status moves do no damage", () => {
    const rolls = calcDamageRolls({
      attacker: mon(), defender: mon(), move: move({ category: "status", power: 0 }), weather: "none",
    });
    expect(rolls.every((r) => r === 0)).toBe(true);
  });

  it("calcDamage reports percentages and KO chances", () => {
    const result = calcDamage({ attacker: mon(), defender: mon({ types: ["normal"], currentHp: 70 }), move: move(), weather: "none" });
    expect(result.min).toBe(62);
    expect(result.max).toBe(74);
    expect(result.maxPercent).toBeCloseTo((74 / 150) * 100, 5);
    // 70 HP left: only the top rolls (≥ 70) knock out in one hit
    expect(result.koChance).toMatch(/chance to OHKO/);
  });
});

describe("entry hazards and weather", () => {
  it("Stealth Rock scales with the weakness to Rock; Spikes miss airborne Pokémon", () => {
    expect(entryHazardDamage(mon(), { stealthRock: true })).toBe(18);
    expect(entryHazardDamage(mon({ types: ["fire", "flying"] }), { stealthRock: true, spikes: 3 })).toBe(75);
    expect(entryHazardDamage(mon({ types: ["steel"] }), { stealthRock: true })).toBe(9);
    expect([1, 2, 3].map((spikes) => entryHazardDamage(mon(), { spikes }))).toEqual([18, 25, 37]);
    expect(entryHazardDamage(mon({ ability: "Levitate" }), { spikes: 3 })).toBe(0);
    expect(entryHazardDamage(mon({ ability: "Magic Guard" }), { stealthRock: true, spikes: 3 })).toBe(0);
  });

  it("sandstorm and hail take 1/16 a turn from Pokémon that aren't immune", () => {
    expect(weatherDamage(mon(), "sand")).toBe(9);
    expect(weatherDamage(mon({ types: ["ground"] }), "sand")).toBe(0);
    expect(weatherDamage(mon({ types: ["ice"] }), "hail")).toBe(0);
    expect(weatherDamage(mon({ types: ["ice"] }), "sand")).toBe(9);
    expect(weatherDamage(mon(), "rain")).toBe(0);
  });

  it("counts both towards the KO", () => {
    const base = { attacker: mon(), defender: mon({ types: ["normal"] }), move: move() };
    // 62–74 per hit against 150 HP: two hits fall just short (74 + 74 = 148)
    expect(calcDamage({ ...base, weather: "none" }).koChance).toBe("Possible 3HKO");
    // Stealth Rock (18) and three layers of Spikes (37) leave 95 HP
    const hazards = calcDamage({ ...base, weather: "none", stealthRock: true, spikes: 3 });
    expect(hazards.hazardDamage).toBe(55);
    expect(hazards.koChance).toBe("Guaranteed 2HKO (after entry hazards)");
    // Sandstorm takes 9 between the hits, which is enough with two high rolls: 74 + 74 + 9 = 157
    const sand = calcDamage({ ...base, weather: "sand" });
    expect(sand.residual).toBe(9);
    expect(sand.koChance).toMatch(/% chance to 2HKO \(with sandstorm damage\)$/);
  });
});

describe("Battle Tower move names", () => {
  it("every move in the tower sets resolves to a real move", () => {
    const slugify = (name: string) => name.toLowerCase().replace(/[’'.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const known = new Set((saveTables.moves as string[]).filter(Boolean).map(slugify));
    const names = new Set((towerSets as { moves: string[] }[]).flatMap((set) => set.moves));
    const unresolved = [...names].filter((name) => !known.has(moveNameToSlug(name)));
    expect(unresolved).toEqual([]);
  });
});

describe("typeEffectiveness and computeStat", () => {
  it("multiplies across both defending types", () => {
    expect(typeEffectiveness("ice", ["dragon", "flying"])).toBe(4);
    expect(typeEffectiveness("electric", ["water", "ground"])).toBe(0);
    expect(typeEffectiveness("fire", ["water", "rock"])).toBe(0.25);
  });

  it("matches known level-100 stats (Garchomp, 31 IVs)", () => {
    // Base 108 HP, 252 EVs → 420. Base 102 Speed, 252 EVs, Jolly → 333; neutral → 303.
    expect(computeStat("hp", 108, 31, 252, "Jolly", 100)).toBe(420);
    expect(computeStat("spe", 102, 31, 252, "Jolly", 100)).toBe(333);
    expect(computeStat("spe", 102, 31, 252, "Hardy", 100)).toBe(303);
  });
});
