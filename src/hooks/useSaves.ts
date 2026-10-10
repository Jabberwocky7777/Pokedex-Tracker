import { useMemo } from "react";
import { useSaveStore } from "../store/useSaveStore";
import { allocatePending, breedingHints, type Allocation } from "../lib/save/living-dex";
import { profileMons } from "../lib/save/summary";
import { genConfigOf, type ProfileMons, type SpeciesMap } from "../lib/save/types";

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
 * and breeding advice, for the saves of one generation. Null when none of the
 * imported saves belong to it.
 */
export function useSavesOverview(dex: SpeciesMap, generation: number): SavesOverview | null {
  const all = useProfileMons();
  return useMemo(() => {
    const profiles = all.filter((p) => genConfigOf(p.profile.family).gen === generation);
    if (profiles.length === 0) return null;
    const { maxSpecies } = genConfigOf(profiles[0].profile.family);
    const allocation = allocatePending(profiles, dex, maxSpecies);
    return { profiles, allocation, breeding: breedingHints(allocation.owned, dex, maxSpecies) };
  }, [all, dex, generation]);
}
