/**
 * The address bar mirrors the open tab, and the section and item open in it where
 * a tab has them: `#/pokedex/94`, `#/pokedex/moves/u-turn`, `#/pokedex/hm`,
 * `#/routes/eterna-forest-area`, `#/games/saves`.
 * Addresses from before a tab moved still open the right place: `#/attackdex/u-turn`
 * is `#/pokedex/moves/u-turn`, `#/notes/journal` is `#/plan/journal`.
 * The tracker's list sort rides along as `#/tracker?sort=caught-desc`.
 *
 * Hash routing, so nothing changes for nginx (every path already serves
 * index.html) or the iOS app (which loads index.html from the bundle).
 * The store stays the source of truth: a store change pushes a history entry,
 * and Back / Forward or a typed address set the store.
 */
import { useSettingsStore } from "../store/useSettingsStore";
import {
  APP_TABS,
  GAMES_SECTIONS,
  PLAN_SECTIONS,
  POKEDEX_SECTIONS,
  type AppTab,
  type GamesSection,
  type PlanSection,
  type PokedexSection,
} from "../types";
import { parseListSort } from "./list-sort";

export interface UrlRoute {
  tab: AppTab;
  /** Pokédex: the section ("pokemon" when the address has none) */
  section?: PokedexSection;
  /** Pokédex: a dex number, or a move slug in Moves; Routes: an area slug; Plan, My games: the section. */
  item: string | null;
  /** Tracker only: the list view's column sort ("caught-desc") */
  sort?: string | null;
}

type SettingsState = ReturnType<typeof useSettingsStore.getState>;

const ITEM_TABS: readonly AppTab[] = ["pokedex", "routes", "plan", "games"];

export function hashOf(route: UrlRoute): string {
  return (
    `#/${route.tab}` +
    (route.tab === "pokedex" && route.section && route.section !== "pokemon" ? `/${route.section}` : "") +
    (route.item ? `/${encodeURIComponent(route.item)}` : "") +
    (route.tab === "tracker" && route.sort ? `?sort=${encodeURIComponent(route.sort)}` : "")
  );
}

/** `null` for an empty or unknown address. An item on a tab without items is dropped. */
export function parseHash(hash: string): UrlRoute | null {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [tabPart, ...rest] = path.split("/");
  // The Attackdex became the Pokédex's Moves section
  if (tabPart === "attackdex") return parseHash(`#/pokedex/moves/${rest.join("/")}`);
  // The Notes tab became the Plan tab's last four sections
  if (tabPart === "notes") return parseHash(`#/plan/${rest[0] || "working"}`);
  const tab = APP_TABS.find((t) => t === tabPart);
  if (!tab) return null;
  if (tab === "pokedex") return parsePokedex(rest);
  let item: string | null;
  try {
    item = rest.length ? decodeURIComponent(rest.join("/")) || null : null;
  } catch {
    item = null;
  }
  if (!ITEM_TABS.includes(tab)) item = null;
  if (tab === "plan" && item !== null && !PLAN_SECTIONS.includes(item as PlanSection)) item = null;
  if (tab === "games" && item !== null && !GAMES_SECTIONS.includes(item as GamesSection)) item = null;
  if (tab === "tracker") {
    const sort = new URLSearchParams(query).get("sort");
    return { tab, item, sort: parseListSort(sort) ? sort : null };
  }
  return { tab, item };
}

/** `#/pokedex/94`, `#/pokedex/moves/surf`, `#/pokedex/combo`. A section the address doesn't name is Pokémon. */
function parsePokedex(parts: string[]): UrlRoute {
  const named = POKEDEX_SECTIONS.find((s) => s !== "pokemon" && s === parts[0]);
  const section: PokedexSection = named ?? "pokemon";
  const rest = named ? parts.slice(1) : parts;
  let item: string | null;
  try {
    item = rest.length ? decodeURIComponent(rest.join("/")) || null : null;
  } catch {
    item = null;
  }
  if (section === "pokemon" && item !== null && !/^\d+$/.test(item)) item = null;
  if (section === "combo" || section === "hm") item = null;
  return { tab: "pokedex", section, item };
}

/** What the address should say for this state. */
export function routeOf(state: SettingsState): UrlRoute {
  const tab = state.activeTab;
  switch (tab) {
    case "pokedex": {
      const section = state.pokedexSection;
      if (section === "pokemon")
        return { tab, section, item: state.activePokedexId ? String(state.activePokedexId) : null };
      if (section === "moves") {
        // A link waiting to be applied is where the section is about to be ("" clears it)
        const slug = state.activeAttackdexSlug ?? state.lastAttackdexSlug;
        return { tab, section, item: slug || null };
      }
      return { tab, section, item: null };
    }
    case "routes":
      return { tab, item: state.activeRoute };
    case "plan":
      return { tab, item: state.planSection };
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
    case "pokedex": {
      const section = route.section ?? "pokemon";
      if (section === "pokemon") {
        settings.setActivePokedexId(route.item ? Number(route.item) : null);
      } else if (section === "moves") {
        // Only when it differs: re-applying the open move would reset the search box
        if (routeOf({ ...settings, activeTab: "pokedex", pokedexSection: "moves" }).item !== route.item) {
          settings.setActiveAttackdexSlug(route.item ?? "");
        }
      }
      if (settings.pokedexSection !== section) settings.setPokedexSection(section);
      break;
    }
    case "routes":
      settings.setActiveRoute(route.item);
      break;
    case "plan":
      if (route.item) settings.setPlanSection(route.item as PlanSection);
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
