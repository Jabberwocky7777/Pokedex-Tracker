import { useMemo } from "react";
import { Check, ListPlus } from "lucide-react";
import { useWorkingOnStore } from "../../store/useWorkingOnStore";
import { useUndoStore } from "../../store/useUndoStore";
import { addItem, encounterItem, isOnListAt, orderedItems, type EncounterSpot } from "../../lib/working-on";
import { openNotes } from "../../lib/navigate";

const COARSE = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

/**
 * The small button on an encounter row (a Pokémon at a route, with its rate): adds
 * "Catch Feebas on Route 119 (Super Rod, 5%)" to Working on, linked to the Pokémon,
 * the route and the games. Once an open item has that Pokémon and route it is a tick
 * that opens the list.
 */
export default function AddSpotButton(spot: EncounterSpot) {
  const entries = useWorkingOnStore((s) => s.entries);
  const onList = useMemo(
    () => isOnListAt(orderedItems(entries), spot.pokemonId, spot.generation, spot.route.slug),
    [entries, spot.pokemonId, spot.generation, spot.route.slug],
  );
  const size = COARSE ? "w-11 h-11" : "w-7 h-7";
  const where = `${spot.displayName} on ${spot.route.name}`;

  if (onList) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          openNotes("working");
        }}
        aria-label={`${where} is on your Working on list — open it`}
        title="On your Working on list"
        className={`inline-flex items-center justify-center flex-shrink-0 rounded-md text-emerald-400 hover:bg-gray-800 ${size}`}
      >
        <Check size={15} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        const { text, links } = encounterItem(spot);
        const id = addItem(text, links);
        if (id)
          useUndoStore.getState().show(`Added “${text}” to Working on`, () => useWorkingOnStore.getState().remove(id));
      }}
      aria-label={`Add ${where} to Working on`}
      title="Add to Working on (Notes)"
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 ${size}`}
    >
      <ListPlus size={15} aria-hidden="true" />
    </button>
  );
}
