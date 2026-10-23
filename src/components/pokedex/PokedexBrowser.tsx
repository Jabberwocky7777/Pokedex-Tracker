import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import type { Pokemon } from "../../types";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { generationMaxId } from "../../lib/generation";
import { openTab } from "../../lib/navigate";

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
  caughtIds?: number[];
  onSelect: (id: number) => void;
}

/** What the Pokédex shows with nothing open: every Pokémon of the generation, by dex number. */
export default function PokedexBrowser({ allPokemon, activeGeneration, caughtIds, onSelect }: Props) {
  const maxId = generationMaxId(activeGeneration);
  const list = useMemo(
    () => allPokemon.filter((p) => p.id <= maxId).sort((a, b) => a.id - b.id),
    [allPokemon, maxId],
  );
  const caught = useMemo(() => new Set(caughtIds ?? []), [caughtIds]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pokedex-browse-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="pokedex-browse-heading" className="text-sm font-semibold text-gray-200">
          All {list.length} Pokémon
        </h3>
        <p className="text-xs text-gray-400">
          Pick one, search above, or{" "}
          <button
            onClick={() => openTab("tracker")}
            className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 underline decoration-dotted underline-offset-2"
          >
            <LayoutGrid size={12} aria-hidden="true" />
            open the Tracker
          </button>
        </p>
      </div>
      <ul className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {list.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className="w-full flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-indigo-500 hover:bg-gray-800 transition-colors"
            >
              <img
                src={getGenSprite(p, activeGeneration)}
                alt=""
                loading="lazy"
                width={48}
                height={48}
                className="w-12 h-12 object-contain pixelated"
              />
              <span className="text-[11px] text-gray-400 tabular-nums">
                #{formatDexNumber(p.id)}
                {caught.has(p.id) && <span className="ml-1 text-emerald-400" title="Caught" aria-label="caught">✓</span>}
              </span>
              <span className="text-xs text-gray-200 truncate w-full text-center">{p.displayName}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
