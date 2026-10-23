/**
 * The one way to open another tab on a particular Pokémon, route or move.
 * Each helper sets what the target tab should show, then switches to it.
 * Callable from anywhere (they read the store directly, not through a hook).
 */
import { useSettingsStore } from "../store/useSettingsStore";
import type { AppTab } from "../types";
import { moveNameToSlug } from "./move-slug";

/** Switches tab with nothing to show there in particular (the target tab has been set up some other way). */
export function openTab(tab: AppTab): void {
  switchTab(tab);
}

function switchTab(tab: AppTab): void {
  const settings = useSettingsStore.getState();
  // Leaving the tracker closes its detail panel, so it isn't still open on the way back
  if (settings.activeTab === "tracker" && tab !== "tracker") settings.setSelectedPokemonId(null);
  settings.setActiveTab(tab);
}

/**
 * Opens the tracker with this Pokémon selected, which shows its detail panel
 * (over whichever tracker view is open). Pass `generation` when the Pokémon
 * comes from something tied to one — a save, a game — so the tracker shows
 * that generation's marks.
 */
export function showInTracker(id: number, generation?: number): void {
  const settings = useSettingsStore.getState();
  if (generation !== undefined && settings.activeGeneration !== generation) settings.setActiveGeneration(generation);
  settings.setSelectedPokemonId(id);
  switchTab("tracker");
}

export function openPokedex(id: number): void {
  useSettingsStore.getState().setActivePokedexId(id);
  switchTab("pokedex");
}

/** Opens the Routes tab on one encounter area (a locationAreaSlug). */
export function openRoute(slug: string): void {
  const settings = useSettingsStore.getState();
  // Empties the search box, so an earlier search isn't left sitting above the area
  settings.setRouteSearch("");
  settings.setActiveRoute(slug);
  switchTab("routes");
}

/** Opens the Routes tab with its search box filled in — for a place with several areas. */
export function openRouteSearch(text: string): void {
  const settings = useSettingsStore.getState();
  settings.setActiveRoute(null);
  settings.setRouteSearch(text);
  switchTab("routes");
}

/** Opens the Attackdex on a move, by its slug ("u-turn"). */
export function openMove(slug: string): void {
  useSettingsStore.getState().setActiveAttackdexSlug(slug);
  switchTab("attackdex");
}

/** The same, from a move's name as the games or Battle Tower sets write it ("U-turn", "ThunderPunch"). */
export function openMoveByName(name: string): void {
  openMove(moveNameToSlug(name));
}
