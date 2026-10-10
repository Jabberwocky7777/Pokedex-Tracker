import type { Pokemon } from "../../types";
import { useSaveStore } from "../../store/useSaveStore";
import { summarizeEntry, type HistoryEntry } from "../../lib/save/history";

interface Props {
  profileId: string;
  pokemonMap: Map<number, Pokemon>;
}

const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The species behind one line of an entry, as a short comma-separated list. */
function Detail({ label, species, nameOf }: { label: string; species: number[]; nameOf: (id: number) => string }) {
  if (species.length === 0) return null;
  const shown = species.slice(0, 12).map(nameOf).join(", ");
  return (
    <div className="text-xs text-gray-500">
      <span className="text-gray-400">{label}:</span> {shown}{species.length > 12 ? ` and ${species.length - 12} more` : ""}
    </div>
  );
}

export function HistoryDetails({ entry, nameOf }: { entry: HistoryEntry; nameOf: (id: number) => string }) {
  return (
    <>
      <Detail label="Placed" species={entry.placed} nameOf={nameOf} />
      {entry.evolved.length > 2 && (
        <div className="text-xs text-gray-500">
          <span className="text-gray-400">Evolved:</span> {entry.evolved.slice(0, 12).map(([from, to]) => `${nameOf(from)} → ${nameOf(to)}`).join(", ")}
        </div>
      )}
      <Detail label="New shinies" species={entry.newShinies} nameOf={nameOf} />
      <Detail label="Added" species={entry.added} nameOf={nameOf} />
      <Detail label="Removed" species={entry.removed} nameOf={nameOf} />
    </>
  );
}

/** What changed between imports of one save, newest first. Kept on the importing device. */
export default function HistoryPanel({ profileId, pokemonMap }: Props) {
  const history = useSaveStore((s) => s.history[profileId]);
  const hasFull = useSaveStore((s) => !!s.fullSaves[profileId]);
  const nameOf = (id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`;

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
          <HistoryDetails entry={entry} nameOf={nameOf} />
        </li>
      ))}
    </ul>
  );
}
