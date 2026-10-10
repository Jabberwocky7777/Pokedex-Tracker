import { useState, useMemo, useEffect } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import {
  NATURES, STAT_KEYS, STAT_LABELS,
  findIVs, ivRange, intersectIVSets, getNatureMultiplier,
  calculateHiddenPower, nextDivergentLevel,
} from "../../lib/iv-calc";
import type { StatKey, Nature } from "../../lib/iv-calc";
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

function computeRanges(
  draftPoints: IvDataPoint[],
  pokemon: Pokemon,
  nature: Nature
): Record<StatKey, { min: number; max: number; candidates: number[] } | null> {
  const result = {} as Record<StatKey, { min: number; max: number; candidates: number[] } | null>;
  for (const stat of STAT_KEYS) {
    const base = pokemon.baseStats[stat as keyof typeof pokemon.baseStats];
    const mod = getNatureMultiplier(nature, stat);
    const sets = draftPoints
      .map((pt) => {
        const observed = parseInt(pt.stats[stat] || "");
        if (isNaN(observed)) return [];
        const ptEv = pt.evSnapshot ? (pt.evSnapshot[stat] ?? 0) : 0;
        return findIVs(base, ptEv, pt.level, mod, observed, stat === "hp");
      })
      .filter((s) => s.length > 0);
    const intersection = intersectIVSets(sets);
    const range = ivRange(intersection);
    result[stat] = range ? { ...range, candidates: intersection } : null;
  }
  return result;
}

