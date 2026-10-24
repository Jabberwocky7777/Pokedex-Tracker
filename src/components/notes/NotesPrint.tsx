import { useState } from "react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import type { LiveItem } from "../../lib/working-on";
import { STATUS_LABELS } from "../../lib/working-on";
import type { NoteRow } from "../../lib/notes";
import type { LiveJournalEntry } from "../../lib/journal";
import type { WorkLink } from "../../store/useWorkingOnStore";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { PrintBox, PrintButton, PrintOption, PrintSheet, PrintSprite } from "../print/Print";

const longDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" });
const dayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return longDate.format(new Date(y, m - 1, d));
};

function linkWords(link: WorkLink | undefined, nameOf: (id: number) => string): string {
  if (!link) return "";
  if (link.kind === "pokemon") return `${nameOf(link.id)}${link.generation ? ` (Gen ${link.generation})` : ""}`;
  if (link.kind === "route") return link.name;
  return GAME_LABELS[link.game] ?? link.game;
}

/** Working on: empty tick boxes; done items only with "Include done". */
export function WorkingOnPrint({ items, allPokemon }: { items: LiveItem[]; allPokemon: Pokemon[] }) {
  const [includeDone, setIncludeDone] = useState(false);
  const byId = new Map(allPokemon.map((p) => [p.id, p.displayName]));
  const nameOf = (id: number) => byId.get(id) ?? `#${id}`;
  // Open items in list order, then (when asked for) the done ones
  const printed = [...items.filter((i) => i.status !== "done"), ...(includeDone ? items.filter((i) => i.status === "done") : [])];

  return (
    <PrintButton
      label="Print"
      disabled={items.length === 0}
      summary={<p>{printed.length} item{printed.length === 1 ? "" : "s"} from your Working on list, each with an empty box to tick.</p>}
      options={<PrintOption checked={includeDone} onChange={setIncludeDone}>Include done</PrintOption>}
      sheet={
        <PrintSheet title="Working on" games="All games">
          <ul>
            {printed.map((item) => (
              <li key={item.id} className="p-row p-block">
                <PrintBox />
                <span>
                  {item.text}
                  {item.link && <span className="p-muted"> · {linkWords(item.link, nameOf)}</span>}
                  {item.status !== "todo" && <span className="p-muted"> · {STATUS_LABELS[item.status]}</span>}
                  {item.note && <span className="p-text p-muted" style={{ display: "block" }}>{item.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </PrintSheet>
      }
    />
  );
}

/** All notes, as filtered and sorted on screen. */
export function AllNotesPrint({ rows, pokemonById, generation, query }: { rows: NoteRow[]; pokemonById: Map<number, Pokemon>; generation: number; query: string }) {
  const [sprites, setSprites] = useState(false);
  return (
    <PrintButton
      label="Print"
      disabled={rows.length === 0}
      summary={<p>{rows.length} note{rows.length === 1 ? "" : "s"} from Generation {generation}{query.trim() ? `, matching “${query.trim()}”` : ""}, in the order shown.</p>}
      options={<PrintOption checked={sprites} onChange={setSprites}>Include sprites</PrintOption>}
      sheet={
        <PrintSheet title="Pokémon notes" games={`Generation ${generation} games`}>
          {rows.map((row) => {
            const pokemon = pokemonById.get(row.pokemonId);
            if (!pokemon) return null;
            return (
              <section key={row.pokemonId} className="p-block">
                <h2 className="p-row">
                  {sprites && <PrintSprite src={getGenSprite(pokemon, generation)} />}
                  <span>{pokemon.displayName} <span className="p-muted">#{formatDexNumber(pokemon.id)} · edited {longDate.format(row.at)}</span></span>
                </h2>
                <p className="p-text">{row.text}</p>
              </section>
            );
          })}
        </PrintSheet>
      }
    />
  );
}

/** The journal, as filtered on screen. */
export function JournalPrint({ entries, game }: { entries: LiveJournalEntry[]; game: GameVersion | "" }) {
  return (
    <PrintButton
      label="Print"
      disabled={entries.length === 0}
      summary={<p>{entries.length} journal entr{entries.length === 1 ? "y" : "ies"}{game ? ` for ${GAME_LABELS[game]}` : ""}, newest first.</p>}
      sheet={
        <PrintSheet title="Journal" games={game ? GAME_LABELS[game] : "All games"}>
          {entries.map((entry) => (
            <section key={entry.id} className="p-block">
              <h2>{dayOf(entry.date)} <span className="p-muted">· {GAME_LABELS[entry.game] ?? entry.game}</span></h2>
              <p className="p-text">{entry.text}</p>
            </section>
          ))}
        </PrintSheet>
      }
    />
  );
}
