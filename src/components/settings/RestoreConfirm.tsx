import { useMemo } from "react";
import { compareForRestore, type BackupData } from "../../lib/backup";
import { buildPayload } from "../../lib/sync";
import Button from "../shared/Button";

interface Props {
  /** What is being restored, e.g. "the backup from 3 Nov 2026, 14:05" */
  source: string;
  data: BackupData;
  /** Malformed items a lenient restore will leave out */
  skipped?: string[];
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const plural = (n: number, word: string) => `${n} ${word.toLowerCase()}`;

/**
 * The confirmation before a restore (backup file or server snapshot): every
 * section side by side, now and in the copy, and what the restore removes from
 * this device and, at their next sync, every other device.
 */
export default function RestoreConfirm({ source, data, skipped = [], busy = false, onConfirm, onCancel }: Props) {
  const rows = useMemo(() => compareForRestore(buildPayload(), data), [data]);
  const losses = rows.filter((r) => r.lost > 0);

  return (
    <div
      className="flex flex-col gap-3 px-3 py-3 rounded-lg bg-red-900/20 border border-red-800/50"
      role="alertdialog"
      aria-label="Confirm restoring"
    >
      <p className="text-sm text-gray-200">
        Replace everything on this device with {source}? Your other devices follow at their next sync. You can undo it
        from this page afterwards.
      </p>

      <table className="text-sm w-full max-w-md">
        <thead>
          <tr className="text-xs text-gray-400 text-left">
            <th className="font-medium py-1">Section</th>
            <th className="font-medium py-1 text-right">Now</th>
            <th className="font-medium py-1 text-right">After restore</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.now > 0 || r.then > 0)
            .map((r) => (
              <tr key={r.label} className="border-t border-gray-800">
                <td className="py-1 text-gray-300">{r.label}</td>
                <td className="py-1 text-right tabular-nums text-gray-300">{r.now}</td>
                <td className={`py-1 text-right tabular-nums ${r.then < r.now ? "text-red-300" : "text-gray-100"}`}>
                  {r.then}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {losses.length > 0 && (
        <ul className="text-sm text-red-200 list-disc pl-5">
          {losses.map((r) => (
            <li key={r.label}>
              {plural(r.lost, r.label)} on this device {r.lost === 1 ? "is" : "are"} removed or replaced by an older
              copy
            </li>
          ))}
        </ul>
      )}

      {skipped.length > 0 && (
        <p className="text-xs text-gray-400">
          {skipped.length} malformed item{skipped.length === 1 ? " is" : "s are"} left out (
          {skipped.slice(0, 3).join(", ")}
          {skipped.length > 3 ? ", …" : ""}).
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Restoring…" : "Restore"}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
