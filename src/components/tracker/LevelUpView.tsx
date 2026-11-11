import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useSaveStore } from "../../store/useSaveStore";
import { useProfileMons } from "../../hooks/useSaves";
import { genConfigOf } from "../../lib/save/types";
import { profileGames } from "../../lib/save/acquire";
import { buildLevelPlan, expShareHolder, type LevelJob } from "../../lib/save/level-plan";
import { generationVersions } from "../../lib/generation";
import { getGenSprite } from "../../lib/pokemon-display";
import { openMyGames } from "../../lib/navigate";
import {
  boostFactor,
  fmtExp,
  spotValue,
  STYLE_SHARE,
  xpGenOf,
  type SpotValue,
  type TrainStyle,
  type XpData,
} from "../../lib/xp";
import { LUCKY_EGG, XP_SPOTS, type XpSpot } from "../../data/xp-spots";
import { useGameProgressStore } from "../../store/useGameProgressStore";
import { isReached, requirementText } from "../../lib/unlocks";

interface GuideSpot {
  spot: XpSpot;
  value: SpotValue;
  reached: boolean;
}
import xpJson from "../../data/xp-trainers.json";
import { PokemonLink, RouteLink } from "../shared/links";
import { OptionRow, Pill, SELECT, SelectField } from "../shared/OptionControls";
import { useClock } from "../../hooks/useClock";
import { WEEKDAY_NAMES } from "../../data/weekly-events";
import type { XpTrainer } from "../../lib/xp";

const XP = xpJson as unknown as XpData;

const STYLES: { value: TrainStyle; label: string }[] = [
  { value: "share", label: "holds the Exp. Share, sits out (½)" },
  { value: "switch", label: "holds the Exp. Share, leads and switches out (¾)" },
  { value: "switchOnly", label: "leads and switches out, no Exp. Share (½)" },
  { value: "alone", label: "fights alone (all of it)" },
];

const unitOf = (spot: XpSpot) => (spot.trainers ? "run" : spot.rematches ? "battle" : "wild battle");

interface Props {
  allPokemon: Pokemon[];
}

/**
 * What's next → Level up: which Pokémon in your saves to level (and which copy),
 * how much EXP each needs, and where each game gives the most EXP — numbers
 * from the games' own trainer and encounter data (lib/xp.ts).
 */
