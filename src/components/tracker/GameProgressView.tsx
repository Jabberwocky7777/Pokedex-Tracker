import { useMemo } from "react";
import { Check, Trophy } from "lucide-react";
import type { GameVersion, MetaData, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useGameProgressStore } from "../../store/useGameProgressStore";
import { useSaveStore } from "../../store/useSaveStore";
import { GAME_PROGRESS } from "../../data/game-progress";
import { badgeCount, playTimeText, type GameProgress } from "../../lib/game-progress";
import { setProgressWithUndo } from "../../lib/progress-actions";
import { computeAvailability } from "../../hooks/usePokemonFilter";
import { GameChip } from "../shared/GameChip";
import GameProgressPrint from "./GameProgressPrint";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  caughtIds: number[];
}

const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/**
 * Game Progress: per selected game, the badges and story milestones reached —
 * ticked by hand or proposed by a save import. Synced, with undo and a line in
 * the change log for every change.
 */
export default function GameProgressView({ allPokemon, meta, caughtIds }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const entries = useGameProgressStore((s) => s.entries);
  const profiles = useSaveStore((s) => s.profiles);
  const genMeta = meta.generations.find((g) => g.id === activeGeneration);
  const games = (activeGames.length > 0 ? activeGames : genMeta?.versions ?? []).filter((g) => GAME_PROGRESS[g]);

  // How many of the uncaught Pokémon each game can supply (catch, trade or evolve)
  const obtainable = useMemo(() => {
    if (!genMeta) return new Map<string, number>();
    const [start, end] = genMeta.pokemonRange;
    const inGen = allPokemon.filter((p) => p.id >= start && p.id <= end);
    const caught = new Set(caughtIds);
    return new Map(games.map((g) => [g, [...computeAvailability(inGen, [g]).obtainable].filter((id) => !caught.has(id)).length]));
  }, [allPokemon, genMeta, games, caughtIds]);

  const progressOf = (game: string): GameProgress | undefined => {
    const e = entries[game];
    return e && !e.removed ? e : undefined;
  };

  return (
    <div className="p-4 flex flex-col gap-3 max-w-5xl">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2" style={{ fontFamily: "var(--theme-font-display)" }}>
            <Trophy size={16} /> Game progress
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Badges and story milestones in each selected game. Tick them as you go; they sync, and every change can be undone
            from the toast or the change log.
          </p>
        </div>
        {games.length > 0 && <GameProgressPrint games={games} progressOf={progressOf} />}
      </div>

      {games.length === 0 && <p className="text-sm text-gray-400 italic py-6 text-center">Select a game to track its progress.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {games.map((game) => {
          const def = GAME_PROGRESS[game]!;
          const progress = progressOf(game);
          const { earned, total } = badgeCount(game, progress);
          const profile = profiles.find((p) => p.game === game);
          const regions = [...new Set(def.badges.map((b) => b.region ?? ""))];
          return (
            <section key={game} className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-3" data-testid={`game-progress-${game}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <GameChip game={game as GameVersion} size="sm" />
                <span className="text-sm text-gray-300 tabular-nums">{earned}/{total} badges</span>
                {profile?.playTime && (
                  <span className="ml-auto text-xs text-gray-400" title={`From ${profile.label}, imported ${dateText(profile.importedAt)}`}>
                    Play time {playTimeText(profile.playTime)} (from save)
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400">
                <span className="text-gray-200 font-medium tabular-nums">{obtainable.get(game) ?? 0}</span> of your uncaught Pokémon can be had in {GAME_LABELS[game as GameVersion]}
              </p>

              {regions.map((region) => (
                <div key={region} className="flex flex-col gap-1">
                  {region && <span className="text-[11px] uppercase tracking-wide text-gray-500">{region}</span>}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${GAME_LABELS[game as GameVersion]} ${region} badges`}>
                    {def.badges.filter((b) => (b.region ?? "") === region).map((b) => {
                      const on = progress?.badges.includes(b.id) ?? false;
                      return (
                        <button
                          key={b.id}
                          onClick={() => setProgressWithUndo({ game, kind: "badge", id: b.id, value: !on })}
                          aria-pressed={on}
                          title={`${b.name} — ${b.leader}`}
                          className={`min-h-[44px] md:min-h-[36px] px-2.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                            on ? "bg-amber-400/15 border-amber-400/50 text-amber-200" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          {on && <Check size={12} aria-hidden="true" />}
                          {b.name.replace(/ Badge$/, "")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <ul className="flex flex-col gap-1">
                {def.milestones.map((m) => {
                  const state = progress?.milestones[m.id];
                  const on = state?.done ?? false;
                  return (
                    <li key={m.id}>
                      <label className="flex items-start gap-2.5 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setProgressWithUndo({ game, kind: "milestone", id: m.id, value: !on })}
                          className="w-4 h-4 mt-0.5 accent-indigo-500 flex-shrink-0"
                        />
                        <span className="min-w-0">
                          <span className={`block text-sm ${on ? "text-gray-100" : "text-gray-300"}`}>{m.label}</span>
                          <span className="block text-xs text-gray-500">
                            {on && state?.at ? `Reached ${dateText(state.at)}${state.source === "save" ? " · from save" : ""}` : m.detail}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
