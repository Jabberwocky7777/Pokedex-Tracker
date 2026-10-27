import { Fragment, useState } from "react";
import type { EncounterMethod, GameVersion, Pokemon } from "../../types";
import { GAME_ABBR, GAME_LABELS } from "../../types";
import { SETUP_METHODS, whenText, type NextLocation, type NextTarget } from "../../lib/what-next";
import { METHOD_ORDER, METHOD_LABELS } from "../../hooks/useRouteIndex";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { areaDisplayName } from "../../lib/area-names";
import { requirementText } from "../../lib/unlocks";
import { saveTrip } from "../../store/useTripStore";
import { APPENDIX_TITLES, expectedEncounters, notOnRoutes, routeEffort, tripSections, weekdaysOf, weekdayText, type AppendixEntry, type AppendixGroup } from "../../lib/trip";
import { CAN_PRINT, PrintBox, PrintButton, PrintOption, PrintSheet, PrintSprite } from "../print/Print";
import SaveAsImage from "../print/SaveAsImage";
import { paginate, routeLines } from "../../lib/next-image";

interface Props {
  /** Every location the view has with the current filters applied, fully caught ones included */
  locations: NextLocation[];
  /** The games the sheet has a column for, in order */
  games: readonly string[];
  /** Ticked routes; none ticked prints them all */
  selected: ReadonlySet<string>;
  generation: number;
  gameLabel: string;
  /** "Only what's on right now", as words, when it is on */
  clockLabel: string | null;
  /** The generation's Pokémon and what is caught, for the "not on these routes" list */
  pokemon: Pokemon[];
  caughtIds: number[];
  /** "Easiest first": print the expected encounters */
  showEffort: boolean;
  /** Setup methods (outbreaks, Poké Radar…) are shown — kept with the printed trip */
  includeSetup: boolean;
  /** The method groups shown (empty: all) — kept with the printed trip */
  methods: string[];
  /** Those groups as words for the header, or null when every method is shown */
  methodLabel: string | null;
}

const abbr = (g: string) => GAME_ABBR[g as GameVersion] ?? GAME_LABELS[g as GameVersion] ?? g;
const levels = (t: NextTarget) => (t.minLevel === t.maxLevel ? `${t.minLevel}` : `${t.minLevel}–${t.maxLevel}`);

/** What a method needs before you can use it — the field move, item or cartridge. */
const METHOD_NEEDS: Partial<Record<EncounterMethod, string>> = {
  surf: "Surf", "old-rod": "Old Rod", "good-rod": "Good Rod", "super-rod": "Super Rod",
  "rock-smash": "Rock Smash", headbutt: "Headbutt", "rock-climb": "Rock Climb",
  "poke-radar": "Poké Radar", radio: "Pokégear radio", "honey-tree": "Honey",
  slot2: "GBA game in Slot 2", "slot2-ruby": "Ruby in Slot 2", "slot2-sapphire": "Sapphire in Slot 2",
  "slot2-emerald": "Emerald in Slot 2", "slot2-firered": "FireRed in Slot 2", "slot2-leafgreen": "LeafGreen in Slot 2",
};

/** The markers after a Pokémon's name, explained in the legend. */
const MARKERS = [
  { mark: "★", words: "nowhere else in your games", on: (t: NextTarget) => !!t.unique && !t.caught },
  { mark: "◆", words: "one-time encounter", on: (t: NextTarget) => t.isStatic },
  { mark: "▲", words: "needs setup (outbreak, Poké Radar, Slot 2 or radio)", on: (_t: NextTarget, method: string) => SETUP_METHODS.has(method) },
  { mark: "↻", words: "comes back after the Elite Four", on: (t: NextTarget) => t.respawnsAfterEliteFour },
];

/**
 * "Print all" / "Print N routes" for What's next, and the sheet it prints: one
 * table per route that never splits across pages, with a tick box per Pokémon
 * (ticked when caught), its method, levels, when and rate, and a column per game.
 * Black and white only — caught rows are lighter, uncaught ones bold.
 */
