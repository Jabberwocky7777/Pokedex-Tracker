import { useState, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import {
  NATURES, STAT_KEYS, STAT_LABELS,
  findIVs, ivRange, intersectIVSets, getNatureMultiplier,
  calculateHiddenPower,
} from "../../lib/iv-calc";
import type { StatKey } from "../../lib/iv-calc";
import type { DesignerSlot, IvDataPoint } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";
import TypeBadge from "../shared/TypeBadge";

interface Props {
  slot: DesignerSlot;
  pokemon: Pokemon;
  onUpdate: (patch: Partial<DesignerSlot>) => void;
}

function emptyStats(): Record<StatKey, string> {
  return { hp: "", atk: "", def: "", spAtk: "", spDef: "", spe: "" };
}

export default function IvSection({ slot, pokemon, onUpdate }: Props) {
  const nature = NATURES.find((n) => n.name === slot.natureName) ?? NATURES[0];
  const [draftPoints, setDraftPoints] = useState<IvDataPoint[]>(
    slot.ivDataPoints.length > 0
      ? slot.ivDataPoints
      : [{ level: 50, stats: emptyStats() }]
  );
  const [levelDrafts, setLevelDrafts] = useState<Record<number, string>>({});

  function addPoint() {
    setDraftPoints((p) => [
      ...p,
      { level: 50, stats: emptyStats(), evSnapshot: { ...slot.evAllocation } },
    ]);
  }

  function updatePoint(index: number, patch: Partial<IvDataPoint>) {
    setDraftPoints((pts) => {
      const next = pts.map((p, i) => i === index ? { ...p, ...patch } : p);
      onUpdate({ ivDataPoints: next });
      return next;
    });
  }

  function removePoint(index: number) {
    setDraftPoints((pts) => {
      const next = pts.filter((_, i) => i !== index);
      onUpdate({ ivDataPoints: next });
      return next;
    });
  }

  function confirmIV(stat: StatKey, iv: number) {
    onUpdate({ confirmedIVs: { ...slot.confirmedIVs, [stat]: iv } });
  }

  function unconfirmIV(stat: StatKey) {
    onUpdate({ confirmedIVs: { ...slot.confirmedIVs, [stat]: null } });
  }

  function clearAllConfirmedIVs() {
    onUpdate({ confirmedIVs: { hp: null, atk: null, def: null, spAtk: null, spDef: null, spe: null } });
  }

  const ranges = useMemo(() => {
    const result = {} as Record<StatKey, { min: number; max: number } | null>;
    for (const stat of STAT_KEYS) {
      const base = pokemon.baseStats[stat as keyof typeof pokemon.baseStats];
      const mod = getNatureMultiplier(nature, stat);
      const sets = draftPoints
        .map((pt) => {
          const observed = parseInt(pt.stats[stat] || "");
          if (isNaN(observed)) return [];
          // Use the EV snapshot captured when this data point was added, falling back to current EVs
          const ptEv = (pt.evSnapshot ?? slot.evAllocation)[stat] ?? 0;
          return findIVs(base, ptEv, pt.level, mod, observed, stat === "hp");
        })
        .filter((s) => s.length > 0);
      const intersection = intersectIVSets(sets);
      result[stat] = ivRange(intersection);
    }
    return result;
  }, [draftPoints, pokemon, slot.evAllocation, nature]);

  const allConfirmed = STAT_KEYS.every((k) => slot.confirmedIVs[k] != null);
  const hiddenPower = allConfirmed
    ? calculateHiddenPower(slot.confirmedIVs as Record<StatKey, number>)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Data point rows */}
      <div className="flex flex-col gap-2">
        {draftPoints.map((pt, idx) => (
          <div key={idx} className="flex items-center gap-1.5 flex-wrap">
            <label className="text-xs text-gray-400 w-8">Lv.</label>
            <input
              type="number"
              min={1}
              max={100}
              value={levelDrafts[idx] ?? pt.level}
              onChange={(e) => setLevelDrafts((d) => ({ ...d, [idx]: e.target.value }))}
              onBlur={(e) => {
                const n = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                updatePoint(idx, { level: n });
                setLevelDrafts((d) => { const next = { ...d }; delete next[idx]; return next; });
              }}
              className="w-14 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            {STAT_KEYS.map((stat) => (
              <input
                key={stat}
                type="text"
                inputMode="numeric"
                placeholder={STAT_LABELS[stat]}
                value={pt.stats[stat]}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "?") {
                    unconfirmIV(stat);
                    updatePoint(idx, { stats: { ...pt.stats, [stat]: "" } });
                    return;
                  }
                  updatePoint(idx, { stats: { ...pt.stats, [stat]: v } });
                }}
                className="w-16 px-1.5 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-gray-600"
              />
            ))}
            {draftPoints.length > 1 && (
              <button onClick={() => removePoint(idx)} className="text-gray-600 hover:text-red-400 text-xs px-1">×</button>
            )}
          </div>
        ))}
        <button
          onClick={addPoint}
          className="text-xs text-indigo-400 hover:text-indigo-300 self-start"
        >
          + Add data point
        </button>
      </div>

      {/* IV range results */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">IV ranges</span>
        <button
          onClick={clearAllConfirmedIVs}
          title="Clear all confirmed IVs"
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STAT_KEYS.map((stat) => {
          const range = ranges[stat];
          const confirmed = slot.confirmedIVs[stat];
          const isSingle = range && range.min === range.max;

          return (
            <div key={stat} className="flex flex-col gap-0.5 text-center">
              <div className="text-xs text-gray-500">{STAT_LABELS[stat]}</div>
              <div className="text-sm text-white font-mono">
                {confirmed != null ? (
                  <span className="text-emerald-400">{confirmed}</span>
                ) : range ? (
                  range.min === range.max ? (
                    <span className="text-indigo-300">{range.min}</span>
                  ) : (
                    <span>{range.min}–{range.max}</span>
                  )
                ) : (
                  <span className="text-gray-600">?</span>
                )}
              </div>
              {isSingle && confirmed == null && (
                <button
                  onClick={() => confirmIV(stat, range!.min)}
                  className="text-xs text-indigo-400 hover:text-indigo-200"
                >
                  Confirm
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden Power */}
      {hiddenPower && (
        <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 rounded p-2">
          <span className="text-gray-400">Hidden Power:</span>
          <TypeBadge type={hiddenPower.type} size="sm" />
          <span>Base Power: {hiddenPower.power}</span>
        </div>
      )}

      {!allConfirmed && (
        <p className="text-xs text-gray-600">Confirm all IVs to see Hidden Power</p>
      )}
    </div>
  );
}
