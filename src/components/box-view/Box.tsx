import PokemonCell from "./PokemonCell";
import type { DexBox, Pokemon } from "../../types";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";

interface Props {
  box: DexBox;
  pokemonMap: Map<number, Pokemon>;
  filteredMap: Map<number, FilteredPokemon>;
  caughtSet: Set<number>;
  pendingSet: Set<number>;
  selectedPokemonId: number | null;
  onSelectPokemon: (id: number) => void;
  onToggleCaught: (id: number) => void;
  onTogglePending: (id: number) => void;
}

export default function Box({
  box,
  pokemonMap,
  filteredMap,
  caughtSet,
  pendingSet,
  selectedPokemonId,
  onSelectPokemon,
  onToggleCaught,
  onTogglePending,
}: Props) {
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-500 font-mono mb-2 px-1">{box.label}</div>
      <div className="grid grid-cols-6 gap-1.5 bg-gray-800/30 rounded-xl p-3">
        {box.pokemonIds.map((id) => {
          const filtered = filteredMap.get(id);
          const pokemon = pokemonMap.get(id);

          if (!filtered || !pokemon) {
            // Empty slot
            return (
              <div
                key={id}
                className="aspect-square rounded-lg bg-gray-800/20 border border-gray-700/20"
              />
            );
          }

          return (
            <PokemonCell
              key={id}
              pokemon={filtered}
              isCaught={caughtSet.has(id)}
              isPending={pendingSet.has(id)}
              isSelected={selectedPokemonId === id}
              onClick={() => onSelectPokemon(id)}
              onDoubleClick={() => onToggleCaught(id)}
              onRightClick={(e) => {
                e.preventDefault();
                onTogglePending(id);
              }}
            />
          );
        })}
        {/* Pad to full 30 if box has fewer entries */}
        {Array.from({ length: Math.max(0, 30 - box.pokemonIds.length) }).map(
          (_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-square rounded-lg bg-gray-800/20 border border-gray-700/20"
            />
          )
        )}
      </div>
    </div>
  );
}
