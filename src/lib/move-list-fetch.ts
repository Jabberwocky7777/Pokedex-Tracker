import { slugToDisplayName } from "./move-fetch";

export interface MoveSummary {
  slug: string;
  displayName: string;
}

let moveListCache: MoveSummary[] | null = null;
let fetchPromise: Promise<MoveSummary[]> | null = null;

export async function fetchMoveList(): Promise<MoveSummary[]> {
  if (moveListCache) return moveListCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("https://pokeapi.co/api/v2/move?limit=467")
    .then((res) => {
      if (!res.ok) throw new Error(`PokéAPI: failed to fetch move list (${res.status})`);
      return res.json() as Promise<{ results: { name: string }[] }>;
    })
    .then((data) => {
      const list: MoveSummary[] = data.results.map((r) => ({
        slug: r.name,
        displayName: slugToDisplayName(r.name),
      }));
      moveListCache = list;
      fetchPromise = null;
      return list;
    });

  return fetchPromise;
}
