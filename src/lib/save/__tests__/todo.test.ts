import { describe, expect, it } from "vitest";
import { makePokemon } from "../../../test/fixtures";
import { homeSlot } from "../living-dex";
import { buildTodo, type TodoKind } from "../todo";
import { PARTY_BOX, type ProfileMons, type SaveRole, type SlimMon } from "../types";

// Caterpie → Metapod → Butterfree · Pikachu (Pichu baby) → Raichu · Seel (Diamond only) ·
// Slowpoke (HeartGold only, and Pearl) · Tauros (nowhere) · Onix → Steelix (trade)
export const POKEMON = [
  makePokemon(10, "Caterpie", ["bug"], {
    encounters: { platinum: { "route-204": ["walk"] } },
    evolvesTo: [{ speciesId: 11, displayName: "Metapod", trigger: "level-up", minLevel: 7, details: "Level 7" }],
  }),
  makePokemon(11, "Metapod", ["bug"], {
    evolvesFrom: 10,
    evolvesTo: [{ speciesId: 12, displayName: "Butterfree", trigger: "level-up", minLevel: 10, details: "Level 10" }],
  }),
  makePokemon(12, "Butterfree", ["bug", "flying"], { evolvesFrom: 11 }),
  makePokemon(25, "Pikachu", ["electric"], {
    encounters: { platinum: { "trophy-garden": ["walk"] } },
    evolvesFrom: 172,
    evolvesTo: [{ speciesId: 26, displayName: "Raichu", trigger: "use-item", item: "thunder-stone", details: "Thunder Stone" }],
  }),
  makePokemon(26, "Raichu", ["electric"], { evolvesFrom: 25 }),
  makePokemon(79, "Slowpoke", ["water"], { encounters: { heartgold: { "slowpoke-well": ["walk"] }, pearl: { "route-205": ["walk"] } } }),
  makePokemon(86, "Seel", ["water"], { encounters: { platinum: { "route-204": ["surf"] }, diamond: { "route-226": ["surf"] } } }),
  makePokemon(95, "Onix", ["rock"], {
    encounters: { platinum: { "oreburgh-mine": ["walk"] } },
    evolvesTo: [{ speciesId: 208, displayName: "Steelix", trigger: "trade", details: "Trade holding Metal Coat" }],
  }),
  makePokemon(128, "Tauros", ["normal"]),
  makePokemon(172, "Pichu", ["electric"], {
    isBaby: true,
    evolvesTo: [{ speciesId: 25, displayName: "Pikachu", trigger: "level-up", details: "Level up with high friendship" }],
  }),
  makePokemon(208, "Steelix", ["steel"], { evolvesFrom: 95 }),
];
const GEN_GAMES = ["diamond", "pearl", "platinum", "heartgold", "soulsilver"] as const;

const BOX_NAMES = ["BOX 1", "001-030", "031-060", "061-090", "091-120", "121-150", "151-180", "181-210"];
function mon(species: number, at?: { box: number; slot: number } | "party", extra: Partial<SlimMon> = {}): SlimMon {
  const where = at === "party" ? { box: PARTY_BOX, slot: 0 } : at ?? homeSlot(species, 1)!;
  return { ...where, species, form: 0, shiny: false, level: 5, isEgg: false, ...extra };
}
const at = (species: number) => homeSlot(species, 1)!;
function profile(id: string, role: SaveRole, mons: SlimMon[], family: "platinum" | "hgss" = "platinum"): ProfileMons {
  return {
    profile: { id, label: id, role, startBox: 1, fileName: "", importedAt: 0, saveCount: 1, family, trainer: { name: "T", tid: 1, sid: 2 } },
    boxNames: BOX_NAMES,
    mons,
  };
}
const todo = (profiles: ProfileMons[]) => buildTodo(profiles, { pokemon: POKEMON, genGames: GEN_GAMES, maxSpecies: 493 });
const of = (list: ReturnType<typeof todo>, kind: TodoKind) => list.steps.filter((s) => s.kind === kind);

