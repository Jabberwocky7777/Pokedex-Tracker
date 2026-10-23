import PokemonRow from "./PokemonRow";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";
import { useSettingsStore } from "../../store/useSettingsStore";
import GestureHint from "../tracker/GestureHint";
import { useDexStore } from "../../store/useDexStore";
import { useNotesStore, noteKey } from "../../store/useNotesStore";
import { generationVersions } from "../../lib/generation";
import { listSortParam, nextSort, parseListSort, sortRows, type ListSort, type ListSortKey } from "../../lib/list-sort";
import { ArrowDown, ArrowUp } from "lucide-react";

interface Props {
  filteredPokemon: FilteredPokemon[];
  caughtIds: number[];
  pendingIds: number[];
  placedIds: number[];
  selectedPokemonId: number | null;
  onSelectPokemon: (id: number) => void;
  onToggleCaught: (id: number) => void;
  onTogglePending: (id: number) => void;
}

const MOBILE_SORTS: [string, string][] = [
  ["dex-asc", "Number"], ["name-asc", "Name"], ["caught-desc", "Caught, newest"], ["caught-asc", "Caught, oldest"],
  ["games-desc", "Most games"], ["note-asc", "Has a note"],
];

export default function ListView({
  filteredPokemon,
  caughtIds,
  pendingIds,
  placedIds,
  selectedPokemonId,
  onSelectPokemon,
  onToggleCaught,
  onTogglePending,
}: Props) {
  const caughtSet = new Set(caughtIds);
  const pendingSet = new Set(pendingIds);
  const placedSet = new Set(placedIds);
  const showUncaughtOnly = useSettingsStore((s) => s.showUncaughtOnly);
  const toggleShowUncaughtOnly = useSettingsStore((s) => s.toggleShowUncaughtOnly);
  const quickMark = useSettingsStore((s) => s.quickMark);

  // Column sort, kept in the address (#/tracker?sort=caught-desc)
  const sortParam = useSettingsStore((s) => s.listSort);
  const setListSort = useSettingsStore((s) => s.setListSort);
  const sort = parseListSort(sortParam);
  const onSort = (key: ListSortKey) => setListSort(listSortParam(nextSort(sort, key)));
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const caughtStamps = useDexStore((s) => s.updatedAt.caught?.[activeGeneration]);
  const notes = useNotesStore((s) => s.entries);
  const noteOf = (id: number) => {
    const entry = notes[noteKey(activeGeneration, id)];
    return entry && !entry.removed ? entry.text : "";
  };
  const caughtAt = (id: number) => (caughtSet.has(id) ? caughtStamps?.[id] ?? 0 : undefined);
  const genVersions = generationVersions(activeGeneration) as string[];

  const shown = showUncaughtOnly
    ? filteredPokemon.filter((p) => !caughtSet.has(p.id))
    : filteredPokemon;
  const displayPokemon = sortRows(shown, sort, {
    displayNumber: (p) => (p as FilteredPokemon).displayNumber,
    caughtAt,
    gamesCount: (p) => p.availableInGames.filter((g) => genVersions.includes(g)).length,
    note: noteOf,
  });

  return (
    <div className="p-4">
      <GestureHint />
      {/* List toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <button
          onClick={toggleShowUncaughtOnly}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
            showUncaughtOnly
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {showUncaughtOnly ? "Showing Uncaught" : "Show Uncaught Only"}
        </button>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {displayPokemon.length} Pokémon
        </span>
        {/* On a phone most columns are hidden, so the sort is a menu */}
        <label className="sm:hidden ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          Sort
          <select
            value={sortParam ?? "dex-asc"}
            onChange={(e) => setListSort(e.target.value === "dex-asc" ? null : e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          >
            {MOBILE_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-700 sticky top-0 bg-gray-950 z-10">
            <SortHeader sortKey="dex" sort={sort} onSort={onSort} className="pl-4 pr-2 w-12 text-right" label="#" />
            <th className="py-2 px-2 w-12" />
            <SortHeader sortKey="name" sort={sort} onSort={onSort} label="Name" />
            <SortHeader sortKey="type" sort={sort} onSort={onSort} label="Type" className="hidden sm:table-cell" />
            <SortHeader sortKey="games" sort={sort} onSort={onSort} label="Games" className="hidden md:table-cell" title="How many of the generation's games it can be had in" />
            <SortHeader sortKey="caught" sort={sort} onSort={onSort} label="Caught" className="hidden sm:table-cell" title="When it was marked caught" />
            <SortHeader sortKey="note" sort={sort} onSort={onSort} label="Note" className="hidden lg:table-cell" />
            {/* Pending column */}
            <th className="py-2 px-2 w-10" title="Pending (have pre-evolution, need to evolve)">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </th>
            {/* Caught column */}
            <th className="py-2 pr-4 pl-2 w-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayPokemon.map((pokemon) => (
            <PokemonRow
              key={pokemon.id}
              pokemon={pokemon}
              isCaught={caughtSet.has(pokemon.id)}
              isPending={pendingSet.has(pokemon.id)}
              isPlaced={placedSet.has(pokemon.id)}
              caughtAt={caughtAt(pokemon.id)}
              note={noteOf(pokemon.id)}
              inlineDate={sort?.key === "caught"}
              isSelected={selectedPokemonId === pokemon.id}
              quickMark={quickMark}
              onSelect={() => onSelectPokemon(pokemon.id)}
              onToggleCaught={() => onToggleCaught(pokemon.id)}
              onTogglePending={() => onTogglePending(pokemon.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A column header that sorts the list; aria-sort says which way. */
function SortHeader({ sortKey, sort, onSort, label, className = "", title }: {
  sortKey: ListSortKey;
  sort: ListSort | null;
  onSort: (key: ListSortKey) => void;
  label: string;
  className?: string;
  title?: string;
}) {
  // No sort in the address is dex order
  const active = sort ? sort.key === sortKey : sortKey === "dex";
  const dir = sort?.dir ?? "asc";
  return (
    <th className={`py-1 px-2 text-left ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        onClick={() => onSort(sortKey)}
        title={title ? `${title} — sort` : `Sort by ${label === "#" ? "number" : label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 py-1 text-xs font-medium uppercase tracking-wider rounded ${active ? "text-gray-200" : "text-gray-500 hover:text-gray-300"}`}
      >
        {label}
        {active && (dir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
      </button>
    </th>
  );
}
