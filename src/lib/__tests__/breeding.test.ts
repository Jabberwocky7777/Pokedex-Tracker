import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { baseStage, breedingAdvice, canBreed, family, findEggMoveChains } from "../breeding";
import { fetchLearnset, type PokemonLearnset, type VersionGroup } from "../move-fetch";
import type { Pokemon } from "../../types";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const mon = (name: string) => allPokemon.find((p) => p.name === name)!;
const ids = (...names: string[]) => new Set(names.map((n) => mon(n).id));
const names = (list: Pokemon[]) => list.map((p) => p.name);
const gen = (generation: number) => allPokemon.filter((p) => p.id <= (generation === 3 ? 386 : 493));
const advice = (target: string, caught: string[], generation = 4) => breedingAdvice(mon(target), gen(generation), ids(...caught), generation);

describe("lines and who can breed", () => {
  const byId = new Map(allPokemon.map((p) => [p.id, p]));
  it("finds the lowest stage and the whole line", () => {
    expect(baseStage(mon("gallade"), byId).name).toBe("ralts");
    expect(names(family(mon("kirlia"), byId, 493))).toEqual(["ralts", "kirlia", "gardevoir", "gallade"]);
    // Gallade doesn't exist in Generation III
    expect(names(family(mon("kirlia"), byId, 386))).toEqual(["ralts", "kirlia", "gardevoir"]);
  });
  it("knows babies and legendaries can't", () => {
    expect([canBreed(mon("pichu")), canBreed(mon("pikachu")), canBreed(mon("mewtwo")), canBreed(mon("nidoqueen")), canBreed(mon("ditto"))])
      .toEqual([false, true, false, false, true]);
  });
});

describe("breedingAdvice", () => {
  it("a baby hatches from its evolved forms", () => {
    const pichu = advice("pichu", ["pikachu"]);
    expect([pichu.possible, pichu.hatches.name, pichu.incense, pichu.needsEvolving]).toEqual([true, "pichu", null, false]);
    expect(names(pichu.parents)).toEqual(["pikachu", "raichu"]);
    // One caught species with both genders is enough
    expect(pichu.ready).toBe(true);
  });

  it("incense babies need the incense, and hatch as the next stage without it", () => {
    const wynaut = advice("wynaut", ["wobbuffet"]);
    expect([wynaut.hatches.name, wynaut.incense, wynaut.withoutIncense?.name, wynaut.ready]).toEqual(["wynaut", "Lax Incense", "wobbuffet", true]);
    expect(advice("munchlax", []).incense).toBe("Full Incense");
    // Wynaut's incense exists in Generation III, too
    expect(advice("wynaut", [], 3).incense).toBe("Lax Incense");
  });

  it("a later stage means hatching the base and evolving it", () => {
    const gallade = advice("gallade", ["kirlia", "gastly"]);
    expect([gallade.hatches.name, gallade.needsEvolving]).toEqual(["ralts", true]);
    expect(names(gallade.caughtParents)).toEqual(["kirlia"]);
    // Gastly is Amorphous, like the Ralts line in Generation IV
    expect(names(gallade.caughtPartners)).toEqual(["gastly"]);
    expect(gallade.ready).toBe(true);
  });

  it("genderless and male-only lines breed only with Ditto", () => {
    const magnemite = advice("magnemite", ["magneton", "voltorb"]);
    expect([magnemite.dittoOnly, magnemite.ready, names(magnemite.caughtPartners)]).toEqual([true, false, []]);
    expect(advice("magnemite", ["magneton", "ditto"]).ready).toBe(true);
    expect(advice("tauros", ["tauros"]).dittoOnly).toBe(true);
    expect(advice("tauros", ["tauros"]).ready).toBe(false);
    // A female-only line can pair with a caught male of its egg group
    const chansey = advice("chansey", ["chansey", "clefairy"]);
    expect([chansey.dittoOnly, chansey.ready, names(chansey.caughtPartners)]).toEqual([false, true, ["clefairy"]]);
  });

  it("says no for what can't be bred, and not-yet when nothing is caught", () => {
    expect(advice("mewtwo", ["ditto"]).possible).toBe(false);
    expect(advice("ditto", ["ditto"]).possible).toBe(false);
    const eevee = advice("eevee", []);
    expect([eevee.possible, eevee.ready, eevee.caughtParents.length]).toEqual([true, false, 0]);
    // A partner alone is not enough: something of the line has to be caught
    expect(advice("eevee", ["ditto", "pikachu"]).ready).toBe(false);
  });

  it("a partner has to be able to be male and share an egg group", () => {
    // Chansey is always female, so it can't father an Eevee's... Togepi's line egg
    expect(names(advice("togepi", ["togetic", "chansey"]).caughtPartners)).toEqual([]);
    expect(names(advice("togepi", ["togetic", "pikachu"]).caughtPartners)).toEqual(["pikachu"]);
  });
});

describe("findEggMoveChains", () => {
  const learnsets = new Map<number, PokemonLearnset>();
  beforeAll(async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(new TextDecoder().decode(fs.readFileSync(`public${url}`)), { status: 200 }));
    for (const p of allPokemon) learnsets.set(p.id, await fetchLearnset(p.id));
  });
  afterAll(() => vi.unstubAllGlobals());

  const chains = (target: string, move: string, versionGroup: VersionGroup, caught: string[] = []) => {
    const generation = ["ruby-sapphire", "emerald", "firered-leafgreen"].includes(versionGroup) ? 3 : 4;
    return findEggMoveChains(mon(target), move, gen(generation), ids(...caught), (id) => learnsets.get(id)![versionGroup])
      .map((c) => ({ path: c.links.map((l) => `${l.pokemon.name}:${l.how}`).join(" > "), startsCaught: c.startsCaught }));
  };

  it("finds a direct father that learns the move by level-up", () => {
    const found = chains("charmander", "dragon-dance", "platinum");
    expect(found.map((c) => c.path)).toContain("dratini:level-up");
    expect(found.every((c) => !c.path.includes(">"))).toBe(true);
  });

  it("finds a chain through an intermediate father (Wish onto Eevee in Emerald)", () => {
    // Nothing in Eevee's egg group learns Wish by itself: Togetic teaches a Pikachu, which fathers the Eevee
    const found = chains("eevee", "wish", "emerald");
    expect(found.map((c) => c.path)).toContain("togetic:level-up > pikachu:egg");
    expect(found.some((c) => !c.path.includes(">"))).toBe(false);
  });

  it("puts chains that start with a caught Pokémon first", () => {
    const found = chains("charmander", "dragon-dance", "platinum", ["gyarados"]);
    expect(found[0]).toEqual({ path: "gyarados:level-up", startsCaught: true });
    expect(found.filter((c) => c.startsCaught)).toHaveLength(1);
  });

  it("finds nothing for a genderless target, or a move nothing can pass", () => {
    expect(chains("magnemite", "thunderbolt", "platinum")).toEqual([]);
    expect(chains("eevee", "roar-of-time", "platinum")).toEqual([]);
  });

  it("never uses Ditto, a female-only species or the target's own line as a father", () => {
    const fathers = chains("eevee", "wish", "emerald").flatMap((c) => c.path.split(" > ").map((s) => s.split(":")[0]));
    for (const name of ["ditto", "chansey", "eevee", "vaporeon", "togepi"]) expect(fathers).not.toContain(name);
  });
});
