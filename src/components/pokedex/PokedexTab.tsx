import { useState, useEffect, useMemo, useCallback } from "react";
import type { Pokemon, MetaData, GameVersion } from "../../types";
import { GEN3_VERSIONS, GEN4_VERSIONS } from "../../types";
import Header from "../layout/Header";
import { useSettingsStore } from "../../store/useSettingsStore";
import { detectStatKey, STAT_LABELS_SHORT, FEATURED_GRINDERS } from "../../lib/ev-search";
import type { StatKey } from "../../lib/iv-calc";
import { TYPE_COLORS } from "../../lib/type-colors";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import {
  GEN3_VERSION_GROUPS,
  GEN4_VERSION_GROUPS,
  type VersionGroup,
} from "../../lib/move-fetch";
import { PokemonHeroCard } from "./PokemonHeroCard";
import { StatBars } from "./StatBars";
import { StatComparison } from "./StatComparison";
import { SectionHeading } from "./SectionHeading";
import { MovesSection } from "./MovesSection";
import { EvolutionChain } from "./EvolutionChain";
import { usePokemonMoves } from "./usePokemonMoves";
import LocationTable from "../detail-panel/LocationTable";
import PokemonSearchBar from "./PokemonSearchBar";
import type { PokemonSuggestion } from "./PokemonSearchBar";
import VersionGroupTabs from "./VersionGroupTabs";
import npcTradesRaw from "../../data/npc-trades.json";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

// ── EV-yield suggestion builder ───────────────────────────────────────────────
// Returns featured grinders first (with ★ rating), then all others sorted by yield.

