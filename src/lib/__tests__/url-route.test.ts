import { beforeEach, describe, expect, it } from "vitest";
import { applyRoute, hashOf, parseHash, routeOf } from "../url-route";
import { openMove, openMyGames, openPlan, openPokedex, openRoute } from "../navigate";
import { useSettingsStore } from "../../store/useSettingsStore";

const settings = () => useSettingsStore.getState();
const current = () => hashOf(routeOf(settings()));

beforeEach(() => {
  useSettingsStore.setState({
    activeTab: "tracker",
    selectedPokemonId: null,
    activePokedexId: null,
    activeRoute: null,
    routeSearch: null,
    activeAttackdexSlug: null,
    lastAttackdexSlug: null,
    lastAttackdexMode: "single",
    pokedexSection: "pokemon",
  });
});

describe("parseHash", () => {
  it("reads a tab and its item", () => {
    expect(parseHash("#/pokedex/94")).toEqual({ tab: "pokedex", section: "pokemon", item: "94" });
    expect(parseHash("#/pokedex/moves/u-turn")).toEqual({ tab: "pokedex", section: "moves", item: "u-turn" });
    expect(parseHash("#/pokedex/hm")).toEqual({ tab: "pokedex", section: "hm", item: null });
    expect(parseHash("#/routes/eterna-forest-area")).toEqual({ tab: "routes", item: "eterna-forest-area" });
    expect(parseHash("#/catch-calc")).toEqual({ tab: "catch-calc", item: null });
  });

  it("ignores unknown tabs, items on tabs without them, and a Pokédex item that isn't a number", () => {
    expect(parseHash("")).toBeNull();
    expect(parseHash("#/nowhere")).toBeNull();
    expect(parseHash("#/settings/x")).toEqual({ tab: "settings", item: null });
    expect(parseHash("#/pokedex/gengar")).toEqual({ tab: "pokedex", section: "pokemon", item: null });
    expect(parseHash("#/pokedex/combo/surf")).toEqual({ tab: "pokedex", section: "combo", item: null });
    expect(parseHash("#/plan/shopping")).toEqual({ tab: "plan", item: null });
  });

  it("round-trips through hashOf", () => {
    for (const hash of [
      "#/tracker",
      "#/pokedex/448",
      "#/pokedex/moves/will-o-wisp",
      "#/pokedex/moves",
      "#/pokedex/combo",
      "#/pokedex",
      "#/routes/route-201-area",
      "#/plan/journal",
      "#/plan/where",
      "#/games/saves",
      "#/games/progress",
    ]) {
      expect(hashOf(parseHash(hash)!)).toBe(hash);
    }
  });
});

describe("the address for the open tab", () => {
  it("follows the cross-tab links", () => {
    openPokedex(94);
    expect(current()).toBe("#/pokedex/94");
    openMove("surf");
    expect(current()).toBe("#/pokedex/moves/surf");
    openPokedex(25);
    expect(current()).toBe("#/pokedex/25");
    openRoute("eterna-forest-area");
    expect(current()).toBe("#/routes/eterna-forest-area");
  });

  it("names no move in the combo search or the HM planner", () => {
    useSettingsStore.setState({ activeTab: "pokedex", pokedexSection: "combo", lastAttackdexSlug: "surf" });
    expect(current()).toBe("#/pokedex/combo");
  });
});

describe("applyRoute", () => {
  it("opens the tab and its item", () => {
    applyRoute({ tab: "pokedex", item: "25" });
    expect(settings().activeTab).toBe("pokedex");
    expect(settings().activePokedexId).toBe(25);
    applyRoute({ tab: "routes", item: "route-201-area" });
    expect(settings().activeRoute).toBe("route-201-area");
    applyRoute({ tab: "pokedex", section: "moves", item: "surf" });
    expect(settings().activeAttackdexSlug).toBe("surf");
    expect(settings().pokedexSection).toBe("moves");
  });

  it("clears the open move for a Moves address without one", () => {
    useSettingsStore.setState({ lastAttackdexSlug: "surf" });
    applyRoute({ tab: "pokedex", section: "moves", item: null });
    expect(settings().activeAttackdexSlug).toBe("");
    expect(current()).toBe("#/pokedex/moves");
  });

  it("closes the tracker's detail panel when it leaves the tracker", () => {
    useSettingsStore.setState({ selectedPokemonId: 94 });
    applyRoute({ tab: "settings", item: null });
    expect(settings().selectedPokemonId).toBeNull();
  });
});

