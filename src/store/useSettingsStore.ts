import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewMode, DexMode, GameVersion, AvailabilityMode, AppTab } from "../types";

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

  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Availability filter
  availabilityMode: AvailabilityMode;
  setAvailabilityMode: (mode: AvailabilityMode) => void;

  // List view: show only uncaught
  showUncaughtOnly: boolean;
  toggleShowUncaughtOnly: () => void;

  // Active tab
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Route info tab — selected location area slug (not persisted)
  activeRoute: string | null;
  setActiveRoute: (slug: string | null) => void;

  // Pokédex tab — selected Pokémon id (not persisted)
  activePokedexId: number | null;
  setActivePokedexId: (id: number | null) => void;

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

      darkMode: true,
      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          applyDarkMode(next);
          return { darkMode: next };
        }),
      setDarkMode: (value) => {
        applyDarkMode(value);
        set({ darkMode: value });
      },

      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),

      availabilityMode: "obtainable",
      setAvailabilityMode: (mode) => set({ availabilityMode: mode }),

      showUncaughtOnly: false,
      toggleShowUncaughtOnly: () =>
        set((state) => ({ showUncaughtOnly: !state.showUncaughtOnly })),

      activeTab: "tracker",
      setActiveTab: (tab) => set({ activeTab: tab }),

      activeRoute: null,
      setActiveRoute: (slug) => set({ activeRoute: slug }),

      activePokedexId: null,
      setActivePokedexId: (id) => set({ activePokedexId: id }),

      compareSlotIndex: null,
      setCompareSlotIndex: (idx) => set({ compareSlotIndex: idx }),
    }),
    {
      name: "pokedex-settings-v1",
      // Transient fields are excluded from persistence. Everything else persists by default,
      // so adding a new setting to SettingsStore will persist automatically.
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { selectedPokemonId: _a, searchQuery: _b, activeRoute: _c, activePokedexId: _d, compareSlotIndex: _e, ...persistent } = state;
        return persistent;
      },
      // Migration: rename iv-checker tab → designer, coerce unknown viewModes to "box"
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>;
        if ((p.activeTab as string) === "iv-checker") p.activeTab = "designer";
        if (p.viewMode && !["box", "list", "slots"].includes(p.viewMode)) p.viewMode = "box";
        return { ...current, ...p };
      },
    }
  )
);

function applyDarkMode(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
