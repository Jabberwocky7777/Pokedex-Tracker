import { useState } from "react";
import type { GameVersion } from "../../types";
import { GAME_LABELS } from "../../types";
import type { NextLocation, NextTarget } from "../../lib/what-next";
import { METHOD_ORDER, METHOD_LABELS } from "../../hooks/useRouteIndex";
import { getGenSprite } from "../../lib/pokemon-display";
import { areaDisplayName } from "../../lib/area-names";
import { PrintBox, PrintButton, PrintOption, PrintSheet, PrintSprite } from "../print/Print";

interface Props {
  /** Every location the view has, with the current filters applied */
  locations: NextLocation[];
  /** Ticked routes; none ticked prints them all */
  selected: ReadonlySet<string>;
  generation: number;
  gameLabel: string;
  /** "Only what's on right now", as words, when it is on */
  clockLabel: string | null;
}

const games = (list: string[]) => list.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(", ");
const levels = (t: NextTarget) => (t.minLevel === t.maxLevel ? `Lv. ${t.minLevel}` : `Lv. ${t.minLevel}–${t.maxLevel}`);
const rate = (t: NextTarget) =>
  !t.maxChance ? "" : t.minChance === t.maxChance ? `${t.maxChance}%` : `${t.minChance}–${t.maxChance}%`;

/** "Print all" / "Print N routes" for What's next, and the sheet it prints. */
export default function WhatNextPrint({ locations, selected, generation, gameLabel, clockLabel }: Props) {
  const [sprites, setSprites] = useState(false);
  const chosen = selected.size === 0 ? locations : locations.filter((l) => selected.has(l.slug));
  const label = selected.size === 0 ? "Print all" : `Print ${chosen.length} route${chosen.length === 1 ? "" : "s"}`;

  return (
    <PrintButton
      label={label}
      disabled={chosen.length === 0}
      summary={
        <>
          <p className="mb-2">{chosen.length} route{chosen.length === 1 ? "" : "s"} in {gameLabel}{clockLabel ? `, on right now (${clockLabel})` : ""}:</p>
          <ul className="max-h-48 overflow-y-auto text-xs text-gray-400 flex flex-col gap-0.5" data-testid="print-route-list">
            {chosen.map((l) => <li key={l.slug}>{areaDisplayName(l.displayName)} — {l.count} to catch</li>)}
          </ul>
        </>
      }
      options={<PrintOption checked={sprites} onChange={setSprites}>Include sprites</PrintOption>}
      sheet={
        <PrintSheet title="What can I get next" games={`${gameLabel}${clockLabel ? ` · on right now (${clockLabel})` : ""}`}>
          {chosen.map((loc) => {
            const methods = [...loc.byMethod].sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
            const where = [...new Set(loc.byMethod.flatMap((m) => m.targets.flatMap((t) => t.games)))];
            return (
              <section key={loc.slug} className="p-block">
                <h2>{areaDisplayName(loc.displayName)} <span className="p-muted">· {games(where)}</span></h2>
                <ul>
                  {methods.flatMap(({ method, targets }) => targets.map((t) => (
                    <li key={`${method}-${t.pokemon.id}`} className="p-row">
                      <PrintBox />
                      {sprites && <PrintSprite src={getGenSprite(t.pokemon, generation)} />}
                      <span>
                        {[t.pokemon.displayName, METHOD_LABELS[method] ?? method, levels(t), t.times.join("/"), rate(t)].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  )))}
                </ul>
              </section>
            );
          })}
        </PrintSheet>
      }
    />
  );
}
