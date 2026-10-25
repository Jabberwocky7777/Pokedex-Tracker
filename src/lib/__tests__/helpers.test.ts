import { describe, expect, it } from "vitest";
import type { Pokemon } from "../../types";
import { calcAllStats, UNKNOWN_IV } from "../stat-calc";
import { NATURES } from "../iv-calc";
import { designerSlotToCalcPokemon } from "../calc-from-designer";
import { normalizeSlots } from "../../store/useDesignerStore";
import { describeEvolution, isTradeEvolution, uncaughtEvolutions } from "../evolution-status";
import { csvText } from "../backup";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };

const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const mon = (name: string) => allPokemon.find((p) => p.name === name)!;
const all = (n: number) => ({ hp: n, atk: n, def: n, spAtk: n, spDef: n, spe: n });
const nature = (name: string) => NATURES.find((n) => n.name === name)!;

describe("calcAllStats", () => {
  it("gives a level 50 Gengar's stats with the Gen III/IV formula and its nature", () => {
    const gengar = mon("gengar");
    // HP: floor((2·60 + 31)·50/100) + 50 + 10; Sp. Atk: floor((2·130 + 31)/2) + 5, ×1.1 for Modest
    expect(calcAllStats(gengar.baseStats, all(31), all(0), nature("Hardy"), 50)).toEqual({ hp: 135, atk: 85, def: 80, spAtk: 150, spDef: 95, spe: 130 });
    expect(calcAllStats(gengar.baseStats, all(31), all(0), nature("Modest"), 50)).toMatchObject({ atk: 76, spAtk: 165 });
  });

  it("counts an IV nobody has entered as the worst case", () => {
    const gengar = mon("gengar");
    const unknown = calcAllStats(gengar.baseStats, {} as ReturnType<typeof all>, all(0), nature("Hardy"), 50);
    expect(unknown).toEqual(calcAllStats(gengar.baseStats, all(UNKNOWN_IV), all(0), nature("Hardy"), 50));
  });
});

describe("designerSlotToCalcPokemon", () => {
  it("turns a Designer slot into a damage-calc Pokémon with the same stats and move names", () => {
    const [slot] = normalizeSlots([{
      pokemonId: mon("gengar").id, level: 50, natureName: "Timid",
      confirmedIVs: all(31), selectedMoves: ["shadow-ball", "u-turn", null, null],
    }]);
    const calc = designerSlotToCalcPokemon(slot, allPokemon)!;
    expect(calc).toMatchObject({ source: "designer", species: "Gengar", level: 50, nature: "Timid", currentHp: 135 });
    // Timid: +Speed −Attack
    expect(calc.stats).toMatchObject({ hp: 135, spa: 150, spe: 143, atk: 76 });
    // Empty move slots stay, as blank names
    expect(calc.moves.map((m) => m.name)).toEqual(["Shadow Ball", "U-turn", "", ""]);
  });

  it("uses inferred IVs where none are confirmed", () => {
    const [slot] = normalizeSlots([{ pokemonId: mon("gengar").id, level: 50, inferredIVs: { hp: 31 } }]);
    expect(designerSlotToCalcPokemon(slot, allPokemon)!.stats.hp).toBe(135);
  });

  it("is null for an empty slot or an unknown species", () => {
    const [empty, unknown] = normalizeSlots([{}, { pokemonId: 9999 }]);
    expect(designerSlotToCalcPokemon(empty, allPokemon)).toBeNull();
    expect(designerSlotToCalcPokemon(unknown, allPokemon)).toBeNull();
  });
});

describe("evolution status", () => {
  it("lists only uncaught evolutions that exist in the generation", () => {
    const eevee = mon("eevee");
    const caught = new Set([mon("vaporeon").id]);
    const names = uncaughtEvolutions(eevee, caught, 493).map((s) => s.displayName);
    expect(names).not.toContain("Vaporeon");
    expect(names).toContain("Leafeon");
    expect(uncaughtEvolutions(eevee, caught, 386).map((s) => s.displayName)).not.toContain("Leafeon");
  });

  it("describes a trade evolution as needing another player", () => {
    const [step] = mon("haunter").evolvesTo;
    expect(isTradeEvolution(step)).toBe(true);
    expect(describeEvolution("Haunter", step)).toBe("Haunter evolves into Gengar by trade — it needs a trade with another player.");
  });
});

describe("csvText", () => {
  it("quotes a field and doubles its quotes", () => {
    expect(csvText('Mr. "Mime"')).toBe('"Mr. ""Mime"""');
  });

  it("keeps a spreadsheet from running a value as a formula", () => {
    for (const value of ["=1+1", "+SUM(A1)", "-2", "@cmd", "\tx"]) {
      expect(csvText(value)).toBe(`"'${value}"`);
    }
    expect(csvText("Route 1 - grass")).toBe('"Route 1 - grass"');
  });
});
