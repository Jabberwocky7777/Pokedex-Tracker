import { useState, useEffect } from "react";
import type { Pokemon } from "../types";
import type { VersionGroup, LearnMethod } from "../lib/move-fetch";
import { fetchLearnset, GEN3_VERSION_GROUPS, GEN4_VERSION_GROUPS } from "../lib/move-fetch";
import type { AttackdexDetail } from "../lib/attackdex-fetch";
import { fetchAttackdexDetail } from "../lib/attackdex-fetch";

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

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

const ALL_VERSION_GROUPS: VersionGroup[] = [
  ...GEN3_VERSION_GROUPS.map((vg) => vg.id),
  ...GEN4_VERSION_GROUPS.map((vg) => vg.id),
];

export function useAttackdex(
  slug: string | null,
  allPokemon: Pokemon[],
  activeGeneration: number
): AttackdexResult {
  const [detail, setDetail] = useState<AttackdexDetail | null>(null);
  const [learners, setLearners] = useState<Map<VersionGroup, LearnerEntry[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setDetail(null);
      setLearners(new Map());
      setLoading(false);
      setLearnersLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setLearnersLoading(true);
    setError(null);
    setDetail(null);
    setLearners(new Map());

    fetchAttackdexDetail(slug)
      .then(async (d) => {
        if (cancelled) return;
        setDetail(d);
        setLoading(false);

        // Phase 2: fetch learnsets for all Pokémon in the current generation range
        const maxId = activeGeneration === 3 ? 386 : 493;
        const filteredPokemon = d.learnedByPokemon
          .map((entry) => allPokemon.find((p) => p.name === entry.name))
          .filter((p): p is Pokemon => p != null && p.id <= maxId);

        const tasks = filteredPokemon.map((p) => () => fetchLearnset(p.id));
        const learnsets = await runWithConcurrency(tasks, 10);
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
            const entry = moves.find((m) => m.move === slug);
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
            return a.displayName.localeCompare(b.displayName);
          });
          learnersMap.set(vg, list);
        }

        setLearners(learnersMap);
        setLearnersLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load move data");
        setLoading(false);
        setLearnersLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, activeGeneration]);

  return { detail, learners, loading, learnersLoading, error };
}
