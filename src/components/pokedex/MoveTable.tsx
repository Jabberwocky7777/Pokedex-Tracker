import type { MoveDetail } from "../../lib/move-fetch";
import { CategoryBadge } from "./CategoryBadge";
import TypeBadge from "../shared/TypeBadge";

export interface MoveRow {
  label?: string;
  move: string;
  detail: MoveDetail;
}

export function MoveTable({ rows, showLabel, labelHeader, useGen3Split }: {
  rows: MoveRow[];
  showLabel: boolean;
  labelHeader: string;
  useGen3Split: boolean;
}) {
  if (rows.length === 0) return (
    <div className="text-sm text-gray-500 italic py-2">None in this version group.</div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-700">
            {showLabel && <th className="py-2 pr-3 text-left font-medium w-14">{labelHeader}</th>}
            <th className="py-2 pr-3 text-left font-medium">Move</th>
            <th className="py-2 pr-3 text-left font-medium">Type</th>
            <th className="py-2 pr-3 text-left font-medium">Cat.</th>
            <th className="py-2 pr-3 text-right font-medium w-10">Pwr</th>
            <th className="py-2 pr-3 text-right font-medium w-10">Acc</th>
            <th className="py-2 text-right font-medium w-8">PP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.label ?? ""}-${row.move}`}
              className={`border-b border-gray-800/60 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"}`}
            >
              {showLabel && (
                <td className="py-1.5 pr-3 font-mono text-xs text-gray-400 whitespace-nowrap">{row.label}</td>
              )}
              <td className="py-1.5 pr-3 text-gray-200 font-medium whitespace-nowrap">{row.detail.displayName}</td>
              <td className="py-1.5 pr-3"><TypeBadge type={row.detail.type} /></td>
              <td className="py-1.5 pr-3"><CategoryBadge cat={useGen3Split ? row.detail.gen3Category : row.detail.category} /></td>
              <td className="py-1.5 pr-3 text-right font-mono text-xs text-gray-300">{row.detail.power ?? "—"}</td>
              <td className="py-1.5 pr-3 text-right font-mono text-xs text-gray-300">
                {row.detail.accuracy != null ? `${row.detail.accuracy}%` : "—"}
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-gray-300">{row.detail.pp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
