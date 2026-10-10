import { describe, expect, it } from "vitest";
import { computeAvailability, filterPokemon, type FilterOptions } from "../usePokemonFilter";
import { parseSearch } from "../../lib/pokemon-search";
import { buildNextLocations } from "../../lib/what-next";
import { META, POKEDEX, makePokemon } from "../../test/fixtures";

const run = (over: Partial<FilterOptions> = {}) =>
  filterPokemon({
    allPokemon: POKEDEX,
    meta: META,
    activeGeneration: 4,
    dexMode: "national",
    activeGames: [],
    availabilityMode: "all",
    searchQuery: "",
    ...over,
  });

const names = (list: { displayName: string }[]) => list.map((p) => p.displayName);
const bright = (list: { displayName: string; isHighlighted: boolean }[]) =>
  list.filter((p) => p.isHighlighted).map((p) => p.displayName);

describe("needs-attention: pending and living-dex placement", () => {
  const attention = (over: Partial<FilterOptions>) => names(run({ availabilityMode: "needs-attention", ...over }));

  it("includes Pokémon marked pending that aren't caught yet", () => {
    // Slowpoke has nothing else going for it: no evolutions, not a baby, no games selected
    expect(attention({})).toEqual(["Pichu"]);
    expect(attention({ pendingIds: [79] })).toEqual(["Slowpoke", "Pichu"]);
    // Once it is caught the pending mark no longer matters
    expect(attention({ pendingIds: [79], caughtIds: [79] })).toEqual(["Pichu"]);
  });

  it("includes caught-but-unplaced Pokémon only once placed marks exist", () => {
    // No placed marks: the user isn't keeping a living dex, so caught is enough
    expect(attention({ caughtIds: [1, 79] })).toEqual(["Pichu"]);
    // One placed mark turns the check on for everything else that is caught
    expect(attention({ caughtIds: [1, 79], placedIds: [1] })).toEqual(["Slowpoke", "Pichu"]);
    expect(attention({ caughtIds: [1, 79], placedIds: [1, 79] })).toEqual(["Pichu"]);
  });
});

describe("availability modes", () => {
  it("all: everything is bright, whatever games are selected", () => {
    const result = run({ availabilityMode: "all", activeGames: ["diamond"] });
    expect(result).toHaveLength(POKEDEX.length);
    expect(result.every((p) => p.isHighlighted)).toBe(true);
  });

  it("catchable: only Pokémon with a direct, non-trade encounter in the selected games", () => {
    expect(bright(run({ availabilityMode: "catchable", activeGames: ["diamond"] })))
      .toEqual(["Pikachu", "Seel", "Gastly", "Haunter"]);
    // In Pearl, Haunter is only an NPC trade and Seel is absent; Slowpoke appears
    expect(bright(run({ availabilityMode: "catchable", activeGames: ["pearl"] })))
      .toEqual(["Pikachu", "Slowpoke", "Gastly"]);
  });

  it("obtainable: adds NPC trades, evolutions (trade evolutions too) and breedable babies", () => {
    expect(bright(run({ availabilityMode: "obtainable", activeGames: ["pearl"] })))
      .toEqual(["Pikachu", "Abra", "Slowpoke", "Gastly", "Haunter", "Gengar", "Pichu"]);
    // Bulbasaur has no encounter anywhere and nothing evolves into it
    expect(bright(run({ availabilityMode: "obtainable" }))).not.toContain("Bulbasaur");
  });

  it("a baby with an encounter in some other game is still breedable in the selected ones", () => {
    // Pichu is wild in Platinum's Trophy Garden; that says nothing about Diamond or Pearl
    const dex = POKEDEX.map((p) =>
      p.id === 172 ? makePokemon(172, "Pichu", ["electric"], {
        isBaby: true,
        encounters: { platinum: { "trophy-garden": ["walk"] } },
        evolvesTo: [{ speciesId: 25, displayName: "Pikachu", trigger: "level-up", details: "Level up with high friendship" }],
      }) : p);
    const { catchable, obtainable } = computeAvailability(dex, ["pearl"]);
    expect(obtainable.has(172)).toBe(true);
    expect(catchable.has(172)).toBe(false);
  });

  it("with no games selected, checks every game of the generation", () => {
    expect(bright(run({ availabilityMode: "catchable" })))
      .toEqual(["Pikachu", "Slowpoke", "Seel", "Gastly", "Haunter"]);
  });

  it("needs-attention: caught-but-unevolved, trade evolutions, babies, version exclusives", () => {
    // Gastly caught → Gastly needs evolving. Haunter not caught, and Gastly→Haunter is not a trade.
    expect(names(run({ availabilityMode: "needs-attention", caughtIds: [92] }))).toEqual(["Gastly", "Pichu"]);
    // Haunter caught → Haunter still has Gengar to go, and Gengar is a trade evolution of a caught Pokémon
    expect(names(run({ availabilityMode: "needs-attention", caughtIds: [92, 93] }))).toEqual(["Haunter", "Gengar", "Pichu"]);
    // Pichu caught but Pikachu not → Pichu is "caught but unevolved"
    expect(names(run({ availabilityMode: "needs-attention", caughtIds: [92, 93, 94, 172] }))).toEqual(["Pichu"]);
    // Both lines fully caught → nothing left to do
    expect(names(run({ availabilityMode: "needs-attention", caughtIds: [92, 93, 94, 172, 25] }))).toEqual([]);
    // Two games selected → uncaught exclusives show up (NPC-trade-only Haunter doesn't make Pearl count)
    expect(names(run({ availabilityMode: "needs-attention", activeGames: ["diamond", "pearl"] })))
      .toEqual(["Slowpoke", "Seel", "Haunter", "Pichu"]);
  });

  it("flags version exclusives only when two or more games are selected", () => {
    const both = run({ activeGames: ["diamond", "pearl"] });
    expect(both.filter((p) => p.isVersionExclusive).map((p) => [p.displayName, p.exclusiveGames]))
      .toEqual([["Slowpoke", ["pearl"]], ["Seel", ["diamond"]], ["Haunter", ["diamond"]]]);
    expect(run({ activeGames: ["diamond"] }).some((p) => p.isVersionExclusive)).toBe(false);
  });

  it("computeAvailability agrees with the filter", () => {
    const { catchable, obtainable } = computeAvailability(POKEDEX, ["diamond"]);
    expect([...catchable].sort((a, b) => a - b)).toEqual([25, 86, 92, 93]);
    expect([...obtainable].sort((a, b) => a - b)).toEqual([25, 63, 86, 92, 93, 94, 172]);
  });
});

