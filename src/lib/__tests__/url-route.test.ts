import { beforeEach, describe, expect, it } from "vitest";
import { applyRoute, hashOf, parseHash, routeOf } from "../url-route";
import { openMove, openMyGames, openPokedex, openRoute } from "../navigate";
import { useSettingsStore } from "../../store/useSettingsStore";

const settings = () => useSettingsStore.getState();
const current = () => hashOf(routeOf(settings()));

beforeEach(() => {
  useSettingsStore.setState({
    activeTab: "tracker", selectedPokemonId: null, activePokedexId: null, activeRoute: null,
    routeSearch: null, activeAttackdexSlug: null, lastAttackdexSlug: null, lastAttackdexMode: "single",
  });
});

describe("parseHash", () => {
  it("reads a tab and its item", () => {
    expect(parseHash("#/pokedex/94")).toEqual({ tab: "pokedex", item: "94" });
    expect(parseHash("#/attackdex/u-turn")).toEqual({ tab: "attackdex", item: "u-turn" });
    expect(parseHash("#/routes/eterna-forest-area")).toEqual({ tab: "routes", item: "eterna-forest-area" });
    expect(parseHash("#/catch-calc")).toEqual({ tab: "catch-calc", item: null });
  });

  it("ignores unknown tabs, items on tabs without them, and a Pokédex item that isn't a number", () => {
    expect(parseHash("")).toBeNull();
    expect(parseHash("#/nowhere")).toBeNull();
    expect(parseHash("#/settings/x")).toEqual({ tab: "settings", item: null });
    expect(parseHash("#/pokedex/gengar")).toEqual({ tab: "pokedex", item: null });
    expect(parseHash("#/notes/shopping")).toEqual({ tab: "notes", item: null });
  });

  it("round-trips through hashOf", () => {
    for (const hash of ["#/tracker", "#/pokedex/448", "#/attackdex/will-o-wisp", "#/routes/route-201-area", "#/notes/journal", "#/notes/hunts", "#/games/saves", "#/games/progress"]) {
      expect(hashOf(parseHash(hash)!)).toBe(hash);
    }
  });
});

describe("the address for the open tab", () => {
  it("follows the cross-tab links", () => {
    openPokedex(94);
    expect(current()).toBe("#/pokedex/94");
    openMove("surf");
    expect(current()).toBe("#/attackdex/surf");
    openRoute("eterna-forest-area");
    expect(current()).toBe("#/routes/eterna-forest-area");
  });

  it("names no move while the Attackdex is in combo or HM mode", () => {
    useSettingsStore.setState({ activeTab: "attackdex", lastAttackdexSlug: "surf", lastAttackdexMode: "combo" });
    expect(current()).toBe("#/attackdex");
  });
});

describe("applyRoute", () => {
  it("opens the tab and its item", () => {
    applyRoute({ tab: "pokedex", item: "25" });
    expect(settings().activeTab).toBe("pokedex");
    expect(settings().activePokedexId).toBe(25);
    applyRoute({ tab: "routes", item: "route-201-area" });
    expect(settings().activeRoute).toBe("route-201-area");
    applyRoute({ tab: "attackdex", item: "surf" });
    expect(settings().activeAttackdexSlug).toBe("surf");
  });

  it("clears the Attackdex's move for an address without one", () => {
    useSettingsStore.setState({ lastAttackdexSlug: "surf" });
    applyRoute({ tab: "attackdex", item: null });
    expect(settings().activeAttackdexSlug).toBe("");
    expect(current()).toBe("#/attackdex");
  });

  it("closes the tracker's detail panel when it leaves the tracker", () => {
    useSettingsStore.setState({ selectedPokemonId: 94 });
    applyRoute({ tab: "settings", item: null });
    expect(settings().selectedPokemonId).toBeNull();
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
    const saves = merge({ activeTab: "tracker", viewMode: "saves" }, base) as typeof base;
    expect([saves.activeTab, saves.gamesSection, saves.viewMode]).toEqual(["games", "saves", "box"]);
    const hunts = merge({ activeTab: "tracker", viewMode: "hunts" }, base) as typeof base;
    expect([hunts.activeTab, hunts.notesSection, hunts.viewMode]).toEqual(["notes", "hunts", "box"]);
    const elsewhere = merge({ activeTab: "pokedex", viewMode: "games" }, base) as typeof base;
    expect([elsewhere.activeTab, elsewhere.gamesSection]).toEqual(["pokedex", "progress"]);
  });
});
