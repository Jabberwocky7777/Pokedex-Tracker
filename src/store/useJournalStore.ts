import { createEntryStore } from "./createEntryStore";
import type { GameVersion } from "../types";

/** One dated entry in the run journal, tagged with the game it is about. */
export interface JournalEntry {
  /** The day it is about, "YYYY-MM-DD" (local) */
  date: string;
  game: GameVersion;
  /** Plain text; line breaks are kept */
  text: string;
  createdAt: number;
}

export const JOURNAL_TEXT_MAX_LENGTH = 5000;

/** The run journal, keyed by a generated id. Synced as the `journal` section, merged entry by entry. */
export const useJournalStore = createEntryStore<JournalEntry>("pokedex-journal-v1");

export const newJournalId = () => `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
