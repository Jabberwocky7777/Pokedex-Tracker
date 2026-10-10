import { useMemo } from "react";
import { useSaveStore } from "../store/useSaveStore";
import { allocatePending, breedingHints, type Allocation } from "../lib/save/living-dex";
import { profileMons } from "../lib/save/summary";
import { SAVE_GEN, type ProfileMons, type SpeciesMap } from "../lib/save/types";

/** Every imported save profile paired with its Pokémon (from the synced summaries). */
export function useProfileMons(): ProfileMons[] {
  const profiles = useSaveStore((s) => s.profiles);
  const summaries = useSaveStore((s) => s.summaries);
  return useMemo(() => profileMons(profiles, summaries), [profiles, summaries]);
}

export interface SavesOverview {
  profiles: ProfileMons[];
  allocation: Allocation;
  /** Missing baby → the owned later stage to breed it from */
  breeding: Map<number, number>;
}

/**
 * What all imported saves say together: owned, placed, pending-by-allocation
 * and breeding advice. Null when nothing is imported or the generation isn't
 * the one the saves belong to.
 */
export function useSavesOverview(dex: SpeciesMap, generation: number): SavesOverview | null {
  const profiles = useProfileMons();
  return useMemo(() => {
    if (profiles.length === 0 || generation !== SAVE_GEN) return null;
    const allocation = allocatePending(profiles, dex);
    return { profiles, allocation, breeding: breedingHints(allocation.owned, dex) };
  }, [profiles, dex, generation]);
}
