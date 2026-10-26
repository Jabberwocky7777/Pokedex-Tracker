import { Fragment, useState } from "react";
import type { EncounterMethod, GameVersion } from "../../types";
import { GAME_ABBR, GAME_LABELS } from "../../types";
import { SETUP_METHODS, whenText, type NextLocation, type NextTarget } from "../../lib/what-next";
import { METHOD_ORDER, METHOD_LABELS } from "../../hooks/useRouteIndex";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { areaDisplayName } from "../../lib/area-names";
import { PrintBox, PrintButton, PrintOption, PrintSheet, PrintSprite } from "../print/Print";

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
export default function WhatNextPrint({ locations, games, selected, generation, gameLabel, clockLabel }: Props) {
  const [sprites, setSprites] = useState(false);
  const [showCaught, setShowCaught] = useState(true);
  const [includeComplete, setIncludeComplete] = useState(false);
  const [notesLines, setNotesLines] = useState(false);
  const chosen = selected.size === 0
    ? locations.filter((l) => includeComplete || l.count > 0)
    : locations.filter((l) => selected.has(l.slug));
  const label = selected.size === 0 ? "Print all" : `Print ${chosen.length} route${chosen.length === 1 ? "" : "s"}`;
  const columns = 6 + games.length + (sprites ? 1 : 0);

  return (
    <PrintButton
      label={label}
      disabled={chosen.length === 0}
      summary={
        <>
          <p className="mb-2">{chosen.length} route{chosen.length === 1 ? "" : "s"} in {gameLabel}{clockLabel ? `, on right now (${clockLabel})` : ""}:</p>
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
        </>
      }
      sheet={
        <PrintSheet title="What can I get next" games={`${gameLabel}${clockLabel ? ` · on right now (${clockLabel})` : ""}`}>
          <Legend games={games} />
          {chosen.map((loc) => {
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
                  <span className="p-route-count">{loc.total - loc.count} of {loc.total} caught</span>
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
                            </td>
                            <td>{METHOD_LABELS[method] ?? method}</td>
                            <td className="p-col-lv">{levels(t)}</td>
                            <td>{whenText(t, { short: true }) || "—"}</td>
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
          })}
        </PrintSheet>
      }
    />
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
