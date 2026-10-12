import { Fragment, type ReactNode } from "react";
import type { Pokemon } from "../../types";
import { useSaveStore } from "../../store/useSaveStore";
import { summarizeEntry, type HistoryEntry } from "../../lib/save/history";
import { genConfigOf } from "../../lib/save/types";
import { PokemonLink } from "../shared/links";

interface Props {
  profileId: string;
  pokemonMap: Map<number, Pokemon>;
}

const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** How one species is written: its name, or (in the History panel) a link to it. */
type Show = (id: number) => ReactNode;

/** The species behind one line of an entry, as a short comma-separated list. */
function Detail({ label, species, show }: { label: string; species: number[]; show: Show }) {
  if (species.length === 0) return null;
  return (
    <div className="text-xs text-gray-500">
      <span className="text-gray-400">{label}:</span>{" "}
      {species.slice(0, 12).map((id, i) => <Fragment key={id}>{i > 0 && ", "}{show(id)}</Fragment>)}
      {species.length > 12 ? ` and ${species.length - 12} more` : ""}
    </div>
  );
}

/**
 * The species lists of one history entry. Plain names unless `link` is given —
 * the import review shows this inside a dialog, where a link would open the
 * tracker underneath it.
 */
export function HistoryDetails({ entry, nameOf, link }: { entry: HistoryEntry; nameOf: (id: number) => string; link?: Show }) {
  const show = link ?? nameOf;
  return (
    <>
      <Detail label="Placed" species={entry.placed} show={show} />
      {entry.evolved.length > 2 && (
        <div className="text-xs text-gray-500">
          <span className="text-gray-400">Evolved:</span>{" "}
          {entry.evolved.slice(0, 12).map(([from, to], i) => (
            <Fragment key={`${from}-${to}-${i}`}>{i > 0 && ", "}{show(from)} → {show(to)}</Fragment>
          ))}
        </div>
      )}
      <Detail label="New shinies" species={entry.newShinies} show={show} />
      <Detail label="Added" species={entry.added} show={show} />
      <Detail label="Removed" species={entry.removed} show={show} />
    </>
  );
}

/** What changed between imports of one save, newest first. Kept on the importing device. */
export default function HistoryPanel({ profileId, pokemonMap }: Props) {
  const history = useSaveStore((s) => s.history[profileId]);
  const hasFull = useSaveStore((s) => !!s.fullSaves[profileId]);
  const family = useSaveStore((s) => s.profiles.find((p) => p.id === profileId)?.family);
  const nameOf = (id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`;
  const link = (id: number) => (
    <PokemonLink id={id} to="tracker" generation={family ? genConfigOf(family).gen : undefined}>{nameOf(id)}</PokemonLink>
  );

  if (!history || history.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-sm text-gray-400 max-w-3xl">
        {hasFull
          ? "No history yet. Each time you import a newer dump of this save, what changed is listed here."
          : "History is kept on the device that imports the save."}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 max-w-3xl">
      {history.map((entry) => (
        <li key={entry.at} className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(entry.at)}</span>
            <span className="text-sm text-gray-100">{summarizeEntry(entry, nameOf)}</span>
            <span className="text-xs text-gray-600 ml-auto">save #{entry.saveCount}</span>
          </div>
          <HistoryDetails entry={entry} nameOf={nameOf} link={link} />
        </li>
      ))}
    </ul>
  );
}
