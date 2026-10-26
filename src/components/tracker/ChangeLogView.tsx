import { useState } from "react";
import { ChevronDown, History, Redo2, Undo2 } from "lucide-react";
import type { Pokemon } from "../../types";
import { useChangeLogStore } from "../../store/useChangeLogStore";
import { useDexStore } from "../../store/useDexStore";
import { describeChanges, groupByPokemon, isApplied, summarizeChanges, type LogEntry } from "../../lib/change-log";
import { redoLogEntry, undoLogEntry } from "../../lib/dex-actions";
import { formatDexNumber, getGenSprite } from "../../lib/pokemon-display";
import { changeName, type ProgressChange } from "../../lib/game-progress";
import { GAME_ABBR, type GameVersion } from "../../types";
import { PokemonLink } from "../shared/links";

interface Props {
  pokemonMap: Map<number, Pokemon>;
}

const KIND_LABEL: Record<LogEntry["kind"], string> = {
  marks: "Marked by hand",
  import: "Save import",
  clear: "Clear",
  revert: "Import reverted",
  progress: "Game Progress",
};

/** "Coal Badge (Pt) ticked" */
const progressWords = (c: ProgressChange) =>
  `${changeName(c)} (${GAME_ABBR[c.game as GameVersion] ?? c.game}) ${c.value ? "ticked" : "unticked"}`;

