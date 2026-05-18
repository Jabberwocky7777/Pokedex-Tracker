import { useMemo } from "react";
import type { FilteredPokemon } from "./usePokemonFilter";

export function useProgress(
  filteredPokemon: FilteredPokemon[],
  caughtIds: number[],
  pendingIds: number[] = []
) {
  return useMemo(() => {
    const caughtSet = new Set(caughtIds);
    const pendingSet = new Set(pendingIds);
    const total = filteredPokemon.length;
    const caught = filteredPokemon.filter((p) => caughtSet.has(p.id)).length;
    const pending = filteredPokemon.filter((p) => pendingSet.has(p.id) && !caughtSet.has(p.id)).length;
    const percentage = total > 0 ? Math.round((caught / total) * 100) : 0;
    return { caught, total, percentage, pending };
  }, [filteredPokemon, caughtIds, pendingIds]);
}
