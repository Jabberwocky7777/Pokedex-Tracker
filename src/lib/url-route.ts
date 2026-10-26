/**
 * The address bar mirrors the open tab, and the item open in it where a tab
 * has one: `#/pokedex/94`, `#/attackdex/u-turn`, `#/routes/eterna-forest-area`,
 * `#/games/saves`.
 * The tracker's list sort rides along as `#/tracker?sort=caught-desc`.
 *
 * Hash routing, so nothing changes for nginx (every path already serves
 * index.html) or the iOS app (which loads index.html from the bundle).
 * The store stays the source of truth: a store change pushes a history entry,
 * and Back / Forward or a typed address set the store.
 */
import { useSettingsStore } from "../store/useSettingsStore";
import { APP_TABS, GAMES_SECTIONS, NOTES_SECTIONS, type AppTab, type GamesSection, type NotesSection } from "../types";
import { parseListSort } from "./list-sort";

export interface UrlRoute {
  tab: AppTab;
  /** Pokédex: a dex number; Attackdex: a move slug; Routes: an area slug; Notes: the section. */
  item: string | null;
  /** Tracker only: the list view's column sort ("caught-desc") */
  sort?: string | null;
}

type SettingsState = ReturnType<typeof useSettingsStore.getState>;

const ITEM_TABS: readonly AppTab[] = ["pokedex", "attackdex", "routes", "notes", "games"];

export function hashOf(route: UrlRoute): string {
  return `#/${route.tab}` + (route.item ? `/${encodeURIComponent(route.item)}` : "") +
    (route.tab === "tracker" && route.sort ? `?sort=${encodeURIComponent(route.sort)}` : "");
}

/** `null` for an empty or unknown address. An item on a tab without items is dropped. */
export function parseHash(hash: string): UrlRoute | null {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [tabPart, ...rest] = path.split("/");
  const tab = APP_TABS.find((t) => t === tabPart);
  if (!tab) return null;
  let item: string | null;
  try {
    item = rest.length ? decodeURIComponent(rest.join("/")) || null : null;
  } catch {
    item = null;
  }
  if (!ITEM_TABS.includes(tab)) item = null;
  if (tab === "pokedex" && item !== null && !/^\d+$/.test(item)) item = null;
  if (tab === "notes" && item !== null && !NOTES_SECTIONS.includes(item as NotesSection)) item = null;
  if (tab === "games" && item !== null && !GAMES_SECTIONS.includes(item as GamesSection)) item = null;
  if (tab === "tracker") {
    const sort = new URLSearchParams(query).get("sort");
    return { tab, item, sort: parseListSort(sort) ? sort : null };
  }
  return { tab, item };
}

/** What the address should say for this state. */
export function routeOf(state: SettingsState): UrlRoute {
  const tab = state.activeTab;
  switch (tab) {
    case "pokedex":
      return { tab, item: state.activePokedexId ? String(state.activePokedexId) : null };
    case "attackdex": {
      // A link waiting to be applied is where the tab is about to be ("" clears it)
      const slug = state.activeAttackdexSlug ?? (state.lastAttackdexMode === "single" ? state.lastAttackdexSlug : null);
      return { tab, item: slug || null };
    }
    case "routes":
      return { tab, item: state.activeRoute };
    case "notes":
      return { tab, item: state.notesSection };
    case "games":
      return { tab, item: state.gamesSection };
    case "tracker":
      return { tab, item: null, sort: state.listSort };
    default:
      return { tab, item: null };
  }
}

// Set while an address is being applied, so its in-between states aren't pushed
let applying = false;

/** Opens what an address names. */
export function applyRoute(route: UrlRoute): void {
  applying = true;
  try {
    applyRouteNow(route);
  } finally {
    applying = false;
  }
}

function applyRouteNow(route: UrlRoute): void {
  const settings = useSettingsStore.getState();
  switch (route.tab) {
    case "pokedex":
      settings.setActivePokedexId(route.item ? Number(route.item) : null);
      break;
    case "attackdex":
      // Only when it differs: re-applying the open move would reset the search box
      if (routeOf({ ...settings, activeTab: "attackdex" }).item !== route.item) {
        settings.setActiveAttackdexSlug(route.item ?? "");
      }
      break;
    case "routes":
      settings.setActiveRoute(route.item);
      break;
    case "notes":
      if (route.item) settings.setNotesSection(route.item as NotesSection);
      break;
    case "games":
      if (route.item) settings.setGamesSection(route.item as GamesSection);
      break;
    case "tracker":
      if ((route.sort ?? null) !== settings.listSort) settings.setListSort(route.sort ?? null);
      break;
  }
  if (settings.activeTab === "tracker" && route.tab !== "tracker") settings.setSelectedPokemonId(null);
  if (settings.activeTab !== route.tab) settings.setActiveTab(route.tab);
}

/**
 * Starts keeping the address and the store in step. Call once, before the first render.
 * An address on load wins over the persisted tab; with none, the persisted tab is written to it.
 */
export function startUrlRouting(): () => void {
  const initial = parseHash(window.location.hash);
  if (initial) applyRoute(initial);
  history.replaceState(history.state, "", hashOf(routeOf(useSettingsStore.getState())));

  const onAddress = () => {
    const route = parseHash(window.location.hash);
    if (route) applyRoute(route);
    // An unknown address is replaced by the one for what is open
    const wanted = hashOf(routeOf(useSettingsStore.getState()));
    if (window.location.hash !== wanted) history.replaceState(history.state, "", wanted);
  };
  window.addEventListener("popstate", onAddress);
  window.addEventListener("hashchange", onAddress);

  const unsubscribe = useSettingsStore.subscribe((state) => {
    if (applying) return;
    const wanted = hashOf(routeOf(state));
    if (window.location.hash !== wanted) history.pushState(null, "", wanted);
  });

  return () => {
    window.removeEventListener("popstate", onAddress);
    window.removeEventListener("hashchange", onAddress);
    unsubscribe();
  };
}
