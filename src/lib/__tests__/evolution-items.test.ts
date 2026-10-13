import { describe, expect, it } from "vitest";
import { buildShoppingList, evolutionItem, summarizeShoppingList } from "../evolution-items";
import { EVOLUTION_ITEM_SOURCES, GAME_GROUPS } from "../../data/evolution-items";
import { generationMaxId, generationVersions } from "../generation";
import type { Pokemon } from "../../types";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const id = (name: string) => allPokemon.find((p) => p.name === name)!.id;
const list = (caught: string[], generation = 4) =>
  buildShoppingList(allPokemon.filter((p) => p.id <= generationMaxId(generation)), new Set(caught.map(id)), generationMaxId(generation));

describe("evolution item shopping list", () => {
  it("counts each item across the Pokémon that need it", () => {
    const needs = list(["kirlia", "snorunt", "sneasel", "scyther"]);
    expect(summarizeShoppingList(needs)).toBe("2 Dawn Stones, 1 Metal Coat (trade), 1 Razor Claw");
    const dawn = needs.find((n) => n.item === "Dawn Stone")!;
    expect(dawn.uses.map((u) => `${u.from.displayName}→${u.step.displayName}`)).toEqual(["Kirlia→Gallade", "Snorunt→Froslass"]);
    expect(needs.find((n) => n.item === "Razor Claw")!.uses[0].condition).toBe("night");
  });

  it("leaves out evolutions that are caught already, and Pokémon that aren't caught", () => {
    expect(list(["kirlia", "gallade"])).toEqual([]);
    expect(list([])).toEqual([]);
    // Level-up and plain trade evolutions need no item
    expect(list(["bulbasaur", "kadabra", "eevee"]).map((n) => n.item).sort()).toEqual(["Fire Stone", "Thunder Stone", "Water Stone"]);
  });

  it("only asks for what exists in the generation", () => {
    // Gen III has no Gallade, Froslass, Weavile or Electivire
    expect(list(["kirlia", "snorunt", "sneasel", "electabuzz", "seadra"], 3).map((n) => n.name)).toEqual(["Dragon Scale"]);
  });

  it("names the items properly and marks a mix of trade and non-trade uses", () => {
    const needs = list(["poliwhirl", "slowpoke", "porygon"]);
    expect(summarizeShoppingList(needs)).toBe("2 King's Rocks (trade), 1 Up-Grade (trade), 1 Water Stone");
  });

  it("knows the item of every item evolution in the data, and has a place for it in its generation", () => {
    const items = new Set<string>();
    for (const p of allPokemon) for (const step of p.evolvesTo) { const item = evolutionItem(step); if (item) items.add(item); }
    expect([...items].filter((item) => !EVOLUTION_ITEM_SOURCES[item])).toEqual([]);
    expect(Object.keys(EVOLUTION_ITEM_SOURCES).filter((item) => !items.has(item))).toEqual([]);
    // Every Gen IV game group has somewhere to get each item
    for (const [item, sources] of Object.entries(EVOLUTION_ITEM_SOURCES)) {
      expect(sources.dppt?.length, `${item} in Diamond/Pearl/Platinum`).toBeGreaterThan(0);
      expect(sources.hgss?.length, `${item} in HeartGold/SoulSilver`).toBeGreaterThan(0);
    }
    // The groups cover exactly the supported games
    expect(GAME_GROUPS.flatMap((g) => g.games).sort()).toEqual([...generationVersions(3), ...generationVersions(4)].sort());
  });
});
