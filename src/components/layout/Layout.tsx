import { useCallback, useMemo } from "react";
import Header from "./Header";
import BoxView from "../box-view/BoxView";
import ListView from "../list-view/ListView";
import DetailPanel from "../detail-panel/DetailPanel";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { usePokemonFilter } from "../../hooks/usePokemonFilter";
import { useProgress } from "../../hooks/useProgress";
import boxesData from "../../data/boxes.json";
import type { Pokemon, MetaData, DexBox } from "../../types";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  onLogout?: () => void;
}

const boxes = boxesData as DexBox[];

export default function Layout({ allPokemon, meta, onLogout }: Props) {
  const {
    viewMode,
    activeGames,
    activeGeneration,
    dexMode,
    selectedPokemonId,
    setSelectedPokemonId,
    availabilityMode,
    searchQuery,
    setActiveTab,
    setActiveRoute,
    setActivePokedexId,
  } = useSettingsStore();

  const caughtByGen = useDexStore((s) => s.caughtByGen);
  const pendingByGen = useDexStore((s) => s.pendingByGen);
  const toggleCaughtRaw = useDexStore((s) => s.toggleCaught);
  const togglePendingRaw = useDexStore((s) => s.togglePending);

  const caught = caughtByGen[activeGeneration] ?? [];
  const pending = pendingByGen[activeGeneration] ?? [];

  const toggleCaught = useCallback(
    (id: number) => toggleCaughtRaw(id, activeGeneration),
    [toggleCaughtRaw, activeGeneration]
  );
  const togglePending = useCallback(
    (id: number) => togglePendingRaw(id, activeGeneration),
    [togglePendingRaw, activeGeneration]
  );

  const filteredPokemon = usePokemonFilter(
    allPokemon,
    meta,
    activeGeneration,
    dexMode,
    activeGames,
    availabilityMode,
    searchQuery
  );

  const { caught: caughtCount, total, percentage } = useProgress(filteredPokemon, caught);

  const selectedPokemon = selectedPokemonId
    ? allPokemon.find((p) => p.id === selectedPokemonId) ?? null
    : null;

  // The FilteredPokemon entry carries dynamically-computed exclusiveGames (context-sensitive)
  const selectedFilteredPokemon = selectedPokemonId
    ? filteredPokemon.find((p) => p.id === selectedPokemonId) ?? null
    : null;

  const handleSelectPokemon = useCallback(
    (id: number) => {
      setSelectedPokemonId(selectedPokemonId === id ? null : id);
    },
    [selectedPokemonId, setSelectedPokemonId]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedPokemonId(null);
  }, [setSelectedPokemonId]);

  const handleRouteClick = useCallback(
    (slug: string) => {
      setActiveTab("routes");
      setActiveRoute(slug);
      setSelectedPokemonId(null);
    },
    [setActiveTab, setActiveRoute, setSelectedPokemonId]
  );

  const handlePokedexClick = useCallback(() => {
    if (!selectedPokemonId) return;
    setActivePokedexId(selectedPokemonId);
    setActiveTab("pokedex");
    setSelectedPokemonId(null);
  }, [selectedPokemonId, setActivePokedexId, setActiveTab, setSelectedPokemonId]);

  const pokemonMap = useMemo(
    () => new Map(allPokemon.map((p) => [p.id, p])),
    [allPokemon]
  );

  const genMaxId = meta.generations.find((g) => g.id === activeGeneration)?.pokemonRange[1] ?? 493;
  const trimmedBoxes = useMemo(
    () => boxes.filter((b) => b.pokemonIds[0] <= genMaxId),
    [genMaxId]
  );

  const detailPanel = selectedPokemon ? (
    <DetailPanel
      pokemon={selectedPokemon}
      allPokemonMap={pokemonMap}
      isCaught={caught.includes(selectedPokemon.id)}
      isPending={pending.includes(selectedPokemon.id)}
      onToggleCaught={() => toggleCaught(selectedPokemon.id)}
      onTogglePending={() => togglePending(selectedPokemon.id)}
      onClose={handleClosePanel}
      exclusiveGames={selectedFilteredPokemon?.exclusiveGames ?? []}
      onRouteClick={handleRouteClick}
      onPokedexClick={handlePokedexClick}
    />
  ) : null;

  return (
    <div className="flex flex-col h-full">
      <Header
        meta={meta}
        caught={caughtCount}
        total={total}
        percentage={percentage}
        onLogout={onLogout}
      />

      {/*
        Content row: fills remaining height.
        overflow-hidden here so only <main> scrolls — the header never gets covered.
      */}
      <div className="flex flex-1 overflow-hidden max-w-screen-2xl mx-auto w-full">
        {/* Scrollable main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {viewMode === "box" ? (
            <BoxView
              filteredPokemon={filteredPokemon}
              pokemonMap={pokemonMap}
              boxes={trimmedBoxes}
              caughtIds={caught}
              pendingIds={pending}
              dexMode={dexMode}
              selectedPokemonId={selectedPokemonId}
              onSelectPokemon={handleSelectPokemon}
              onToggleCaught={toggleCaught}
              onTogglePending={togglePending}
            />
          ) : (
            <ListView
              filteredPokemon={filteredPokemon}
              caughtIds={caught}
              pendingIds={pending}
              selectedPokemonId={selectedPokemonId}
              onSelectPokemon={handleSelectPokemon}
              onToggleCaught={toggleCaught}
              onTogglePending={togglePending}
            />
          )}
        </main>

        {/* Desktop sidebar — flex sibling, never behind the header */}
        {selectedPokemon && (
          <aside className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl">
            {detailPanel}
          </aside>
        )}
      </div>

      {/* Mobile overlay — fixed above everything including the header */}
      {selectedPokemon && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={handleClosePanel}
          />
          <aside className="fixed right-0 top-0 h-full w-80 z-50 lg:hidden bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl">
            {detailPanel}
          </aside>
        </>
      )}
    </div>
  );
}
