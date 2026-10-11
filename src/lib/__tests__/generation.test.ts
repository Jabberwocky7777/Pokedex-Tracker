import { describe, it, expect } from "vitest";
import type { Pokemon } from "../../types";
import { abilitiesInGeneration } from "../generation";
import { abilityForSlot3, abilityName } from "../save/tables";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const byName = (name: string) => allPokemon.find((p) => p.name === name)!;
const names = (name: string, generation: number) =>
  abilitiesInGeneration(byName(name), generation).map((a) => a.displayName);

describe("abilitiesInGeneration", () => {
  it("leaves out abilities a species only gained in Gen IV when Gen III is viewed", () => {
    expect(names("clefable", 4)).toEqual(["Cute Charm", "Magic Guard"]);
    expect(names("clefable", 3)).toEqual(["Cute Charm"]);
    expect(names("machamp", 3)).toEqual(["Guts"]);
    expect(names("eevee", 3)).toEqual(["Run Away"]);
  });

  it("keeps both abilities where the species had two in Gen III", () => {
    expect(names("shiftry", 3)).toEqual(["Chlorophyll", "Early Bird"]);
    expect(names("gengar", 3)).toEqual(["Levitate"]);
  });

  it("gives every Gen I–III species at least one Gen III ability", () => {
    const none = allPokemon.filter((p) => p.id <= 386 && abilitiesInGeneration(p, 3).length === 0);
    expect(none.map((p) => p.name)).toEqual([]);
  });
});

describe("Gen III ability slots for imported saves", () => {
  const slot = (name: string, n: number) => abilityName(abilityForSlot3(byName(name).id, n));

  it("uses the abilities the species had in Gen III, not today's", () => {
    // Shiftry has since lost Early Bird; Pelipper and Torkoal have since gained a second ability
    expect(slot("shiftry", 1)).toBe("Early Bird");
    expect(slot("pelipper", 1)).toBe("Keen Eye");
    expect(slot("torkoal", 1)).toBe("White Smoke");
    expect(slot("feebas", 1)).toBe("Swift Swim");
  });
});
