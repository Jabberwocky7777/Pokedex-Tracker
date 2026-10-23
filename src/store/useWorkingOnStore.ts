import { createEntryStore } from "./createEntryStore";
import type { GameVersion } from "../types";

export type WorkStatus = "todo" | "doing" | "done";
export const WORK_STATUSES: WorkStatus[] = ["todo", "doing", "done"];

/** What an item can point at. A Pokémon link may name the generation it belongs to. */
export type WorkLink =
  | { kind: "pokemon"; id: number; generation?: number }
  | { kind: "route"; slug: string; name: string }
  | { kind: "game"; game: GameVersion };

/** One item on the "Working on" list. Kept per account, not per generation. */
export interface WorkItem {
  text: string;
  status: WorkStatus;
  link?: WorkLink;
  createdAt: number;
  /** Manual order: lower first. Fractional, so moving one item changes only that item. */
  order: number;
}

export const WORK_TEXT_MAX_LENGTH = 300;

/** The "Working on" list, keyed by a generated id. Synced as the `workingOn` section, merged item by item. */
export const useWorkingOnStore = createEntryStore<WorkItem>("pokedex-working-on-v1");

export const newWorkItemId = () => `work-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
