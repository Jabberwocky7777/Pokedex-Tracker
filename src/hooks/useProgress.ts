import { useMemo } from "react";
import type { FilteredPokemon } from "./usePokemonFilter";

export function useProgress(
  filteredPokemon: FilteredPokemon[],
  caughtIds: number[]
) {
  return useMemo(() => {
    const caughtSet = new Set(caughtIds);
    const total = filteredPokemon.length;
    const caught = filteredPokemon.filter((p) => caughtSet.has(p.id)).length;
    const percentage = total > 0 ? Math.round((caught / total) * 100) : 0;
    return { caught, total, percentage };
  }, [filteredPokemon, caughtIds]);
}
