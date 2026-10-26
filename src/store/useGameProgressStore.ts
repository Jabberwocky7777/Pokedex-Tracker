import { createEntryStore } from "./createEntryStore";
import type { GameProgress } from "../lib/game-progress";

/**
 * Game Progress: badges and story milestones, keyed by game ("platinum").
 * Synced as the `gameProgress` section, merged game by game. Change it through
 * lib/progress-actions.ts, which adds the undo toast and the change-log entry.
 */
export const useGameProgressStore = createEntryStore<GameProgress>("pokedex-game-progress-v1");
