import { loadMoveIndex } from "./move-fetch";
import { moveDisplayName } from "./move-names";

export interface MoveSummary {
  slug: string;
  displayName: string;
}

let moveList: MoveSummary[] | null = null;

/** Every Gen I–IV move, in move-id order, for the search boxes. */
export async function fetchMoveList(): Promise<MoveSummary[]> {
  moveList ??= (await loadMoveIndex()).records.map((record) => ({
    slug: record.slug,
    displayName: moveDisplayName(record.slug),
  }));
  return moveList;
}
