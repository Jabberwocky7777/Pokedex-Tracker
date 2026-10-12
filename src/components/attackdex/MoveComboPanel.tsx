import { useState, useEffect, useMemo, useRef } from "react";
import { moveDisplayName } from "../../lib/move-names";
import type { Pokemon } from "../../types";
import {
  versionGroupsFor,
  type VersionGroup,
  fetchLearnsets,
} from "../../lib/move-fetch";
import { fetchMoveList, type MoveSummary } from "../../lib/move-list-fetch";
import { fetchAttackdexDetail } from "../../lib/attackdex-fetch";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { generationMaxId } from "../../lib/generation";
import MoveSearchBar from "../pokedex/MoveSearchBar";
import VersionGroupTabs from "../pokedex/VersionGroupTabs";

const MAX_SLOTS = 3;

type Slot = { id: number; slug: string | null };

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
  onSelectPokemon: (id: number) => void;
}

export default function MoveComboPanel({ allPokemon, activeGeneration, onSelectPokemon }: Props) {
  const [slots, setSlots] = useState<Slot[]>([{ id: 0, slug: null }]);
  const nextId = useRef(1);

  const activeVersionGroups = versionGroupsFor(activeGeneration);
  const [versionGroup, setVersionGroup] = useState<VersionGroup>(activeVersionGroups[0].id);

  const [moveList, setMoveList] = useState<MoveSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultIds, setResultIds] = useState<number[] | null>(null);

  useEffect(() => {
    const groups = versionGroupsFor(activeGeneration);
    setVersionGroup(groups[0].id); // eslint-disable-line react-hooks/set-state-in-effect -- reset version group when generation changes
  }, [activeGeneration]);

  useEffect(() => {
    fetchMoveList().then(setMoveList).catch(() => {});
  }, []);

  const genMax = generationMaxId(activeGeneration);

  // Recompute intersection whenever slots, generation, or version group changes.
  // Uses a two-pass approach:
  //   1. Fast pass: intersect PokéAPI's global learned_by_pokemon lists to get candidates.
  //   2. Validation pass: fetch each candidate's per-game learnset and confirm they can
  //      learn every move in the selected versionGroup. This catches cases where PokéAPI
  //      lists a Pokémon globally (across all games) but it can't actually learn the move
  //      in the chosen version group (e.g. Gligar + Rock Climb in Gen IV).
  useEffect(() => {
    const filledSlugs = slots.map((s) => s.slug).filter((s): s is string => s !== null);

    if (filledSlugs.length < 2) {
      setResultIds(null); // eslint-disable-line react-hooks/set-state-in-effect -- clear results when move slots are empty
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(filledSlugs.map((s) => fetchAttackdexDetail(s)))
      .then(async (details) => {
        if (cancelled) return;

        // Pass 1: Pokémon that learn every move in some Gen III–IV game.
        const idSets = details.map((d) => new Set(d.learnedBy.filter((id) => id <= genMax)));

        const [first, ...rest] = idSets;
        const candidates = [...first].filter((id) => rest.every((s) => s.has(id)));

        // Pass 2: validate each candidate against the selected version group learnset.
        const learnsets = await fetchLearnsets(candidates);
        const verified = candidates.filter((_, i) => {
          const learnset = learnsets[i][versionGroup] ?? [];
          const learnedSlugs = new Set(learnset.map((m) => m.move));
          return filledSlugs.every((slug) => learnedSlugs.has(slug));
        });

        if (!cancelled) setResultIds(verified.sort((a, b) => a - b));
      })
      .catch(() => { if (!cancelled) setResultIds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slots, genMax, versionGroup]);

  function addSlot() {
    if (slots.length >= MAX_SLOTS) return;
    setSlots((prev) => [...prev, { id: nextId.current++, slug: null }]);
  }

  function removeSlot(id: number) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSlug(id: number, slug: string | null) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, slug } : s)));
  }

  const filledSlugs = useMemo(
    () => slots.map((s) => s.slug).filter((s): s is string => s !== null),
    [slots]
  );

  const resultPokemon = useMemo(() => {
    if (!resultIds) return null;
    return resultIds.flatMap((id) => {
      const p = allPokemon.find((p) => p.id === id);
      return p ? [p] : [];
    });
  }, [resultIds, allPokemon]);

  return (
    <div className="flex flex-col gap-5">

      {/* Move slots */}
      <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Moves</span>

        {slots.map((slot, index) => (
          <div key={slot.id} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 w-4 text-center flex-shrink-0">
              {index + 1}
            </span>
            <div className="flex-1">
              <ComboSlot
                moveList={moveList}
                onSelect={(slug) => updateSlug(slot.id, slug)}
                onClear={() => updateSlug(slot.id, null)}
              />
            </div>
            {slots.length > 1 && (
              <button
                onClick={() => removeSlot(slot.id)}
                title="Remove move"
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white flex items-center justify-center transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {slots.length < MAX_SLOTS && (
          <button
            onClick={addSlot}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-xs font-medium transition-all mt-1"
          >
            <span className="text-sm leading-none">+</span>
            Add move
          </button>
        )}
      </div>

      {/* Results panel — only once ≥2 moves are selected */}
      {filledSlugs.length >= 2 ? (
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Results</span>
            <VersionGroupTabs
              activeVersionGroups={activeVersionGroups}
              versionGroup={versionGroup}
              setVersionGroup={setVersionGroup}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : resultPokemon !== null && (
            <>
              <span className="text-xs text-gray-400">
                {resultPokemon.length === 0
                  ? "No Pokémon can learn all selected moves in this generation."
                  : `${resultPokemon.length} Pokémon can learn all ${filledSlugs.length} moves`}
              </span>
              {resultPokemon.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                  {resultPokemon.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectPokemon(p.id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all group"
                      title={p.displayName}
                    >
                      <img
                        src={getGenSprite(p, activeGeneration)}
                        alt={p.displayName}
                        className="w-12 h-12 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="text-xs text-gray-500 font-mono">#{formatDexNumber(p.id)}</span>
                      <span className="text-xs text-gray-300 group-hover:text-white text-center leading-tight">
                        {p.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-3">
          <p className="text-sm">Select at least 2 moves above to find Pokémon that can learn all of them.</p>
        </div>
      )}

    </div>
  );
}

// ── ComboSlot: self-contained move search bar with local query state ──────────

interface ComboSlotProps {
  moveList: MoveSummary[];
  onSelect: (slug: string) => void;
  onClear: () => void;
}

function ComboSlot({ moveList, onSelect, onClear }: ComboSlotProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<MoveSummary[]>([]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; } // eslint-disable-line react-hooks/set-state-in-effect -- clear suggestions when query is empty
    setSuggestions(
      moveList
        .filter((m) => m.displayName.toLowerCase().includes(q) || m.slug.includes(q))
        .slice(0, 10)
    );
  }, [query, moveList]);

  return (
    <MoveSearchBar
      query={query}
      setQuery={setQuery}
      showDropdown={showDropdown}
      setShowDropdown={setShowDropdown}
      suggestions={suggestions}
      onSelect={(slug) => {
        onSelect(slug);
        setQuery(moveDisplayName(slug));
        setShowDropdown(false);
      }}
      onClear={() => {
        onClear();
        setQuery("");
      }}
    />
  );
}