function buildEvSuggestions(
  allPokemon: Pokemon[],
  activeGeneration: number,
  statKey: ReturnType<typeof detectStatKey>
): PokemonSuggestion[] {
  if (!statKey) return [];
  const genKey = activeGeneration === 3 ? 3 : 4;
  const featured = FEATURED_GRINDERS[genKey]?.[statKey] ?? [];
  const featuredIds = new Set(featured.map((f) => f.id));
  const featuredSuggestions: PokemonSuggestion[] = featured
    .flatMap(({ id, stars }) => {
      const p = allPokemon.find((p) => p.id === id);
      if (!p) return [];
      return [{ pokemon: p, evYield: p.evYield?.[statKey] ?? 0, statLabel: STAT_LABELS_SHORT[statKey], stars }];
    });
  const rest: PokemonSuggestion[] = allPokemon
    .filter((p) => !featuredIds.has(p.id) && (p.evYield?.[statKey] ?? 0) > 0)
    .sort((a, b) => (b.evYield?.[statKey] ?? 0) - (a.evYield?.[statKey] ?? 0))
    .map((p) => ({ pokemon: p, evYield: p.evYield?.[statKey] ?? 0, statLabel: STAT_LABELS_SHORT[statKey] }));
  return [...featuredSuggestions, ...rest];
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PokedexTab({ allPokemon }: Props) {
  const activePokedexId = useSettingsStore((s) => s.activePokedexId);
  const setActivePokedexId = useSettingsStore((s) => s.setActivePokedexId);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const setActiveRoute = useSettingsStore((s) => s.setActiveRoute);
  const setActiveAttackdexSlug = useSettingsStore((s) => s.setActiveAttackdexSlug);

  // Slot A (primary — synced with store so "More Detail" from tracker still works)
  const [queryA, setQueryA] = useState("");
  const [showDropA, setShowDropA] = useState(false);

  // Advanced search state
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [abilityFilter, setAbilityFilter] = useState("");
  const [minStats, setMinStats] = useState({ hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0 });

  const hasActiveFilters = abilityFilter.trim().length > 0 || Object.values(minStats).some((v) => v > 0);

  const advancedFilteredPokemon = useMemo(() => {
    if (!hasActiveFilters) return [];
    const q = abilityFilter.trim().toLowerCase();
    return allPokemon.filter((p) => {
      if (q && !p.abilities?.some((a) => a.name.includes(q) || a.displayName.toLowerCase().includes(q))) return false;
      if (p.baseStats.hp    < minStats.hp)    return false;
      if (p.baseStats.atk   < minStats.atk)   return false;
      if (p.baseStats.def   < minStats.def)   return false;
      if (p.baseStats.spAtk < minStats.spAtk) return false;
      if (p.baseStats.spDef < minStats.spDef) return false;
      if (p.baseStats.spe   < minStats.spe)   return false;
      return true;
    });
  }, [allPokemon, abilityFilter, minStats, hasActiveFilters]);

  const clearFilters = useCallback(() => {
    setAbilityFilter("");
    setMinStats({ hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0 });
  }, []);

  // Slot B (compare)
  const [compareId, setCompareId] = useState<number | null>(null);
  const [queryB, setQueryB] = useState("");
  const [showDropB, setShowDropB] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  // Which Pokémon's moves to show in compare mode
  const [moveTab, setMoveTab] = useState<"a" | "b">("a");

  // Version group — driven by activeGeneration
  const activeVersionGroups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
  const [versionGroup, setVersionGroup] = useState<VersionGroup>(activeVersionGroups[0].id);

  // Reset to first tab of the new generation when generation changes.

  useEffect(() => {
    const groups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVersionGroup(groups[0].id);
  }, [activeGeneration]);

  const pokemonA = activePokedexId ? allPokemon.find((p) => p.id === activePokedexId) ?? null : null;
  const pokemonB = compareId ? allPokemon.find((p) => p.id === compareId) ?? null : null;

  const allPokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);
  const genVersions = (activeGeneration === 4 ? GEN4_VERSIONS : GEN3_VERSIONS) as GameVersion[];

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

  // Suggestions (support stat-keyword search like "attack" → EV yield results)
  const suggestionsA = useMemo((): PokemonSuggestion[] => {
    if (!queryA.trim() || pokemonA?.displayName === queryA) return [];
    const q = queryA.toLowerCase();
    const statKey = detectStatKey(q);
    if (statKey) return buildEvSuggestions(allPokemon, activeGeneration, statKey);
    return allPokemon
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .slice(0, 8)
      .map((p) => ({ pokemon: p }));
  }, [queryA, allPokemon, pokemonA, activeGeneration]);

  const suggestionsB = useMemo((): PokemonSuggestion[] => {
    if (!queryB.trim() || pokemonB?.displayName === queryB) return [];
    const q = queryB.toLowerCase();
    const statKey = detectStatKey(q);
    if (statKey) return buildEvSuggestions(allPokemon, activeGeneration, statKey);
    return allPokemon
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .slice(0, 8)
      .map((p) => ({ pokemon: p }));
  }, [queryB, allPokemon, pokemonB, activeGeneration]);

  function exitCompareMode() {
    setCompareMode(false);
    setCompareId(null);
    setQueryB("");
    setMoveTab("a");
  }

  const activeMoves = moveTab === "a" ? movesA : movesB;

  const genLabel = activeGeneration === 4
    ? "Gen IV (Diamond / Pearl / Platinum / HG / SS)"
    : "Gen III (Ruby / Sapphire / Emerald / FireRed / LeafGreen)";

  return (
    <div className="flex flex-col h-full">
      <Header />

      <main className="flex-1 overflow-y-auto pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <div className={`${compareMode ? "max-w-5xl" : "max-w-3xl"} mx-auto w-full px-4 py-8 flex flex-col gap-6 transition-all`}>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--theme-font-display)' }}>Pokédex</h2>
            <p className="text-sm text-gray-400">
              Moves shown for {genLabel}.
            </p>
          </div>

          {/* Pokémon search row */}
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
                <>
                  <button
                    onClick={() => setShowAdvancedSearch((v) => !v)}
                    title="Advanced search / filter"
                    className={`relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      showAdvancedSearch || hasActiveFilters
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                    {hasActiveFilters && !showAdvancedSearch && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setCompareMode(true)}
                    title="Compare with another Pokémon"
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700 hover:bg-indigo-600 text-gray-300 hover:text-white flex items-center justify-center transition-all text-lg font-light leading-none"
                  >
                    +
                  </button>
                </>
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

          {/* Advanced search filter panel */}
          {showAdvancedSearch && !compareMode && (
            <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-4">
              {/* Ability search */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ability</label>
                <input
                  type="text"
                  value={abilityFilter}
                  onChange={(e) => setAbilityFilter(e.target.value)}
                  placeholder="e.g. Overgrow, Swift Swim…"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 border border-gray-700 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Stat sliders */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Min Base Stats</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mt-1">
                  {([ ["hp", "HP"], ["atk", "Attack"], ["def", "Defense"], ["spAtk", "Sp. Atk"], ["spDef", "Sp. Def"], ["spe", "Speed"] ] as [keyof typeof minStats, string][]).map(([key, label]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{label}</span>
                        <span className={minStats[key] > 0 ? "text-indigo-400 font-semibold" : "text-gray-600"}>
                          {minStats[key] > 0 ? `≥${minStats[key]}` : "Any"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={minStats[key]}
                        onChange={(e) => setMinStats((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        style={{ background: `linear-gradient(to right, #6366f1 ${(minStats[key] / 255) * 100}%, #374151 ${(minStats[key] / 255) * 100}%)` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="self-start text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Advanced search results */}
          {hasActiveFilters && !compareMode && (
            <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
              <div className="text-xs text-gray-500">
                {advancedFilteredPokemon.length === 0
                  ? "No Pokémon match these filters"
                  : `${advancedFilteredPokemon.length} Pokémon match`}
              </div>
              {advancedFilteredPokemon.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
                  {advancedFilteredPokemon.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePokedexId(p.id);
                        setQueryA(p.displayName);
                        setShowAdvancedSearch(false);
                      }}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 hover:ring-1 hover:ring-indigo-500 transition-all group"
                    >
                      <img
                        src={getGenSprite(p, activeGeneration)}
                        alt={p.displayName}
                        className="w-12 h-12 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="text-xs text-gray-300 group-hover:text-white text-center leading-tight truncate w-full">
                        {p.displayName}
                      </span>
                      <div className="flex gap-0.5 flex-wrap justify-center">
                        {p.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
                                ? "bg-indigo-500 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            {pokemonA.displayName}
                          </button>
                          <button
                            onClick={() => setMoveTab("b")}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              moveTab === "b"
                                ? "bg-pink-500 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            {pokemonB.displayName}
                          </button>
                        </div>
                      )}
                    </div>
                    <VersionGroupTabs
                    activeVersionGroups={activeVersionGroups}
                    versionGroup={versionGroup}
                    setVersionGroup={setVersionGroup}
                  />
                  </div>

                  <MovesSection
                    learnset={activeMoves.learnset}
                    moveDetails={activeMoves.moveDetails}
                    loading={activeMoves.loading}
                    error={activeMoves.error}
                    versionGroup={versionGroup}
                    onMoveClick={(slug) => {
                      setActiveAttackdexSlug(slug);
                      setActiveTab("attackdex");
                    }}
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
                          <h3 className="text-3xl font-bold text-white mt-0.5" style={{ fontFamily: 'var(--theme-font-display)' }}>{pokemonA.displayName}</h3>
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
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                          <span>Catch rate: <span className="text-gray-200 font-medium">{pokemonA.catchRate}</span></span>
                          {pokemonA.evYield && Object.entries(pokemonA.evYield).some(([, v]) => (v ?? 0) > 0) && (
                            <span>
                              EV yield:{" "}
                              <span className="text-emerald-400 font-medium">
                                {Object.entries(pokemonA.evYield)
                                  .filter(([, v]) => (v ?? 0) > 0)
                                  .map(([k, v]) => `${v} ${STAT_LABELS_SHORT[k as StatKey]}`)
                                  .join(", ")}
                              </span>
                            </span>
                          )}
                        </div>
                        {pokemonA.abilities && pokemonA.abilities.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {pokemonA.abilities.map((a) => (
                              <span
                                key={a.name}
                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                  a.isHidden
                                    ? "bg-gray-800 text-gray-400 border-gray-600/50"
                                    : "bg-indigo-900/50 text-indigo-300 border-indigo-700/50"
                                }`}
                              >
                                {a.displayName}{a.isHidden ? " (H)" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <StatBars pokemon={pokemonA} />

                  {/* Evolution Chain */}
                  {(pokemonA.evolvesFrom != null || pokemonA.evolvesTo.length > 0) && (
                    <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-3">
                      <SectionHeading>Evolution</SectionHeading>
                      <EvolutionChain
                        pokemon={pokemonA}
                        allPokemonMap={allPokemonMap}
                        onSelect={(id) => {
                          setActivePokedexId(id);
                          setQueryA(allPokemon.find((p) => p.id === id)?.displayName ?? "");
                        }}
                        activeGeneration={activeGeneration}
                      />
                    </div>
                  )}

                  {/* Moves */}
                  <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 justify-between">
                      <SectionHeading>Moves</SectionHeading>
                      <VersionGroupTabs
                    activeVersionGroups={activeVersionGroups}
                    versionGroup={versionGroup}
                    setVersionGroup={setVersionGroup}
                  />
                    </div>
                    <MovesSection
                      learnset={movesA.learnset}
                      moveDetails={movesA.moveDetails}
                      loading={movesA.loading}
                      error={movesA.error}
                      versionGroup={versionGroup}
                      onMoveClick={(slug) => {
                        setActiveAttackdexSlug(slug);
                        setActiveTab("attackdex");
                      }}
                    />
                  </div>

                  {/* Where to Find */}
                  <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-3">
                    <SectionHeading>Where to Find</SectionHeading>
                    <LocationTable
                      encounters={pokemonA.encounters.filter((e) => genVersions.includes(e.version as GameVersion))}
                      evolvesFrom={pokemonA.evolvesFrom}
                      evolvesFromName={pokemonA.evolvesFrom ? (allPokemonMap.get(pokemonA.evolvesFrom)?.displayName ?? null) : null}
                      evolvesFromDetails={
                        pokemonA.evolvesFrom
                          ? (allPokemonMap.get(pokemonA.evolvesFrom)?.evolvesTo.find(
                              (s) => s.speciesId === pokemonA.id
                            )?.details ?? null)
                          : null
                      }
                      npcTrades={
                        (npcTradesRaw as { pokemonId: number; games: string[]; note: string }[])
                          .filter((t) => t.pokemonId === pokemonA.id && t.games.some((g) => genVersions.includes(g as GameVersion)))
                          .map((t) => ({ games: t.games, note: t.note }))
                      }
                      breedParentName={
                        pokemonA.isBaby && pokemonA.encounters.length === 0 && pokemonA.evolvesTo.length > 0
                          ? pokemonA.evolvesTo[0].displayName : null
                      }
                      onRouteClick={(slug) => { setActiveTab("routes"); setActiveRoute(slug); }}
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

