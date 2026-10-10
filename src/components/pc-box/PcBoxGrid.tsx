import { useState, useMemo } from "react";
import PcBoxSlot from "./PcBoxSlot";
import PokemonPicker from "../shared/PokemonPicker";
import type { Pokemon } from "../../types";

interface Props {
  boxIndex: number;
  boxLabel: string;
  slots: (number | null)[];
  pokemonMap: Map<number, Pokemon>;
  allPokemon: Pokemon[];
  caughtIds: number[];
  pendingIds: number[];
  activeGeneration: number;
  selectedPokemonId: number | null;
  allAssigned: Set<number>;
  onAssign: (slot: number, pokemonId: number) => void;
  onClear: (slot: number) => void;
  onMove: (fromSlot: number, toSlot: number) => void;
  onSelectPokemon: (id: number) => void;
}

export default function PcBoxGrid({
  boxIndex,
  boxLabel,
  slots,
  pokemonMap,
  allPokemon,
  caughtIds,
  pendingIds,
  activeGeneration,
  selectedPokemonId,
  allAssigned,
  onAssign,
  onClear,
  onMove,
  onSelectPokemon,
}: Props) {
  const [pendingAssignSlot, setPendingAssignSlot] = useState<number | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);

  const caughtSet = useMemo(() => new Set(caughtIds), [caughtIds]);
  const pendingSet = useMemo(() => new Set(pendingIds), [pendingIds]);
  const padded = useMemo(() => Array.from({ length: 30 }, (_, i) => slots[i] ?? null), [slots]);

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3">
      <div className="text-xs font-semibold text-gray-400 mb-2">{boxLabel}</div>
      <div className="grid grid-cols-6 gap-1">
        {padded.map((pokemonId, slotIndex) => {
          const pokemon = pokemonId != null ? (pokemonMap.get(pokemonId) ?? null) : null;
          return (
            <PcBoxSlot
              key={slotIndex}
              pokemon={pokemon}
              isCaught={pokemonId != null && caughtSet.has(pokemonId)}
              isPending={pokemonId != null && pendingSet.has(pokemonId)}
              isSelected={pokemonId != null && pokemonId === selectedPokemonId}
              activeGeneration={activeGeneration}
              onAssign={() => setPendingAssignSlot(slotIndex)}
              onClear={() => onClear(slotIndex)}
              onSelect={() => pokemonId != null && onSelectPokemon(pokemonId)}
              onDragStart={() => setDraggingSlot(boxIndex * 30 + slotIndex)}
              onDrop={() => {
                if (draggingSlot !== null) {
                  const fromBox = Math.floor(draggingSlot / 30);
                  const fromSlot = draggingSlot % 30;
                  if (fromBox === boxIndex) {
                    onMove(fromSlot, slotIndex);
                  }
                  setDraggingSlot(null);
                }
              }}
            />
          );
        })}
      </div>

      {pendingAssignSlot !== null && (
        <PokemonPicker
          allPokemon={allPokemon}
          activeGeneration={activeGeneration}
          title="Assign Pokémon"
          tagged={allAssigned}
          tagLabel="in box"
          onSelect={(id) => onAssign(pendingAssignSlot, id)}
          onClose={() => setPendingAssignSlot(null)}
        />
      )}
    </div>
  );
}
