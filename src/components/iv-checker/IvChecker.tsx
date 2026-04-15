import { useState, useMemo, useRef } from "react";
import {
  NATURES,
  STAT_KEYS,
  STAT_LABELS,
  findIVs,
  ivRange,
  intersectIVSets,
  projectStats,
  type StatKey,
  type Nature,
  getNatureMultiplier,
} from "../../lib/iv-calc";
import type { Pokemon, MetaData } from "../../types";
import Header from "../layout/Header";
import { useIvStore, type IvSession } from "../../store/useIvStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { getGenSprite } from "../../lib/pokemon-display";
import { type LevelEntry, EMPTY_STATS, DEFAULT_IVS, DEFAULT_EVS, ivColor, ivBadgeColor } from "./ivTypes";
import { PokemonSearchBar } from "./IvPokemonSearch";
import { StatGrid } from "./StatGrid";
import { ProjectionTable } from "./IvProjectionTable";
import { PcBoxPanel } from "./PcBoxPanel";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function IvChecker({ allPokemon, meta }: Props) {
  const { activeGeneration } = useSettingsStore();

  // ── Slot A ──────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [nature, setNature] = useState<Nature>(NATURES[0]);
  const [evs, setEvs] = useState<Record<StatKey, number>>(DEFAULT_EVS());
  const [manualIvs, setManualIvs] = useState<Record<StatKey, number>>(DEFAULT_IVS());

  const nextId = useRef(1);
  const [entries, setEntries] = useState<LevelEntry[]>([
    { id: 0, level: 50, stats: EMPTY_STATS() },
  ]);

  // ── Slot B (compare) ────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIdB, setSelectedIdB] = useState<number | null>(null);
  const [queryB, setQueryB] = useState("");
  const [showDropdownB, setShowDropdownB] = useState(false);
  const [natureB, setNatureB] = useState<Nature>(NATURES[0]);
  const [evsB, setEvsB] = useState<Record<StatKey, number>>(DEFAULT_EVS());
  const [manualIvsB, setManualIvsB] = useState<Record<StatKey, number>>(DEFAULT_IVS());

  // ── PC Box ──────────────────────────────────────────────────────────────
  const { savedSessions, saveSession, deleteSession } = useIvStore();
  const [pcBoxOpen, setPcBoxOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedPokemon = selectedId ? allPokemon.find((p) => p.id === selectedId) : null;
  const selectedPokemonB = selectedIdB ? allPokemon.find((p) => p.id === selectedIdB) : null;

  const suggestionsA = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allPokemon.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 8);
  }, [query, allPokemon]);

  const suggestionsB = useMemo(() => {
    if (!queryB.trim()) return [];
    const q = queryB.toLowerCase();
    return allPokemon.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 8);
  }, [queryB, allPokemon]);

  // ── Entry helpers ────────────────────────────────────────────────────────
  function addEntry() {
    const lastLevel = entries[entries.length - 1].level;
    setEntries((prev) => [
      ...prev,
      { id: nextId.current++, level: Math.min(100, lastLevel + 1), stats: EMPTY_STATS() },
    ]);
  }

  function removeEntry(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function updateEntryLevel(id: number, level: number) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, level: Math.max(1, Math.min(100, level)) } : e))
    );
  }

  function updateEntryStat(id: number, stat: StatKey, value: string) {
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, stats: { ...e.stats, [stat]: value } } : e)
    );
  }

  // ── Compare helpers ──────────────────────────────────────────────────────
  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIdB(null);
    setQueryB("");
    setNatureB(NATURES[0]);
    setEvsB(DEFAULT_EVS());
    setManualIvsB(DEFAULT_IVS());
  }

  // ── PC Box helpers ───────────────────────────────────────────────────────
  function handleSave() {
    if (!selectedPokemon) return;
    const name = saveNameInput.trim() || selectedPokemon.displayName;
    const session: IvSession = {
      id: crypto.randomUUID(),
      name,
      pokemonId: selectedPokemon.id,
      pokemonName: selectedPokemon.displayName,
      pokemonSprite: getGenSprite(selectedPokemon, activeGeneration),
      natureName: nature.name,
      evs: { ...evs },
      entries: entries.map((e) => ({ level: e.level, stats: { ...e.stats } })),
      savedAt: Date.now(),
    };
    saveSession(session);
    setSaveNameInput("");
    setShowSaveInput(false);
  }

  function handleLoad(session: IvSession) {
    const pokemon = allPokemon.find((p) => p.id === session.pokemonId);
    if (!pokemon) return;
    const nat = NATURES.find((n) => n.name === session.natureName) ?? NATURES[0];
    setSelectedId(session.pokemonId);
    setQuery(session.pokemonName);
    setNature(nat);
    setEvs(session.evs);
    const restored: LevelEntry[] = session.entries.map((e, i) => ({
      id: i,
      level: e.level,
      stats: { ...e.stats },
    }));
    nextId.current = restored.length;
    setEntries(restored);
    setPcBoxOpen(false);
  }

  // ── IV Calculation (intersect across all rows) ───────────────────────────
  const ivResults = useMemo(() => {
    if (!selectedPokemon) return null;
    const results = {} as Record<
      StatKey,
      { ivs: number[]; range: { min: number; max: number } | null; hasAnyInput: boolean }
    >;

    for (const stat of STAT_KEYS) {
      const setsPerEntry: number[][] = [];
      let hasAnyInput = false;

      for (const entry of entries) {
        const val = parseInt(entry.stats[stat]);
        if (isNaN(val) || val <= 0) continue;
        hasAnyInput = true;
        const base = selectedPokemon.baseStats[stat as keyof typeof selectedPokemon.baseStats];
        const ivs = findIVs(base, evs[stat], entry.level, getNatureMultiplier(nature, stat), val, stat === "hp");
        setsPerEntry.push(ivs);
      }

      const ivs = setsPerEntry.length > 0 ? intersectIVSets(setsPerEntry) : [];
      results[stat] = { ivs, range: ivRange(ivs), hasAnyInput };
    }
    return results;
  }, [selectedPokemon, entries, evs, nature]);

  // Copy calculated min IVs → manual IVs
  function copyIvsFromResults() {
    if (!ivResults) return;
    const next = { ...manualIvs };
    for (const stat of STAT_KEYS) {
      const r = ivResults[stat];
      if (r.hasAnyInput && r.range) next[stat] = r.range.min;
    }
    setManualIvs(next);
  }

  const hasAnyIvResult = ivResults
    ? STAT_KEYS.some((s) => ivResults[s].hasAnyInput && ivResults[s].range)
    : false;

  // ── Stat projections ─────────────────────────────────────────────────────
  const projection = useMemo(() => {
    if (!selectedPokemon) return null;
    return projectStats(selectedPokemon.baseStats, manualIvs, evs, nature);
  }, [selectedPokemon, manualIvs, evs, nature]);

  const projectionB = useMemo(() => {
    if (!selectedPokemonB) return null;
    return projectStats(selectedPokemonB.baseStats, manualIvsB, evsB, natureB);
  }, [selectedPokemonB, manualIvsB, evsB, natureB]);

  const activeGen = meta.generations[0]?.id ?? 3;
  const formulaNote =
    activeGen <= 2
      ? "Note: Gen I/II use DVs (0–15). This calculator uses the Gen III formula."
      : "Using Gen III/IV formula (IVs 0–31, natures ±10%). Add level rows to narrow IV ranges.";

  return (
    <div className="flex flex-col h-full">
      <Header meta={meta} caught={0} total={0} percentage={0} />

      <main className="flex-1 overflow-y-auto">
        <div className={`${compareMode ? "max-w-5xl" : "max-w-3xl"} mx-auto w-full px-4 py-8 flex flex-col gap-6 transition-all`}>

          {/* Title + PC Box */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">IV Checker</h2>
              <p className="text-sm text-gray-400">{formulaNote}</p>
            </div>
            <div className="relative shrink-0">
              <button
                onClick={() => setPcBoxOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-indigo-500 transition-colors"
              >
                <span>PC Box</span>
                <span className="text-xs bg-gray-700 text-gray-400 rounded px-1">{savedSessions.length}</span>
                <span className="text-xs text-gray-500">{pcBoxOpen ? "▲" : "▼"}</span>
              </button>

              {pcBoxOpen && (
                <PcBoxPanel
                  savedSessions={savedSessions}
                  onLoad={handleLoad}
                  onDelete={deleteSession}
                />
              )}
            </div>
          </div>

          {/* ── Pokémon selector(s) ── */}
          <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300">Pokémon</label>

            <div className="flex items-center gap-2">
              {compareMode && (
                <span className="text-xs font-semibold text-indigo-400 shrink-0 w-5 text-center">A</span>
              )}

              <PokemonSearchBar
                query={query}
                setQuery={setQuery}
                showDropdown={showDropdown}
                setShowDropdown={setShowDropdown}
                suggestions={suggestionsA}
                onSelect={(p) => { setSelectedId(p.id); setQuery(p.displayName); }}
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
                    showDropdown={showDropdownB}
                    setShowDropdown={setShowDropdownB}
                    suggestions={suggestionsB}
                    onSelect={(p) => { setSelectedIdB(p.id); setQueryB(p.displayName); }}
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

            {/* Hero card(s) */}
            {!compareMode && selectedPokemon && (
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                <img
                  src={getGenSprite(selectedPokemon, activeGeneration)}
                  alt={selectedPokemon.displayName}
                  className="w-12 h-12 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-white">{selectedPokemon.displayName}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    Base: {selectedPokemon.baseStats.hp}/{selectedPokemon.baseStats.atk}/{selectedPokemon.baseStats.def}/{selectedPokemon.baseStats.spAtk}/{selectedPokemon.baseStats.spDef}/{selectedPokemon.baseStats.spe}
                  </div>
                </div>
              </div>
            )}

            {compareMode && (selectedPokemon || selectedPokemonB) && (
              <div className="grid grid-cols-2 gap-3 mt-1">
                {[
                  { mon: selectedPokemon, label: "A", color: "border-indigo-700 bg-indigo-950/30" },
                  { mon: selectedPokemonB, label: "B", color: "border-pink-700 bg-pink-950/30" },
                ].map(({ mon, label, color }) => (
                  <div key={label} className={`flex items-center gap-3 p-3 rounded-lg border ${color} min-h-[4rem]`}>
                    {mon ? (
                      <>
                        <img
                          src={getGenSprite(mon, activeGeneration)}
                          alt={mon.displayName}
                          className="w-10 h-10 object-contain shrink-0"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div>
                          <div className="font-semibold text-white text-sm">{mon.displayName}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {mon.baseStats.hp}/{mon.baseStats.atk}/{mon.baseStats.def}/{mon.baseStats.spAtk}/{mon.baseStats.spDef}/{mon.baseStats.spe}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-600">Slot {label} empty</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Nature + EVs + IVs ── */}
          {!compareMode ? (
            /* Single column */
            <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-4">
              {/* Nature */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Nature</label>
                <select
                  value={nature.name}
                  onChange={(e) => setNature(NATURES.find((n) => n.name === e.target.value)!)}
                  className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 max-w-xs"
                >
                  {NATURES.map((n) => (
                    <option key={n.name} value={n.name}>
                      {n.name}{n.plus ? ` (+${STAT_LABELS[n.plus]} / −${STAT_LABELS[n.minus!]})` : " (neutral)"}
                    </option>
                  ))}
                </select>
              </div>

              <StatGrid
                label="EVs"
                sublabel="(shared across all rows)"
                values={evs}
                onChange={(stat, val) => setEvs((prev) => ({ ...prev, [stat]: val }))}
                min={0}
                max={252}
                nature={nature}
              />

              <StatGrid
                label="IVs"
                sublabel="(used for stat projection)"
                values={manualIvs}
                onChange={(stat, val) => setManualIvs((prev) => ({ ...prev, [stat]: val }))}
                min={0}
                max={31}
                nature={nature}
              />
            </div>
          ) : (
            /* Two-column compare layout */
            <div className="grid grid-cols-2 gap-3">
              {/* Slot A */}
              <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-4">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Slot A</div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-300">Nature</label>
                  <select
                    value={nature.name}
                    onChange={(e) => setNature(NATURES.find((n) => n.name === e.target.value)!)}
                    className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 w-full"
                  >
                    {NATURES.map((n) => (
                      <option key={n.name} value={n.name}>
                        {n.name}{n.plus ? ` (+${STAT_LABELS[n.plus]})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <StatGrid label="EVs" values={evs} onChange={(s, v) => setEvs((p) => ({ ...p, [s]: v }))} min={0} max={252} nature={nature} accentColor="indigo" />
                <StatGrid label="IVs" values={manualIvs} onChange={(s, v) => setManualIvs((p) => ({ ...p, [s]: v }))} min={0} max={31} nature={nature} accentColor="indigo" />
              </div>

              {/* Slot B */}
              <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-4">
                <div className="text-xs font-semibold text-pink-400 uppercase tracking-wider">Slot B</div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-300">Nature</label>
                  <select
                    value={natureB.name}
                    onChange={(e) => setNatureB(NATURES.find((n) => n.name === e.target.value)!)}
                    className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-pink-500 w-full"
                  >
                    {NATURES.map((n) => (
                      <option key={n.name} value={n.name}>
                        {n.name}{n.plus ? ` (+${STAT_LABELS[n.plus]})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <StatGrid label="EVs" values={evsB} onChange={(s, v) => setEvsB((p) => ({ ...p, [s]: v }))} min={0} max={252} nature={natureB} accentColor="pink" />
                <StatGrid label="IVs" values={manualIvsB} onChange={(s, v) => setManualIvsB((p) => ({ ...p, [s]: v }))} min={0} max={31} nature={natureB} accentColor="pink" />
              </div>
            </div>
          )}

          {/* ── IV-finding section (hidden in compare mode) ── */}
          {!compareMode && (
            <>
              {/* Level entry table */}
              <div className="bg-gray-900 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-300 mb-3">
                  Stat entries{" "}
                  <span className="text-gray-500 font-normal">— enter observed in-game stats to find IVs</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-gray-500 font-medium border-separate" style={{ borderSpacing: "0 4px" }}>
                    <thead>
                      <tr>
                        <th className="text-left px-1 pb-1 w-16">Lv.</th>
                        {STAT_KEYS.map((stat) => (
                          <th key={stat} className="text-center px-1 pb-1">
                            <span className="inline-flex items-center gap-0.5 justify-center">
                              {STAT_LABELS[stat].replace("Special ", "Sp.")}
                              {nature.plus === stat && <span className="text-green-400">▲</span>}
                              {nature.minus === stat && <span className="text-red-400">▼</span>}
                            </span>
                          </th>
                        ))}
                        <th className="w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => (
                        <tr key={entry.id}>
                          <td className="pr-2">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={entry.level}
                              onChange={(e) => updateEntryLevel(entry.id, Number(e.target.value))}
                              className="w-14 px-1.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 text-center"
                            />
                          </td>
                          {STAT_KEYS.map((stat) => (
                            <td key={stat} className="px-1">
                              <input
                                type="number"
                                min={1}
                                placeholder="—"
                                value={entry.stats[stat]}
                                onChange={(e) => updateEntryStat(entry.id, stat, e.target.value)}
                                className="w-full min-w-[52px] px-1.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 text-center placeholder-gray-600"
                              />
                            </td>
                          ))}
                          <td className="pl-1">
                            {idx > 0 ? (
                              <button
                                onClick={() => removeEntry(entry.id)}
                                className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors text-sm leading-none"
                                title="Remove row"
                              >
                                ×
                              </button>
                            ) : (
                              <div className="w-6" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={addEntry}
                  className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <span className="text-base leading-none">+</span> Add Level
                </button>
              </div>

              {/* IV Results */}
              {ivResults && (
                <div className="bg-gray-900 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-300 mb-3">IV Results</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {STAT_KEYS.map((stat) => {
                      const result = ivResults[stat];
                      const label = STAT_LABELS[stat];
                      return (
                        <div
                          key={stat}
                          className={`rounded-lg border p-3 ${
                            result.hasAnyInput && result.range
                              ? ivBadgeColor(result.range.min, result.range.max)
                              : "bg-gray-800 border-gray-700"
                          }`}
                        >
                          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            {label}
                            {nature.plus === stat && <span className="text-green-400 text-xs">▲</span>}
                            {nature.minus === stat && <span className="text-red-400 text-xs">▼</span>}
                          </div>
                          {!result.hasAnyInput ? (
                            <div className="text-sm text-gray-600">—</div>
                          ) : result.range === null ? (
                            <div className="text-sm text-red-400 font-medium">No match</div>
                          ) : (
                            <div className={`text-lg font-bold tabular-nums ${ivColor(result.range.min, result.range.max)}`}>
                              {result.range.min === result.range.max
                                ? result.range.min
                                : `${result.range.min}–${result.range.max}`}
                            </div>
                          )}
                          {result.hasAnyInput && result.ivs.length > 1 && (
                            <div className="text-xs text-gray-500 mt-0.5">{result.ivs.join(", ")}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-xs text-gray-600">
                    Green = 31 (perfect) · Yellow = 25–30 (great) · Red = &lt;10 (poor)
                  </div>

                  {/* Copy to IVs */}
                  {hasAnyIvResult && (
                    <div className="mt-2">
                      <button
                        onClick={copyIvsFromResults}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                      >
                        ↓ Copy min IVs to projection
                      </button>
                    </div>
                  )}

                  {/* Save to PC Box */}
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    {showSaveInput ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={selectedPokemon?.displayName ?? "Session name…"}
                          value={saveNameInput}
                          onChange={(e) => setSaveNameInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false); }}
                          autoFocus
                          className="flex-1 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleSave}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setShowSaveInput(false)}
                          className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSaveInput(true)}
                        disabled={!selectedPokemon}
                        className="text-sm text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                      >
                        <span>+</span> Save to PC Box
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Stat Projection ── */}
          {(projection || projectionB) && (
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="text-sm font-medium text-gray-300 mb-3">
                Stat Projection
                <span className="text-gray-500 font-normal ml-1">— based on IVs, EVs &amp; nature</span>
              </div>

              {projection && projectionB ? (
                <ProjectionTable
                  projectionA={projection}
                  projectionB={projectionB}
                  nameA={selectedPokemon?.displayName}
                  nameB={selectedPokemonB?.displayName}
                  nature={nature}
                  natureB={natureB}
                />
              ) : projection ? (
                <ProjectionTable
                  projectionA={projection}
                  nature={nature}
                />
              ) : projectionB ? (
                <ProjectionTable
                  projectionA={projectionB}
                  nature={natureB}
                />
              ) : null}
            </div>
          )}

          {/* Formula note */}
          <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg p-3">
            <span className="font-semibold text-gray-400">Gen III/IV Formula: </span>
            HP = ⌊(2B + IV + ⌊EV/4⌋) × L/100⌋ + L + 10.{" "}
            Other stats = ⌊(⌊(2B + IV + ⌊EV/4⌋) × L/100⌋ + 5) × Nature⌋.{" "}
            Enter observed stats in the level table to find IVs, then use the IVs grid to project stats at any level.
          </div>
        </div>
      </main>
    </div>
  );
}