export default function LevelUpView({ allPokemon }: Props) {
  const generation = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const luckyEgg = useSettingsStore((s) => s.levelLuckyEgg);
  const setLuckyEgg = useSettingsStore((s) => s.setLevelLuckyEgg);
  const fullSaves = useSaveStore((s) => s.fullSaves);
  const all = useProfileMons();

  const profiles = useMemo(
    () => all.filter((p) => genConfigOf(p.profile.family).gen === generation),
    [all, generation],
  );
  const dex = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);
  const jobs = useMemo(
    () =>
      profiles.length === 0
        ? []
        : buildLevelPlan(profiles, dex, { maxSpecies: genConfigOf(profiles[0].profile.family).maxSpecies, fullSaves }),
    [profiles, dex, fullSaves],
  );
  const holder = useMemo(() => expShareHolder(jobs), [jobs]);

  // The game to train in: the living-dex save's, else the first selected game, else the generation's first
  const genGames = generationVersions(generation);
  const living = profiles.find((p) => p.profile.role === "living-dex") ?? profiles[0];
  const defaultGame =
    (living && profileGames(living.profile).find((g) => genGames.includes(g))) ??
    activeGames.find((g): g is GameVersion => genGames.includes(g)) ??
    genGames[0];
  const [gameChoice, setGame] = useState<GameVersion | null>(null);
  const game = gameChoice && genGames.includes(gameChoice) ? gameChoice : defaultGame;
  const progressEntry = useGameProgressStore((s) => s.entries[game]);
  const progress = progressEntry && !progressEntry.removed ? progressEntry : undefined;

  const spots = useMemo(
    () =>
      XP_SPOTS.filter((s) => s.games.includes(game))
        .map((spot) => ({
          spot,
          value: spotValue(spot, XP, allPokemon),
          // Unknown (no Game Progress for this game) counts as reached
          reached: !progress || (spot.needs ?? []).every((req) => isReached(req, progress)),
        }))
        .filter((s): s is GuideSpot => s.value !== null),
    [game, allPokemon, progress],
  );
  const [spotChoice, setSpot] = useState<string | null>(null);
  // Estimates use a repeatable spot by default: the best "any time" one Game Progress says you've reached
  const byExp = [...spots].sort((a, b) => b.value.exp - a.value.exp);
  const trainAt =
    spots.find((s) => s.spot.id === spotChoice) ??
    byExp.find((s) => s.reached && s.spot.repeat === "any time") ??
    byExp.find((s) => s.reached) ??
    byExp[0];
  const [style, setStyle] = useState<TrainStyle>("share");

  const gen = Number(xpGenOf(game));
  const runsFor = (job: LevelJob) => {
    if (!trainAt || job.pick.expToGo === 0) return null;
    const per = trainAt.value.exp * STYLE_SHARE[style] * boostFactor(gen, { luckyEgg, traded: job.pick.traded });
    return Math.max(1, Math.ceil(job.pick.expToGo / per));
  };
  const nameOf = (id: number) => dex.get(id)?.displayName ?? `#${id}`;
  const ready = jobs.filter((j) => j.readyNow);
  const toLevel = jobs.filter((j) => !j.readyNow);
  const totalExp = toLevel.reduce((s, j) => s + j.pick.expToGo, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
          Who to level up
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          The Pokémon you still need that only take levels: an earlier stage in one of your imported saves has to reach
          its evolution level. Where you have several copies, the one needing the least EXP is picked.
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-sm text-gray-300">
          This works from your imported saves — import a Generation {generation === 3 ? "III" : "IV"} save to see who to
          level.{" "}
          <button onClick={() => openMyGames("saves")} className="text-indigo-300 hover:text-indigo-200 underline">
            Import a save →
          </button>
          <p className="mt-2 text-xs text-gray-400">Where to get EXP is listed below either way.</p>
        </div>
      ) : jobs.length === 0 ? (
        <p className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-sm text-gray-300">
          Nothing pending in your saves needs levels.
        </p>
      ) : (
        <>
          <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3 flex flex-col gap-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SelectField label="Estimate at">
                <select
                  value={trainAt?.spot.id ?? ""}
                  onChange={(e) => setSpot(e.target.value)}
                  aria-label="Training spot for the estimates"
                  className={SELECT}
                >
                  {spots.map(({ spot, value, reached }) => (
                    <option key={spot.id} value={spot.id}>
                      {spot.title} — {fmtExp(value.exp)} / {unitOf(spot)}
                      {reached ? "" : " (not reached yet)"}
                    </option>
                  ))}
                </select>
              </SelectField>
              <SelectField label="The one training">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as TrainStyle)}
                  aria-label="How the Pokémon being trained gets EXP"
                  className={SELECT}
                >
                  {STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </SelectField>
            </div>
            <OptionRow label="Items">
              <Pill on={luckyEgg} onClick={() => setLuckyEgg(!luckyEgg)}>
                Lucky Egg (×1.5)
              </Pill>
            </OptionRow>
          </div>

          {holder && (
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-3 text-sm text-gray-200">
              <p>
                <span className="font-semibold">Exp. Share:</span> give it to{" "}
                <span className="font-semibold">{nameOf(holder.pick.mon.species)}</span> ({holder.pick.where}), which
                needs the most — {fmtExp(holder.pick.expToGo)} EXP. Bring your strongest Pokémon to do the fighting and
                put the others you are training in the party too.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                For each opposing Pokémon, send one of the others out first and switch to your strong one: everyone who
                was out splits half the EXP, the Exp. Share holder gets the other half. Traded Pokémon get 1.5× (1.7×
                from a game in another language, Gen IV), and so does a Lucky Egg holder.
              </p>
            </div>
          )}

          {ready.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-emerald-300">Ready — level once to evolve</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {ready.map((j) => (
                  <JobRow key={`${j.target}`} job={j} nameOf={nameOf} dex={dex} generation={generation} runs={null} />
                ))}
              </ul>
            </section>
          )}

          {toLevel.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-200">
                To level{" "}
                <span className="font-normal text-gray-400">
                  — {toLevel.length} Pokémon, {fmtExp(totalExp)} EXP in all, fewest first
                </span>
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {toLevel.map((j) => (
                  <JobRow
                    key={`${j.target}`}
                    job={j}
                    nameOf={nameOf}
                    dex={dex}
                    generation={generation}
                    runs={runsFor(j)}
                    unit={trainAt ? unitOf(trainAt.spot) : undefined}
                    holder={j === holder}
                  />
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                Estimates are for each Pokémon trained on its own, the way chosen above, at that spot. EXP is exact
                where this device has the full save; otherwise it is the least a Pokémon of that level can have.
              </p>
            </section>
          )}
        </>
      )}

      <XpGuide game={game} genGames={genGames} setGame={setGame} spots={spots} />
    </div>
  );
}

