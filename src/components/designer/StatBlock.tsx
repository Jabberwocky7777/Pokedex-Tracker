import { useMemo, useState } from "react";
import { NATURES, STAT_KEYS, STAT_LABELS, getNatureMultiplier } from "../../lib/iv-calc";
import { calcAllStats } from "../../lib/stat-calc";
import type { StatKey } from "../../lib/iv-calc";
import type { DesignerSlot } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";

interface Props {
  slot: DesignerSlot;
  pokemon: Pokemon;
  activeGeneration: number;
  onUpdate: (patch: Partial<DesignerSlot>) => void;
}

const EV_DEAD_ZONE = 252;

export default function StatBlock({ slot, pokemon, activeGeneration, onUpdate }: Props) {
  const nature = NATURES.find((n) => n.name === slot.natureName) ?? NATURES[0];
  const sprite = getGenSprite(pokemon, activeGeneration);
  const [levelDraft, setLevelDraft] = useState<string | null>(null);

  const computedStats = useMemo(() => {
    const ivs = STAT_KEYS.reduce((acc, k) => {
      acc[k] = slot.confirmedIVs[k] ?? 15;
      return acc;
    }, {} as Record<StatKey, number>);
    return calcAllStats(pokemon.baseStats, ivs, slot.evAllocation, nature, slot.level);
  }, [pokemon.baseStats, slot.confirmedIVs, slot.evAllocation, nature, slot.level]);

  function setNature(name: string) {
    onUpdate({ natureName: name });
  }

  function setLevel(v: number) {
    onUpdate({ level: Math.max(1, Math.min(100, v)) });
  }

  function setEV(stat: StatKey, raw: string) {
    const val = Math.max(0, Math.min(255, parseInt(raw) || 0));
    onUpdate({ evAllocation: { ...slot.evAllocation, [stat]: val } });
  }

  function setIV(stat: StatKey, raw: string) {
    const val = Math.max(0, Math.min(31, parseInt(raw) || 0));
    onUpdate({ confirmedIVs: { ...slot.confirmedIVs, [stat]: val } });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pokémon header row */}
      <div className="flex items-center gap-4">
        {sprite && (
          <img src={sprite} alt={pokemon.displayName} className="w-16 h-16 object-contain pixelated flex-shrink-0" />
        )}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-white">{slot.nickname || pokemon.displayName}</span>
            {slot.nickname && (
              <span className="text-sm text-gray-400">({pokemon.displayName})</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Level */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Lv.</span>
              <input
                type="number"
                min={1}
                max={100}
                value={levelDraft ?? slot.level}
                onChange={(e) => setLevelDraft(e.target.value)}
                onBlur={(e) => {
                  setLevel(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)));
                  setLevelDraft(null);
                }}
                className="w-14 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {/* Nature */}
            <select
              value={slot.natureName}
              onChange={(e) => setNature(e.target.value)}
              className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {NATURES.map((n) => (
                <option key={n.name} value={n.name}>{n.name}</option>
              ))}
            </select>
            {/* Ability */}
            {pokemon.abilities.length > 0 && (
              <select
                value={slot.ability ?? ""}
                onChange={(e) => onUpdate({ ability: e.target.value || null })}
                className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">— Ability —</option>
                {pokemon.abilities.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.displayName}{a.isHidden ? " (Hidden)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* Nature note */}
          {(nature.plus || nature.minus) && (
            <div className="text-xs text-gray-500">
              {nature.plus && <span className="text-emerald-400">+{STAT_LABELS[nature.plus]}</span>}
              {nature.plus && nature.minus && <span> / </span>}
              {nature.minus && <span className="text-red-400">-{STAT_LABELS[nature.minus]}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Stat table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 text-left">
              <th className="pb-1 font-medium w-16">Stat</th>
              <th className="pb-1 font-medium text-right pr-2">Base</th>
              <th className="pb-1 font-medium text-center w-14">IV</th>
              <th className="pb-1 font-medium text-center w-14">EV</th>
              <th className="pb-1 font-medium pl-2">Bar</th>
              <th className="pb-1 font-medium text-right w-12">Total</th>
            </tr>
          </thead>
          <tbody>
            {STAT_KEYS.map((stat) => {
              const base = pokemon.baseStats[stat as keyof typeof pokemon.baseStats];
              const computed = computedStats[stat];
              const mod = getNatureMultiplier(nature, stat);
              const ev = slot.evAllocation[stat] ?? 0;
              const iv = slot.confirmedIVs[stat];
              const isConfirmed = iv != null;
              const barPct = Math.min(100, (computed / 714) * 100);

              let labelClass = "text-gray-300";
              if (mod > 1) labelClass = "text-emerald-400 font-semibold";
              if (mod < 1) labelClass = "text-red-400 font-semibold";

              return (
                <tr key={stat} className="border-t border-gray-800">
                  <td className={`py-1 ${labelClass}`}>{STAT_LABELS[stat]}</td>
                  <td className="py-1 text-right pr-2 text-gray-400">{base}</td>
                  <td className="py-1 text-center">
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={isConfirmed ? iv : ""}
                      placeholder="?"
                      onChange={(e) => setIV(stat, e.target.value)}
                      className={`w-12 px-1 py-0.5 rounded text-center bg-gray-800 focus:outline-none focus:border-indigo-500 ${
                        isConfirmed ? "border border-gray-600 text-white" : "border border-dashed border-gray-600 text-gray-500"
                      }`}
                    />
                  </td>
                  <td className="py-1 text-center">
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={ev || ""}
                      placeholder="0"
                      onChange={(e) => setEV(stat, e.target.value)}
                      className={`w-12 px-1 py-0.5 rounded text-center bg-gray-800 border focus:outline-none focus:border-indigo-500 ${
                        ev > EV_DEAD_ZONE ? "border-amber-500 text-amber-300" : "border-gray-600 text-white"
                      }`}
                    />
                  </td>
                  <td className="py-1 pl-2">
                    <div className="w-full bg-gray-700 rounded-full h-1.5 min-w-[60px]">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500 transition-[width] duration-200"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-1 text-right font-mono text-white">{computed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-1">EVs marked amber exceed the 252 effective cap</p>
      </div>
    </div>
  );
}
