import { useState, useMemo } from "react";
import { DAILY_EVENT_SECTIONS } from "../../data/daily-events";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import type { Pokemon } from "../../types";
import { toggleWithUndo } from "../../lib/dex-actions";
import { useClock } from "../../hooks/useClock";
import { generationVersions } from "../../lib/generation";
import { roamersIn } from "../../lib/roamers";
import RoamerPanel from "./RoamerPanel";
import { LocationLink, PokemonLink } from "../shared/links";

interface Props {
  allPokemon: Pokemon[];
}

export default function DailyChecklist({ allPokemon }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const caughtByGen = useDexStore((s) => s.caughtByGen);
  const clock = useClock();

  const caught = useMemo(() => caughtByGen[activeGeneration] ?? [], [caughtByGen, activeGeneration]);

  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);

  const sections = useMemo(() => {
    const byGen = DAILY_EVENT_SECTIONS.filter((s) => s.genIds.includes(activeGeneration));
    if (activeGames.length === 0) return byGen;
    return byGen.filter((s) =>
      s.versions.some((v) => activeGames.includes(v as never))
    );
  }, [activeGeneration, activeGames]);

  // The roamers of the games in view get a tab of their own, after the event sections
  const roamerGames = useMemo(
    () => (activeGames.length > 0 ? activeGames : generationVersions(activeGeneration)),
    [activeGames, activeGeneration],
  );
  const hasRoamers = useMemo(() => roamersIn(allPokemon, roamerGames).length > 0, [allPokemon, roamerGames]);
  const [showRoamers, setShowRoamers] = useState(false);

  const [activeIdx, setActiveIdx] = useState(0);
  const [uncaughtOnly, setUncaughtOnly] = useState(true);

  const sectionIdx = Math.min(activeIdx, Math.max(0, sections.length - 1));
  const section = sections[sectionIdx];

  if (sections.length === 0 && hasRoamers) {
    return (
      <div className="overflow-y-auto flex-1 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <RoamerPanel allPokemon={allPokemon} generation={activeGeneration} games={roamerGames} />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
        No daily events for the selected game(s).
      </div>
    );
  }

  // The games a place is looked up in: the section's, narrowed to the ones selected
  const sectionGames = section
    ? activeGames.length > 0 ? section.versions.filter((v) => (activeGames as string[]).includes(v)) : section.versions
    : [];

  const items = section
    ? uncaughtOnly
      ? section.pokemon.filter((p) => !caught.includes(p.id))
      : section.pokemon
    : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 flex items-center bg-gray-900/95 backdrop-blur border-b border-gray-800 overflow-x-auto [&::-webkit-scrollbar]:hidden flex-shrink-0">
        {sections.map((s, i) => {
          const uncaught = s.pokemon.filter((p) => !caught.includes(p.id)).length;
          const isActive = sectionIdx === i && !showRoamers;
          return (
            <button
              key={s.id}
              onClick={() => { setActiveIdx(i); setShowRoamers(false); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                isActive
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {s.title}
              <span className="text-gray-600 font-normal">{s.games}</span>
              {uncaught > 0 && (
                <span className={`text-xs px-1.5 py-px rounded-full ${
                  isActive ? "bg-indigo-900/60 text-indigo-300" : "bg-gray-800 text-gray-400"
                }`}>
                  {uncaught}
                </span>
              )}
              {uncaught === 0 && (
                <span className="text-emerald-600 text-xs">✓</span>
              )}
            </button>
          );
        })}

        {hasRoamers && (
          <button
            onClick={() => setShowRoamers(true)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
              showRoamers ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Roaming legendaries
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 px-3 flex-shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={uncaughtOnly}
              onChange={(e) => setUncaughtOnly(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 accent-indigo-500 cursor-pointer"
            />
            Uncaught only
          </label>
        </div>
      </div>

      {showRoamers && hasRoamers && (
        <div className="overflow-y-auto flex-1 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
          <RoamerPanel allPokemon={allPokemon} generation={activeGeneration} games={roamerGames} />
        </div>
      )}

      {/* How-to tip */}
      {section && !showRoamers && (
        <div className="px-4 py-2 text-xs text-gray-600 border-b border-gray-800/40 flex-shrink-0">
          {section.how}
        </div>
      )}

      {/* Pokémon list */}
      <div className={`overflow-y-auto flex-1 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0 ${showRoamers ? "hidden" : ""}`}>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            All caught! ✓
          </div>
        ) : (
          <div className="divide-y divide-gray-800/40 max-w-2xl">
            {items.map((dp) => {
              const pokemon = pokemonMap.get(dp.id);
              const isCaught = caught.includes(dp.id);
              return (
                <label
                  key={`${dp.id}-${dp.location}-${dp.games ?? ""}`}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-800/40 transition-colors ${
                    isCaught ? "opacity-40" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isCaught}
                    onChange={() => toggleWithUndo("caught", dp.id, activeGeneration, dp.name)}
                    className="flex-shrink-0 rounded border-gray-600 bg-gray-800 accent-indigo-500 cursor-pointer"
                  />
                  {pokemon && (
                    <img
                      src={pokemon.gen4Sprite ?? pokemon.spriteUrl}
                      alt=""
                      className="w-7 h-7 object-contain flex-shrink-0"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                  {/* Links inside the row's <label>: they open their target without ticking the box */}
                  <PokemonLink id={dp.id} to="tracker" className={`text-sm font-medium flex-shrink-0 ${isCaught ? "line-through text-gray-500" : "text-gray-100"}`}>
                    {dp.name}
                  </PokemonLink>
                  <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">
                    <LocationLink text={dp.location} games={sectionGames} allPokemon={allPokemon} />
                  </span>
                  {dp.games && (
                    <span className="text-xs text-gray-700 bg-gray-800 px-1.5 py-px rounded flex-shrink-0">
                      {dp.games}
                    </span>
                  )}
                  {dp.days?.includes(clock.weekday) && (
                    <span className="text-[11px] font-bold px-1.5 py-px rounded bg-emerald-500 text-gray-900 flex-shrink-0">TODAY</span>
                  )}
                  {dp.note && (
                    <span className="text-xs text-gray-600 flex-shrink-0 italic">{dp.note}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
