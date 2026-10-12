import { PokemonLink } from "../shared/links";
import { useMemo, useState } from "react";
import { NATURES, STAT_KEYS, STAT_LABELS, calcStat, getNatureMultiplier } from "../../lib/iv-calc";
import { calcAllStats, UNKNOWN_IV } from "../../lib/stat-calc";
import type { StatKey } from "../../lib/iv-calc";
import type { DesignerSlot } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { abilitiesInGeneration } from "../../lib/generation";

interface Props {
  slot: DesignerSlot;
  pokemon: Pokemon;
  activeGeneration: number;
  onUpdate: (patch: Partial<DesignerSlot>) => void;
}

const EV_DEAD_ZONE = 252;

// Speed benchmarks — base speed, neutral 31 IV / 0 EV / neutral nature reference label
const SPEED_TIERS = [
  { baseSpe: 130, label: "Jolteon / Aerodactyl" },
  { baseSpe: 120, label: "Alakazam / Dugtrio" },
  { baseSpe: 115, label: "Starmie / Raikou" },
  { baseSpe: 110, label: "Gengar / Latios" },
  { baseSpe: 100, label: "Salamence / Zapdos" },
  { baseSpe: 95,  label: "Arcanine / Houndoom" },
  { baseSpe: 90,  label: "Lucario / Roserade" },
  { baseSpe: 80,  label: "Dragonite / Togekiss" },
];

/** Speed for a Pokémon with given baseSpe at level, 31 IVs, 0 EVs, neutral nature */
function neutralSpeedAtLevel(baseSpe: number, level: number): number {
  return calcStat(baseSpe, 31, 0, level, 1);
}

export default function StatBlock({ slot, pokemon, activeGeneration, onUpdate }: Props) {
  const nature = NATURES.find((n) => n.name === slot.natureName) ?? NATURES[0];
  const sprite = getGenSprite(pokemon, activeGeneration);
  const abilities = abilitiesInGeneration(pokemon, activeGeneration);
  const [levelDraft, setLevelDraft] = useState<string | null>(null);

  const computedStats = useMemo(() => {
    const ivs = STAT_KEYS.reduce((acc, k) => {
      // confirmedIVs (user-set) → inferredIVs (auto from ranges) → UNKNOWN_IV
      acc[k] = slot.confirmedIVs[k] ?? slot.inferredIVs?.[k] ?? UNKNOWN_IV;
      return acc;
    }, {} as Record<StatKey, number>);
    return calcAllStats(pokemon.baseStats, ivs, slot.evAllocation, nature, slot.level);
  }, [pokemon.baseStats, slot.confirmedIVs, slot.inferredIVs, slot.evAllocation, nature, slot.level]);

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
    // An emptied box means "unknown again", not an IV of 0
    const val = raw.trim() === "" ? null : Math.max(0, Math.min(31, parseInt(raw) || 0));
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
            {/* The species is the link: on its own, or in brackets after a nickname */}
            {slot.nickname ? (
              <>
                <span className="text-lg font-bold text-white">{slot.nickname}</span>
                <span className="text-sm text-gray-400">(<PokemonLink id={pokemon.id}>{pokemon.displayName}</PokemonLink>)</span>
              </>
            ) : (
              <PokemonLink id={pokemon.id} className="text-lg font-bold text-white">{pokemon.displayName}</PokemonLink>
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
            {abilities.length > 0 && (
              <select
                value={slot.ability ?? ""}
                onChange={(e) => onUpdate({ ability: e.target.value || null })}
                className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">— Ability —</option>
                {abilities.map((a) => (
                  <option key={a.name} value={a.name}>{a.displayName}</option>
                ))}
              </select>
            )}
            {/* Held item */}
            <input
              type="text"
              placeholder="Item…"
              value={slot.item ?? ""}
              onChange={(e) => onUpdate({ item: e.target.value || null })}
              className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500 w-28"
            />
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
              const inferred = slot.inferredIVs?.[stat];
              const isConfirmed = iv != null;
              const isInferred = iv == null && inferred != null;
              const displayIv = iv ?? inferred;
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
                      value={displayIv ?? ""}
                      placeholder="?"
                      onChange={(e) => setIV(stat, e.target.value)}
                      title={isInferred ? `Inferred from IV ranges (min possible: ${inferred})` : undefined}
                      className={`w-12 px-1 py-0.5 rounded text-center bg-gray-800 focus:outline-none focus:border-indigo-500 ${
                        isConfirmed
                          ? "border border-gray-600 text-white"
                          : isInferred
                          ? "border border-dashed border-blue-700 text-blue-400"
                          : "border border-dashed border-gray-600 text-gray-500"
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

      {/* Speed tier reference */}
      {(() => {
        const spd = computedStats.spe;
        const tier = SPEED_TIERS.find((t) => spd > neutralSpeedAtLevel(t.baseSpe, slot.level));
        const slowestRef = SPEED_TIERS[SPEED_TIERS.length - 1];
        return (
          <p className="text-xs text-gray-600">
            {tier
              ? <>Speed {spd} — outspeeds <span className="text-gray-400">base {tier.baseSpe} ({tier.label})</span> at neutral Lv.{slot.level}</>
              : spd <= neutralSpeedAtLevel(slowestRef.baseSpe, slot.level)
                ? <>Speed {spd} — slower than base {slowestRef.baseSpe} ({slowestRef.label}) at neutral Lv.{slot.level}</>
                : null
            }
          </p>
        );
      })()}
    </div>
  );
}