describe("buildTodo", () => {
  it("needs a living-dex profile", () => {
    expect(todo([profile("ss", "playthrough", [mon(25, "party")])]).living).toBeNull();
  });

  it("moves owned Pokémon into their empty slot, naming both ends", () => {
    const list = todo([profile("pt", "living-dex", [mon(25, { box: 0, slot: 3 })])]);
    expect(of(list, "move")).toMatchObject([
      { species: 25, text: "Move Pikachu: BOX 1 · slot 4 → 001-030 · slot 25", group: "BOX 1" },
    ]);
    // …and the mover is not also listed as a spare
    expect(of(list, "spare")).toEqual([]);
  });

  it("notes when the destination already holds something", () => {
    const list = todo([profile("pt", "living-dex", [mon(25, { box: 0, slot: 3 }), mon(128, at(25))])]);
    expect(of(list, "move").find((s) => s.species === 25)?.detail).toBe("It swaps places with the Tauros there");
  });

  it("emits one swap when two Pokémon are in each other's slots", () => {
    const list = todo([profile("pt", "living-dex", [mon(25, at(26)), mon(26, at(25))])]);
    expect(of(list, "swap")).toHaveLength(1);
    expect(of(list, "swap")[0].text).toBe("Swap Pikachu (001-030 · slot 26) with Raichu (001-030 · slot 25)");
    expect(of(list, "move")).toEqual([]);
  });

  it("lists evolutions with their method, ready ones first", () => {
    const list = todo([profile("pt", "living-dex", [
      mon(10),
      mon(10, at(11), { level: 7 }),  // ready for Metapod
      mon(10, at(12), { level: 3 }),  // on its way to Butterfree, via Metapod
    ])]);
    expect(of(list, "evolve")).toMatchObject([
      { species: 11, ready: true, text: "Evolve Caterpie (001-030 · slot 11) into Metapod", detail: "Level 7 — Ready now — level it once" },
      { species: 12, ready: false, text: "Evolve Caterpie (001-030 · slot 12) into Butterfree (next: Metapod)", detail: "Level 7 — 4 levels to go" },
    ]);
  });

  it("brings species over from a playthrough save, grouped by save", () => {
    const list = todo([
      profile("pt", "living-dex", [mon(10)]),
      profile("SoulSilver", "playthrough", [mon(79, { box: 2, slot: 7 })], "hgss"),
    ]);
    expect(of(list, "bring")).toMatchObject([
      { species: 79, group: "SoulSilver", text: "Bring Slowpoke over from SoulSilver (031-060 · slot 8)" },
    ]);
  });

  it("sends the rest to the best place to catch them, in the user's own games first", () => {
    const list = todo([profile("pt", "living-dex", [])]);
    const texts = Object.fromEntries(of(list, "catch").map((s) => [s.species, s]));
    // Route 204 holds two missing species (Caterpie, Seel), so Seel is sent there rather than to Diamond
    expect(texts[86].text).toBe("Catch Seel in Platinum: route-204, Lv 5–10");
    expect(texts[10].text).toBe("Catch Caterpie in Platinum: route-204, Lv 5–10");
    expect(texts[10].slug).toBe("route-204");
    // Slowpoke isn't in Platinum at all: fall back to another game, and say so
    expect(texts[79].text).toMatch(/^Catch Slowpoke in (Pearl|HeartGold)/);
    expect(texts[79].detail).toContain("not in a game you've imported");
    // Evolution-only and encounter-less species
    expect(texts[12].text).toBe("Get Butterfree by evolving Metapod");
    expect(texts[208]).toMatchObject({ text: "Get Steelix by evolving Onix", detail: "Get Onix first — it evolves by trade" });
    // Games you own come before games you don't
    const groups = [...new Set(of(list, "catch").map((s) => s.group))];
    expect(groups[0]).toBe("Platinum");
    expect(groups.at(-1)).toBe("No wild encounter");
    expect(texts[128].text).toBe("Tauros: no wild encounter in these games");
  });

  it("suggests breeding for missing babies and never asks to catch them", () => {
    const list = todo([profile("pt", "living-dex", [mon(25)])]);
    expect(of(list, "breed")).toMatchObject([{ species: 172, text: "Breed Pikachu to get Pichu" }]);
    expect(of(list, "catch").some((s) => s.species === 172)).toBe(false);
  });

  it("lists leftover copies as spares, but not placeholders or the team's evolvers", () => {
    const spare = mon(128, { box: 0, slot: 0 });
    const list = todo([profile("pt", "living-dex", [mon(128), spare, mon(10), mon(10, at(11))])]);
    expect(of(list, "spare")).toMatchObject([{ species: 128, text: "Spare Tauros: BOX 1 · slot 1" }]);
  });

  it("reports progress and completion", () => {
    const partial = todo([profile("pt", "living-dex", [mon(10), mon(25)])]);
    expect([partial.placed, partial.total, partial.complete]).toEqual([2, 493, false]);

    const everything = Array.from({ length: 493 }, (_, i) => mon(i + 1));
    const full = todo([profile("pt", "living-dex", everything)]);
    expect(full.complete).toBe(true);
    expect(full.steps).toEqual([]);
  });

  it("gives every step a unique id", () => {
    const list = todo([
      profile("pt", "living-dex", [mon(25, { box: 0, slot: 3 }), mon(10), mon(10, at(11)), mon(128, { box: 0, slot: 1 }), mon(128, { box: 0, slot: 2 })]),
      profile("SoulSilver", "playthrough", [mon(79, "party")], "hgss"),
    ]);
    expect(new Set(list.steps.map((s) => s.id)).size).toBe(list.steps.length);
  });
});