export default function IvSection({ slot, pokemon, onUpdate }: Props) {
  const nature = NATURES.find((n) => n.name === slot.natureName) ?? NATURES[0];
  const [draftPoints, setDraftPoints] = useState<IvDataPoint[]>(
    slot.ivDataPoints.length > 0
      ? slot.ivDataPoints
      : [{ level: 50, stats: emptyStats(), evSnapshot: { ...slot.evAllocation } }]
  );
  const [levelDrafts, setLevelDrafts] = useState<Record<number, string>>({});

  function addPoint() {
    setDraftPoints((p) => [
      ...p,
      { level: 50, stats: emptyStats(), evSnapshot: { ...slot.evAllocation } },
    ]);
  }

  function updatePoint(index: number, patch: Partial<IvDataPoint>) {
    const next = draftPoints.map((p, i) => i === index ? { ...p, ...patch } : p);
    setDraftPoints(next);
    onUpdate({ ivDataPoints: next });
  }

  function removePoint(index: number) {
    const next = draftPoints.filter((_, i) => i !== index);
    setDraftPoints(next);
    onUpdate({ ivDataPoints: next });
  }

  function confirmIV(stat: StatKey, iv: number) {
    onUpdate({ confirmedIVs: { ...slot.confirmedIVs, [stat]: iv } });
  }

  function unconfirmIV(stat: StatKey) {
    onUpdate({ confirmedIVs: { ...slot.confirmedIVs, [stat]: null } });
  }

  function clearAllConfirmedIVs() {
    // Recompute ranges immediately from current draft points so inferred IVs
    // are restored in the same update rather than waiting for the useEffect.
    const freshPoints =
      slot.ivDataPoints.length > 0
        ? slot.ivDataPoints
        : [{ level: 50, stats: emptyStats() }];
    const freshRanges = computeRanges(freshPoints, pokemon, nature);
    const inferred: Partial<Record<StatKey, number>> = {};
    for (const stat of STAT_KEYS) {
      const r = freshRanges[stat];
      if (r) inferred[stat] = r.min;
    }
    onUpdate({
      confirmedIVs: { hp: null, atk: null, def: null, spAtk: null, spDef: null, spe: null },
      inferredIVs: inferred,
    });
    // Force new array reference so ranges useMemo re-runs even if content is unchanged
    setDraftPoints([...freshPoints]);
  }

  const ranges = useMemo(
    () => computeRanges(draftPoints, pokemon, nature),
    [draftPoints, pokemon, nature]
  );

  // Highest level with any stat entered — used as the starting point for check-level hints.
  const maxDataLevel = useMemo(() => {
    return draftPoints
      .filter((pt) => STAT_KEYS.some((k) => pt.stats[k].trim() !== ""))
      .reduce((max, pt) => Math.max(max, pt.level), 0);
  }, [draftPoints]);

  // For each ambiguous stat, the lowest level >= maxDataLevel+1 where candidates diverge.
  const checkLevels = useMemo(() => {
    const result = {} as Record<StatKey, number | null>;
    const fromLevel = maxDataLevel + 1;
    for (const stat of STAT_KEYS) {
      const range = ranges[stat];
      if (!range || range.min === range.max || range.candidates.length <= 1) {
        result[stat] = null;
        continue;
      }
      const base = pokemon.baseStats[stat as keyof typeof pokemon.baseStats];
      const mod = getNatureMultiplier(nature, stat);
      const ev = slot.evAllocation[stat] ?? 0;
      result[stat] = nextDivergentLevel(range.candidates, base, ev, mod, stat === "hp", fromLevel);
    }
    return result;
  }, [ranges, maxDataLevel, pokemon, nature, slot.evAllocation]);

  // Sync inferredIVs whenever ranges change (nature or data point edits)
  useEffect(() => {
    const inferred: Partial<Record<StatKey, number>> = {};
    for (const stat of STAT_KEYS) {
      const range = ranges[stat];
      if (range) inferred[stat] = range.min;
    }
    // Only write when something changed. A store write counts as an edit for
    // sync, and merely opening a slot must not look like one.
    const unchanged = STAT_KEYS.every((stat) => inferred[stat] === slot.inferredIVs?.[stat]);
    if (!unchanged) onUpdate({ inferredIVs: inferred });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranges]);

  const allConfirmed = STAT_KEYS.every((k) => slot.confirmedIVs[k] != null);
  const noDataEntered = draftPoints.every((pt) =>
    STAT_KEYS.every((k) => !pt.stats[k].trim())
  );
  const allRangesNull = STAT_KEYS.every((k) => ranges[k] === null && slot.confirmedIVs[k] == null);
  const hiddenPower = allConfirmed
    ? calculateHiddenPower(slot.confirmedIVs as Record<StatKey, number>)
    : null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── IV Summary (always at top) ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 font-medium">IV ranges</span>
          <button
            onClick={clearAllConfirmedIVs}
            title="Clear all confirmed IVs and re-derive from data points"
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors"
          >
            <RotateCcw size={11} />
            <span>Reset Confirmations</span>
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STAT_KEYS.map((stat) => {
            const range = ranges[stat];
            const confirmed = slot.confirmedIVs[stat];
            const isSingle = range && range.min === range.max;
            const isImpossible = !noDataEntered && range === null && confirmed == null;

            return (
              <div key={stat} className="flex flex-col gap-0.5 text-center">
                <div className="text-xs text-gray-500">{STAT_LABELS[stat]}</div>
                <div className="text-sm font-mono leading-tight">
                  {confirmed != null ? (
                    <span className="text-emerald-400 font-semibold">{confirmed}</span>
                  ) : range ? (
                    isSingle ? (
                      <span className="text-indigo-300">{range.min}</span>
                    ) : (
                      <span className="text-gray-300">{range.min}–{range.max}</span>
                    )
                  ) : isImpossible ? (
                    <span className="text-red-500">!</span>
                  ) : (
                    <span className="text-gray-700">—</span>
                  )}
                </div>
                {isSingle && confirmed == null && (
                  <button
                    onClick={() => confirmIV(stat, range!.min)}
                    className="text-xs text-indigo-400 hover:text-indigo-200 leading-tight"
                  >
                    Confirm
                  </button>
                )}
                {confirmed != null && (
                  <button
                    onClick={() => unconfirmIV(stat)}
                    className="text-xs text-gray-600 hover:text-gray-400 leading-tight"
                  >
                    ✕
                  </button>
                )}
                {!isSingle && confirmed == null && checkLevels[stat] != null && (
                  <span
                    className="text-xs text-yellow-700 leading-tight"
                    title={`Check this stat at Lv. ${checkLevels[stat]} to narrow the range`}
                  >
                    → Lv. {checkLevels[stat]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {allRangesNull && noDataEntered && (
          <p className="text-xs text-gray-600 mt-2">Enter observed stats below to compute ranges</p>
        )}
        {allRangesNull && !noDataEntered && (
          <p className="text-xs text-amber-700 mt-2">
            No valid IVs found — check level, nature, and EVs match your in-game Pokémon
          </p>
        )}
      </div>

      {/* ── Data point rows ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-500">Observed stats</span>
        {draftPoints.map((pt, idx) => {
          const missingEvSnapshot = idx > 0 && pt.evSnapshot === undefined;
          return (
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
              {missingEvSnapshot && (
                <span
                  title="This data point was recorded before EV tracking — EVs assumed 0. Re-enter to snapshot current EVs."
                  className="text-amber-500 cursor-help"
                >
                  <AlertTriangle size={12} />
                </span>
              )}
              {draftPoints.length > 1 && (
                <button onClick={() => removePoint(idx)} className="text-gray-600 hover:text-red-400 text-xs px-1">×</button>
              )}
            </div>
          );
        })}
        <button
          onClick={addPoint}
          title="Snapshot taken at current EVs"
          className="text-xs text-indigo-400 hover:text-indigo-300 self-start"
        >
          + Add data point (snapshots current EVs)
        </button>
      </div>

      {/* ── Hidden Power ────────────────────────────────────────── */}
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
