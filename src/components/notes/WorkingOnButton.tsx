import { useMemo } from "react";
import { Check, ListPlus } from "lucide-react";
import { useWorkingOnStore } from "../../store/useWorkingOnStore";
import { useUndoStore } from "../../store/useUndoStore";
import { addItem, isOnList, orderedItems } from "../../lib/working-on";
import { openNotes } from "../../lib/navigate";

interface Props {
  pokemonId: number;
  displayName: string;
  generation: number;
  isCaught: boolean;
}

/** "Add to Working on" in the tracker's detail panel; "On your list" (opens the list) once it is there. */
export default function WorkingOnButton({ pokemonId, displayName, generation, isCaught }: Props) {
  const entries = useWorkingOnStore((s) => s.entries);
  const onList = useMemo(() => isOnList(orderedItems(entries), pokemonId, generation), [entries, pokemonId, generation]);
  const base = "w-full py-1.5 min-h-[44px] md:min-h-0 flex items-center justify-center gap-1.5 rounded-lg font-medium text-sm transition-colors border";

  if (onList) {
    return (
      <button onClick={() => openNotes("working")} title="Open the Working on list" className={`${base} bg-gray-800 hover:bg-gray-700 text-emerald-300 border-gray-700`}>
        <Check size={15} aria-hidden="true" />
        On your list
      </button>
    );
  }
  return (
    <button
      onClick={() => {
        const text = isCaught ? displayName : `Catch ${displayName}`;
        const id = addItem(text, { kind: "pokemon", id: pokemonId, generation });
        if (id) useUndoStore.getState().show(`Added “${text}” to Working on`, () => useWorkingOnStore.getState().remove(id));
      }}
      className={`${base} bg-gray-700 hover:bg-gray-600 text-gray-200 border-transparent`}
    >
      <ListPlus size={15} aria-hidden="true" />
      Add to Working on
    </button>
  );
}
