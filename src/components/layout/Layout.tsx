import { useCallback, useMemo, useState } from "react";
import Header from "./Header";
import FilterSubbar from "./FilterSubbar";
import ViewportProgressBar from "./ViewportProgressBar";
import BoxView from "../box-view/BoxView";
import ListView from "../list-view/ListView";
import PcBoxLayout from "../pc-box/PcBoxLayout";
import DetailPanel from "../detail-panel/DetailPanel";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { usePokemonFilter } from "../../hooks/usePokemonFilter";
import { useProgress } from "../../hooks/useProgress";
import boxesData from "../../data/boxes.json";
import type { Pokemon, MetaData, DexBox } from "../../types";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import ShortcutModal from "../shared/ShortcutModal";
import DailyChecklist from "../tracker/DailyChecklist";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  onLogout?: () => void;
}

const boxes = boxesData as DexBox[];

export default function Layout({ allPokemon, meta, onLogout }: Props) {
  const viewMode = useSettingsStore((s) => s.viewMode);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const dexMode = useSettingsStore((s) => s.dexMode);
  const selectedPokemonId = useSettingsStore((s) => s.selectedPokemonId);
  const setSelectedPokemonId = useSettingsStore((s) => s.setSelectedPokemonId);
  const availabilityMode = useSettingsStore((s) => s.availabilityMode);
  const searchQuery = useSettingsStore((s) => s.searchQuery);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const setActiveRoute = useSettingsStore((s) => s.setActiveRoute);
  const setActivePokedexId = useSettingsStore((s) => s.setActivePokedexId);

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
    searchQuery,
    caught
  );

  const { caught: caughtCount, total, percentage } = useProgress(filteredPokemon, caught);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useKeyboardShortcuts(filteredPokemon, activeGeneration, () => setShortcutsOpen(true));

  const selectedPokemon = selectedPokemonId
    ? allPokemon.find((p) => p.id === selectedPokemonId) ?? null
    : null;

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
    <>
      {/* 3px progress bar pinned to absolute top of viewport */}
      <ViewportProgressBar percentage={percentage} />

      <div className="flex flex-col h-full">
        <Header onLogout={onLogout} caughtCount={caughtCount} totalCount={total} />

        {/* Filter sub-bar — sticky below top bar, tracker-specific */}
        <FilterSubbar meta={meta} caught={caughtCount} total={total} tab="tracker" />

        {/*
          Content row: fills remaining height.
          pb-[76px] on mobile leaves room for the bottom nav (60px + safe area).
        */}
        <div className="flex flex-1 overflow-hidden max-w-screen-2xl mx-auto w-full">
          <main className="flex-1 min-w-0 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0 flex flex-col">
            {viewMode === "daily" ? (
              <DailyChecklist allPokemon={allPokemon} />
            ) : viewMode === "box" ? (
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
                searchActive={!!searchQuery}
              />
            ) : viewMode === "slots" ? (
              <PcBoxLayout allPokemon={allPokemon} meta={meta} />
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

          {/* Desktop sidebar */}
          {selectedPokemon && (
            <aside className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl">
              {detailPanel}
            </aside>
          )}
        </div>

        {/* Mobile overlay detail panel — bottom sheet */}
        {selectedPokemon && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={handleClosePanel}
            />
            <aside className="fixed bottom-0 left-0 right-0 max-h-[75vh] z-50 lg:hidden bg-gray-900 border-t border-gray-800 rounded-t-2xl overflow-y-auto shadow-2xl flex flex-col">
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-600" />
              </div>
              {detailPanel}
            </aside>
          </>
        )}

      </div>

      {shortcutsOpen && <ShortcutModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
