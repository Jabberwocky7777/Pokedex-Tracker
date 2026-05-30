import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewMode, DexMode, GameVersion, AvailabilityMode, AppTab, TabGroup } from "../types";
import { applyTheme } from "../lib/applyTheme";
import { applyLegibility } from "../lib/applyLegibility";
import type { LegibilityLevel } from "../lib/applyLegibility";
import { DEFAULT_THEME } from "../themes";

interface SettingsStore {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  dexMode: DexMode;
  setDexMode: (mode: DexMode) => void;

  // Multi-game selection: empty array = "All games"
  activeGames: GameVersion[];
  toggleActiveGame: (game: GameVersion) => void;
  clearActiveGames: () => void;

  activeGeneration: number;
  setActiveGeneration: (gen: number) => void;

  selectedPokemonId: number | null;
  setSelectedPokemonId: (id: number | null) => void;

  theme: string;
  setTheme: (id: string) => void;

  legibility: LegibilityLevel;
  setLegibility: (level: LegibilityLevel) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Availability filter
  availabilityMode: AvailabilityMode;
  setAvailabilityMode: (mode: AvailabilityMode) => void;

  // List view: show only uncaught
  showUncaughtOnly: boolean;
  toggleShowUncaughtOnly: () => void;

  // Active tab and tab group
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  tabGroup: TabGroup;
  setTabGroup: (group: TabGroup) => void;

  // Route info tab — selected location area slug (not persisted)
  activeRoute: string | null;
  setActiveRoute: (slug: string | null) => void;

  // Pokédex tab — selected Pokémon id (not persisted)
  activePokedexId: number | null;
  setActivePokedexId: (id: number | null) => void;

  // Attackdex tab — move slug to pre-select (not persisted)
  activeAttackdexSlug: string | null;
  setActiveAttackdexSlug: (slug: string | null) => void;

  // Attackdex tab — last search state (persisted)
  lastAttackdexQuery: string;
  lastAttackdexSlug: string | null;
  lastAttackdexMode: "single" | "combo" | "hm-planner";
  lastAttackdexVersionGroup: string;
  setLastAttackdexState: (s: { query: string; slug: string | null; mode: "single" | "combo" | "hm-planner"; versionGroup: string }) => void;

  // Designer tab — second slot for split-screen compare (not persisted)
  compareSlotIndex: number | null;
  setCompareSlotIndex: (idx: number | null) => void;

}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      viewMode: "box",
      setViewMode: (mode) => set({ viewMode: mode }),

      dexMode: "national",
      setDexMode: (mode) => set({ dexMode: mode }),

      activeGames: [],
      toggleActiveGame: (game) =>
        set((state) => {
          const current = new Set(state.activeGames);
          if (current.has(game)) {
            current.delete(game);
          } else {
            current.add(game);
          }
          return { activeGames: Array.from(current) };
        }),
      clearActiveGames: () => set({ activeGames: [] }),

      activeGeneration: 3,
      setActiveGeneration: (gen) =>
        set({ activeGeneration: gen, dexMode: "national", activeGames: [] }),

      selectedPokemonId: null,
      setSelectedPokemonId: (id) => set({ selectedPokemonId: id }),

      theme: DEFAULT_THEME,
      setTheme: (id) => {
        applyTheme(id);
        set({ theme: id });
      },

      legibility: "off",
      setLegibility: (level) => {
        applyLegibility(level);
        set({ legibility: level });
      },

      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),

      availabilityMode: "obtainable",
      setAvailabilityMode: (mode) => set({ availabilityMode: mode }),

      showUncaughtOnly: false,
      toggleShowUncaughtOnly: () =>
        set((state) => ({ showUncaughtOnly: !state.showUncaughtOnly })),

      activeTab: "tracker",
      setActiveTab: (tab) => {
        const frontierTabs: AppTab[] = ["designer", "trainer-lookup", "damage-calc", "settings"];
        set({ activeTab: tab, tabGroup: frontierTabs.includes(tab) ? "frontier" : "tracker" });
      },

      tabGroup: "tracker",
      setTabGroup: (group) => set({ tabGroup: group }),

      activeRoute: null,
      setActiveRoute: (slug) => set({ activeRoute: slug }),

      activePokedexId: null,
      setActivePokedexId: (id) => set({ activePokedexId: id }),

      activeAttackdexSlug: null,
      setActiveAttackdexSlug: (slug) => set({ activeAttackdexSlug: slug }),

      lastAttackdexQuery: "",
      lastAttackdexSlug: null,
      lastAttackdexMode: "single",
      lastAttackdexVersionGroup: "",
      setLastAttackdexState: (s) => set({
        lastAttackdexQuery: s.query,
        lastAttackdexSlug: s.slug,
        lastAttackdexMode: s.mode,
        lastAttackdexVersionGroup: s.versionGroup,
      }),

      compareSlotIndex: null,
      setCompareSlotIndex: (idx) => set({ compareSlotIndex: idx }),
    }),
    {
      name: "pokedex-settings-v1",
      // Transient fields are excluded from persistence. Everything else persists by default,
      // so adding a new setting to SettingsStore will persist automatically.
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { selectedPokemonId: _a, searchQuery: _b, activeRoute: _c, compareSlotIndex: _e, activeAttackdexSlug: _f, ...persistent } = state;
        return persistent;
      },
      // Migration: rename iv-checker tab → designer, coerce unknown viewModes to "box"
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>;
        if ((p.activeTab as string) === "iv-checker") p.activeTab = "designer";
        const validTabs = ["tracker", "catch-calc", "designer", "routes", "pokedex", "attackdex", "trainer-lookup", "damage-calc", "settings"];
        if (p.activeTab && !validTabs.includes(p.activeTab)) p.activeTab = "tracker";
        if (p.viewMode && !["box", "list", "slots", "daily"].includes(p.viewMode)) p.viewMode = "box";
        return { ...current, ...p };
      },
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? DEFAULT_THEME);
        applyLegibility(state?.legibility ?? "off");
      },
    }
  )
);
