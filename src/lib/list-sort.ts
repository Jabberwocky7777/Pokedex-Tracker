/**
 * Sorting the tracker's list view by a column. The sort lives in the address
 * (#/tracker?sort=caught-desc, see lib/url-route.ts) so a refresh keeps it. Pure.
 */
import type { Pokemon } from "../types";

export const LIST_SORT_KEYS = ["dex", "name", "type", "games", "caught", "note"] as const;
export type ListSortKey = (typeof LIST_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export interface ListSort { key: ListSortKey; dir: SortDir }

/** Which way a column sorts the first time its header is clicked */
const FIRST_DIR: Record<ListSortKey, SortDir> = { dex: "asc", name: "asc", type: "asc", games: "desc", caught: "desc", note: "asc" };

/** "caught-desc" → { key: "caught", dir: "desc" }; null for anything else. */
export function parseListSort(value: string | null | undefined): ListSort | null {
  const match = value?.match(/^([a-z]+)-(asc|desc)$/);
  if (!match || !LIST_SORT_KEYS.includes(match[1] as ListSortKey)) return null;
  return { key: match[1] as ListSortKey, dir: match[2] as SortDir };
}

export const listSortParam = (sort: ListSort): string => `${sort.key}-${sort.dir}`;

/** Clicking a header: the same column flips direction, another starts in its usual one. */
export function nextSort(current: ListSort | null, key: ListSortKey): ListSort {
  if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: FIRST_DIR[key] };
}

export interface SortContext {
  /** The number shown (regional in a regional dex) */
  displayNumber: (p: Pokemon) => number;
  /** When it was marked caught — undefined when it isn't caught, 0 when caught but undated */
  caughtAt: (id: number) => number | undefined;
  /** How many of the generation's games it can be had in */
  gamesCount: (p: Pokemon) => number;
  /** Its note in this generation, or "" */
  note: (id: number) => string;
}

/**
 * Sorts the rows. Rows without a value for the column (not caught, no note) go
 * last whichever way it runs; ties fall back to dex order.
 */
export function sortRows<T extends Pokemon>(rows: readonly T[], sort: ListSort | null, ctx: SortContext): T[] {
  if (!sort || (sort.key === "dex" && sort.dir === "asc")) return [...rows];
  const sign = sort.dir === "asc" ? 1 : -1;
  const value = (p: T): number | string | undefined => {
    switch (sort.key) {
      case "dex": return ctx.displayNumber(p);
      case "name": return p.displayName.toLowerCase();
      case "type": return p.types.join("/");
      case "games": return ctx.gamesCount(p);
      case "caught": return ctx.caughtAt(p.id);
      case "note": return ctx.note(p.id).trim().toLowerCase() || undefined;
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (va === undefined || vb === undefined) {
      if (va !== vb) return va === undefined ? 1 : -1;
    } else if (va !== vb) {
      return (va < vb ? -1 : 1) * sign;
    }
    return ctx.displayNumber(a) - ctx.displayNumber(b);
  });
}
