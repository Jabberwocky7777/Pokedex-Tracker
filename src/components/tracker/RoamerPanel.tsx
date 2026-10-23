import { useMemo } from "react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_COLORS, GAME_LABELS } from "../../types";
import { useDexStore } from "../../store/useDexStore";
import { roamerKey, useRoamerStore } from "../../store/useRoamerStore";
import { toggleWithUndo } from "../../lib/dex-actions";
import { roamerState, roamerTips, roamersIn, type RoamerState } from "../../lib/roamers";
import { getGenSprite } from "../../lib/pokemon-display";
import { PokemonLink } from "../shared/links";

interface Props {
  allPokemon: Pokemon[];
  generation: number;
  /** The games to show roamers for */
  games: GameVersion[];
}

const STATE: Record<RoamerState, { label: string; className: string }> = {
  caught: { label: "Caught", className: "bg-emerald-600 text-white" },
  met: { label: "Met — on the map", className: "bg-amber-400/20 text-amber-200 border border-amber-400/40" },
  roaming: { label: "Still roaming", className: "bg-gray-700 text-gray-300" },
};

/**
 * Roaming legendaries of the selected games: whether each has been met (which
 * is what puts it on the map) or caught, and the usual tips. "Met" is this
 * panel's own, synced, per game; "caught" is the tracker's mark.
 */
export default function RoamerPanel({ allPokemon, generation, games }: Props) {
  const caughtIds = useDexStore((s) => s.caughtByGen[generation]);
  const entries = useRoamerStore((s) => s.entries);
  const put = useRoamerStore((s) => s.put);

  const roamers = useMemo(() => roamersIn(allPokemon, games), [allPokemon, games]);
  const caught = useMemo(() => new Set(caughtIds ?? []), [caughtIds]);

  if (roamers.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-gray-500">No Pokémon roam in the selected game(s).</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl" data-testid="roamer-panel">
      {games.filter((game) => roamers.some((r) => r.game === game)).map((game) => (
        <section key={game} className="flex flex-col gap-1.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: GAME_COLORS[game] ?? "#6b7280" }} />
            {GAME_LABELS[game]}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {roamers.filter((r) => r.game === game).map(({ pokemon, level, unlock }) => {
              const key = roamerKey(game, pokemon.id);
              const entry = entries[key];
              const met = !!entry && !entry.removed && entry.met;
              const state = roamerState(caught.has(pokemon.id), met);
              return (
                <li key={key} className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <img src={getGenSprite(pokemon, generation)} alt="" loading="lazy" className="w-12 h-12 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PokemonLink id={pokemon.id} to="tracker" className="text-sm font-semibold text-gray-100">{pokemon.displayName}</PokemonLink>
                        <span className="text-xs text-gray-500">Lv. {level}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATE[state].className}`} data-testid="roamer-state">
                          {STATE[state].label}
                        </span>
                      </div>
                      {unlock && <div className="text-xs text-gray-400 mt-0.5">{unlock}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => put(key, { met: !met })}
                      disabled={state === "caught"}
                      aria-pressed={met}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        met ? "bg-amber-500 hover:bg-amber-400 text-gray-900" : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      }`}
                    >
                      {met ? "✓ Met" : "I've met it"}
                    </button>
                    <button
                      onClick={() => toggleWithUndo("caught", pokemon.id, generation, pokemon.displayName)}
                      aria-pressed={state === "caught"}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        state === "caught" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      }`}
                    >
                      {state === "caught" ? "✓ Caught" : "Mark as caught"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-1">
        <h3 className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tips</h3>
        <ul className="flex flex-col gap-1 text-xs text-gray-300 leading-relaxed list-disc pl-4">
          {roamerTips(generation).map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
    </div>
  );
}
