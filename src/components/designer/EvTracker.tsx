import { useState } from "react";
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

export default function EvTracker({ slot, allPokemon, activeGeneration, onUpdate }: Props) {
  const [koQuery, setKoQuery] = useState("");
  const [showKoSearch, setShowKoSearch] = useState(false);
  const [presetName, setPresetName] = useState("");

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

  const genRange = activeGeneration === 3 ? [1, 386] : [1, 493];
  const koSuggestions = koQuery.trim()
    ? allPokemon
        .filter((p) => p.id >= genRange[0] && p.id <= genRange[1])
        .filter((p) => p.displayName.toLowerCase().includes(koQuery.toLowerCase()))
        .slice(0, 8)
    : [];

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
            return (
              <div key={stat} className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500">{STAT_LABELS[stat]}</span>
                <div className="h-1.5 bg-gray-700 rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-[width] duration-150 ${
                      val >= EV_STAT_CAP ? "bg-emerald-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-center font-mono text-gray-300">{val}</span>
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
            return (
              <button
                key={stat}
                onClick={() => applyVitamin(stat)}
                disabled={maxed}
                className={`flex flex-col items-center gap-0.5 p-2 rounded border text-xs transition-colors ${
                  maxed
                    ? "border-gray-700 text-gray-600 cursor-not-allowed"
                    : "border-gray-700 hover:border-indigo-500 hover:bg-gray-800 text-gray-300"
                }`}
              >
                <span className="font-medium">{VITAMIN_LABELS[stat]}</span>
                <span className="text-gray-500">{vitaminUsed}/100</span>
              </button>
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
        <div className="text-xs font-semibold text-gray-400 mb-2">Knock-Out Log</div>

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
            placeholder="Add species to KO log…"
            value={koQuery}
            onChange={(e) => { setKoQuery(e.target.value); setShowKoSearch(true); }}
            onFocus={() => setShowKoSearch(true)}
            className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {showKoSearch && koSuggestions.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowKoSearch(false)} />
              <div className="absolute bottom-full left-0 right-0 z-50 mb-0.5 bg-gray-800 border border-gray-700 rounded shadow-lg">
                {koSuggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addKOSpecies(p.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 text-sm text-left"
                  >
                    <img src={getGenSprite(p, activeGeneration)} alt="" className="w-6 h-6 object-contain pixelated" />
                    <span className="text-gray-200">{p.displayName}</span>
                    <span className="text-gray-500 text-xs ml-auto">#{formatDexNumber(p.id)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
