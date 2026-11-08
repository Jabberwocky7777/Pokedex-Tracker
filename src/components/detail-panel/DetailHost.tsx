import { useCallback, useMemo } from "react";
import DetailPanel from "./DetailPanel";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { useSavesOverview } from "../../hooks/useSaves";
import { toggleWithUndo } from "../../lib/dex-actions";
import { generationMaxId } from "../../lib/generation";
import { hasNonTradeEncounter } from "../../lib/npc-trades";
import { openPokedex } from "../../lib/navigate";
import type { Pokemon } from "../../types";

const NO_IDS: number[] = [];

interface Props {
  allPokemon: Pokemon[];
  /** The Pokémon to show; null shows nothing */
  pokemonId: number | null;
  onClose: () => void;
  /**
   * The selected games that alone have it. The tracker passes what its filter worked out;
   * without it, it is worked out here the same way.
   */
  exclusiveGames?: string[];
}

/**
 * A Pokémon's detail panel, wherever a tab shows one: docked beside the content from 1024 px
 * (put it inside the tab's content row), a bottom sheet below that. Marks go through
 * toggleWithUndo, like everywhere else.
 */
export default function DetailHost({ allPokemon, pokemonId, onClose, exclusiveGames }: Props) {
  const generation = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const caught = useDexStore((s) => s.caughtByGen[generation]) ?? NO_IDS;
  const pending = useDexStore((s) => s.pendingByGen[generation]) ?? NO_IDS;
  const shiny = useDexStore((s) => s.shinyByGen[generation]) ?? NO_IDS;
  const placed = useDexStore((s) => s.placedByGen[generation]) ?? NO_IDS;

  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);
  const caughtSet = useMemo(() => new Set(caught), [caught]);
  const savesOverview = useSavesOverview(pokemonMap, generation);
  const pokemon = pokemonId ? (pokemonMap.get(pokemonId) ?? null) : null;

  const toggle = useCallback(
    (field: "caught" | "pending" | "shiny" | "placed") => {
      if (pokemon) toggleWithUndo(field, pokemon.id, generation, pokemon.displayName);
    },
    [pokemon, generation],
  );

  if (!pokemon) return null;

  // Catchable in just one of two or more selected games (as the tracker's filter has it)
  const onlyIn =
    exclusiveGames ??
    (() => {
      if (activeGames.length < 2) return [];
      const withIt = activeGames.filter((g) => hasNonTradeEncounter(pokemon.encounters, [g]));
      return withIt.length === 1 ? withIt : [];
    })();

  const panel = (
    <DetailPanel
      key={pokemon.id}
      pokemon={pokemon}
      allPokemonMap={pokemonMap}
      isCaught={caught.includes(pokemon.id)}
      isPending={pending.includes(pokemon.id)}
      isShiny={shiny.includes(pokemon.id)}
      isPlaced={placed.includes(pokemon.id)}
      savesOverview={savesOverview}
      caughtIds={caughtSet}
      genMaxId={generationMaxId(generation)}
      onToggleCaught={() => toggle("caught")}
      onTogglePending={() => toggle("pending")}
      onToggleShiny={() => toggle("shiny")}
      onTogglePlaced={() => toggle("placed")}
      onClose={onClose}
      exclusiveGames={onlyIn}
      onPokedexClick={() => openPokedex(pokemon.id)}
    />
  );

  return (
    <>
      {/* Docked, from 1024 px */}
      <aside className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl pr-[env(safe-area-inset-right,0px)]">
        {panel}
      </aside>

      {/* A bottom sheet below that */}
      <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={`${pokemon.displayName} details`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="fixed bottom-0 left-0 right-0 md:max-w-2xl md:mx-auto max-h-[75vh] z-50 lg:hidden bg-gray-900 border-t border-gray-800 rounded-t-2xl overflow-y-auto shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
      >
        {/* Drag handle — tappable to close */}
        <button
          onClick={onClose}
          className="flex justify-center w-full py-3 flex-shrink-0 focus:outline-none"
          aria-label="Close panel"
        >
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </button>
        {panel}
      </aside>
    </>
  );
}
