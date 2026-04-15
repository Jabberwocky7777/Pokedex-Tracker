import PokemonRow from "./PokemonRow";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";
import { useSettingsStore } from "../../store/useSettingsStore";

interface Props {
  filteredPokemon: FilteredPokemon[];
  caughtIds: number[];
  pendingIds: number[];
  selectedPokemonId: number | null;
  onSelectPokemon: (id: number) => void;
  onToggleCaught: (id: number) => void;
  onTogglePending: (id: number) => void;
}

export default function ListView({
  filteredPokemon,
  caughtIds,
  pendingIds,
  selectedPokemonId,
  onSelectPokemon,
  onToggleCaught,
  onTogglePending,
}: Props) {
  const caughtSet = new Set(caughtIds);
  const pendingSet = new Set(pendingIds);
  const { showUncaughtOnly, toggleShowUncaughtOnly } = useSettingsStore();

  const displayPokemon = showUncaughtOnly
    ? filteredPokemon.filter((p) => !caughtSet.has(p.id))
    : filteredPokemon;

  return (
    <div className="p-4">
      {/* List toolbar */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggleShowUncaughtOnly}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
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
        <span className="text-xs text-gray-500">
          {displayPokemon.length} Pokémon
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-700 sticky top-0 bg-gray-950 z-10">
            <th className="py-2 pl-4 pr-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
              #
            </th>
            <th className="py-2 px-2 w-12" />
            <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
              Type
            </th>
            <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
              Games
            </th>
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
              isSelected={selectedPokemonId === pokemon.id}
              onSelect={() => onSelectPokemon(pokemon.id)}
              onToggleCaught={(e) => {
                e.stopPropagation();
                onToggleCaught(pokemon.id);
              }}
              onTogglePending={(e) => {
                e.stopPropagation();
                onTogglePending(pokemon.id);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
