import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import FilterSubbar from "./FilterSubbar";
import ViewportProgressBar from "./ViewportProgressBar";
import BoxView from "../box-view/BoxView";
import ListView from "../list-view/ListView";
import PcBoxLayout from "../pc-box/PcBoxLayout";
import DetailHost from "../detail-panel/DetailHost";
import { useClock } from "../../hooks/useClock";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { useTrackerCountStore } from "../../store/useTrackerCountStore";
import { usePokemonFilter } from "../../hooks/usePokemonFilter";
import { useProgress } from "../../hooks/useProgress";
import boxesData from "../../data/boxes.json";
import type { Pokemon, MetaData, DexBox } from "../../types";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import ShortcutModal from "../shared/ShortcutModal";
import { toggleWithUndo } from "../../lib/dex-actions";
import ChangeLogView from "../tracker/ChangeLogView";
import { generationMaxId } from "../../lib/generation";
import { useNotesStore } from "../../store/useNotesStore";
import { notedIdsIn } from "../../lib/notes";

// Tool views are separate chunks, loaded the first time one is opened
const ProgressView = lazy(() => import("../tracker/ProgressView"));
// The save importer brings the save tables (~60 kB) with it

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

const boxes = boxesData as DexBox[];
// Stable fallback so "no marks yet" doesn't look like a new array on every render
const NO_IDS: number[] = [];

export default function Layout({ allPokemon, meta }: Props) {
  const viewMode = useSettingsStore((s) => s.viewMode);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const dexMode = useSettingsStore((s) => s.dexMode);
  const selectedPokemonId = useSettingsStore((s) => s.selectedPokemonId);
  const setSelectedPokemonId = useSettingsStore((s) => s.setSelectedPokemonId);
  const availabilityMode = useSettingsStore((s) => s.availabilityMode);
  const searchQuery = useSettingsStore((s) => s.searchQuery);

  const caughtByGen = useDexStore((s) => s.caughtByGen);
  const pendingByGen = useDexStore((s) => s.pendingByGen);
  const shinyByGen = useDexStore((s) => s.shinyByGen);
  const placedByGen = useDexStore((s) => s.placedByGen);

  const caught = caughtByGen[activeGeneration] ?? NO_IDS;
  const pending = pendingByGen[activeGeneration] ?? NO_IDS;
  const shiny = shinyByGen[activeGeneration] ?? NO_IDS;
  const placed = placedByGen[activeGeneration] ?? NO_IDS;

  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);

  // Every toggle (cells, list rows, detail panel) goes through toggleWithUndo
  // so it gets an "… · Undo" toast.
  const nameOf = useCallback((id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`, [pokemonMap]);
  const toggleCaught = useCallback(
    (id: number) => toggleWithUndo("caught", id, activeGeneration, nameOf(id)),
    [activeGeneration, nameOf],
  );
  const togglePending = useCallback(
    (id: number) => toggleWithUndo("pending", id, activeGeneration, nameOf(id)),
    [activeGeneration, nameOf],
  );
  // Pokémon with a note in this generation: note:yes, and a mark on their cell
  const notes = useNotesStore((s) => s.entries);
  const notedIds = useMemo(() => notedIdsIn(notes, activeGeneration), [notes, activeGeneration]);

  const clock = useClock();
  const filteredPokemon = usePokemonFilter(
    allPokemon,
    meta,
    activeGeneration,
    dexMode,
    activeGames,
    availabilityMode,
    searchQuery,
    caught,
    pending,
    shiny,
    placed,
    clock,
    notedIds,
  );

  const {
    caught: caughtCount,
    total,
    percentage,
    pending: pendingCount,
  } = useProgress(filteredPokemon, caught, pending);
  // The shared header shows these on a phone
  const setTrackerCounts = useTrackerCountStore((s) => s.setCounts);
  useEffect(() => {
    setTrackerCounts({ caught: caughtCount, pending: pendingCount, total });
  }, [caughtCount, pendingCount, total, setTrackerCounts]);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useKeyboardShortcuts(filteredPokemon, activeGeneration, () => setShortcutsOpen(true));

  const selectedPokemon = selectedPokemonId ? (allPokemon.find((p) => p.id === selectedPokemonId) ?? null) : null;

  const selectedFilteredPokemon = selectedPokemonId
    ? (filteredPokemon.find((p) => p.id === selectedPokemonId) ?? null)
    : null;

  const handleSelectPokemon = useCallback(
    (id: number) => {
      setSelectedPokemonId(selectedPokemonId === id ? null : id);
    },
    [selectedPokemonId, setSelectedPokemonId],
  );

  const handleClosePanel = useCallback(() => {
    setSelectedPokemonId(null);
  }, [setSelectedPokemonId]);

  const genMaxId = generationMaxId(activeGeneration);
  const trimmedBoxes = useMemo(() => boxes.filter((b) => b.pokemonIds[0] <= genMaxId), [genMaxId]);

  return (
    <>
      {/* 3px progress bar pinned to absolute top of viewport */}
      <ViewportProgressBar percentage={percentage} />

      <div className="flex flex-col h-full">
        {/* Filter sub-bar — sticky below top bar, tracker-specific */}
        <FilterSubbar
          meta={meta}
          allPokemon={allPokemon}
          caught={caughtCount}
          total={total}
          pending={pendingCount}
          tab="tracker"
        />

        {/*
          Content row: fills remaining height.
          pb-[76px] on mobile leaves room for the bottom nav (60px + safe area).
        */}
        <div className="flex flex-1 overflow-hidden max-w-screen-2xl mx-auto w-full">
          <main className="flex-1 min-w-0 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-[env(safe-area-inset-bottom,0px)] flex flex-col">
            {viewMode === "progress" ? (
              <Suspense fallback={null}>
                <ProgressView allPokemon={allPokemon} meta={meta} />
              </Suspense>
            ) : viewMode === "log" ? (
              <ChangeLogView pokemonMap={pokemonMap} />
            ) : viewMode === "box" ? (
              <BoxView
                filteredPokemon={filteredPokemon}
                pokemonMap={pokemonMap}
                boxes={trimmedBoxes}
                caughtIds={caught}
                pendingIds={pending}
                shinyIds={shiny}
                placedIds={placed}
                notedIds={notedIds}
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
                placedIds={placed}
                selectedPokemonId={selectedPokemonId}
                onSelectPokemon={handleSelectPokemon}
                onToggleCaught={toggleCaught}
                onTogglePending={togglePending}
              />
            )}
          </main>

          <DetailHost
            allPokemon={allPokemon}
            pokemonId={selectedPokemon?.id ?? null}
            onClose={handleClosePanel}
            exclusiveGames={selectedFilteredPokemon?.exclusiveGames ?? []}
          />
        </div>
      </div>

      {shortcutsOpen && <ShortcutModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
