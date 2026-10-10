import { useState, useMemo } from "react";
import BoxGameSelector from "./BoxGameSelector";
import PcBoxGrid from "./PcBoxGrid";
import { useBoxSlotStore } from "../../store/useBoxSlotStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import type { Pokemon, MetaData, GameVersion } from "../../types";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

export default function PcBoxLayout({ allPokemon, meta }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const selectedPokemonId = useSettingsStore((s) => s.selectedPokemonId);
  const setSelectedPokemonId = useSettingsStore((s) => s.setSelectedPokemonId);

  const genMeta = meta.generations.find((g) => g.id === activeGeneration);
  const games = useMemo(() => (genMeta?.versions ?? []) as GameVersion[], [genMeta]);
  const [selectedGame, setSelectedGame] = useState<GameVersion>(games[0]);
  // After a generation switch the remembered game belongs to the other generation
  const currentGame = games.includes(selectedGame) ? selectedGame : games[0];

  const slotsByGen = useBoxSlotStore((s) => s.slotsByGen);
  const assignSlot = useBoxSlotStore((s) => s.assignSlot);
  const clearSlot = useBoxSlotStore((s) => s.clearSlot);
  const moveSlot = useBoxSlotStore((s) => s.moveSlot);
  const caughtByGen = useDexStore((s) => s.caughtByGen);
  const pendingByGen = useDexStore((s) => s.pendingByGen);

  const caught = caughtByGen[activeGeneration] ?? [];
  const pending = pendingByGen[activeGeneration] ?? [];

  const pokemonMap = useMemo(
    () => new Map(allPokemon.map((p) => [p.id, p])),
    [allPokemon]
  );

  const gameBoxes: (number | null)[][] = useMemo(() => {
    const raw = slotsByGen[activeGeneration]?.[currentGame] ?? [];
    const numBoxes = Math.max(9, raw.length);
    return Array.from({ length: numBoxes }, (_, i) => raw[i] ?? Array(30).fill(null));
  }, [slotsByGen, activeGeneration, currentGame]);

  const allAssigned = useMemo(() => {
    const ids = new Set<number>();
    const genData = slotsByGen[activeGeneration] ?? {};
    for (const game of games) {
      for (const box of genData[game] ?? []) {
        for (const id of box) {
          if (id != null) ids.add(id);
        }
      }
    }
    return ids;
  }, [slotsByGen, activeGeneration, games]);

  return (
    <div className="p-4 flex flex-col gap-4">
      <BoxGameSelector
        games={games}
        selectedGame={currentGame}
        onSelect={setSelectedGame}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {gameBoxes.map((slots, boxIndex) => (
          <PcBoxGrid
            key={boxIndex}
            boxIndex={boxIndex}
            boxLabel={`Box ${boxIndex + 1}`}
            slots={slots}
            pokemonMap={pokemonMap}
            allPokemon={allPokemon}
            caughtIds={caught}
            pendingIds={pending}
            activeGeneration={activeGeneration}
            selectedPokemonId={selectedPokemonId}
            allAssigned={allAssigned}
            onAssign={(slot, pokemonId) =>
              assignSlot(activeGeneration, currentGame, boxIndex, slot, pokemonId)
            }
            onClear={(slot) => clearSlot(activeGeneration, currentGame, boxIndex, slot)}
            onMove={(fromSlot, toSlot) =>
              moveSlot(activeGeneration, currentGame, boxIndex, fromSlot, boxIndex, toSlot)
            }
            onSelectPokemon={(id) =>
              setSelectedPokemonId(selectedPokemonId === id ? null : id)
            }
          />
        ))}
      </div>
    </div>
  );
}