function formatTime(at: number): string {
  return new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The tracker's change log: every import, clear and run of hand-made marks on
 * this device, with what each Pokémon changed from and to, and a way back.
 */
export default function ChangeLogView({ pokemonMap }: Props) {
  const entries = useChangeLogStore((s) => s.entries);
  const clear = useChangeLogStore((s) => s.clear);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  function undo(entry: LogEntry, pokemonId?: number) {
    const { reverted, skipped } = undoLogEntry(entry.id, pokemonId);
    setNotice(
      skipped > 0
        ? `Put back ${reverted} mark${reverted === 1 ? "" : "s"}; left ${skipped} alone because ${skipped === 1 ? "it has" : "they have"} been changed again since.`
        : null,
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2" style={{ fontFamily: "var(--theme-font-display)" }}>
            <History size={18} /> Change log
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            What changed on this device, newest first: save imports, clears, and the Pokémon you marked by hand
            (marks made within a few minutes of each other are grouped). Undo an entry, or open it and undo one Pokémon.
            Changes that arrive from another device by sync aren't listed.
          </p>
        </div>
        {entries.length > 0 && (
          confirmingClear ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => { clear(); setConfirmingClear(false); setNotice(null); }}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 text-white"
              >
                Empty the log
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              title="Forget the list. Your marks stay as they are."
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 flex-shrink-0"
            >
              Empty log
            </button>
          )
        )}
      </div>

      {notice && (
        <div role="status" className="text-xs text-amber-200 bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-2">
          {notice}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-10 text-center">
          Nothing yet. Mark a Pokémon or import a save and it will show up here.
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              pokemonMap={pokemonMap}
              open={open === entry.id}
              onToggle={() => setOpen(open === entry.id ? null : entry.id)}
              onUndo={(pokemonId) => undo(entry, pokemonId)}
              onRedo={() => { redoLogEntry(entry.id); setNotice(null); }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryCard({ entry, pokemonMap, open, onToggle, onUndo, onRedo }: {
  entry: LogEntry;
  pokemonMap: Map<number, Pokemon>;
  open: boolean;
  onToggle: () => void;
  onUndo: (pokemonId?: number) => void;
  onRedo: () => void;
}) {
  const groups = groupByPokemon(entry.changes);
  const undone = entry.undoneAt !== undefined;
  const nameOf = (id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`;
  // One Pokémon marked by hand reads best as its own from → to
  const progress = entry.progress ?? [];
  const title = entry.kind === "progress"
    ? progress.length === 1 ? progressWords(progress[0]) : `${progress.length} Game Progress changes`
    : entry.kind === "marks"
    ? groups.length === 1
      ? `${nameOf(groups[0].id)}: ${describeChanges(groups[0].changes)}`
      : `${groups.length} Pokémon marked`
    : entry.label;

  return (
    <li className={`bg-gray-900 border rounded-xl overflow-hidden ${undone ? "border-gray-800 opacity-70" : "border-gray-800"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <ChevronDown size={16} className={`text-gray-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="min-w-0">
            <span className={`block text-sm font-medium truncate ${undone ? "text-gray-400 line-through" : "text-gray-100"}`}>{title}</span>
            <span className="block text-xs text-gray-500 truncate">
              {formatTime(entry.at)} · Gen {entry.gen} · {KIND_LABEL[entry.kind]}
              {entry.changes.length > 0 && (groups.length > 1 || entry.kind !== "marks") ? ` · ${summarizeChanges(entry.changes)}` : ""}
              {entry.kind !== "progress" && progress.length > 0 ? ` · ${progress.length} Game Progress` : ""}
              {undone ? " · undone" : ""}
            </span>
          </span>
        </button>
        {undone ? (
          <button
            onClick={onRedo}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 flex-shrink-0"
          >
            <Redo2 size={14} /> Redo
          </button>
        ) : (
          <button
            onClick={() => onUndo()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex-shrink-0"
          >
            <Undo2 size={14} /> Undo{groups.length + progress.length > 1 ? " all" : ""}
          </button>
        )}
      </div>

      {open && groups.length > 0 && <EntryRows entry={entry} groups={groups} pokemonMap={pokemonMap} onUndo={onUndo} />}
      {open && progress.length > 0 && (
        <ul className="border-t border-gray-800 divide-y divide-gray-800/60">
          {progress.map((c) => (
            <li key={`${c.game}-${c.kind}-${c.id}`} className="px-3 py-1.5 text-sm text-gray-300">{progressWords(c)}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function EntryRows({ entry, groups, pokemonMap, onUndo }: {
  entry: LogEntry;
  groups: ReturnType<typeof groupByPokemon>;
  pokemonMap: Map<number, Pokemon>;
  onUndo: (pokemonId: number) => void;
}) {
  // Subscribed here, so only an open entry re-renders when marks change
  const caught = useDexStore((s) => s.caughtByGen[entry.gen]);
  const pending = useDexStore((s) => s.pendingByGen[entry.gen]);
  const shiny = useDexStore((s) => s.shinyByGen[entry.gen]);
  const placed = useDexStore((s) => s.placedByGen[entry.gen]);
  const current = { caught: caught ?? [], pending: pending ?? [], shiny: shiny ?? [], placed: placed ?? [] };
  const undone = entry.undoneAt !== undefined;

  return (
    <ul className="border-t border-gray-800 divide-y divide-gray-800/60 max-h-[60vh] overflow-y-auto">
      {groups.map(({ id, changes }) => {
        const pokemon = pokemonMap.get(id);
        const stillApplied = changes.every((c) => isApplied(c, current));
        return (
          <li key={id} className="flex items-center gap-2 px-3 py-1.5">
            {pokemon && (
              <img src={getGenSprite(pokemon, entry.gen)} alt="" loading="lazy" className="w-8 h-8 object-contain pixelated flex-shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-gray-200 truncate">
                <span className="text-gray-500 text-xs mr-1.5">{formatDexNumber(id)}</span>
                <PokemonLink id={id} to="tracker" generation={entry.gen}>{pokemon?.displayName ?? `#${id}`}</PokemonLink>
              </span>
              <span className="block text-xs text-gray-400 truncate">{describeChanges(changes)}</span>
            </span>
            {!undone && (
              stillApplied ? (
                <button
                  onClick={() => onUndo(id)}
                  aria-label={`Undo for ${pokemon?.displayName ?? id}`}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white flex-shrink-0"
                >
                  Undo
                </button>
              ) : (
                <span className="text-[11px] text-gray-500 flex-shrink-0" title="This Pokémon's marks have been changed again since this entry, so undoing would not put back what the entry describes.">
                  changed since
                </span>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
