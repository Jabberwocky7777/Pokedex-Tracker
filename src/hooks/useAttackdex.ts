import { useState, useEffect } from "react";
import type { Pokemon } from "../types";
import type { VersionGroup, LearnMethod } from "../lib/move-fetch";
import { fetchLearnsets, GEN3_VERSION_GROUPS, GEN4_VERSION_GROUPS } from "../lib/move-fetch";
import type { AttackdexDetail } from "../lib/attackdex-fetch";
import { fetchAttackdexDetail } from "../lib/attackdex-fetch";
import { generationMaxId } from "../lib/generation";

export interface LearnerEntry {
  pokemonId: number;
  displayName: string;
  method: LearnMethod;
  level: number;
}

export interface AttackdexResult {
  detail: AttackdexDetail | null;
  learners: Map<VersionGroup, LearnerEntry[]>;
  loading: boolean;
  learnersLoading: boolean;
  error: string | null;
}

interface Loaded {
  key: string;
  detail: AttackdexDetail | null;
  /** Null until the learnsets have been read */
  learners: Map<VersionGroup, LearnerEntry[]> | null;
  error: string | null;
}

const NO_LEARNERS = new Map<VersionGroup, LearnerEntry[]>();

const ALL_VERSION_GROUPS: VersionGroup[] = [
  ...GEN3_VERSION_GROUPS.map((vg) => vg.id),
  ...GEN4_VERSION_GROUPS.map((vg) => vg.id),
];

export function useAttackdex(
  slug: string | null,
  allPokemon: Pokemon[],
  activeGeneration: number
): AttackdexResult {
  // What has loaded, and for which move and generation. Anything loaded for
  // another key is stale, so loading is derived rather than set.
  const key = slug ? `${slug}|${activeGeneration}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!slug) return;
    const loadKey = `${slug}|${activeGeneration}`;
    let cancelled = false;

    fetchAttackdexDetail(slug)
      .then(async (d) => {
        if (cancelled) return;
        setLoaded({ key: loadKey, detail: d, learners: null, error: null });

        // Phase 2: the learnsets of every learner in the current generation's range
        const maxId = generationMaxId(activeGeneration);
        const byId = new Map(allPokemon.map((p) => [p.id, p]));
        const filteredPokemon = d.learnedBy
          .map((id) => byId.get(id))
          .filter((p): p is Pokemon => p != null && p.id <= maxId);

        const learnsets = await fetchLearnsets(filteredPokemon.map((p) => p.id));
        if (cancelled) return;

        const learnersMap = new Map<VersionGroup, LearnerEntry[]>();
        for (const vg of ALL_VERSION_GROUPS) {
          learnersMap.set(vg, []);
        }

        for (let i = 0; i < filteredPokemon.length; i++) {
          const pokemon = filteredPokemon[i];
          const learnset = learnsets[i];
          if (!learnset) continue;

          for (const vg of ALL_VERSION_GROUPS) {
            const moves = learnset[vg];
            if (!moves) continue;
            const entry = moves.find((m) => m.move === d.name);
            if (!entry) continue;
            learnersMap.get(vg)!.push({
              pokemonId: pokemon.id,
              displayName: pokemon.displayName,
              method: entry.method,
              level: entry.level,
            });
          }
        }

        // Sort each version group's learners: by level (level-up), then TM/HM, then egg, then tutor
        const METHOD_ORDER: Record<string, number> = {
          "level-up": 0,
          "machine":  1,
          "egg":      2,
          "tutor":    3,
        };

        for (const [vg, list] of learnersMap) {
          list.sort((a, b) => {
            const ao = METHOD_ORDER[a.method] ?? 9;
            const bo = METHOD_ORDER[b.method] ?? 9;
            if (ao !== bo) return ao - bo;
            if (a.method === "level-up") return a.level - b.level;
            return a.pokemonId - b.pokemonId;
          });
          learnersMap.set(vg, list);
        }

        setLoaded({ key: loadKey, detail: d, learners: learnersMap, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded({ key: loadKey, detail: null, learners: null, error: err instanceof Error ? err.message : "Failed to load move data" });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, activeGeneration]);

  const current = key !== null && loaded?.key === key ? loaded : null;
  return {
    detail: current?.detail ?? null,
    learners: current?.learners ?? NO_LEARNERS,
    loading: key !== null && current === null,
    learnersLoading: key !== null && (current === null || (current.learners === null && current.error === null)),
    error: current?.error ?? null,
  };
}
