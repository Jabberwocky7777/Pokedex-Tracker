import { STAT_KEYS, STAT_LABELS, PROJECTION_LEVELS, type StatKey, type Nature } from "../../lib/iv-calc";

export interface ProjectionTableProps {
  projectionA: Record<number, Record<StatKey, number>>;
  projectionB?: Record<number, Record<StatKey, number>> | null;
  nameA?: string;
  nameB?: string;
  nature: Nature;
  natureB?: Nature;
}

export function ProjectionTable({ projectionA, projectionB, nameA, nameB, nature, natureB }: ProjectionTableProps) {
  const compare = !!projectionB;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate" style={{ borderSpacing: "0 2px" }}>
        <thead>
          {compare && (
            <tr>
              <th className="text-left px-2 pb-1 text-gray-600 font-normal w-12" />
              {STAT_KEYS.map((stat) => (
                <th key={stat} colSpan={2} className="text-center px-1 pb-1 text-gray-500 font-medium">
                  <span className="flex items-center justify-center gap-0.5">
                    {STAT_LABELS[stat].replace("Special ", "Sp.")}
                  </span>
                </th>
              ))}
            </tr>
          )}
          <tr className="text-gray-500 font-medium">
            <th className="text-left px-2 pb-1 w-12">Lv.</th>
            {STAT_KEYS.map((stat) =>
              compare ? (
                <>
                  <th key={`${stat}-a`} className="text-center px-1 pb-1">
                    <span className="flex items-center justify-center gap-0.5 text-indigo-400">
                      {nameA ? nameA.slice(0, 3) : "A"}
                      {nature.plus === stat && <span className="text-green-400">▲</span>}
                      {nature.minus === stat && <span className="text-red-400">▼</span>}
                    </span>
                  </th>
                  <th key={`${stat}-b`} className="text-center px-1 pb-1">
                    <span className="flex items-center justify-center gap-0.5 text-pink-400">
                      {nameB ? nameB.slice(0, 3) : "B"}
                      {natureB?.plus === stat && <span className="text-green-400">▲</span>}
                      {natureB?.minus === stat && <span className="text-red-400">▼</span>}
                    </span>
                  </th>
                </>
              ) : (
                <th key={stat} className="text-center px-1 pb-1">
                  <span className="flex items-center justify-center gap-0.5">
                    {STAT_LABELS[stat].replace("Special ", "Sp.")}
                    {nature.plus === stat && <span className="text-green-400">▲</span>}
                    {nature.minus === stat && <span className="text-red-400">▼</span>}
                  </span>
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {PROJECTION_LEVELS.map((lv) => {
            const rowA = projectionA[lv];
            const rowB = projectionB?.[lv];
            const isMax = lv === 100;
            return (
              <tr
                key={lv}
                className={isMax ? "border-t border-indigo-900/50" : ""}
              >
                <td className={`px-2 py-1.5 font-mono rounded-l-lg ${isMax ? "text-indigo-300 font-bold bg-indigo-950/40" : "text-gray-500 bg-gray-800/50"}`}>
                  {lv}
                </td>
                {STAT_KEYS.map((stat) => {
                  const va = rowA[stat];
                  const vb = rowB?.[stat];

                  if (compare && vb !== undefined) {
                    const aWins = va > vb;
                    const bWins = vb > va;
                    return (
                      <>
                        <td key={`${stat}-a`} className={`py-1.5 px-1 text-center font-mono tabular-nums ${isMax ? "bg-indigo-950/40" : "bg-gray-800/50"} ${aWins ? "text-indigo-300 font-bold" : bWins ? "text-gray-500" : "text-gray-300"}`}>
                          {va}
                        </td>
                        <td key={`${stat}-b`} className={`py-1.5 px-1 text-center font-mono tabular-nums rounded-r-lg ${isMax ? "bg-indigo-950/40" : "bg-gray-800/50"} ${bWins ? "text-pink-300 font-bold" : aWins ? "text-gray-500" : "text-gray-300"}`}>
                          {vb}
                        </td>
                      </>
                    );
                  }

                  return (
                    <td
                      key={stat}
                      className={`py-1.5 px-1 text-center font-mono tabular-nums last:rounded-r-lg ${
                        isMax ? "text-indigo-200 font-bold bg-indigo-950/40" : "text-gray-300 bg-gray-800/50"
                      }`}
                    >
                      {va}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
