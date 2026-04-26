import { useState, useEffect, useMemo, useRef } from "react";
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
  slugToDisplayName,
} from "../../lib/move-fetch";
import { fetchMoveList, type MoveSummary } from "../../lib/move-list-fetch";
import { PokemonHeroCard } from "./PokemonHeroCard";
import { StatBars } from "./StatBars";
import { StatComparison } from "./StatComparison";
import { SectionHeading } from "./SectionHeading";
import { MovesSection } from "./MovesSection";
import { usePokemonMoves } from "./usePokemonMoves";
import MoveSearchBar from "./MoveSearchBar";
import { AttackdexPanel } from "./AttackdexPanel";
import LocationTable from "../detail-panel/LocationTable";
import npcTradesRaw from "../../data/npc-trades.json";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

// ── Search suggestion type ────────────────────────────────────────────────────

interface PokemonSuggestion {
  pokemon: Pokemon;
  evYield?: number;
  statLabel?: string;
  stars?: 2 | 3;
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
  suggestions: PokemonSuggestion[];
  onSelect: (p: Pokemon) => void;
  onClear: () => void;
  placeholder: string;
  activeGeneration: number;
  accentColor: "indigo" | "pink";
}) {
  const focusRing = accentColor === "indigo" ? "focus:border-indigo-500" : "focus:border-pink-500";
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHighlightedIndex(-1); }, [suggestions]);

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

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
        onKeyDown={(e) => {
          if (!showDropdown || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && highlightedIndex >= 0) {
            e.preventDefault();
            onSelect(suggestions[highlightedIndex].pokemon);
            setShowDropdown(false);
            setHighlightedIndex(-1);
          } else if (e.key === "Escape") {
            setShowDropdown(false);
            setHighlightedIndex(-1);
          }
        }}
        className={`w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none ${focusRing}`}
      />
      {showDropdown && suggestions.length > 0 && (
        <div ref={dropdownRef} className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-80">
          {suggestions.map(({ pokemon: p, evYield, statLabel, stars }, index) => (
            <button
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setShowDropdown(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-700/40 last:border-0 ${highlightedIndex === index ? "bg-gray-700" : "hover:bg-gray-700"}`}
            >
              <img
                src={getGenSprite(p, activeGeneration)}
                alt={p.displayName}
                className="w-8 h-8 object-contain flex-shrink-0"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-sm text-gray-200 flex-1">{p.displayName}</span>
              {evYield != null && statLabel ? (
                <span className="text-xs text-emerald-400 font-mono flex-shrink-0">+{evYield} {statLabel}</span>
              ) : (
                <span className="text-xs text-gray-500 flex-shrink-0">#{formatDexNumber(p.id)}</span>
              )}
              {stars != null && (
                <span className="text-xs text-amber-400 flex-shrink-0 ml-1">{stars === 3 ? "★★★" : "★★"}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PokedexTab({ allPokemon, meta }: Props) {
  const { activePokedexId, setActivePokedexId, activeGeneration, setActiveTab, setActiveRoute } = useSettingsStore();

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

  // Move search (Attackdex)
  const [selectedMoveSlug, setSelectedMoveSlug] = useState<string | null>(null);
  const [moveQuery, setMoveQuery] = useState("");
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [moveSuggestions, setMoveSuggestions] = useState<MoveSummary[]>([]);
  const moveListRef = useRef<MoveSummary[]>([]);

  // Version group — driven by activeGeneration
  const activeVersionGroups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
  const [versionGroup, setVersionGroup] = useState<VersionGroup>(activeVersionGroups[0].id);

  // Reset to first tab of the new generation when generation changes.

  useEffect(() => {
    const groups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVersionGroup(groups[0].id);
  }, [activeGeneration]);

  // Fetch the move list once for autocomplete
  useEffect(() => {
    fetchMoveList().then((list) => { moveListRef.current = list; }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter move suggestions as the user types
  useEffect(() => {
    const q = moveQuery.trim().toLowerCase();
    if (!q) { setMoveSuggestions([]); return; }
    const results = moveListRef.current
      .filter((m) => m.displayName.toLowerCase().includes(q) || m.slug.includes(q))
      .slice(0, 10);
    setMoveSuggestions(results);
  }, [moveQuery]);

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

  // Build EV-yield suggestions: featured grinders first (with ★ rating), then all others sorted by yield
  function buildEvSuggestions(statKey: ReturnType<typeof detectStatKey>): PokemonSuggestion[] {
    if (!statKey) return [];
    const genKey = activeGeneration === 3 ? 3 : 4;
    const featured = FEATURED_GRINDERS[genKey]?.[statKey] ?? [];
    const featuredIds = new Set(featured.map((f) => f.id));
    const featuredSuggestions: PokemonSuggestion[] = featured
      .flatMap(({ id, stars }) => {
        const p = allPokemon.find((p) => p.id === id);
        if (!p) return [];
        const s: PokemonSuggestion = { pokemon: p, evYield: p.evYield?.[statKey] ?? 0, statLabel: STAT_LABELS_SHORT[statKey], stars };
        return [s];
      });
    const rest: PokemonSuggestion[] = allPokemon
      .filter((p) => !featuredIds.has(p.id) && (p.evYield?.[statKey] ?? 0) > 0)
      .sort((a, b) => (b.evYield?.[statKey] ?? 0) - (a.evYield?.[statKey] ?? 0))
      .map((p) => ({ pokemon: p, evYield: p.evYield?.[statKey] ?? 0, statLabel: STAT_LABELS_SHORT[statKey] }));
    return [...featuredSuggestions, ...rest];
  }

  // Suggestions (support stat-keyword search like "attack" → EV yield results)
  const suggestionsA = useMemo((): PokemonSuggestion[] => {
    if (!queryA.trim() || pokemonA?.displayName === queryA) return [];
    const q = queryA.toLowerCase();
    const statKey = detectStatKey(q);
    if (statKey) return buildEvSuggestions(statKey);
    return allPokemon
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .slice(0, 8)
      .map((p) => ({ pokemon: p }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryA, allPokemon, pokemonA, activeGeneration]);

  const suggestionsB = useMemo((): PokemonSuggestion[] => {
    if (!queryB.trim() || pokemonB?.displayName === queryB) return [];
    const q = queryB.toLowerCase();
    const statKey = detectStatKey(q);
    if (statKey) return buildEvSuggestions(statKey);
    return allPokemon
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .slice(0, 8)
      .map((p) => ({ pokemon: p }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <Header meta={meta} />

      <main className="flex-1 overflow-y-auto">
        <div className={`${compareMode ? "max-w-5xl" : "max-w-3xl"} mx-auto w-full px-4 py-8 flex flex-col gap-6 transition-all`}>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Pokédex</h2>
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

          {/* Move search row */}
          <div className="bg-gray-900 rounded-xl p-4">
            <MoveSearchBar
              query={moveQuery}
              setQuery={setMoveQuery}
              showDropdown={showMoveDropdown}
              setShowDropdown={setShowMoveDropdown}
              suggestions={moveSuggestions}
              onSelect={(slug) => {
                setSelectedMoveSlug(slug);
                setMoveQuery(slugToDisplayName(slug));
              }}
              onClear={() => setSelectedMoveSlug(null)}
            />
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
                  />
                </div>
              )}

              {selectedMoveSlug && (
                <AttackdexPanel
                  slug={selectedMoveSlug}
                  allPokemon={allPokemon}
                  activeGeneration={activeGeneration}
                  versionGroup={versionGroup}
                  onVersionGroupChange={setVersionGroup}
                  onSelectPokemon={(id) => { setActivePokedexId(id); setQueryA(allPokemon.find((p) => p.id === id)?.displayName ?? ""); }}
                />
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
                      </div>
                    </div>
                  </div>

                  <StatBars pokemon={pokemonA} />

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

              {selectedMoveSlug && (
                <AttackdexPanel
                  slug={selectedMoveSlug}
                  allPokemon={allPokemon}
                  activeGeneration={activeGeneration}
                  versionGroup={versionGroup}
                  onVersionGroupChange={setVersionGroup}
                  onSelectPokemon={(id) => { setActivePokedexId(id); setQueryA(allPokemon.find((p) => p.id === id)?.displayName ?? ""); }}
                />
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function VersionGroupTabs({
  activeVersionGroups,
  versionGroup,
  setVersionGroup,
}: {
  activeVersionGroups: { id: VersionGroup; label: string }[];
  versionGroup: VersionGroup;
  setVersionGroup: (vg: VersionGroup) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {activeVersionGroups.map((vg) => (
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
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="h-full min-h-48 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-2 text-gray-600 bg-gray-900/40">
      <span className="text-2xl font-bold">{label}</span>
      <span className="text-xs">Search for a Pokémon</span>
    </div>
  );
}

