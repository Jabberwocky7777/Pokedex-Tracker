import { useEffect } from "react";
import { useSettingsStore } from "../store/useSettingsStore";
import { toggleWithUndo } from "../lib/dex-actions";
import type { FilteredPokemon } from "./usePokemonFilter";

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useKeyboardShortcuts(
  filteredPokemon: FilteredPokemon[],
  activeGeneration: number,
  onOpenShortcuts: () => void,
) {
  const selectedPokemonId = useSettingsStore((s) => s.selectedPokemonId);
  const setSelectedPokemonId = useSettingsStore((s) => s.setSelectedPokemonId);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      // Tabs stay mounted while hidden; these shortcuts belong to the tracker only
      if (useSettingsStore.getState().activeTab !== "tracker") return;

      // ? — open shortcut help (Shift+/ on most keyboards)
      if (e.key === "?" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // A plain arrow with nothing focused (a D-pad's first press): into the tracker's cells,
      // at the selected Pokémon if it is showing. From there the cells move focus themselves.
      if (
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.startsWith("Arrow") &&
        (document.activeElement === document.body || document.activeElement == null)
      ) {
        const cells = [...document.querySelectorAll<HTMLElement>('[data-nav="cell"]')].filter(
          (el) => el.getClientRects().length > 0,
        );
        const selected = cells.find(
          (el) => el.closest("[data-pokemon-id]")?.getAttribute("data-pokemon-id") === String(selectedPokemonId),
        );
        const target = selected ?? cells[0];
        if (target) {
          e.preventDefault();
          target.focus();
        }
        return;
      }

      if (!e.shiftKey) return;

      // Shift+C — toggle caught on selected Pokémon
      if (e.key === "C") {
        e.preventDefault();
        if (selectedPokemonId != null) {
          const name = filteredPokemon.find((p) => p.id === selectedPokemonId)?.displayName ?? `#${selectedPokemonId}`;
          toggleWithUndo("caught", selectedPokemonId, activeGeneration, name);
        }
        return;
      }

      // Shift+Enter — same as clicking a Pokémon (select first in filtered if none selected)
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedPokemonId == null && filteredPokemon.length > 0) {
          setSelectedPokemonId(filteredPokemon[0].id);
        }
        return;
      }

      // Shift+Arrow — navigate through filtered list
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredPokemon.length === 0) return;

        const currentIndex =
          selectedPokemonId != null ? filteredPokemon.findIndex((p) => p.id === selectedPokemonId) : -1;

        const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
        let nextIndex: number;

        if (currentIndex === -1) {
          nextIndex = forward ? 0 : filteredPokemon.length - 1;
        } else {
          nextIndex = forward ? Math.min(filteredPokemon.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        }

        setSelectedPokemonId(filteredPokemon[nextIndex].id);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPokemon, selectedPokemonId, setSelectedPokemonId, activeGeneration, onOpenShortcuts]);
}
