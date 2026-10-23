import { useId, useMemo, useRef, useState } from "react";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useJournalStore, JOURNAL_TEXT_MAX_LENGTH } from "../../store/useJournalStore";
import { useChangeLogStore } from "../../store/useChangeLogStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { addJournalEntry, deleteJournalEntry, journalEntries, localDate, todaysCatches, updateJournalEntry, type LiveJournalEntry } from "../../lib/journal";
import { generationOfVersion, generationVersions } from "../../lib/generation";
import { GameChip } from "../shared/GameChip";

interface Props {
  allPokemon: Pokemon[];
}

const ALL_GAMES = [...generationVersions(3), ...generationVersions(4)] as GameVersion[];
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
/** "YYYY-MM-DD" → a readable day, read as a local date (not UTC midnight) */
const showDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return longDate.format(new Date(y, m - 1, d));
};

/** Dated entries about a run, each tagged with a game; newest first, filterable by game. */
export default function JournalPanel({ allPokemon }: Props) {
  const entries = useJournalStore((s) => s.entries);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const [filter, setFilter] = useState<GameVersion | "">("");
  const all = useMemo(() => journalEntries(entries), [entries]);
  const shown = useMemo(() => journalEntries(entries, filter || null), [entries, filter]);
  const usedGames = ALL_GAMES.filter((g) => all.some((e) => e.game === g));
  const defaultGame = all[0]?.game ?? generationVersions(activeGeneration)[0] as GameVersion;
  const filterId = useId();

  return (
    <section className="flex flex-col gap-5" aria-label="Journal">
      <EntryForm allPokemon={allPokemon} defaultGame={defaultGame} submitLabel="Add entry" onSubmit={(e) => addJournalEntry(e) !== null} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {all.length === 0 ? "No entries yet." : `${shown.length} entr${shown.length === 1 ? "y" : "ies"}${filter ? ` for ${GAME_LABELS[filter]}` : ""}`}
        </p>
        {usedGames.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor={filterId} className="text-xs text-gray-400">Game</label>
            <select
              id={filterId}
              value={filter}
              onChange={(e) => setFilter(e.target.value as GameVersion | "")}
              className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All games</option>
              {usedGames.map((g) => <option key={g} value={g}>{GAME_LABELS[g]}</option>)}
            </select>
          </div>
        )}
      </div>

      <ol className="flex flex-col gap-3">
        {shown.map((entry) => <EntryCard key={entry.id} entry={entry} allPokemon={allPokemon} />)}
      </ol>
    </section>
  );
}

function EntryCard({ entry, allPokemon }: { entry: LiveJournalEntry; allPokemon: Pokemon[] }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li>
        <EntryForm
          allPokemon={allPokemon}
          initial={entry}
          defaultGame={entry.game}
          submitLabel="Save"
          onSubmit={(e) => { updateJournalEntry(entry.id, e); setEditing(false); return true; }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="px-4 py-3 rounded-xl bg-gray-900 border border-gray-800">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-100">{showDate(entry.date)}</h3>
        <GameChip game={entry.game} size="sm" />
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => setEditing(true)} aria-label="Edit entry" title="Edit" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800">
            <Pencil size={15} />
          </button>
          <button onClick={() => deleteJournalEntry(entry.id)} aria-label="Delete entry" title="Delete" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-200 whitespace-pre-line break-words">{entry.text}</p>
    </li>
  );
}

/** The form for a new entry, and for editing one. */
function EntryForm({ allPokemon, initial, defaultGame, submitLabel, onSubmit, onCancel }: {
  allPokemon: Pokemon[];
  initial?: LiveJournalEntry;
  defaultGame: GameVersion;
  submitLabel: string;
  /** Returns whether it was saved, so a new-entry form knows to empty itself */
  onSubmit: (entry: { date: string; game: GameVersion; text: string }) => boolean;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(() => initial?.date ?? localDate(Date.now()));
  const [game, setGame] = useState<GameVersion>(initial?.game ?? defaultGame);
  const [text, setText] = useState(initial?.text ?? "");
  const [nothingToday, setNothingToday] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const log = useChangeLogStore((s) => s.entries);
  const id = useId();
  const nameOf = useMemo(() => {
    const byId = new Map(allPokemon.map((p) => [p.id, p.displayName]));
    return (pokemonId: number) => byId.get(pokemonId) ?? `#${pokemonId}`;
  }, [allPokemon]);

  function insertTodaysCatches() {
    const summary = todaysCatches(log, generationOfVersion(game) ?? 4, Date.now(), nameOf);
    setNothingToday(summary === null);
    if (!summary) return;
    setText((t) => (t.trim() ? `${t.trimEnd()}\n${summary}.` : `${summary}.`));
    requestAnimationFrame(() => textRef.current?.focus());
  }

  function submit() {
    if (!text.trim()) return;
    if (onSubmit({ date, game, text }) && !initial) {
      setText("");
      setNothingToday(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-date`} className="text-xs text-gray-400">Date</label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-game`} className="text-xs text-gray-400">Game</label>
          <select
            id={`${id}-game`}
            value={game}
            onChange={(e) => setGame(e.target.value as GameVersion)}
            className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          >
            {ALL_GAMES.map((g) => <option key={g} value={g}>{GAME_LABELS[g]}</option>)}
          </select>
        </div>
        <button
          onClick={insertTodaysCatches}
          title="Add a summary of today's marks from the change log"
          className="self-end flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200"
        >
          <ClipboardList size={15} aria-hidden="true" />
          Today&apos;s catches
        </button>
      </div>
      {nothingToday && <p className="text-xs text-gray-400">Nothing was caught or marked in Generation {generationOfVersion(game)} today.</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-text`} className="text-xs text-gray-400">What happened</label>
        <textarea
          ref={textRef}
          id={`${id}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={JOURNAL_TEXT_MAX_LENGTH}
          rows={initial ? 4 : 3}
          placeholder="What you did, found or want to remember about this session…"
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-y"
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200">Cancel</button>
        )}
        <button onClick={submit} disabled={!text.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white font-medium">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
