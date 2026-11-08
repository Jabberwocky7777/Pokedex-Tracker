import { describe, expect, it } from "vitest";
import { makePokemon } from "../../test/fixtures";
import { extraCopies } from "../evolution-status";

// Houndour → Houndoom (24) · Charmander → Charmeleon (16) → Charizard (36) · Oddish → Gloom → Vileplume / Bellossom
const lvl = (speciesId: number, displayName: string, minLevel: number) => ({
  speciesId,
  displayName,
  trigger: "level-up" as const,
  minLevel,
  details: `Level ${minLevel}`,
});
const DEX = [
  makePokemon(4, "Charmander", ["fire"], { evolvesTo: [lvl(5, "Charmeleon", 16)] }),
  makePokemon(5, "Charmeleon", ["fire"], { evolvesFrom: 4, evolvesTo: [lvl(6, "Charizard", 36)] }),
  makePokemon(6, "Charizard", ["fire"], { evolvesFrom: 5 }),
  makePokemon(43, "Oddish", ["grass"], { evolvesTo: [lvl(44, "Gloom", 21)] }),
  makePokemon(44, "Gloom", ["grass"], {
    evolvesFrom: 43,
    evolvesTo: [
      { speciesId: 45, displayName: "Vileplume", trigger: "use-item" as const, details: "Leaf Stone" },
      { speciesId: 182, displayName: "Bellossom", trigger: "use-item" as const, details: "Sun Stone" },
    ],
  }),
  makePokemon(228, "Houndour", ["dark", "fire"], { evolvesTo: [lvl(229, "Houndoom", 24)] }),
  makePokemon(229, "Houndoom", ["dark", "fire"], { evolvesFrom: 228 }),
  makePokemon(133, "Eevee", ["normal"], {
    evolvesTo: [
      { speciesId: 134, displayName: "Vaporeon", trigger: "use-item" as const, details: "Water Stone" },
      { speciesId: 470, displayName: "Leafeon", trigger: "level-up" as const, details: "Level up at Eterna Forest" },
    ],
  }),
  makePokemon(447, "Riolu", ["fighting"], {
    evolvesTo: [{ speciesId: 448, displayName: "Lucario", trigger: "level-up" as const, details: "Friendship (day)" }],
  }),
];
const ids = (m: Map<number, { speciesId: number }[]>) =>
  Object.fromEntries([...m].map(([k, v]) => [k, v.map((s) => s.speciesId)]));

describe("extraCopies", () => {
  it("asks for another Houndour when Houndoom isn't caught", () => {
    expect(ids(extraCopies(DEX, new Set([228]), new Set(), 493))).toEqual({ 228: [229] });
  });

  it("leaves it out once Houndoom is caught or pending", () => {
    expect(extraCopies(DEX, new Set([228, 229]), new Set(), 493).size).toBe(0);
    expect(extraCopies(DEX, new Set([228]), new Set([229]), 493).size).toBe(0);
  });

  it("only asks the nearest caught stage", () => {
    // Charmeleon is caught too: Charizard is Charmeleon's to give, not Charmander's
    expect(ids(extraCopies(DEX, new Set([4, 5]), new Set(), 493))).toEqual({ 5: [6] });
    // Only Charmander: it is needed for Charmeleon (Charizard comes from Charmeleon later)
    expect(ids(extraCopies(DEX, new Set([4]), new Set(), 493))).toEqual({ 4: [5] });
  });

  it("lists every branch still missing", () => {
    expect(ids(extraCopies(DEX, new Set([43, 44, 45]), new Set(), 493))).toEqual({ 44: [182] });
    expect(ids(extraCopies(DEX, new Set([44]), new Set(), 493))).toEqual({ 44: [45, 182] });
  });

  it("ignores evolutions the generation doesn't have", () => {
    // Gen III: no Lucario
    expect(extraCopies(DEX, new Set([447]), new Set(), 386).size).toBe(0);
  });

  it("leaves out evolving at a Sinnoh place when no Sinnoh game is selected", () => {
    const caught = new Set([133]);
    expect(ids(extraCopies(DEX, caught, new Set(), 493, ["heartgold", "soulsilver"]))).toEqual({ 133: [134] });
    expect(ids(extraCopies(DEX, caught, new Set(), 493, ["soulsilver", "platinum"]))).toEqual({ 133: [134, 470] });
    // Without games, nothing is left out
    expect(ids(extraCopies(DEX, caught, new Set(), 493))).toEqual({ 133: [134, 470] });
  });
});
