import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { STAT_KEYS, STAT_LABELS } from "../../lib/iv-calc";
import type { StatKey } from "../../lib/iv-calc";
import type { DesignerSlot } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { formatDexNumber } from "../../lib/pokemon-display";

interface Props {
  slot: DesignerSlot;
  allPokemon: Pokemon[];
  activeGeneration: number;
  onUpdate: (patch: Partial<DesignerSlot>) => void;
}

const VITAMIN_LABELS: Record<StatKey, string> = {
  hp: "HP Up",
  atk: "Protein",
  def: "Iron",
  spAtk: "Calcium",
  spDef: "Zinc",
  spe: "Carbos",
};

const MAX_VITAMIN_EVS = 100;
const EV_TOTAL_CAP = 510;
const EV_STAT_CAP = 252;

// Stat keyword detection for EV-yield-based search
const STAT_KEYWORDS: Record<string, StatKey> = {
  hp: "hp", health: "hp",
  attack: "atk", atk: "atk",
  defense: "def", defence: "def", def: "def",
  "sp atk": "spAtk", spatk: "spAtk", "special attack": "spAtk", spa: "spAtk",
  "sp def": "spDef", spdef: "spDef", "special defense": "spDef", "special defence": "spDef", spd: "spDef",
  speed: "spe", spe: "spe",
};

function detectStatKey(q: string): StatKey | null {
  return STAT_KEYWORDS[q.trim().toLowerCase()] ?? null;
}

// Gen-aware curated EV grinding spots (community favourites, 3★ = best, 2★ = great)
const FEATURED_GRINDERS: Record<number, Partial<Record<StatKey, { id: number; stars: 2 | 3 }[]>>> = {
  3: {
    hp:    [{ id: 263, stars: 3 }, { id: 265, stars: 3 }, { id: 293, stars: 2 }], // Zigzagoon, Wurmple, Whismur
    atk:   [{ id: 261, stars: 3 }, { id: 262, stars: 3 }, { id: 66,  stars: 2 }], // Poochyena, Mightyena, Machop
    def:   [{ id: 74,  stars: 3 }, { id: 75,  stars: 3 }, { id: 299, stars: 2 }], // Geodude, Graveler, Nosepass
    spAtk: [{ id: 43,  stars: 3 }, { id: 44,  stars: 3 }, { id: 218, stars: 2 }], // Oddish, Gloom, Slugma
    spDef: [{ id: 72,  stars: 3 }, { id: 73,  stars: 3 }, { id: 333, stars: 2 }], // Tentacool, Tentacruel, Swablu
    spe:   [{ id: 278, stars: 3 }, { id: 41,  stars: 3 }, { id: 309, stars: 2 }], // Wingull, Zubat, Electrike
  },
  4: {
    hp:    [{ id: 194, stars: 3 }, { id: 422, stars: 3 }, { id: 423, stars: 2 }], // Wooper, Shellos, Gastrodon
    atk:   [{ id: 400, stars: 3 }, { id: 419, stars: 3 }, { id: 67,  stars: 2 }], // Bibarel, Floatzel, Machoke
    def:   [{ id: 74,  stars: 3 }, { id: 75,  stars: 3 }, { id: 449, stars: 2 }], // Geodude, Graveler, Hippopotas
    spAtk: [{ id: 92,  stars: 3 }, { id: 315, stars: 3 }, { id: 406, stars: 2 }], // Gastly, Roselia, Budew
    spDef: [{ id: 72,  stars: 3 }, { id: 73,  stars: 3 }, { id: 226, stars: 2 }], // Tentacool, Tentacruel, Mantine
    spe:   [{ id: 396, stars: 3 }, { id: 397, stars: 3 }, { id: 41,  stars: 2 }], // Starly, Staravia, Zubat
  },
};

