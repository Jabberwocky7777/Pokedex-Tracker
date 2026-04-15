import { useState, useEffect, useMemo } from "react";
import type { Pokemon, MetaData } from "../../types";
import Header from "../layout/Header";
import { useSettingsStore } from "../../store/useSettingsStore";
import { TYPE_COLORS } from "../../lib/type-colors";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import { GEN3_VERSION_GROUPS, type Gen3VersionGroup } from "../../lib/move-fetch";
import { PokemonHeroCard } from "./PokemonHeroCard";
import { StatBars } from "./StatBars";
import { StatComparison } from "./StatComparison";
import { SectionHeading } from "./SectionHeading";
import { MovesSection } from "./MovesSection";
import { usePokemonMoves } from "./usePokemonMoves";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

// ── Search bar (PokedexTab-specific — has onClear callback) ───────────────────

function PokemonSearchBar({
  query,
  setQuery,
  showDropdown,
  setShowDropdown,
  suggestions,
  onSelect,
  onClear,
  placeholder,
  activeGeneration,
  accentColor,
}: {
  query: string;
  setQuery: (q: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  suggestions: Pokemon[];
  onSelect: (p: Pokemon) => void;
  onClear: () => void;
  placeholder: string;
  activeGeneration: number;
  accentColor: "indigo" | "pink";
}) {
  const focusRing = accentColor === "indigo" ? "focus:border-indigo-500" : "focus:border-pink-500";

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
          if (e.target.value === "") onClear();
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        className={`w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none ${focusRing}`}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((p) => (
            <button
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-left"
            >
              <img
                src={getGenSprite(p, activeGeneration)}
                alt={p.displayName}
                className="w-8 h-8 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-sm text-gray-200 flex-1">{p.displayName}</span>
              <span className="text-xs text-gray-500">#{formatDexNumber(p.id)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PokedexTab({ allPokemon, meta }: Props) {
  const { activePokedexId, setActivePokedexId, activeGeneration } = useSettingsStore();

  // Slot A (primary — synced with store so "More Detail" from tracker still works)
  const [queryA, setQueryA] = useState("");
  const [showDropA, setShowDropA] = useState(false);

  // Slot B (compare)
  const [compareId, setCompareId] = useState<number | null>(null);
  const [queryB, setQueryB] = useState("");
  const [showDropB, setShowDropB] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  // Which Pokémon's moves to show in compare mode
  const [moveTab, setMoveTab] = useState<"a" | "b">("a");

  // Shared version group
  const [versionGroup, setVersionGroup] = useState<Gen3VersionGroup>("ruby-sapphire");

  const pokemonA = activePokedexId ? allPokemon.find((p) => p.id === activePokedexId) ?? null : null;
  const pokemonB = compareId ? allPokemon.find((p) => p.id === compareId) ?? null : null;

  // Keep the search inputs in sync when the selection changes externally
  // (e.g. "More Detail" in the tracker sets activePokedexId in the Zustand store).
  // Suppressed: react-hooks/set-state-in-effect — this is a deliberate derived-state
  // sync from Zustand store → local UI state, not from an external system to React.
  // This pattern was present in the original file and is correct for this use case.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pokemonA) setQueryA(pokemonA.displayName);
  }, [pokemonA]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pokemonB) setQueryB(pokemonB.displayName);
  }, [pokemonB]);

  // Fetch moves for both slots
  const movesA = usePokemonMoves(activePokedexId);
  const movesB = usePokemonMoves(compareMode ? compareId : null);

  // Suggestions
  const suggestionsA = useMemo(() => {
    if (!queryA.trim() || pokemonA?.displayName === queryA) return [];
    const q = queryA.toLowerCase();
    return allPokemon.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 8);
  }, [queryA, allPokemon, pokemonA]);

  const suggestionsB = useMemo(() => {
    if (!queryB.trim() || pokemonB?.displayName === queryB) return [];
    const q = queryB.toLowerCase();
    return allPokemon.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 8);
  }, [queryB, allPokemon, pokemonB]);

  function exitCompareMode() {
    setCompareMode(false);
    setCompareId(null);
    setQueryB("");
    setMoveTab("a");
  }

  const activeMoves = moveTab === "a" ? movesA : movesB;

  return (
    <div className="flex flex-col h-full">
      <Header meta={meta} caught={0} total={0} percentage={0} />

      <main className="flex-1 overflow-y-auto">
        <div className={`${compareMode ? "max-w-5xl" : "max-w-3xl"} mx-auto w-full px-4 py-8 flex flex-col gap-6 transition-all`}>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Pokédex</h2>
            <p className="text-sm text-gray-400">
              Moves shown for Gen III (Ruby / Sapphire / Emerald / FireRed / LeafGreen).
            </p>
          </div>

          {/* Search row */}
          <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {compareMode && (
                <span className="text-xs font-semibold text-indigo-400 shrink-0 w-5 text-center">A</span>
              )}

              <PokemonSearchBar
                query={queryA}
                setQuery={setQueryA}
                showDropdown={showDropA}
                setShowDropdown={setShowDropA}
                suggestions={suggestionsA}
                onSelect={(p) => { setActivePokedexId(p.id); setQueryA(p.displayName); }}
                onClear={() => setActivePokedexId(null)}
                placeholder="Search by name…"
                activeGeneration={activeGeneration}
                accentColor="indigo"
              />

              {!compareMode ? (
                <button
                  onClick={() => setCompareMode(true)}
                  title="Compare with another Pokémon"
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700 hover:bg-indigo-600 text-gray-300 hover:text-white flex items-center justify-center transition-all text-lg font-light leading-none"
                >
                  +
                </button>
              ) : (
                <>
                  <span className="text-xs font-semibold text-pink-400 shrink-0 w-5 text-center">B</span>

                  <PokemonSearchBar
                    query={queryB}
                    setQuery={setQueryB}
                    showDropdown={showDropB}
                    setShowDropdown={setShowDropB}
                    suggestions={suggestionsB}
                    onSelect={(p) => { setCompareId(p.id); setQueryB(p.displayName); }}
                    onClear={() => setCompareId(null)}
                    placeholder="Compare with…"
                    activeGeneration={activeGeneration}
                    accentColor="pink"
                  />

                  <button
                    onClick={exitCompareMode}
                    title="Exit compare mode"
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white flex items-center justify-center transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── COMPARE MODE ─────────────────────────────────────────────── */}
          {compareMode ? (
            <>
              {(pokemonA || pokemonB) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-h-48">
                    {pokemonA ? (
                      <PokemonHeroCard pokemon={pokemonA} activeGeneration={activeGeneration} compact />
                    ) : (
                      <EmptySlot label="A" />
                    )}
                  </div>
                  <div className="min-h-48">
                    {pokemonB ? (
                      <PokemonHeroCard pokemon={pokemonB} activeGeneration={activeGeneration} compact />
                    ) : (
                      <EmptySlot label="B" />
                    )}
                  </div>
                </div>
              )}

              {pokemonA && pokemonB && (
                <StatComparison a={pokemonA} b={pokemonB} />
              )}
              {pokemonA && !pokemonB && <StatBars pokemon={pokemonA} />}
              {pokemonB && !pokemonA && <StatBars pokemon={pokemonB} />}

              {(pokemonA || pokemonB) && (
                <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      <SectionHeading>Moves</SectionHeading>
                      {pokemonA && pokemonB && (
                        <div className="flex gap-1 mb-2">
                          <button
                            onClick={() => setMoveTab("a")}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              moveTab === "a"
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            {pokemonA.displayName}
                          </button>
                          <button
                            onClick={() => setMoveTab("b")}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              moveTab === "b"
                                ? "bg-pink-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            {pokemonB.displayName}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {GEN3_VERSION_GROUPS.map((vg) => (
                        <button
                          key={vg.id}
                          onClick={() => setVersionGroup(vg.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            versionGroup === vg.id
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                          }`}
                        >
                          {vg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <MovesSection
                    learnset={activeMoves.learnset}
                    moveDetails={activeMoves.moveDetails}
                    loading={activeMoves.loading}
                    error={activeMoves.error}
                    versionGroup={versionGroup}
                  />
                </div>
              )}
            </>
          ) : (
          /* ── SINGLE MODE ─────────────────────────────────────────────── */
            <>
              {pokemonA && (
                <>
                  {/* Hero card (single mode uses a more spacious layout) */}
                  <div
                    className="bg-gray-900 rounded-xl overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${TYPE_COLORS[pokemonA.types[0]] ?? "#374151"}22 0%, #111827 60%)` }}
                  >
                    <div className="p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                      <div className="flex-shrink-0">
                        <img
                          src={getGenSprite(pokemonA, activeGeneration)}
                          alt={pokemonA.displayName}
                          className="w-32 h-32 object-contain drop-shadow-2xl"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-3 items-center sm:items-start">
                        <div>
                          <div className="text-sm text-gray-500 font-mono">#{formatDexNumber(pokemonA.id)}</div>
                          <h3 className="text-3xl font-bold text-white mt-0.5">{pokemonA.displayName}</h3>
                        </div>
                        <div className="flex gap-2">
                          {pokemonA.types.map((t) => <TypeBadge key={t} type={t} />)}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {pokemonA.isLegendary && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">◆ Legendary</span>
                          )}
                          {pokemonA.isMythical && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50">✦ Mythical</span>
                          )}
                          {pokemonA.isBaby && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-900/50 text-pink-300 border border-pink-700/50">♡ Baby</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-gray-400">
                          <span>Catch rate: <span className="text-gray-200 font-medium">{pokemonA.catchRate}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <StatBars pokemon={pokemonA} />

                  {/* Moves */}
                  <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 justify-between">
                      <SectionHeading>Moves</SectionHeading>
                      <div className="flex gap-1 flex-wrap">
                        {GEN3_VERSION_GROUPS.map((vg) => (
                          <button
                            key={vg.id}
                            onClick={() => setVersionGroup(vg.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              versionGroup === vg.id
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                            }`}
                          >
                            {vg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <MovesSection
                      learnset={movesA.learnset}
                      moveDetails={movesA.moveDetails}
                      loading={movesA.loading}
                      error={movesA.error}
                      versionGroup={versionGroup}
                    />
                  </div>
                </>
              )}

              {!pokemonA && (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-900/30 relative overflow-hidden border-2 border-gray-700">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gray-700" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-800 border border-gray-700" />
                  </div>
                  <p className="text-sm">
                    Search for a Pokémon above, or click{" "}
                    <span className="text-indigo-400 font-medium">More Detail</span> in the tracker.
                  </p>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="h-full min-h-48 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-2 text-gray-600 bg-gray-900/40">
      <span className="text-2xl font-bold">{label}</span>
      <span className="text-xs">Search for a Pokémon</span>
    </div>
  );
}
