import type { Pokemon } from "../../types";
import { STAT_CONFIG, statBarColor } from "./pokedexHelpers";
import { SectionHeading } from "./SectionHeading";

export function StatBars({ pokemon }: { pokemon: Pokemon }) {
  const total = Object.values(pokemon.baseStats).reduce((a, b) => a + b, 0);
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <SectionHeading>Base Stats</SectionHeading>
      <div className="flex flex-col gap-2.5">
        {STAT_CONFIG.map(({ key, label }) => {
          const val = pokemon.baseStats[key as keyof typeof pokemon.baseStats];
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-16 text-right text-xs text-gray-500 font-medium shrink-0">{label}</div>
              <div className="w-8 text-right text-sm font-mono text-gray-200 shrink-0">{val}</div>
              <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((val / 255) * 100)}%`, backgroundColor: statBarColor(val) }}
                />
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1 border-t border-gray-800 mt-1">
          <div className="w-16 text-right text-xs text-gray-400 font-semibold shrink-0">Total</div>
          <div className="w-8 text-right text-sm font-mono font-bold text-white shrink-0">{total}</div>
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
