import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { moveValuesIn, type MoveValues, type PastMoveValues } from "../move-values";
import { fetchLearners, fetchLearnset, fetchMoveDetail, moveForVersionGroup } from "../move-fetch";
import { fetchAttackdexDetail } from "../attackdex-fetch";
import { fetchMoveList } from "../move-list-fetch";
import { enrichCalcMoves, moveNameToSlug } from "../move-lookup";
import towerSets from "../../data/battle-tower-sets.json";
import type { CalcMove } from "../../types/battleTower";

// ── From PokéAPI's change records to one game's values (the data pipeline) ───

// The current games' values, and what each change record says the move was before that version group.
const move = (over: Partial<MoveValues>): MoveValues => ({ type: "normal", power: 40, accuracy: 100, pp: 35, ...over });
const before = (versionGroup: string, values: Partial<Omit<PastMoveValues, "versionGroup">>): PastMoveValues => ({
  versionGroup, power: null, accuracy: null, pp: null, type: null, ...values,
});

describe("moveValuesIn", () => {
  it("gives Gen IV values, not the latest games' ones", () => {
    const thunderbolt = move({ type: "electric", power: 90, pp: 15 });
    expect(moveValuesIn(thunderbolt, [before("x-y", { power: 95 })], "heartgold-soulsilver").power).toBe(95);
  });

  it("takes the nearest later change for each field separately", () => {
    // Tackle: 35 power / 95% until Black/White, 50 power until Sun/Moon, 40 power today
    const past = [before("black-white", { power: 35, accuracy: 95 }), before("sun-moon", { power: 50 })];
    expect(moveValuesIn(move({}), past, "platinum")).toEqual({ type: "normal", power: 35, accuracy: 95, pp: 35 });
  });

  it("undoes the Fairy type", () => {
    const charm = move({ type: "fairy", power: null, pp: 20 });
    expect(moveValuesIn(charm, [before("x-y", { type: "normal" })], "emerald").type).toBe("normal");
  });

  it("follows changes made between the supported games", () => {
    // Hypnosis: 60% in Gen III, 70% in Diamond/Pearl, back to 60% from Platinum
    const hypnosis = move({ type: "psychic", power: null, accuracy: 60, pp: 20 });
    const past = [before("diamond-pearl", { accuracy: 60 }), before("platinum", { accuracy: 70 })];
    expect(moveValuesIn(hypnosis, past, "emerald").accuracy).toBe(60);
    expect(moveValuesIn(hypnosis, past, "diamond-pearl").accuracy).toBe(70);
    expect(moveValuesIn(hypnosis, past, "platinum").accuracy).toBe(60);
  });
});

// ── The generated files, as the app reads them ───────────────────────────────

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };

beforeAll(() => {
  // The app fetches /data/moves.json and /data/learnsets.json; serve them from public/
  vi.stubGlobal("fetch", async (url: string) =>
    new Response(new TextDecoder().decode(fs.readFileSync(`public${url}`)), { status: 200 }));
});
afterAll(() => vi.unstubAllGlobals());

