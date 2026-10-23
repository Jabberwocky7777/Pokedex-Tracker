import { beforeEach, describe, expect, it } from "vitest";
import { openMove, openMoveByName, openPokedex, openRoute, openRouteSearch, showInTracker } from "../navigate";
import { useSettingsStore } from "../../store/useSettingsStore";

const settings = () => useSettingsStore.getState();

beforeEach(() => {
  useSettingsStore.setState({
    activeTab: "tracker", activeGeneration: 4,
    selectedPokemonId: null, activePokedexId: null, activeRoute: null, routeSearch: null, activeAttackdexSlug: null,
  });
});

describe("navigate helpers", () => {
  it("showInTracker selects the Pokémon and opens the tracker", () => {
    settings().setActiveTab("pokedex");
    showInTracker(94);
    expect(settings().activeTab).toBe("tracker");
    expect(settings().selectedPokemonId).toBe(94);
  });

  it("showInTracker switches generation only when one is given and it differs", () => {
    showInTracker(1);
    expect(settings().activeGeneration).toBe(4);
    showInTracker(1, 4);
    expect(settings().activeGeneration).toBe(4);
    showInTracker(1, 3);
    expect(settings().activeGeneration).toBe(3);
    expect(settings().selectedPokemonId).toBe(1);
  });

  it("openPokedex sets the Pokémon and opens the Pokédex", () => {
    openPokedex(448);
    expect(settings().activeTab).toBe("pokedex");
    expect(settings().activePokedexId).toBe(448);
  });

  it("openRoute sets the area, empties the search box, and opens Routes", () => {
    settings().setRouteSearch("Mt. Coronet");
    openRoute("eterna-forest-area");
    expect(settings().activeTab).toBe("routes");
    expect(settings().activeRoute).toBe("eterna-forest-area");
    expect(settings().routeSearch).toBe("");
  });

  it("openRouteSearch hands over the text and leaves no area open", () => {
    settings().setActiveRoute("eterna-forest-area");
    openRouteSearch("Mt. Coronet");
    expect(settings().activeTab).toBe("routes");
    expect(settings().routeSearch).toBe("Mt. Coronet");
    expect(settings().activeRoute).toBeNull();
  });

  it("openMove sets the slug and opens the Attackdex", () => {
    openMove("u-turn");
    expect(settings().activeTab).toBe("attackdex");
    expect(settings().activeAttackdexSlug).toBe("u-turn");
  });

  it("openMoveByName accepts names as the games and Battle Tower sets write them", () => {
    for (const [name, slug] of [
      ["U-turn", "u-turn"], ["Will-O-Wisp", "will-o-wisp"], ["ThunderPunch", "thunder-punch"],
      ["Hi Jump Kick", "high-jump-kick"], ["Wake-Up Slap", "wake-up-slap"], ["Earthquake", "earthquake"],
    ]) {
      openMoveByName(name);
      expect(settings().activeAttackdexSlug, name).toBe(slug);
    }
  });

});

describe("the tracker's selection", () => {
  it("is cleared when a link leaves the tracker", () => {
    for (const leave of [() => openPokedex(94), () => openRoute("eterna-forest-area"), () => openRouteSearch("Mt. Coronet"), () => openMove("surf")]) {
      useSettingsStore.setState({ activeTab: "tracker", selectedPokemonId: 94 });
      leave();
      expect(settings().selectedPokemonId).toBeNull();
    }
  });

  it("is kept when a link goes from one other tab to another", () => {
    useSettingsStore.setState({ activeTab: "pokedex", selectedPokemonId: 94 });
    openRoute("eterna-forest-area");
    openMove("surf");
    openPokedex(1);
    expect(settings().selectedPokemonId).toBe(94);
  });

  it("is kept — and changed — by a link that stays in the tracker", () => {
    useSettingsStore.setState({ activeTab: "tracker", selectedPokemonId: 94 });
    showInTracker(93);
    expect(settings().activeTab).toBe("tracker");
    expect(settings().selectedPokemonId).toBe(93);
  });
});

describe("deep-link fields", () => {
  it("are not persisted: a reload doesn't reopen a link's target", () => {
    openRoute("eterna-forest-area");
    openRouteSearch("Mt. Coronet");
    openMove("surf");
    showInTracker(94);

    const persisted = useSettingsStore.persist.getOptions().partialize!(settings()) as Record<string, unknown>;
    for (const field of ["activeRoute", "routeSearch", "activeAttackdexSlug", "selectedPokemonId"]) {
      expect(persisted, field).not.toHaveProperty(field);
    }
    // The Pokédex tab reopening on the same Pokémon is deliberate
    expect(persisted).toHaveProperty("activePokedexId");
    expect(JSON.parse(localStorage.getItem("pokedex-settings-v1") ?? "{}").state).not.toHaveProperty("routeSearch");
  });
});