describe("the Attackdex, now the Pokédex's move sections", () => {
  it("opens old addresses in the Moves section", () => {
    expect(parseHash("#/attackdex/u-turn")).toEqual({ tab: "pokedex", section: "moves", item: "u-turn" });
    expect(parseHash("#/attackdex")).toEqual({ tab: "pokedex", section: "moves", item: null });
  });

  it("moves a persisted Attackdex tab to the matching section", () => {
    const merge = useSettingsStore.persist.getOptions().merge!;
    const base = useSettingsStore.getState();
    const single = merge({ activeTab: "attackdex", lastAttackdexMode: "single" }, base);
    expect([single.activeTab, single.pokedexSection]).toEqual(["pokedex", "moves"]);
    const hm = merge({ activeTab: "attackdex", lastAttackdexMode: "hm-planner" }, base);
    expect([hm.activeTab, hm.pokedexSection]).toEqual(["pokedex", "hm"]);
    const unknown = merge({ pokedexSection: "attacks" }, base);
    expect(unknown.pokedexSection).toBe("pokemon");
  });
});

describe("My games", () => {
  it("has a section in the address and opens on it", () => {
    expect(parseHash("#/games/boxes")).toEqual({ tab: "games", item: null });
    applyRoute({ tab: "games", item: "saves" });
    expect(settings().activeTab).toBe("games");
    expect(settings().gamesSection).toBe("saves");
    openMyGames("progress");
    expect(current()).toBe("#/games/progress");
  });

  it("moves an old persisted Saves / Game progress / Shiny hunts view to its new place", () => {
    const merge = useSettingsStore.persist.getOptions().merge!;
    const base = useSettingsStore.getState();
    const saves = merge({ activeTab: "tracker", viewMode: "saves" }, base);
    expect([saves.activeTab, saves.gamesSection, saves.viewMode]).toEqual(["games", "saves", "box"]);
    const hunts = merge({ activeTab: "tracker", viewMode: "hunts" }, base);
    expect([hunts.activeTab, hunts.planSection, hunts.viewMode]).toEqual(["plan", "hunts", "box"]);
    const elsewhere = merge({ activeTab: "pokedex", viewMode: "games" }, base);
    expect([elsewhere.activeTab, elsewhere.gamesSection]).toEqual(["pokedex", "progress"]);
  });
});

describe("Plan, which took in the Notes tab and the tracker's tool views", () => {
  it("opens old Notes addresses in Plan", () => {
    expect(parseHash("#/notes/journal")).toEqual({ tab: "plan", item: "journal" });
    expect(parseHash("#/notes")).toEqual({ tab: "plan", item: "working" });
    openPlan("level");
    expect(current()).toBe("#/plan/level");
  });

  it("moves a persisted Notes tab, What's next, Daily or Items view to its Plan section", () => {
    const merge = useSettingsStore.persist.getOptions().merge!;
    const base = useSettingsStore.getState();
    const notes = merge({ activeTab: "notes", notesSection: "journal" }, base);
    expect([notes.activeTab, notes.planSection]).toEqual(["plan", "journal"]);
    const next = merge({ activeTab: "tracker", viewMode: "next" }, base);
    expect([next.activeTab, next.planSection, next.viewMode]).toEqual(["plan", "where", "box"]);
    const level = merge({ activeTab: "tracker", viewMode: "next", nextPanel: "level" }, base);
    expect(level.planSection).toBe("level");
    const daily = merge({ activeTab: "tracker", viewMode: "daily" }, base);
    expect([daily.activeTab, daily.planSection]).toEqual(["plan", "today"]);
    // Somewhere else, the tab stays; the section is still where Plan will open
    const items = merge({ activeTab: "routes", viewMode: "items" }, base);
    expect([items.activeTab, items.planSection, items.viewMode]).toEqual(["routes", "items", "box"]);
    const kept = merge({ activeTab: "tracker", viewMode: "progress" }, base);
    expect([kept.activeTab, kept.viewMode]).toEqual(["tracker", "progress"]);
  });
});
