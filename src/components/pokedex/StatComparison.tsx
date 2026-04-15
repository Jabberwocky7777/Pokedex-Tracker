import type { Pokemon } from "../../types";
import { STAT_CONFIG, statBarColor } from "./pokedexHelpers";
import { SectionHeading } from "./SectionHeading";

export function StatComparison({ a, b }: { a: Pokemon; b: Pokemon }) {
  const totalA = Object.values(a.baseStats).reduce((s, v) => s + v, 0);
  const totalB = Object.values(b.baseStats).reduce((s, v) => s + v, 0);

  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <SectionHeading>Base Stats</SectionHeading>

      {/* Column headers */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-16 shrink-0" />
        <div className="flex-1 text-center text-xs font-semibold text-indigo-400 truncate">{a.displayName}</div>
        <div className="w-2 shrink-0" />
        <div className="flex-1 text-center text-xs font-semibold text-pink-400 truncate">{b.displayName}</div>
      </div>

      <div className="flex flex-col gap-2.5">
        {STAT_CONFIG.map(({ key, label }) => {
          const va = a.baseStats[key as keyof typeof a.baseStats];
          const vb = b.baseStats[key as keyof typeof b.baseStats];
          const aWins = va > vb;
          const bWins = vb > va;
          const barA = Math.round((va / 255) * 100);
          const barB = Math.round((vb / 255) * 100);

          return (
            <div key={key} className="flex items-center gap-2">
              {/* Label */}
              <div className="w-16 text-right text-xs text-gray-500 font-medium shrink-0">{label}</div>

              {/* A side: bar grows right→left (toward center) */}
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full float-right transition-all duration-300"
                    style={{ width: `${barA}%`, backgroundColor: statBarColor(va) }}
                  />
                </div>
                <div className={`text-xs font-mono w-7 text-right shrink-0 ${aWins ? "text-indigo-400 font-bold" : "text-gray-400"}`}>
                  {va}
                </div>
              </div>

              {/* Center divider */}
              <div className="text-gray-700 text-xs select-none shrink-0">·</div>

              {/* B side: bar grows left→right */}
              <div className="flex-1 flex items-center gap-1.5">
                <div className={`text-xs font-mono w-7 text-left shrink-0 ${bWins ? "text-pink-400 font-bold" : "text-gray-400"}`}>
                  {vb}
                </div>
                <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${barB}%`, backgroundColor: statBarColor(vb) }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Total row */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-800 mt-1">
          <div className="w-16 text-right text-xs text-gray-400 font-semibold shrink-0">Total</div>
          <div className="flex-1 flex items-center gap-1.5">
            <div className="flex-1" />
            <div className={`text-xs font-mono font-bold w-7 text-right shrink-0 ${totalA > totalB ? "text-indigo-400" : "text-gray-400"}`}>
              {totalA}
            </div>
          </div>
          <div className="w-2 shrink-0" />
          <div className="flex-1 flex items-center gap-1.5">
            <div className={`text-xs font-mono font-bold w-7 text-left shrink-0 ${totalB > totalA ? "text-pink-400" : "text-gray-400"}`}>
              {totalB}
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
