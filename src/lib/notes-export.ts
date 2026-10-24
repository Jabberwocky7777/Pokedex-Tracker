/**
 * "Export notes" in Settings: the Working on list, every per-Pokémon note and
 * the run journal as one Markdown file. Pure — the caller downloads or copies it.
 */
import type { Entries } from "./entries";
import { orderedItems, STATUS_LABELS } from "./working-on";
import { notesIn } from "./notes";
import { journalEntries } from "./journal";
import type { WorkItem, WorkLink } from "../store/useWorkingOnStore";
import type { PokemonNote } from "../store/useNotesStore";
import type { JournalEntry } from "../store/useJournalStore";
import { GAME_LABELS } from "../types";

export interface NotesExportInput {
  workingOn: Entries<WorkItem> | undefined;
  notes: Entries<PokemonNote> | undefined;
  journal: Entries<JournalEntry> | undefined;
  /** Generations to list notes for, in order */
  generations: readonly number[];
  nameOf: (id: number) => string;
  now: number;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function linkText(link: WorkLink | undefined, nameOf: (id: number) => string): string {
  if (!link) return "";
  if (link.kind === "pokemon") return ` (${nameOf(link.id)}${link.generation ? `, Gen ${link.generation}` : ""})`;
  if (link.kind === "route") return ` (${link.name})`;
  return ` (${GAME_LABELS[link.game] ?? link.game})`;
}

/** Text as a Markdown block quote, line by line, so line breaks survive. */
const quote = (text: string) => text.trim().split("\n").map((line) => `> ${line}`.trimEnd()).join("\n");

export function notesMarkdown({ workingOn, notes, journal, generations, nameOf, now }: NotesExportInput): string {
  const out: string[] = [`# Pokédex Tracker notes`, ``, `Exported ${day(now)}.`, ``];

  const items = orderedItems(workingOn);
  out.push(`## Working on`, ``);
  if (items.length === 0) out.push(`Nothing on the list.`, ``);
  for (const status of ["doing", "todo", "done"] as const) {
    const group = items.filter((i) => i.status === status);
    if (group.length === 0) continue;
    out.push(`### ${STATUS_LABELS[status]}`, ``);
    for (const item of group) {
      out.push(`- [${status === "done" ? "x" : " "}] ${item.text}${linkText(item.link, nameOf)}`);
      // The note as indented lines, so it stays part of the list item
      if (item.note) out.push(...item.note.split("\n").map((line) => (line.trim() ? `  ${line}` : ``)));
    }
    out.push(``);
  }

  out.push(`## Pokémon notes`, ``);
  let anyNotes = false;
  for (const gen of generations) {
    const rows = notesIn(notes, gen).sort((a, b) => a.pokemonId - b.pokemonId);
    if (rows.length === 0) continue;
    anyNotes = true;
    out.push(`### Generation ${gen}`, ``);
    for (const row of rows) {
      out.push(`#### #${String(row.pokemonId).padStart(3, "0")} ${nameOf(row.pokemonId)}`, ``, quote(row.text), ``, `_Last edited ${day(row.at)}_`, ``);
    }
  }
  if (!anyNotes) out.push(`No notes.`, ``);

  const entries = journalEntries(journal);
  out.push(`## Journal`, ``);
  if (entries.length === 0) out.push(`No entries.`, ``);
  for (const entry of entries) {
    out.push(`### ${entry.date} · ${GAME_LABELS[entry.game] ?? entry.game}`, ``, entry.text.trim(), ``);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
