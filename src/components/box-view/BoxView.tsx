import Box from "./Box";
import type { DexBox, Pokemon, DexMode } from "../../types";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";

interface Props {
  filteredPokemon: FilteredPokemon[];
  pokemonMap: Map<number, Pokemon>;
  boxes: DexBox[];
  caughtIds: number[];
  pendingIds: number[];
  dexMode: DexMode;
  selectedPokemonId: number | null;
  onSelectPokemon: (id: number) => void;
  onToggleCaught: (id: number) => void;
  onTogglePending: (id: number) => void;
}

export default function BoxView({
  filteredPokemon,
  pokemonMap,
  boxes,
  caughtIds,
  pendingIds,
  dexMode,
  selectedPokemonId,
  onSelectPokemon,
  onToggleCaught,
  onTogglePending,
}: Props) {
  const caughtSet = new Set(caughtIds);
  const pendingSet = new Set(pendingIds);
  const filteredSet = new Map(filteredPokemon.map((p) => [p.id, p]));

  // For regional dex mode, build synthetic boxes from the filtered list
  const displayBoxes: DexBox[] =
    dexMode !== "national"
      ? buildRegionalBoxes(filteredPokemon)
      : boxes;

  return (
    <div className="p-4">
      <p className="text-xs text-gray-500 mb-4 italic">
        Click to select • Double-click to toggle caught
      </p>
      {/* Grid layout: fills left→right then wraps down */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        {displayBoxes.map((box) => (
          <Box
            key={box.boxNumber}
            box={box}
            pokemonMap={pokemonMap}
            filteredMap={filteredSet}
            caughtSet={caughtSet}
            pendingSet={pendingSet}
            selectedPokemonId={selectedPokemonId}
            onSelectPokemon={onSelectPokemon}
            onToggleCaught={onToggleCaught}
            onTogglePending={onTogglePending}
          />
        ))}
      </div>
    </div>
  );
}

function buildRegionalBoxes(filteredPokemon: FilteredPokemon[]): DexBox[] {
  const BOX_SIZE = 30;
  const boxes: DexBox[] = [];
  for (let i = 0; i < filteredPokemon.length; i += BOX_SIZE) {
    const slice = filteredPokemon.slice(i, i + BOX_SIZE);
    const boxNum = Math.floor(i / BOX_SIZE) + 1;
    const firstNum = slice[0].displayNumber;
    const lastNum = slice[slice.length - 1].displayNumber;
    boxes.push({
      boxNumber: boxNum,
      label: `Box ${boxNum} (#${String(firstNum).padStart(3, "0")}–#${String(lastNum).padStart(3, "0")})`,
      pokemonIds: slice.map((p) => p.id),
    });
  }
  return boxes;
}