export default function EvTracker({ slot, allPokemon, activeGeneration, onUpdate }: Props) {
  const [koQuery, setKoQuery] = useState("");
  const [showKoSearch, setShowKoSearch] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [evDrafts, setEvDrafts] = useState<Partial<Record<StatKey, string>>>({});
  const [showKoOverlay, setShowKoOverlay] = useState(false);

  const totalEVs = STAT_KEYS.reduce((sum, k) => sum + (slot.evAllocation[k] ?? 0), 0);
  const multiplier = (slot.machobraceActive ? 2 : 1) * (slot.pokerusActive ? 2 : 1);

  const pokemonMap = new Map(allPokemon.map((p) => [p.id, p]));

  function applyVitamin(stat: StatKey) {
    const current = slot.vitaminEVs[stat] ?? 0;
    if (current >= MAX_VITAMIN_EVS) return;
    const add = Math.min(10, MAX_VITAMIN_EVS - current);
    onUpdate({
      vitaminEVs: { ...slot.vitaminEVs, [stat]: current + add },
      evAllocation: { ...slot.evAllocation, [stat]: (slot.evAllocation[stat] ?? 0) + add },
    });
  }

  function removeVitamin(stat: StatKey) {
    const current = slot.vitaminEVs[stat] ?? 0;
    if (current <= 0) return;
    const remove = Math.min(10, current);
    onUpdate({
      vitaminEVs: { ...slot.vitaminEVs, [stat]: current - remove },
      evAllocation: { ...slot.evAllocation, [stat]: Math.max(0, (slot.evAllocation[stat] ?? 0) - remove) },
    });
  }

  function setEVDirectly(stat: StatKey, raw: number) {
    const clamped = Math.max(0, Math.min(EV_STAT_CAP, isNaN(raw) ? 0 : raw));
    const otherTotal = STAT_KEYS.reduce((sum, k) => sum + (k === stat ? 0 : (slot.evAllocation[k] ?? 0)), 0);
    const value = Math.min(clamped, Math.max(0, EV_TOTAL_CAP - otherTotal));
    onUpdate({ evAllocation: { ...slot.evAllocation, [stat]: value } });
    setEvDrafts((d) => { const n = { ...d }; delete n[stat]; return n; });
  }

  function incrementKO(speciesId: number) {
    const log = slot.knockOutLog.map((e) =>
      e.speciesId === speciesId ? { ...e, count: e.count + 1 } : e
    );
    applyKOYields(speciesId, 1, log);
  }

  function decrementKO(speciesId: number) {
    const log = slot.knockOutLog.map((e) =>
      e.speciesId === speciesId ? { ...e, count: Math.max(0, e.count - 1) } : e
    );
    applyKOYields(speciesId, -1, log);
  }

  function removeKO(speciesId: number) {
    const entry = slot.knockOutLog.find((e) => e.speciesId === speciesId);
    if (!entry) return;
    const log = slot.knockOutLog.filter((e) => e.speciesId !== speciesId);
    const pokemon = pokemonMap.get(speciesId);
    if (pokemon?.evYield) {
      const newEvs = { ...slot.evAllocation };
      for (const stat of STAT_KEYS) {
        const yieldVal = pokemon.evYield![stat] ?? 0;
        newEvs[stat] = Math.max(0, (newEvs[stat] ?? 0) - yieldVal * entry.count * multiplier);
      }
      onUpdate({ knockOutLog: log, evAllocation: newEvs });
    } else {
      onUpdate({ knockOutLog: log });
    }
  }

  function applyKOYields(speciesId: number, delta: number, log: typeof slot.knockOutLog) {
    const pokemon = pokemonMap.get(speciesId);
    if (!pokemon?.evYield) { onUpdate({ knockOutLog: log }); return; }
    const newEvs = { ...slot.evAllocation };
    for (const stat of STAT_KEYS) {
      const yieldVal = pokemon.evYield[stat] ?? 0;
      const gained = yieldVal * delta * multiplier;
      newEvs[stat] = Math.min(255, Math.max(0, (newEvs[stat] ?? 0) + gained));
    }
    onUpdate({ knockOutLog: log, evAllocation: newEvs });
  }

  function addKOSpecies(speciesId: number) {
    if (slot.knockOutLog.some((e) => e.speciesId === speciesId)) return;
    const newLog = [...slot.knockOutLog, { speciesId, count: 1 }];
    setKoQuery("");
    setShowKoSearch(false);
    // Apply yield for the initial count of 1 (same path as incrementKO)
    applyKOYields(speciesId, 1, newLog);
  }

  function savePreset() {
    if (!presetName.trim()) return;
    const species = slot.knockOutLog.map((e) => e.speciesId);
    onUpdate({
      routePresets: [...slot.routePresets, { name: presetName.trim(), species }],
    });
    setPresetName("");
  }

  function loadPreset(species: number[]) {
    const toAdd = species.filter((id) => !slot.knockOutLog.some((e) => e.speciesId === id));
    onUpdate({ knockOutLog: [...slot.knockOutLog, ...toAdd.map((id) => ({ speciesId: id, count: 0 }))] });
  }

  const genKey = activeGeneration === 3 ? 3 : 4;
  const [genMin, genMax] = activeGeneration === 3 ? [1, 386] : [1, 493];
  const detectedStat = detectStatKey(koQuery);

  const featuredSuggestions = useMemo(() => {
    if (!detectedStat) return [] as { pokemon: Pokemon; stars: 2 | 3 }[];
    return (FEATURED_GRINDERS[genKey]?.[detectedStat] ?? [])
      .map(({ id, stars }) => ({ pokemon: pokemonMap.get(id), stars }))
      .filter((x): x is { pokemon: Pokemon; stars: 2 | 3 } => x.pokemon != null);
  }, [detectedStat, genKey, pokemonMap]);

  const regularSuggestions = useMemo(() => {
    const q = koQuery.trim();
    if (!q) return [] as Pokemon[];
    if (detectedStat) {
      const featuredIds = new Set(featuredSuggestions.map((f) => f.pokemon.id));
      return allPokemon
        .filter((p) => p.id >= genMin && p.id <= genMax)
        .filter((p) => !featuredIds.has(p.id))
        .filter((p) => (p.evYield?.[detectedStat] ?? 0) > 0)
        .sort((a, b) => (b.evYield?.[detectedStat] ?? 0) - (a.evYield?.[detectedStat] ?? 0))
        .slice(0, 20);
    }
    return allPokemon
      .filter((p) => p.id >= genMin && p.id <= genMax)
      .filter((p) => p.displayName.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
  }, [koQuery, detectedStat, allPokemon, genMin, genMax, featuredSuggestions]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Allocated EVs summary ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400">EV Allocation</span>
          <span className={`text-xs font-mono ${totalEVs > EV_TOTAL_CAP ? "text-red-400" : "text-gray-400"}`}>
            {totalEVs} / {EV_TOTAL_CAP}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STAT_KEYS.map((stat) => {
            const val = slot.evAllocation[stat] ?? 0;
            const pct = Math.min(100, (val / EV_STAT_CAP) * 100);
            const draft = evDrafts[stat];
            return (
              <div key={stat} className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">{STAT_LABELS[stat]}</span>
                <div className="h-1.5 bg-gray-700 rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-[width] duration-150 ${
                      val >= EV_STAT_CAP ? "bg-emerald-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <input
                  type="number"
                  min={0}
                  max={EV_STAT_CAP}
                  value={draft ?? val}
                  onChange={(e) => setEvDrafts((d) => ({ ...d, [stat]: e.target.value }))}
                  onBlur={(e) => setEVDirectly(stat, parseInt(e.target.value))}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="w-full px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-center font-mono text-gray-200 focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Macho Brace / Pokérus toggles ── */}
      <div className="flex gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={slot.machobraceActive}
            onChange={(e) => onUpdate({ machobraceActive: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0"
          />
          <span className="text-sm text-gray-300">Macho Brace (2× yield)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={slot.pokerusActive}
            onChange={(e) => onUpdate({ pokerusActive: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0"
          />
          <span className="text-sm text-gray-300">Pokérus (2× yield)</span>
        </label>
        {multiplier > 1 && (
          <span className="text-xs text-indigo-400 self-center">{multiplier}× multiplier active</span>
        )}
      </div>

      {/* ── Vitamins ── */}
      <div>
        <div className="text-xs font-semibold text-gray-400 mb-2">Vitamins (max 100 EVs each)</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STAT_KEYS.map((stat) => {
            const vitaminUsed = slot.vitaminEVs[stat] ?? 0;
            const maxed = vitaminUsed >= MAX_VITAMIN_EVS;
            const empty = vitaminUsed <= 0;
            return (
              <div key={stat} className="flex flex-col items-center gap-1 p-2 rounded border border-gray-700 text-xs text-gray-300">
                <span className="font-medium">{VITAMIN_LABELS[stat]}</span>
                <span className="text-gray-500 text-[10px]">{vitaminUsed}/100</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => removeVitamin(stat)}
                    disabled={empty}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <button
                    onClick={() => applyVitamin(stat)}
                    disabled={maxed}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Route Presets ── */}
      {slot.routePresets.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-2">Route Presets</div>
          <div className="flex gap-1.5 flex-wrap">
            {slot.routePresets.map((preset, i) => (
              <button
                key={i}
                onClick={() => loadPreset(preset.species)}
                className="px-2.5 py-1 rounded-full text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KO Log ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400">Knock-Out Log</span>
          <button
            onClick={() => setShowKoOverlay(true)}
            className="text-xs px-2 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
          >
            Full screen
          </button>
        </div>

        {slot.knockOutLog.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {slot.knockOutLog.map((entry) => {
              const pokemon = pokemonMap.get(entry.speciesId);
              const sprite = pokemon ? getGenSprite(pokemon, activeGeneration) : null;
              return (
                <div key={entry.speciesId} className="flex items-center gap-2 bg-gray-800/50 rounded p-2">
                  {sprite && <img src={sprite} alt="" className="w-7 h-7 object-contain pixelated flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200">{pokemon?.displayName ?? `#${entry.speciesId}`}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => decrementKO(entry.speciesId)}
                      className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-mono text-white">{entry.count}</span>
                    <button
                      onClick={() => incrementKO(entry.speciesId)}
                      className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm flex items-center justify-center"
                    >
                      +
                    </button>
                    <button onClick={() => removeKO(entry.speciesId)} className="ml-1 text-gray-600 hover:text-red-400">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save as preset */}
        {slot.knockOutLog.length > 0 && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={savePreset}
              disabled={!presetName.trim()}
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs text-white"
            >
              Save
            </button>
          </div>
        )}

        {/* Species search */}
        <div className="relative">
          <input
            type="text"
            placeholder='Search by name or stat (e.g. "attack")…'
            value={koQuery}
            onChange={(e) => { setKoQuery(e.target.value); setShowKoSearch(true); }}
            onFocus={() => setShowKoSearch(true)}
            className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {showKoSearch && (featuredSuggestions.length > 0 || regularSuggestions.length > 0) && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowKoSearch(false)} />
              <div className="absolute bottom-full left-0 right-0 z-50 mb-0.5 bg-gray-800 border border-gray-700 rounded shadow-lg max-h-60 overflow-y-auto">
                <SuggestionList
                  featured={featuredSuggestions}
                  regular={regularSuggestions}
                  detectedStat={detectedStat}
                  activeGeneration={activeGeneration}
                  compact
                  onAdd={(id) => addKOSpecies(id)}
                  onClose={() => setShowKoSearch(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── KO Counter fullscreen overlay ── */}
      {showKoOverlay && (
        <KoOverlay
          slot={slot}
          activeGeneration={activeGeneration}
          pokemonMap={pokemonMap}
          multiplier={multiplier}
          koQuery={koQuery}
          setKoQuery={setKoQuery}
          detectedStat={detectedStat}
          featuredSuggestions={featuredSuggestions}
          regularSuggestions={regularSuggestions}
          onClose={() => setShowKoOverlay(false)}
          onIncrement={incrementKO}
          onDecrement={decrementKO}
          onRemove={removeKO}
          onAdd={addKOSpecies}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// ─── Suggestion list (shared between inline search and overlay) ───────────────

interface SuggestionListProps {
  featured: { pokemon: Pokemon; stars: 2 | 3 }[];
  regular: Pokemon[];
  detectedStat: StatKey | null;
  activeGeneration: number;
  compact?: boolean;
  onAdd: (id: number) => void;
  onClose: () => void;
}

function SuggestionList({
  featured,
  regular,
  detectedStat,
  activeGeneration,
  compact,
  onAdd,
  onClose,
}: SuggestionListProps) {
  const py = compact ? "py-2" : "py-3";
  const imgSize = compact ? "w-7 h-7" : "w-9 h-9";

  return (
    <>
      {featured.length > 0 && (
        <>
          <div className="px-3 py-1 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider bg-gray-900/60 border-b border-gray-700/50">
            Top {detectedStat ? STAT_LABELS[detectedStat] : ""} grinders
          </div>
          {featured.map(({ pokemon: p, stars }) => {
            const yieldAmt = detectedStat ? (p.evYield?.[detectedStat] ?? 0) : 0;
            return (
              <button
                key={p.id}
                onClick={() => { onAdd(p.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 ${py} hover:bg-gray-700 text-sm text-left border-b border-gray-700/30 last:border-0`}
              >
                <img src={getGenSprite(p, activeGeneration)} alt="" className={`${imgSize} object-contain pixelated flex-shrink-0`} />
                <span className="text-gray-200 flex-1 truncate">{p.displayName}</span>
                {detectedStat && yieldAmt > 0 && (
                  <span className="text-indigo-300 text-xs font-mono flex-shrink-0">+{yieldAmt} {STAT_LABELS[detectedStat]}</span>
                )}
                <span className="text-amber-400 text-xs flex-shrink-0">{stars === 3 ? "★★★" : "★★"}</span>
              </button>
            );
          })}
        </>
      )}
      {regular.length > 0 && (
        <>
          {featured.length > 0 && (
            <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-900/60 border-b border-gray-700/50">
              {detectedStat ? "Others" : "Results"}
            </div>
          )}
          {regular.map((p) => {
            const yieldAmt = detectedStat ? (p.evYield?.[detectedStat] ?? 0) : 0;
            return (
              <button
                key={p.id}
                onClick={() => { onAdd(p.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 ${py} hover:bg-gray-700 text-sm text-left border-b border-gray-700/30 last:border-0`}
              >
                <img src={getGenSprite(p, activeGeneration)} alt="" className={`${imgSize} object-contain pixelated flex-shrink-0`} />
                <span className="text-gray-200 flex-1 truncate">{p.displayName}</span>
                {detectedStat && yieldAmt > 0 && (
                  <span className="text-gray-400 text-xs font-mono flex-shrink-0">+{yieldAmt} {STAT_LABELS[detectedStat]}</span>
                )}
                {!detectedStat && (
                  <span className="text-gray-500 text-xs flex-shrink-0">#{formatDexNumber(p.id)}</span>
                )}
              </button>
            );
          })}
        </>
      )}
    </>
  );
}

// ─── KO Counter fullscreen overlay ────────────────────────────────────────────

interface KoOverlayProps {
  slot: DesignerSlot;
  activeGeneration: number;
  pokemonMap: Map<number, Pokemon>;
  multiplier: number;
  koQuery: string;
  setKoQuery: (q: string) => void;
  detectedStat: StatKey | null;
  featuredSuggestions: { pokemon: Pokemon; stars: 2 | 3 }[];
  regularSuggestions: Pokemon[];
  onClose: () => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
  onRemove: (id: number) => void;
  onAdd: (id: number) => void;
  onUpdate: (patch: Partial<DesignerSlot>) => void;
}

function KoOverlay({
  slot,
  activeGeneration,
  pokemonMap,
  multiplier,
  koQuery,
  setKoQuery,
  detectedStat,
  featuredSuggestions,
  regularSuggestions,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onAdd,
  onUpdate,
}: KoOverlayProps) {
  const [showSearch, setShowSearch] = useState(false);

  const totalEVs = STAT_KEYS.reduce((sum, k) => sum + (slot.evAllocation[k] ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <h2 className="text-base font-bold text-white">KO Counter</h2>
        <div className="flex items-center gap-3">
          {multiplier > 1 && (
            <span className="text-xs text-indigo-400">{multiplier}× multiplier</span>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* EV summary */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400">EV Allocation</span>
          <span className={`text-xs font-mono ${totalEVs > EV_TOTAL_CAP ? "text-red-400" : "text-gray-500"}`}>
            {totalEVs} / {EV_TOTAL_CAP}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {STAT_KEYS.map((stat) => {
            const val = slot.evAllocation[stat] ?? 0;
            const pct = Math.min(100, (val / EV_STAT_CAP) * 100);
            return (
              <div key={stat} className="flex flex-col gap-1 items-center">
                <span className="text-[10px] text-gray-500">{STAT_LABELS[stat]}</span>
                <div className="w-full h-1.5 bg-gray-700 rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-[width] duration-150 ${val >= EV_STAT_CAP ? "bg-emerald-500" : "bg-indigo-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-[11px] font-mono ${val >= EV_STAT_CAP ? "text-emerald-400" : "text-gray-300"}`}>{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multiplier toggles */}
      <div className="flex gap-4 px-4 py-2.5 border-b border-gray-800 bg-gray-900/30 flex-shrink-0 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={slot.machobraceActive}
            onChange={(e) => onUpdate({ machobraceActive: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0 w-4 h-4"
          />
          <span className="text-sm text-gray-300">Macho Brace (2×)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={slot.pokerusActive}
            onChange={(e) => onUpdate({ pokerusActive: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0 w-4 h-4"
          />
          <span className="text-sm text-gray-300">Pokérus (2×)</span>
        </label>
      </div>

      {/* KO log — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {slot.knockOutLog.length === 0 ? (
          <p className="text-center text-gray-600 text-sm mt-12">
            No Pokémon added yet. Search below to start tracking.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {slot.knockOutLog.map((entry) => {
              const pokemon = pokemonMap.get(entry.speciesId);
              const sprite = pokemon ? getGenSprite(pokemon, activeGeneration) : null;
              return (
                <div
                  key={entry.speciesId}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3"
                >
                  {sprite && (
                    <img src={sprite} alt="" className="w-10 h-10 object-contain pixelated flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {pokemon?.displayName ?? `#${entry.speciesId}`}
                    </div>
                    {pokemon?.evYield && (
                      <div className="text-xs text-gray-500 truncate">
                        {Object.entries(pokemon.evYield)
                          .filter(([, v]) => (v ?? 0) > 0)
                          .map(([k, v]) => `+${(v ?? 0) * multiplier} ${STAT_LABELS[k as StatKey]}`)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onDecrement(entry.speciesId)}
                      className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-200 text-xl flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-lg font-bold font-mono text-white">
                      {entry.count}
                    </span>
                    <button
                      onClick={() => onIncrement(entry.speciesId)}
                      className="w-12 h-12 rounded-xl bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-500 text-white text-xl flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onRemove(entry.speciesId)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Species search — pinned at bottom */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800 bg-gray-900">
        <div className="relative">
          <input
            type="text"
            placeholder='Search by name or stat (e.g. "attack")…'
            value={koQuery}
            onChange={(e) => { setKoQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {showSearch && (featuredSuggestions.length > 0 || regularSuggestions.length > 0) && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />
              <div className="absolute bottom-full left-0 right-0 z-50 mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                <SuggestionList
                  featured={featuredSuggestions}
                  regular={regularSuggestions}
                  detectedStat={detectedStat}
                  activeGeneration={activeGeneration}
                  onAdd={onAdd}
                  onClose={() => setShowSearch(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
