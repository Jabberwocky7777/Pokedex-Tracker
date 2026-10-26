import { describe, expect, it } from "vitest";
import { AREA_UNLOCKS, METHOD_UNLOCKS } from "../../data/route-unlocks";
import { GAME_PROGRESS } from "../../data/game-progress";
import { areasOf, isReached, reachability, requirementText, requirementsFor } from "../unlocks";
import type { GameProgress } from "../game-progress";
import type { GameVersion, Pokemon } from "../../types";
import allPokemon from "../../../public/data/pokemon.json";

const POKEMON = allPokemon as unknown as Pokemon[];
const progress = (badges: number[], milestones: string[] = []): GameProgress =>
  ({ badges, milestones: Object.fromEntries(milestones.map((m) => [m, { done: true, source: "manual" }])) });

describe("route unlock data", () => {
  it("names only areas that exist in that game's encounter data (no typos)", () => {
    for (const [game, areas] of Object.entries(AREA_UNLOCKS)) {
      const known = areasOf(POKEMON, game);
      const missing = Object.keys(areas!).filter((slug) => !known.has(slug));
      // A few areas are only in one game of a pair; they must exist in the generation at least
      const elsewhere = new Set(Object.keys(AREA_UNLOCKS).flatMap((g) => [...areasOf(POKEMON, g)]));
      expect(missing.filter((slug) => !elsewhere.has(slug)), game).toEqual([]);
    }
  });

  it("only uses milestones the game has", () => {
    for (const table of [AREA_UNLOCKS, METHOD_UNLOCKS]) {
      for (const [game, entries] of Object.entries(table)) {
        const ids = GAME_PROGRESS[game as GameVersion]!.milestones.map((m) => m.id);
        for (const req of Object.values(entries!)) if ("milestone" in req) expect(ids, `${game} ${req.milestone}`).toContain(req.milestone);
      }
    }
  });
});

describe("requirements", () => {
  it("combines the area's and the method's", () => {
    expect(requirementsFor("platinum", "sinnoh-route-229-area", "poke-radar")).toEqual([{ milestone: "national-dex" }, { milestone: "national-dex" }]);
    expect(requirementsFor("platinum", "sinnoh-route-201-area", "walk")).toEqual([]);
    expect(requirementsFor("heartgold", "mt-silver-outside", "walk")).toEqual([{ badges: 16 }]);
    expect(requirementsFor("platinum", "trophy-garden-area", "walk", "trophy-garden")).toEqual([{ milestone: "national-dex" }]);
    expect(requirementsFor("diamond", "great-marsh", "safari", "great-marsh")).toEqual([]);
  });

  it("checks them against progress", () => {
    expect(isReached({ milestone: "national-dex" }, progress([], ["national-dex"]))).toBe(true);
    expect(isReached({ milestone: "national-dex" }, undefined)).toBe(false);
    expect(isReached({ badges: 16 }, progress(Array.from({ length: 16 }, (_, i) => i)))).toBe(true);
    expect(isReached({ badges: 16 }, progress([0, 1, 2]))).toBe(false);
    expect(requirementText({ milestone: "sevii-4-7" }, "firered")).toBe("Sevii Islands 4–7");
    expect(requirementText({ badges: 16 }, "heartgold")).toBe("All 16 badges");
  });

  it("is reachable when any of the games has it open", () => {
    const needs = (game: string) => requirementsFor(game, "kanto-route-1-area", "walk");
    const of = (map: Record<string, GameProgress>) => (g: string) => map[g];
    expect(reachability(["heartgold", "soulsilver"], needs, of({}))).toEqual({ reachable: false, game: "heartgold", missing: [{ milestone: "kanto" }] });
    expect(reachability(["heartgold", "soulsilver"], needs, of({ soulsilver: progress([], ["kanto"]) }))).toEqual({ reachable: true });
  });
});
