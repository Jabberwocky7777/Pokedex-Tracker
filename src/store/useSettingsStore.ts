import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  APP_TABS,
  VIEW_MODES,
  type ViewMode,
  type DexMode,
  type GameVersion,
  type AvailabilityMode,
  type AppTab,
  type PlanSection,
  PLAN_SECTIONS,
  type GamesSection,
  type PokedexSection,
  POKEDEX_SECTIONS,
} from "../types";
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

  // "What can I get next" view: include the HG/SS Safari Zone and the Bug-Catching Contest
  nextIncludeSpecial: boolean;
  setNextIncludeSpecial: (on: boolean) => void;

  // "What can I get next" view: leave out Pokémon marked pending (only what still has to be caught)
  nextHidePending: boolean;
  setNextHidePending: (on: boolean) => void;
  // "What can I get next" view: a caught Pokémon whose evolution isn't caught or pending shows as one to catch again
  nextExtraCopies: boolean;
  setNextExtraCopies: (on: boolean) => void;

  // Level up: the trainee holds a Lucky Egg
  levelLuckyEgg: boolean;
  setLevelLuckyEgg: (on: boolean) => void;

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

  // Pokédex tab — which section is open: Pokémon, or one of the move tools (also in the address)
  pokedexSection: PokedexSection;
  setPokedexSection: (section: PokedexSection) => void;

  // Section sidebars (Pokédex, Plan, tracker): folded to an icon rail. Per device
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (on: boolean) => void;

  // Pokédex → Moves — move slug to pre-select; "" clears the selection (not persisted)
  activeAttackdexSlug: string | null;
  setActiveAttackdexSlug: (slug: string | null) => void;

  // Pokédex → Moves — last search state (persisted; the names are from when it was the Attackdex tab)
  lastAttackdexQuery: string;
  lastAttackdexSlug: string | null;
  lastAttackdexMode: "single" | "combo" | "hm-planner";
  lastAttackdexVersionGroup: string;
  setLastAttackdexState: (s: {
    query: string;
    slug: string | null;
    mode: "single" | "combo" | "hm-planner";
    versionGroup: string;
  }) => void;

  // Tracker list view — column sort, "caught-desc" (lib/list-sort.ts). In the address, not persisted
  listSort: string | null;
  setListSort: (sort: string | null) => void;

  // Plan tab — which section is open (persisted; also in the address, #/plan/<section>)
  planSection: PlanSection;
  setPlanSection: (section: PlanSection) => void;

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
      setActiveGeneration: (gen) => set({ activeGeneration: gen, dexMode: "national", activeGames: [] }),

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
      toggleShowUncaughtOnly: () => set((state) => ({ showUncaughtOnly: !state.showUncaughtOnly })),

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

      nextIncludeSpecial: true,
      setNextIncludeSpecial: (on) => set({ nextIncludeSpecial: on }),

      nextHidePending: false,
      setNextHidePending: (on) => set({ nextHidePending: on }),
      nextExtraCopies: true,
      setNextExtraCopies: (on) => set({ nextExtraCopies: on }),

      levelLuckyEgg: false,
      setLevelLuckyEgg: (on) => set({ levelLuckyEgg: on }),

      shinyLivingDex: false,
      setShinyLivingDex: (on) => set({ shinyLivingDex: on }),

      progressConfirmed: [],
      confirmProgress: (family) =>
        set((state) =>
          state.progressConfirmed.includes(family) ? {} : { progressConfirmed: [...state.progressConfirmed, family] },
        ),

      saveNoticesSeen: [],
      markSaveNoticeSeen: (family) =>
        set((state) =>
          state.saveNoticesSeen.includes(family) ? {} : { saveNoticesSeen: [...state.saveNoticesSeen, family] },
        ),

      activeTab: "tracker",
      setActiveTab: (tab) => set({ activeTab: tab }),

      activeRoute: null,
      setActiveRoute: (slug) => set({ activeRoute: slug }),

      routeSearch: null,
      setRouteSearch: (text) => set({ routeSearch: text }),

      activePokedexId: null,
      setActivePokedexId: (id) => set({ activePokedexId: id }),

      pokedexSection: "pokemon",
      setPokedexSection: (section) => set({ pokedexSection: section }),

      sidebarCollapsed: false,
      setSidebarCollapsed: (on) => set({ sidebarCollapsed: on }),

      activeAttackdexSlug: null,
      setActiveAttackdexSlug: (slug) => set({ activeAttackdexSlug: slug }),

      lastAttackdexQuery: "",
      lastAttackdexSlug: null,
      lastAttackdexMode: "single",
      lastAttackdexVersionGroup: "",
      setLastAttackdexState: (s) =>
        set({
          lastAttackdexQuery: s.query,
          lastAttackdexSlug: s.slug,
          lastAttackdexMode: s.mode,
          lastAttackdexVersionGroup: s.versionGroup,
        }),

      listSort: null,
      setListSort: (sort) => set({ listSort: sort }),

      planSection: "where",
      setPlanSection: (section) => set({ planSection: section }),

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
        const {
          selectedPokemonId: _a,
          searchQuery: _b,
          activeRoute: _c,
          routeSearch: _d,
          compareSlotIndex: _e,
          activeAttackdexSlug: _f,
          listSort: _g,
          ...persistent
        } = state;
        return persistent;
      },
      // Migration: tabs and views that were renamed or moved; anything unknown falls back to a default
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current> & {
          tabGroup?: unknown;
          notesSection?: string;
          nextPanel?: string;
        };
        delete p.tabGroup;
        const tab = p.activeTab as string | undefined;
        if (tab === "iv-checker") p.activeTab = "designer";
        // The Attackdex is now the Pokédex's move sections
        if (tab === "attackdex") {
          p.activeTab = "pokedex";
          p.pokedexSection =
            p.lastAttackdexMode === "combo" ? "combo" : p.lastAttackdexMode === "hm-planner" ? "hm" : "moves";
        }
        if (p.pokedexSection && !POKEDEX_SECTIONS.includes(p.pokedexSection)) p.pokedexSection = "pokemon";
        // The Notes tab is now the Plan tab's "Keep track" sections
        const notesSection = p.notesSection;
        delete p.notesSection;
        if (notesSection && PLAN_SECTIONS.includes(notesSection as PlanSection) && !p.planSection)
          p.planSection = notesSection as PlanSection;
        if (tab === "notes") {
          p.activeTab = "plan";
          p.planSection = PLAN_SECTIONS.includes(notesSection as PlanSection)
            ? (notesSection as PlanSection)
            : "working";
        }
        // Views that moved out of the tracker: Saves and Game progress (My games), Shiny hunts, What's next,
        // Daily and Items (Plan)
        const nextPanel = p.nextPanel;
        delete p.nextPanel;
        const moved = p.viewMode as string | undefined;
        const toPlan: Record<string, PlanSection> = {
          hunts: "hunts",
          next: nextPanel === "level" ? "level" : "where",
          daily: "today",
          items: "items",
        };
        if (moved === "saves" || moved === "games") {
          p.gamesSection = moved === "saves" ? "saves" : "progress";
          if (p.activeTab === "tracker") p.activeTab = "games";
        } else if (moved && toPlan[moved]) {
          p.planSection = toPlan[moved];
          if (p.activeTab === "tracker") p.activeTab = "plan";
        }
        if (p.viewMode && !VIEW_MODES.includes(p.viewMode)) p.viewMode = "box";
        if (p.planSection && !PLAN_SECTIONS.includes(p.planSection)) p.planSection = "where";
        if (p.activeTab && !APP_TABS.includes(p.activeTab)) p.activeTab = "tracker";
        return { ...current, ...p };
      },
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? DEFAULT_THEME);
        applyLegibility(state?.legibility ?? "off");
      },
    },
  ),
);