describe("move data", () => {
  it("has the Gen IV values up front", async () => {
    expect((await fetchMoveDetail("thunderbolt")).power).toBe(95);
    expect((await fetchMoveDetail("hydro-pump")).power).toBe(120);
    expect((await fetchMoveDetail("knock-off")).power).toBe(20);
    expect((await fetchMoveDetail("charm")).type).toBe("normal");
  });

  it("gives each game's own values", async () => {
    const hypnosis = await fetchMoveDetail("hypnosis");
    expect(moveForVersionGroup(hypnosis, "emerald").accuracy).toBe(60);
    expect(moveForVersionGroup(hypnosis, "diamond-pearl").accuracy).toBe(70);
    expect(moveForVersionGroup(hypnosis, "platinum").accuracy).toBe(60);
    // Asking for a second game starts again from the stored values, not from the first answer
    expect(moveForVersionGroup(moveForVersionGroup(hypnosis, "diamond-pearl"), "platinum").accuracy).toBe(60);
  });

  it("recomputes the Gen III physical/special split from the type", async () => {
    // Outrage: 90 power in Gen III, 120 from Diamond/Pearl; Dragon was a special type
    const outrage = await fetchMoveDetail("outrage");
    const gen3 = moveForVersionGroup(outrage, "ruby-sapphire");
    expect([gen3.power, gen3.gen3Category, outrage.category]).toEqual([90, "special", "physical"]);
    expect(outrage.power).toBe(120);
  });

  it("names the hyphenated moves properly", async () => {
    const names = await Promise.all(
      ["u-turn", "will-o-wisp", "double-edge", "x-scissor", "mud-slap", "soft-boiled", "self-destruct", "lock-on", "wake-up-slap"]
        .map(async (slug) => (await fetchMoveDetail(slug)).displayName));
    expect(names).toEqual(["U-turn", "Will-O-Wisp", "Double-Edge", "X-Scissor", "Mud-Slap", "Soft-Boiled", "Self-Destruct", "Lock-On", "Wake-Up Slap"]);
  });

  it("lists all 467 moves for the search box, with no name left as a bare slug", async () => {
    const list = await fetchMoveList();
    expect(list).toHaveLength(467);
    expect(list[0]).toEqual({ slug: "pound", displayName: "Pound" });
    expect(list.filter((m) => /^[a-z]/.test(m.displayName))).toEqual([]);
  });

  it("rejects a move that isn't in Gen I–IV", async () => {
    await expect(fetchMoveDetail("scald")).rejects.toThrow("Unknown move");
  });

  it("resolves every Battle Tower move, including the Gen IV spellings", async () => {
    const names = [...new Set((towerSets as { moves: string[] }[]).flatMap((set) => set.moves))];
    const blank: Omit<CalcMove, "name"> = { type: "normal", power: 0, category: "physical" };
    const enriched = await enrichCalcMoves(names.map((name) => ({ ...blank, name })));
    expect(enriched.filter((m) => m.notFound).map((m) => m.name)).toEqual([]);

    expect((await fetchMoveDetail(moveNameToSlug("ViceGrip"))).name).toBe("vice-grip");
    expect((await fetchMoveDetail(moveNameToSlug("Hi Jump Kick"))).power).toBe(100);
    expect((await fetchMoveDetail(moveNameToSlug("Faint Attack"))).type).toBe("dark");
  });
});

describe("learnsets", () => {
  it("gives a Pokémon's moves per game, with method and level", async () => {
    const bulbasaur = await fetchLearnset(1);
    expect(bulbasaur["heartgold-soulsilver"]).toContainEqual({ move: "vine-whip", method: "level-up", level: 9 });
    expect(bulbasaur["firered-leafgreen"]).toContainEqual({ move: "vine-whip", method: "level-up", level: 10 });
    expect(bulbasaur["platinum"]).toContainEqual({ move: "energy-ball", method: "machine", level: 0 });
    expect(bulbasaur["emerald"].some((m) => m.method === "egg")).toBe(true);
    expect(bulbasaur["emerald"].some((m) => m.method === "tutor")).toBe(true);
  });

  it("has nothing for a Gen IV Pokémon in the Gen III games", async () => {
    const lucario = await fetchLearnset(448);
    expect(lucario["emerald"]).toEqual([]);
    expect(lucario["platinum"].length).toBeGreaterThan(40);
  });

  it("never lists a move in a game older than the move", async () => {
    const gengar = await fetchLearnset(94);
    const moves = new Set(gengar["ruby-sapphire"].map((m) => m.move));
    expect(moves.has("shadow-ball")).toBe(true);
    expect(moves.has("focus-blast")).toBe(false);
  });

  it("finds a move's learners without any request per Pokémon", async () => {
    // Spore: Paras, Parasect and Shroomish (Breloom has to learn it before evolving)
    expect(await fetchLearners("spore")).toEqual([46, 47, 285]);
    const surf = await fetchAttackdexDetail("surf");
    expect(surf.learnedBy.length).toBeGreaterThan(100);
    expect(surf.learnedBy).toContain(130);
    expect(surf.learnedBy).not.toContain(129);
    expect(surf.flavorTextEntries.map((e) => e.versionGroup)).toContain("platinum");
    expect(surf.shortEffect).not.toBe("");
  });
});
