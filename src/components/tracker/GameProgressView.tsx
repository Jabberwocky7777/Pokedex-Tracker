import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { planCoverage, reachableIn, soleSources, unlockPreview } from "../../lib/planner";
import { useDexStore } from "../../store/useDexStore";
import { PokemonLink } from "../shared/links";
import { tradesBetweenGames } from "../../lib/trade-session";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const NO_IDS: number[] = [];

/**
 * Game Progress (the My games tab): for every game of the generation, the
 * badges and story milestones reached — ticked by hand or proposed by a save
 * import. Synced, with undo and a line in the change log for every change.
 * What a game or milestone "opens" is counted across all the games, so
 * something another game already gives you isn't credited again.
 */
export default function GameProgressView({ allPokemon, meta }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const entries = useGameProgressStore((s) => s.entries);
  const profiles = useSaveStore((s) => s.profiles);
  const caughtIds = useDexStore((s) => s.caughtByGen[activeGeneration] ?? NO_IDS);
  const genMeta = meta.generations.find((g) => g.id === activeGeneration);
  // Every game of the generation, whatever the tracker's game filter shows
  const games = useMemo(() => (genMeta?.versions ?? []).filter((g) => GAME_PROGRESS[g]), [genMeta]);

  const inGen = useMemo(() => {
    if (!genMeta) return [];
    const [start, end] = genMeta.pokemonRange;
    return allPokemon.filter((p) => p.id >= start && p.id <= end);
  }, [allPokemon, genMeta]);
  const caughtSet = useMemo(() => new Set(caughtIds), [caughtIds]);
  const nameOf = useMemo(() => new Map(allPokemon.map((p) => [p.id, p.displayName])), [allPokemon]);
  const progressOf = useCallback((game: string): GameProgress | undefined => {
    const e = entries[game];
    return e && !e.removed ? e : undefined;
  }, [entries]);

  // How many uncaught Pokémon each game can supply at all, and how many of those no other game can
  const obtainable = useMemo(() => {
    const sole = soleSources(inGen, games);
    return new Map(games.map((g) => {
      const ids = [...computeAvailability(inGen, [g]).obtainable].filter((id) => !caughtSet.has(id));
      return [g, { total: ids.length, onlyHere: ids.filter((id) => sole.get(id) === g).length }];
    }));
  }, [inGen, games, caughtSet]);

  // What each milestone not yet reached would open that none of your other games gives you now
  const previews = useMemo(() => {
    const out = new Map<string, number[]>();
    for (const game of games) {
      const progress = progressOf(game);
      const elsewhere = reachableIn(inGen, games.filter((g) => g !== game), progressOf, caughtSet);
      for (const m of GAME_PROGRESS[game]!.milestones) {
        if (progress?.milestones[m.id]?.done) continue;
        out.set(`${game}:${m.id}`, unlockPreview(inGen, game, m.id, progress, caughtSet, elsewhere));
      }
    }
    return out;
  }, [games, progressOf, inGen, caughtSet]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="flex-1 min-w-[14rem] text-xs text-gray-400">
          Tick badges and milestones as you go — or import a save. They sync, and every change can be undone from the toast or
          the change log.
        </p>
        {games.length > 0 && <GameProgressPrint games={games} progressOf={progressOf} />}
      </div>

      {games.length === 0 && <p className="text-sm text-gray-400 italic py-6 text-center">Select a game to track its progress.</p>}

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
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
                <span className="text-gray-200 font-medium tabular-nums">{obtainable.get(game)?.total ?? 0}</span> of your uncaught Pokémon can be had in {GAME_LABELS[game as GameVersion]}
                {(obtainable.get(game)?.onlyHere ?? 0) > 0 && (
                  <> · <span className="text-amber-300 font-medium tabular-nums">{obtainable.get(game)!.onlyHere}</span> only here</>
                )}
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
                  const opens = previews.get(`${game}:${m.id}`) ?? [];
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
                      {!on && opens.length > 0 && (
                        <PokemonList
                          ids={opens}
                          nameOf={nameOf}
                          label={`${m.id === "hall-of-fame" ? "Beating the Elite Four" : `Reaching ${m.label}`} in ${GAME_LABELS[game as GameVersion]} opens ${opens.length} Pokémon you still need`}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {games.length > 0 && <NeedsPlanner pokemon={inGen} games={games} caught={caughtSet} nameOf={nameOf} progressOf={progressOf} />}
      {games.length > 1 && <GamesTradeList pokemon={inGen} games={games as GameVersion[]} caught={caughtSet} nameOf={nameOf} maxSpecies={genMeta?.pokemonRange[1] ?? 493} />}
    </div>
  );
}

/** A sentence with a list of Pokémon that opens under it. */
function PokemonList({ ids, nameOf, label }: { ids: number[]; nameOf: Map<number, string>; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-6 mb-1">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200 text-left min-h-[32px]">
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        {label}
      </button>
      {open && (
        <p className="text-xs text-gray-300 leading-relaxed">
          {ids.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <PokemonLink id={id} to="tracker">{nameOf.get(id) ?? `#${id}`}</PokemonLink>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** "What do I actually need?": the few games-and-milestones that cover the most of what you're missing. */
function NeedsPlanner({ pokemon, games, caught, nameOf, progressOf }: {
  pokemon: Pokemon[];
  games: string[];
  caught: ReadonlySet<number>;
  nameOf: Map<number, string>;
  progressOf: (game: string) => GameProgress | undefined;
}) {
  const plan = useMemo(() => planCoverage(pokemon, games, caught, 6, progressOf), [pokemon, games, caught, progressOf]);
  const pct = (n: number) => Math.round((n / plan.missing.length) * 100);
  // Covered after each pick, counting what is already within reach
  const sofar = plan.picks.map((_, i) => plan.reachableNow.length + plan.picks.slice(0, i + 1).reduce((n, p) => n + p.adds.length, 0));
  return (
    <section className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-2" data-testid="needs-planner">
      <h3 className="text-sm font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>What do I actually need?</h3>
      {plan.missing.length === 0 ? (
        <p className="text-xs text-gray-400">Nothing left to catch in this generation.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            You have {plan.missing.length} Pokémon left to catch (counting evolving and breeding).{" "}
            {plan.picks.length > 0
              ? <>With the next steps below your games cover <strong className="text-gray-100">{Math.round(plan.coverage * 100)}%</strong>.</>
              : <>Your games can&apos;t open any more of them.</>}
          </p>
          <PokemonList
            ids={plan.reachableNow}
            nameOf={nameOf}
            label={`Within reach now, with your progress: ${plan.reachableNow.length} (${pct(plan.reachableNow.length)}%)`}
          />
          <ol className="flex flex-col gap-1">
            {plan.picks.map((pick, i) => (
              <li key={pick.game} className="text-sm text-gray-200">
                <PokemonList
                  ids={[...pick.adds].sort((a, b) => a - b)}
                  nameOf={nameOf}
                  label={`Then ${pick.label}: +${pick.adds.length} (${pct(sofar[i])}% so far)`}
                />
              </li>
            ))}
          </ol>
          {plan.unavailable.length > 0 && (
            <PokemonList ids={plan.unavailable} nameOf={nameOf} label={`${plan.unavailable.length} can't be had in any game of this generation (events, other generations)`} />
          )}
        </>
      )}
    </section>
  );
}

/** Trades between your own games: per pair, what each sends the other and what goes over and back. */
function GamesTradeList({ pokemon, games, caught, nameOf, maxSpecies }: {
  pokemon: Pokemon[];
  games: GameVersion[];
  caught: ReadonlySet<number>;
  nameOf: Map<number, string>;
  maxSpecies: number;
}) {
  const pairs = useMemo(() => tradesBetweenGames(games, { pokemon, maxSpecies, caught }), [games, pokemon, maxSpecies, caught]);
  if (pairs.length === 0) return null;
  const label = (g: GameVersion) => GAME_LABELS[g] ?? g;
  return (
    <section className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-2" data-testid="games-trade-list">
      <h3 className="text-sm font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>Trades between your games</h3>
      <p className="text-xs text-gray-400">Version exclusives each game can send the other, and trade evolutions to send over and back. For two saves, use the Trade panel in Saves.</p>
      {pairs.map(({ a, b, items }) => {
        const ids = (from: 0 | 1, kind: "exclusive" | "trade-evolution") =>
          items.filter((t) => t.from === from && t.kind === kind).map((t) => t.species);
        const there = ids(0, "exclusive"), back = ids(1, "exclusive");
        const evolve = items.filter((t) => t.kind === "trade-evolution");
        return (
          <div key={`${a}-${b}`} className="rounded-lg border border-gray-800 bg-gray-800/30 px-2 py-1">
            <p className="text-sm font-medium text-gray-100 px-1 pt-1">{label(a)} ⇄ {label(b)}</p>
            {there.length > 0 && <PokemonList ids={there} nameOf={nameOf} label={`${label(a)} → ${label(b)}: send ${there.length}`} />}
            {back.length > 0 && <PokemonList ids={back} nameOf={nameOf} label={`${label(b)} → ${label(a)}: bring back ${back.length}`} />}
            {evolve.length > 0 && (
              <PokemonList
                ids={[...new Set(evolve.map((t) => t.species))]}
                // "Clamperl → Huntail (holding DeepSeaTooth) / Gorebyss (holding DeepSeaScale)"
                nameOf={new Map([...new Set(evolve.map((t) => t.species))].map((id) => [id, `${nameOf.get(id) ?? `#${id}`} → ${evolve
                  .filter((t) => t.species === id)
                  .map((t) => `${nameOf.get(t.evolvesInto!) ?? ""}${t.heldItem ? ` (holding ${t.heldItem})` : ""}`)
                  .join(" / ")}`]))}
                label={`Send over and back to evolve: ${new Set(evolve.map((t) => t.species)).size}`}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
