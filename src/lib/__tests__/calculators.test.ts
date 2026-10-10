import { describe, expect, it } from "vitest";
import { calcCatchRate } from "../catch-rate";
import { calcDamage, calcDamageRolls, computeStat, typeEffectiveness } from "../damage-calc";
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
    const surf = move({ type: "water", category: "special" });
    expect(calcDamageRolls({ ...base, defender: mon({ types: ["normal"] }), move: surf, weather: "rain" })[15]).toBe(55);
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