function JobRow({
  job,
  nameOf,
  dex,
  generation,
  runs,
  unit,
  holder,
}: {
  job: LevelJob;
  nameOf: (id: number) => string;
  dex: Map<number, Pokemon>;
  generation: number;
  runs: number | null;
  unit?: string;
  holder?: boolean;
}) {
  const { pick } = job;
  const sprite = (id: number) => {
    const p = dex.get(id);
    return p ? (
      <img
        src={getGenSprite(p, generation)}
        alt={p.displayName}
        loading="lazy"
        className="w-10 h-10 object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    ) : null;
  };
  return (
    <li className="rounded-xl bg-gray-900 border border-gray-800 p-3" data-testid="level-job">
      <div className="flex items-center gap-2 flex-wrap">
        {sprite(pick.mon.species)}
        <ArrowRight size={14} className="text-gray-500" aria-hidden="true" />
        {sprite(job.target)}
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm text-gray-100">
            <PokemonLink id={pick.mon.species} to="tracker" generation={generation}>
              {nameOf(pick.mon.species)}
            </PokemonLink>{" "}
            →{" "}
            <PokemonLink id={job.target} to="tracker" generation={generation}>
              {nameOf(job.target)}
            </PokemonLink>
            {holder && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold">
                EXP. SHARE
              </span>
            )}
            {pick.traded && (
              <span
                className="ml-2 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[10px] font-semibold"
                title="Not its original trainer's: 1.5× EXP from battles"
              >
                TRADED ×1.5
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">
            {pick.profileLabel} · {pick.where}
          </p>
        </div>
        <div className="text-right text-xs tabular-nums">
          <p className="text-gray-100 font-semibold">
            Lv {pick.mon.level} → {job.readyNow ? pick.mon.level + 1 : job.needLevel}
            {!job.readyNow && <span className="text-gray-400 font-normal"> ({job.levelsToGo} levels)</span>}
          </p>
          <p className="text-gray-300">
            {pick.expExact ? "" : "≤ "}
            {fmtExp(pick.expToGo)} EXP
            {runs !== null && unit && (
              <span className="text-gray-400">
                {" "}
                · ≈{runs} {unit}
                {runs === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>
      </div>
      {(job.steps.length > 1 || job.then) && (
        <p className="mt-1 text-xs text-gray-400">
          {job.steps.map(([s, l]) => `${nameOf(s)} at Lv ${l}`).join(", ")}
          {job.then && <> · then {job.then.charAt(0).toLowerCase() + job.then.slice(1)}</>}
        </p>
      )}
      {pick.branchUnknown && (
        <p className="mt-1 text-xs text-amber-200">
          Wurmple becomes Silcoon or Cascoon depending on its personality value, which this device can&apos;t see for
          this save — it's a coin flip. Import the save on this device to know for sure.
        </p>
      )}
      {job.others.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          Rather than{" "}
          {job.others
            .slice(0, 2)
            .map(
              (o) =>
                `the Lv ${o.mon.level} ${nameOf(o.mon.species)} (${o.profileLabel} · ${o.where}, ${fmtExp(o.expToGo - pick.expToGo)} more EXP)`,
            )
            .join(" or ")}
          {job.others.length > 2 ? ` and ${job.others.length - 2} more` : ""}.
        </p>
      )}
    </li>
  );
}

function XpGuide({
  game,
  genGames,
  setGame,
  spots,
}: {
  game: GameVersion;
  genGames: GameVersion[];
  setGame: (g: GameVersion) => void;
  spots: GuideSpot[];
}) {
  const sorted = [...spots].sort((a, b) => b.value.exp - a.value.exp);
  return (
    <section className="flex flex-col gap-2" data-testid="xp-guide">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
          Where to get EXP in
        </h2>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value as GameVersion)}
          aria-label="Game"
          className={SELECT}
        >
          {genGames.map((g) => (
            <option key={g} value={g}>
              {GAME_LABELS[g]}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-gray-400">
        What players recommend, checked against the game&apos;s own trainer parties and encounter tables. EXP is for one
        Pokémon that fought the whole thing alone, its own catch, no Lucky Egg — per League run, per trainer battle, or
        the average wild battle. A trainer battle gives 1.5× a wild one.
        {(game === "ruby" || game === "sapphire") && " Ruby and Sapphire's trainers are taken from Emerald's data."}
      </p>
      {LUCKY_EGG[game] && (
        <p className="text-xs text-gray-300">
          <span className="font-semibold">Lucky Egg (×1.5):</span> {LUCKY_EGG[game]}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {sorted.map(({ spot, value, reached }) => (
          <li key={spot.id} className="rounded-xl bg-gray-900 border border-gray-800 p-3" data-testid="xp-spot">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-100 flex-1 min-w-[12rem]">
                {spot.wild ? <RouteLink slug={spot.wild.slug}>{spot.title}</RouteLink> : spot.title}
              </h3>
              <span className="text-sm font-semibold text-emerald-300 tabular-nums">
                {spot.rematches ? "up to " : spot.wild ? "≈" : ""}
                {fmtExp(value.exp)} EXP
                <span className="text-xs font-normal text-gray-400"> / {unitOf(spot)}</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              {spot.when}
              {value.wildLevels && ` · wild Pokémon Lv ${value.wildLevels[0]}–${value.wildLevels[1]}`}
              {spot.repeat === "daily" ? " · daily" : spot.repeat === "rematch" ? " · rematches" : ""}
            </p>
            {!reached && (
              <p className="mt-0.5 text-[11px] font-semibold text-amber-300" data-testid="xp-spot-locked">
                Not reached yet in your Game progress: {spot.needs!.map((req) => requirementText(req, game)).join(", ")}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-300">{spot.how}</p>
            {spot.said && (
              <p className="mt-1 text-xs text-gray-400">
                <span className="text-gray-300">Players say:</span> {spot.said}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-200">
              <span className="text-emerald-300 font-medium">The numbers:</span> {spot.verdict}
            </p>
            {spot.schedule && <CallSchedule battles={value.battles} />}
            {value.battles.length > 0 && !spot.schedule && (
              <details className="mt-1 text-xs text-gray-400">
                <summary className="cursor-pointer select-none hover:text-gray-200">
                  {spot.trainers ? "The battles" : "The trainers"}
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
                  {value.battles.map((t) => (
                    <li key={t.id}>
                      {t.cls} {t.name} ({t.where}
                      {t.double ? ", double battle" : ""}) — Lv {Math.min(...t.party.map(([, l]) => l))}–
                      {Math.max(...t.party.map(([, l]) => l))}, {t.party.length} Pokémon:{" "}
                      <span className="text-gray-200">{fmtExp(t.exp)} EXP</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {spot.sources && spot.sources.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {spot.sources.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 && " · "}
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-gray-300 underline">
                      {s.label}
                      <ExternalLink size={10} className="inline ml-0.5 -mt-0.5" aria-hidden="true" />
                    </a>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        Trainer parties from the pret decompilations of Emerald, FireRed, Diamond, Platinum and HeartGold; wild rates
        from this app&apos;s encounter data. Formula: base EXP × level ÷ 7 per Pokémon defeated, ×1.5 for a trainer.
      </p>
    </section>
  );
}

const TIME_ORDER = { morning: 0, day: 1, night: 2 } as const;
const TIME_HOURS = { morning: "morning (4–10)", day: "day (10–20)", night: "night (20–4)" } as const;

/**
 * HG/SS phone rematches as a week: who agrees to a rematch on which day, at
 * which time of day, starting from today (the device's clock, like the game's).
 */
function CallSchedule({ battles }: { battles: XpTrainer[] }) {
  const clock = useClock();
  const anyDay = battles.filter((t) => t.call && t.call.weekday === null);
  const days = Array.from({ length: 7 }, (_, i) => (clock.weekday + i) % 7).map((weekday) => ({
    weekday,
    trainers: battles
      .filter((t) => t.call?.weekday === weekday)
      .sort((a, b) => TIME_ORDER[a.call!.time ?? "morning"] - TIME_ORDER[b.call!.time ?? "morning"]),
  }));
  return (
    <div className="mt-2 flex flex-col gap-1" data-testid="call-schedule">
      {days
        .filter((d) => d.trainers.length > 0)
        .map(({ weekday, trainers }) => {
          const today = weekday === clock.weekday;
          return (
            <div
              key={weekday}
              className={`flex flex-col sm:flex-row gap-0.5 sm:gap-3 rounded-lg px-2 py-1.5 text-xs ${
                today ? "bg-indigo-500/10 border border-indigo-500/30" : "bg-gray-800/40"
              }`}
            >
              <span className={`sm:w-24 flex-shrink-0 font-semibold ${today ? "text-indigo-200" : "text-gray-300"}`}>
                {WEEKDAY_NAMES[weekday]}
                {today && " · today"}
              </span>
              <ul className="flex flex-col gap-0.5 tabular-nums">
                {trainers.map((t) => {
                  const now = today && t.call!.time === clock.time;
                  return (
                    <li key={t.id} className={now ? "text-emerald-200" : "text-gray-400"}>
                      <span className="text-gray-200">{t.name}</span>,{" "}
                      {t.call!.time ? TIME_HOURS[t.call!.time] : "any time"}
                      {t.where !== "Saffron City Fighting Dojo" && <> · {t.where}</>} —{" "}
                      <span className="text-gray-200">{fmtExp(t.exp)} EXP</span>
                      {now && <span className="ml-1 font-semibold text-emerald-300">call now</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      {anyDay.length > 0 && (
        <p className="text-xs text-gray-400">
          Any day: {anyDay.map((t) => `${t.name} (${t.where}, ${fmtExp(t.exp)} EXP)`).join(", ")}
        </p>
      )}
      <p className="text-xs text-gray-500">
        Times are the game&apos;s clock. Calling on another day or at another time gets a no.
      </p>
    </div>
  );
}