describe("regional dex mode", () => {
  it("filters to the dex and orders by regional number", () => {
    const result = run({ dexMode: "sinnoh-dp" });
    expect(result.map((p) => [p.displayName, p.displayNumber])).toEqual([
      ["Abra", 20], ["Gastly", 69], ["Haunter", 70], ["Gengar", 71], ["Pichu", 103], ["Pikachu", 104],
    ]);
  });
});

describe("search", () => {
  it("matches names, as before", () => {
    expect(names(run({ searchQuery: "gas" }))).toEqual(["Gastly"]);
    expect(names(run({ searchQuery: "  PIK " }))).toEqual(["Pikachu"]);
  });

  it("matches dex numbers with or without # and leading zeros", () => {
    for (const q of ["94", "#94", "094", "#094"]) {
      expect(names(run({ searchQuery: q })), q).toEqual(["Gengar"]);
    }
    expect(names(run({ searchQuery: "#001" }))).toEqual(["Bulbasaur"]);
  });

  it("uses regional numbers in a regional dex mode", () => {
    expect(names(run({ dexMode: "sinnoh-dp", searchQuery: "#070" }))).toEqual(["Haunter"]);
    // National #94 is Gengar, but in the DP dex Gengar is #71 and nothing is #94
    expect(names(run({ dexMode: "sinnoh-dp", searchQuery: "94" }))).toEqual([]);
  });

  it("matches type names", () => {
    expect(names(run({ searchQuery: "ghost" }))).toEqual(["Gastly", "Haunter", "Gengar"]);
    expect(names(run({ searchQuery: "Electric" }))).toEqual(["Pikachu", "Pichu"]);
  });

  it("supports caught:, shiny: and pending: filters", () => {
    const marks = { caughtIds: [92, 93], shinyIds: [93], pendingIds: [94] };
    expect(names(run({ ...marks, searchQuery: "caught:yes" }))).toEqual(["Gastly", "Haunter"]);
    expect(names(run({ ...marks, searchQuery: "caught:no" }))).toHaveLength(POKEDEX.length - 2);
    expect(names(run({ ...marks, searchQuery: "shiny:yes" }))).toEqual(["Haunter"]);
    expect(names(run({ ...marks, searchQuery: "pending:yes" }))).toEqual(["Gengar"]);
  });

  it("combines terms with AND", () => {
    const marks = { caughtIds: [92, 93] };
    expect(names(run({ ...marks, searchQuery: "ghost caught:no" }))).toEqual(["Gengar"]);
    expect(names(run({ ...marks, searchQuery: "poison caught:yes haunt" }))).toEqual(["Haunter"]);
  });

  it("treats an unfinished filter as a name search rather than failing", () => {
    expect(parseSearch("caught:")).toEqual([{ kind: "name", value: "caught:" }]);
    expect(names(run({ searchQuery: "caught:" }))).toEqual([]);
  });
});

describe("what can I get next", () => {
  it("ranks locations by uncaught species and skips NPC trades", () => {
    const locations = buildNextLocations(POKEDEX, ["diamond", "pearl"], new Set([92]), true);
    // Gastly is caught, so Old Chateau drops out; trade-only houses never appear
    expect(locations.map((l) => l.slug).sort()).toEqual(["route-205", "route-226", "trophy-garden", "turnback-cave"]);
    const garden = locations.find((l) => l.slug === "trophy-garden")!;
    expect(garden.count).toBe(1);
    expect(garden.byMethod[0].targets[0].games).toEqual(["diamond", "pearl"]);
  });
});
