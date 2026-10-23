import { useEffect, useMemo, useState } from "react";
import { getGen3Category, loadMoveIndex } from "../../lib/move-fetch";
import type { MoveRecord, VersionGroup } from "../../lib/move-data";
import { moveDisplayName } from "../../lib/move-names";
import { TYPE_COLORS } from "../../lib/type-colors";

interface Props {
  versionGroup: VersionGroup;
  onSelect: (slug: string) => void;
}

const GEN3_GROUPS: VersionGroup[] = ["ruby-sapphire", "emerald", "firered-leafgreen"];

const CATEGORY_LABEL: Record<MoveRecord["category"], string> = { physical: "Phys.", special: "Spec.", status: "Status" };

/**
 * What the Attackdex shows with no move open: the game's moves by type.
 * Types and power are the selected game's (moves.json keeps the older games' differences in `by`).
 */
export default function MoveBrowser({ versionGroup, onSelect }: Props) {
  const [records, setRecords] = useState<MoveRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState("normal");

  useEffect(() => {
    loadMoveIndex().then((index) => setRecords(index.records)).catch(() => setFailed(true));
  }, []);

  const generation = GEN3_GROUPS.includes(versionGroup) ? 3 : 4;
  const byType = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; power: number | null; category: MoveRecord["category"] }[]>();
    for (const record of records ?? []) {
      if (record.gen > generation) continue;
      const values = { ...record, ...record.by?.[versionGroup] };
      const list = map.get(values.type) ?? [];
      const category = generation === 3 ? getGen3Category(values.type, record.category) : record.category;
      list.push({ slug: record.slug, name: moveDisplayName(record.slug), power: values.power, category });
      map.set(values.type, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [records, generation, versionGroup]);

  if (failed) return <p className="text-sm text-gray-400 text-center py-12">The move list couldn&apos;t be loaded. Search above instead.</p>;
  if (!records) return <p className="text-sm text-gray-400 text-center py-12">Loading moves…</p>;

  const types = [...byType.keys()].sort((a, b) => a.localeCompare(b));
  const shown = byType.get(type) ?? [];

  return (
    <section className="flex flex-col gap-3" aria-labelledby="move-browse-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="move-browse-heading" className="text-sm font-semibold text-gray-200">Browse moves by type</h3>
        <p className="text-xs text-gray-400">Or search above for any move.</p>
      </div>

      <div role="radiogroup" aria-label="Move type" className="flex flex-wrap gap-1.5">
        {types.map((t) => {
          const active = t === type;
          const color = TYPE_COLORS[t] ?? "#6b7280";
          return (
            <button
              key={t}
              role="radio"
              aria-checked={active}
              onClick={() => setType(t)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${
                active ? "text-white" : "text-gray-300 border-gray-700 bg-gray-900 hover:bg-gray-800"
              }`}
              style={active ? { backgroundColor: color, borderColor: color, textShadow: "0 1px 1px rgb(0 0 0 / 0.5)" } : { borderLeftColor: color, borderLeftWidth: 3 }}
            >
              {t === "unknown" ? "???" : t}
              <span className={`ml-1 tabular-nums ${active ? "text-white/80" : "text-gray-500"}`}>{byType.get(t)?.length}</span>
            </button>
          );
        })}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
        {shown.map((m) => (
          <li key={m.slug}>
            <button
              onClick={() => onSelect(m.slug)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-gray-900 border border-gray-800 hover:border-indigo-500 hover:bg-gray-800 text-left transition-colors"
            >
              <span className="text-sm text-gray-200 truncate">{m.name}</span>
              <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">
                {CATEGORY_LABEL[m.category]}{m.power ? ` · ${m.power}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
