import { create } from "zustand";
import { persist } from "zustand/middleware";
import { APP_TABS, VIEW_MODES, type ViewMode, type DexMode, type GameVersion, type AvailabilityMode, type AppTab, type NotesSection, type GamesSection } from "../types";
import { applyTheme } from "../lib/applyTheme";
import { applyLegibility } from "../lib/applyLegibility";
import type { LegibilityLevel } from "../lib/applyLegibility";
import { DEFAULT_THEME } from "../themes";
import type { SaveFamily } from "../lib/save/types";

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

  // Quick mark: a single tap/click on a cell or row toggles caught
  quickMark: boolean;
  setQuickMark: (on: boolean) => void;

  // One-time hint explaining the marking gestures
  gestureHintDismissed: boolean;
  dismissGestureHint: () => void;

  // "What can I get next" view: include outbreak / Poké Radar / Slot 2 / radio encounters
  nextIncludeSetup: boolean;
  setNextIncludeSetup: (on: boolean) => void;

  // "What can I get next" view: show caught Pokémon too (dimmed)
  nextShowCaught: boolean;
  setNextShowCaught: (on: boolean) => void;

  // "What can I get next" view: only what Game Progress has opened; locked entries hidden or greyed out
  nextReachOnly: boolean;
  setNextReachOnly: (on: boolean) => void;
  nextLockedMode: "hide" | "grey";
  setNextLockedMode: (mode: "hide" | "grey") => void;

  // "What can I get next" view: ranking — most uncaught first, or the least expected effort first
  nextSort: "count" | "effort";
  setNextSort: (sort: "count" | "effort") => void;

  // "What can I get next" view: only what is on at this time of day and weekday
  nextNowOnly: boolean;
  setNextNowOnly: (on: boolean) => void;

  // "What can I get next" view: only these method groups (lib/what-next.ts METHOD_GROUPS); empty = every method
  nextMethods: string[];
  setNextMethods: (groups: string[]) => void;

  // Save import: when on, ✦ comes only from the Pokémon sitting in the living-dex slot
  shinyLivingDex: boolean;
  setShinyLivingDex: (on: boolean) => void;

  // Save import: families whose progress reading you have checked against your trainer card (lib/save/progress.ts)
  progressConfirmed: SaveFamily[];
  confirmProgress: (family: SaveFamily) => void;

  // Save import: families whose "please spot-check" notice has been shown
  saveNoticesSeen: SaveFamily[];
  markSaveNoticeSeen: (family: SaveFamily) => void;

  // Active tab (mirrored in the address bar by lib/url-route.ts)
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Route info tab — selected location area slug (not persisted)
  activeRoute: string | null;
  setActiveRoute: (slug: string | null) => void;

  // Route info tab — text for its search box, handed over by a link from another
  // tab (see lib/navigate.ts). RouteInfo copies it into the box once and clears it. Not persisted.
  routeSearch: string | null;
  setRouteSearch: (text: string | null) => void;

  // Pokédex tab — selected Pokémon id (persisted, so the tab reopens on the same Pokémon)
  activePokedexId: number | null;
  setActivePokedexId: (id: number | null) => void;

  // Attackdex tab — move slug to pre-select; "" clears the selection (not persisted)
  activeAttackdexSlug: string | null;
  setActiveAttackdexSlug: (slug: string | null) => void;

  // Attackdex tab — last search state (persisted)
  lastAttackdexQuery: string;
  lastAttackdexSlug: string | null;
  lastAttackdexMode: "single" | "combo" | "hm-planner";
  lastAttackdexVersionGroup: string;
  setLastAttackdexState: (s: { query: string; slug: string | null; mode: "single" | "combo" | "hm-planner"; versionGroup: string }) => void;

  // Tracker list view — column sort, "caught-desc" (lib/list-sort.ts). In the address, not persisted
  listSort: string | null;
  setListSort: (sort: string | null) => void;

  // Notes tab — which section is open (persisted; also in the address, #/notes/<section>)
  notesSection: NotesSection;
  setNotesSection: (section: NotesSection) => void;

  // My games tab: Progress or Saves
  gamesSection: GamesSection;
  setGamesSection: (section: GamesSection) => void;

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

      // Default on for touch screens, where double-click and right-click are awkward.
      // Once the user changes it, their choice is what gets persisted.
      quickMark: typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches,
      setQuickMark: (on) => set({ quickMark: on }),

      gestureHintDismissed: false,
      dismissGestureHint: () => set({ gestureHintDismissed: true }),

      nextIncludeSetup: false,
      setNextIncludeSetup: (on) => set({ nextIncludeSetup: on }),

      nextShowCaught: true,
      setNextShowCaught: (on) => set({ nextShowCaught: on }),

      nextReachOnly: false,
      setNextReachOnly: (on) => set({ nextReachOnly: on }),
      nextLockedMode: "grey",
      setNextLockedMode: (mode) => set({ nextLockedMode: mode }),

      nextSort: "count",
      setNextSort: (sort) => set({ nextSort: sort }),

      nextNowOnly: false,
      setNextNowOnly: (on) => set({ nextNowOnly: on }),

      nextMethods: [],
      setNextMethods: (groups) => set({ nextMethods: groups }),

      shinyLivingDex: false,
      setShinyLivingDex: (on) => set({ shinyLivingDex: on }),

      progressConfirmed: [],
      confirmProgress: (family) =>
        set((state) => (state.progressConfirmed.includes(family) ? {} : { progressConfirmed: [...state.progressConfirmed, family] })),

      saveNoticesSeen: [],
      markSaveNoticeSeen: (family) =>
        set((state) => (state.saveNoticesSeen.includes(family) ? {} : { saveNoticesSeen: [...state.saveNoticesSeen, family] })),

      activeTab: "tracker",
      setActiveTab: (tab) => set({ activeTab: tab }),

      activeRoute: null,
      setActiveRoute: (slug) => set({ activeRoute: slug }),

      routeSearch: null,
      setRouteSearch: (text) => set({ routeSearch: text }),

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

      listSort: null,
      setListSort: (sort) => set({ listSort: sort }),

      notesSection: "working",
      setNotesSection: (section) => set({ notesSection: section }),

      gamesSection: "progress",
      setGamesSection: (section) => set({ gamesSection: section }),

      compareSlotIndex: null,
      setCompareSlotIndex: (idx) => set({ compareSlotIndex: idx }),
    }),
    {
      name: "pokedex-settings-v1",
      // Transient fields are excluded from persistence. Everything else persists by default,
      // so adding a new setting to SettingsStore will persist automatically.
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { selectedPokemonId: _a, searchQuery: _b, activeRoute: _c, routeSearch: _d, compareSlotIndex: _e, activeAttackdexSlug: _f, listSort: _g, ...persistent } = state;
        return persistent;
      },
      // Migration: rename iv-checker tab → designer, coerce unknown viewModes to "box"
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current> & { tabGroup?: unknown };
        delete p.tabGroup;
        if ((p.activeTab as string) === "iv-checker") p.activeTab = "designer";
        if (p.activeTab && !APP_TABS.includes(p.activeTab)) p.activeTab = "tracker";
        // Saves, Game progress and Shiny hunts moved out of the tracker's views (My games tab, Notes)
        const moved = p.viewMode as string | undefined;
        if (moved === "saves" || moved === "games") {
          p.gamesSection = moved === "saves" ? "saves" : "progress";
          if (p.activeTab === "tracker") p.activeTab = "games";
        } else if (moved === "hunts") {
          p.notesSection = "hunts";
          if (p.activeTab === "tracker") p.activeTab = "notes";
        }
        if (p.viewMode && !VIEW_MODES.includes(p.viewMode)) p.viewMode = "box";
        return { ...current, ...p };
      },
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? DEFAULT_THEME);
        applyLegibility(state?.legibility ?? "off");
      },
    }
  )
);
