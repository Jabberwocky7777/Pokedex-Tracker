import { useState, useEffect } from "react";
import {
  fetchLearnset,
  fetchAllMoveDetails,
  type PokemonLearnset,
  type MoveDetail,
} from "../../lib/move-fetch";

export interface PokemonMovesResult {
  learnset: PokemonLearnset | null;
  moveDetails: Map<string, MoveDetail>;
  loading: boolean;
  error: string | null;
}

// Suppressed: react-hooks/set-state-in-effect — these setState calls synchronize
// React state with an external async data source (PokéAPI). The synchronous setState
// calls in the null-branch and the async callbacks are the correct pattern here;
// the linter rule is intended for simpler derived-state cases, not async data fetching.
// This pattern was present in the original PokedexTab.tsx and is correct for this use case.
export function usePokemonMoves(pokemonId: number | null): PokemonMovesResult {
  const [learnset, setLearnset] = useState<PokemonLearnset | null>(null);
  const [moveDetails, setMoveDetails] = useState<Map<string, MoveDetail>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pokemonId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLearnset(null);
      setMoveDetails(new Map());
      return;
    }

    let cancelled = false;
     
    setLoading(true);
    setError(null);
     
    setLearnset(null);
    setMoveDetails(new Map());

    fetchLearnset(pokemonId)
      .then((ls) => {
        if (cancelled) return;
        setLearnset(ls);
        const allSlugs = new Set<string>();
        for (const moves of Object.values(ls)) for (const m of moves) allSlugs.add(m.move);
        return fetchAllMoveDetails([...allSlugs]);
      })
      .then((details) => {
        if (cancelled || !details) return;
        setMoveDetails(details);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [pokemonId]);

  return { learnset, moveDetails, loading, error };
}
