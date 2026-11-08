import { createContext, useCallback, useContext } from "react";
import { showInTracker } from "../../lib/navigate";
import { useSettingsStore } from "../../store/useSettingsStore";

/**
 * Where "show this Pokémon's details" opens. By default that is the tracker's detail panel
 * (which switches to the tracker). A tab with a detail panel of its own — Plan — provides
 * this, so its Pokémon open beside what you're doing instead of taking you away from it.
 */
export const PokemonPanelContext = createContext<((id: number) => void) | null>(null);

/**
 * Opens a Pokémon's detail panel: the enclosing tab's own, when it has one and the Pokémon
 * belongs to the generation on show; the tracker's otherwise. `generation` is for Pokémon tied
 * to one (a save's, a game's), as with showInTracker.
 */
export function useShowPokemon(): { show: (id: number, generation?: number) => void; here: boolean } {
  const openHere = useContext(PokemonPanelContext);
  const show = useCallback(
    (id: number, generation?: number) => {
      if (openHere && (generation === undefined || generation === useSettingsStore.getState().activeGeneration)) {
        openHere(id);
      } else {
        showInTracker(id, generation);
      }
    },
    [openHere],
  );
  return { show, here: openHere !== null };
}