export default function WhatNextPrint({ locations, games, selected, generation, gameLabel, clockLabel, pokemon, caughtIds, showEffort, includeSetup, methods, methodLabel }: Props) {
  const [sprites, setSprites] = useState(false);
  const [showCaught, setShowCaught] = useState(true);
  const [includeComplete, setIncludeComplete] = useState(false);
  const [notesLines, setNotesLines] = useState(false);
  const [tripSheets, setTripSheets] = useState(false);
  const [appendix, setAppendix] = useState(false);
  const chosen = selected.size === 0
    ? locations.filter((l) => includeComplete || l.count > 0 || l.byMethod.some((m) => m.targets.some((t) => t.locked && !t.caught)))
    : locations.filter((l) => selected.has(l.slug));
  // In the iOS app the panel can only save images
  const verb = CAN_PRINT ? "Print" : "Save";
  const label = selected.size === 0 ? `${verb} all` : `${verb} ${chosen.length} route${chosen.length === 1 ? "" : "s"}`;
  const subtitle = [gameLabel, methodLabel, clockLabel ? `on right now (${clockLabel})` : ""].filter(Boolean).join(" · ");
  const caught = new Set(caughtIds);
  // The uncaught Pokémon the printed routes have, for the appendix
  const onRoutes = new Set(chosen.flatMap((l) => l.byMethod.flatMap((m) => m.targets.map((t) => t.pokemon.id))));

  return (
    <PrintButton
      label={label}
      // Kept (and synced) so a phone can check this sheet off in the same order
      onPrint={() => saveTrip({ slugs: chosen.map((l) => l.slug), generation, games: [...games], grouped: tripSheets, setup: includeSetup, methods })}
      disabled={chosen.length === 0}
      summary={
        <>
          <p className="mb-2">{chosen.length} route{chosen.length === 1 ? "" : "s"} in {gameLabel}{methodLabel ? `, ${methodLabel.toLowerCase()} only` : ""}{clockLabel ? `, on right now (${clockLabel})` : ""}:</p>
          <ul className="max-h-48 overflow-y-auto text-xs text-gray-400 flex flex-col gap-0.5" data-testid="print-route-list">
            {chosen.map((l) => <li key={l.slug}>{areaDisplayName(l.displayName)} — {l.count === 0 ? "all caught" : `${l.count} to catch`}</li>)}
          </ul>
        </>
      }
      options={
        <>
          <PrintOption checked={showCaught} onChange={setShowCaught}>Show caught Pokémon (ticked)</PrintOption>
          {selected.size === 0 && (
            <PrintOption checked={includeComplete} onChange={setIncludeComplete}>Include fully caught routes</PrintOption>
          )}
          <PrintOption checked={sprites} onChange={setSprites}>Include sprites</PrintOption>
          <PrintOption checked={notesLines} onChange={setNotesLines}>Add notes lines</PrintOption>
          <PrintOption checked={tripSheets} onChange={setTripSheets}>Trip sheet: group by morning, day, night and weekday</PrintOption>
          <PrintOption checked={appendix} onChange={setAppendix}>List what isn&apos;t on these routes (evolve, breed, trade, event)</PrintOption>
        </>
      }
      extra={
        <SaveAsImage
          fileStem="whats-next"
          getPages={() => {
            // Kept like a printed sheet, so the phone's check-off list offers it
            saveTrip({ slugs: chosen.map((l) => l.slug), generation, games: [...games], grouped: false, setup: includeSetup, methods });
            return {
              pages: paginate(chosen.map((l) => routeLines(l, { showCaught, showGames: games.length > 1 }))),
              header: { title: "What can I get next", subtitle, date: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) },
            };
          }}
        />
      }
      sheet={
        <PrintSheet title="What can I get next" games={subtitle}>
          <Legend games={games} />
          {(tripSheets ? tripSections(chosen) : [{ id: "all", title: "", locations: chosen }]).map((section) => (
            <Fragment key={section.id}>
              {section.title && <h2 className="p-section">{section.title}</h2>}
              {section.locations.map((loc) => (
                <RouteBlock
                  key={`${section.id}-${loc.slug}`}
                  loc={loc}
                  games={games}
                  generation={generation}
                  sprites={sprites}
                  showCaught={showCaught}
                  notesLines={notesLines}
                  showEffort={showEffort}
                />
              ))}
            </Fragment>
          ))}
          {appendix && <Appendix entries={notOnRoutes(pokemon, onRoutes, caught, games)} />}
        </PrintSheet>
      }
    />
  );
}

/** One route: header, then its table — never split across pages. */
function RouteBlock({ loc, games, generation, sprites, showCaught, notesLines, showEffort }: {
  loc: NextLocation;
  games: readonly string[];
  generation: number;
  sprites: boolean;
  showCaught: boolean;
  notesLines: boolean;
  showEffort: boolean;
}) {
  const columns = 6 + games.length + (sprites ? 1 : 0);
            const methods = [...loc.byMethod].sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
            const rows = methods.flatMap(({ method, targets }) =>
              targets.filter((t) => showCaught || !t.caught).map((t) => ({ method, t })));
            const where = Object.keys(loc.perGame);
            const needs = [...new Set(methods.map((m) => METHOD_NEEDS[m.method]).filter((n): n is string => !!n))];
            const best = loc.bestGame && where.length > 1 ? loc.bestGame : null;
            // A requirement shared by several rows (Mr. Backlot's daily Pokémon) is said once, under the header
            const reqCount = new Map<string, number>();
            for (const { t } of rows) for (const r of t.requirements) reqCount.set(r, (reqCount.get(r) ?? 0) + 1);
            const shared = [...reqCount].filter(([, n]) => n > 1).map(([r]) => r);
            const own = (t: NextTarget) => t.requirements.filter((r) => !shared.includes(r));
            return (
    <section key={loc.slug} className="p-block p-route" data-testid="print-route">
                <div className="p-route-head">
                  <h2>{areaDisplayName(loc.displayName)}</h2>
                  <span className="p-route-count">{loc.uniques > 0 ? `★ ${loc.uniques} only here · ` : ""}{loc.total - loc.count} of {loc.total} caught{showEffort && loc.count > 0 ? ` · ~${routeEffort(loc)} enc.` : ""}</span>
                </div>
                <div className="p-route-head p-muted p-small">
                  <span>Games: {where.map(abbr).join(" · ")} &nbsp; Needs: {needs.length > 0 ? needs.join(", ") : "—"}</span>
                  {best && <span>Best game: {abbr(best)} ({loc.perGame[best]} left)</span>}
                </div>
                {loc.note && <p className="p-muted p-small">{loc.note}</p>}
                {shared.map((r) => <p key={r} className="p-muted p-small"><em>For some Pokémon here: {r}</em></p>)}
                {rows.length === 0 ? (
                  <p className="p-muted p-small">Everything here is caught.</p>
                ) : (
                  <table className="p-table">
                    <thead>
                      <tr>
                        <th className="p-col-box" aria-label="Caught" />
                        {sprites && <th className="p-col-sprite" aria-label="Sprite" />}
                        <th className="p-col-num">#</th>
                        <th>Pokémon</th>
                        <th>Method</th>
                        <th className="p-col-lv">Lv</th>
                        <th>When / Rate</th>
                        {games.map((g) => <th key={g} className="p-col-game">{abbr(g)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ method, t }) => (
                        <Fragment key={`${method}-${t.pokemon.id}`}>
                          <tr className={t.caught ? "p-caught" : "p-uncaught"}>
                            <td className="p-col-box"><PrintBox checked={t.caught} /></td>
                            {sprites && <td className="p-col-sprite"><PrintSprite src={getGenSprite(t.pokemon, generation)} /></td>}
                            <td className="p-col-num">{formatDexNumber(t.pokemon.id)}</td>
                            <td className="p-name">
                              {t.pokemon.displayName}
                              {MARKERS.filter((m) => m.on(t, method)).map((m) => <span key={m.mark} className="p-marker"> {m.mark}</span>)}
                              {t.onlyIn && <span className="p-only"> only {abbr(t.onlyIn)}</span>}
                              {t.locked && (
                                <span className="p-only"> · unlocks: {t.locked.missing.map((r) => requirementText(r, t.locked!.game)).join(", ")} ({abbr(t.locked.game)})</span>
                              )}
                            </td>
                            <td>{METHOD_LABELS[method] ?? method}</td>
                            <td className="p-col-lv">{levels(t)}</td>
                            <td>
                              {[
                                weekdaysOf(loc.slug, method, t) ? weekdayText(weekdaysOf(loc.slug, method, t)!) : "",
                                whenText(t, { short: true }),
                                showEffort && !t.caught && expectedEncounters(t) !== null ? `(~${expectedEncounters(t)})` : "",
                              ].filter(Boolean).join(" · ") || "—"}
                            </td>
                            {games.map((g) => <td key={g} className="p-col-game">{t.games.includes(g) ? "●" : "·"}</td>)}
                          </tr>
                          {own(t).length > 0 && (
                            <tr className="p-req">
                              <td colSpan={columns} className="p-muted p-small">{own(t).join(" ")}</td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
                {notesLines && <div className="p-notes" aria-hidden="true"><span>Notes:</span></div>}
              </section>
            );
}

/** The end of the sheet: uncaught Pokémon none of the printed routes has, and how to get them instead. */
function Appendix({ entries }: { entries: AppendixEntry[] }) {
  if (entries.length === 0) return null;
  const groups = (Object.keys(APPENDIX_TITLES) as AppendixGroup[])
    .map((g) => ({ g, list: entries.filter((e) => e.group === g) }))
    .filter((x) => x.list.length > 0);
  return (
    <section className="p-appendix" data-testid="print-appendix">
      <h2 className="p-section">Not on these routes</h2>
      {groups.map(({ g, list }) => (
        <div key={g} className="p-block">
          <h3>{APPENDIX_TITLES[g]} ({list.length})</h3>
          <ul className="p-appendix-list p-small">
            {list.map((e) => (
              <li key={e.id} className="p-row">
                <PrintBox />
                <span>{formatDexNumber(e.id)} {e.name} <span className="p-muted">— {e.how}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Page 1: what the abbreviations and marks mean. */
function Legend({ games }: { games: readonly string[] }) {
  return (
    <section className="p-legend p-small" data-testid="print-legend">
      <p>
        <strong>Games:</strong> {games.map((g) => `${abbr(g)} = ${GAME_LABELS[g as GameVersion] ?? g}`).join(" · ")}
        {" "}— <strong>●</strong> that game has it here, <strong>·</strong> it doesn&apos;t
      </p>
      <p>
        <strong>When:</strong> M / D / N = morning (4–10), day (10–20), night (20–4) in Gen IV; no time = any time.
        {" "}<strong>Rate</strong> is the chance per encounter in the selected games.
      </p>
      <p>
        <PrintBox checked /> caught (lighter) · <PrintBox /> still to catch (bold)
        {MARKERS.map((m) => <Fragment key={m.mark}> · <strong>{m.mark}</strong> {m.words}</Fragment>)}
        {" "}· <strong>only Pt</strong> only that one of your games has it here
      </p>
    </section>
  );
}
