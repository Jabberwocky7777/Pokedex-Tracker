import { useState } from "react";
import { fetchSnapshot, listSnapshots, type ServerSnapshot } from "../../lib/sync";
import { restoreBackupData } from "../../lib/backup";

interface Props {
  onResult: (message: string, ok: boolean) => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Older copies of the synced data that the server kept. Restoring one goes
 * through the same path as a backup file, so it is validated first and then
 * syncs to the other devices like any other change.
 */
export default function ServerSnapshots({ onResult }: Props) {
  const [snapshots, setSnapshots] = useState<ServerSnapshot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await listSnapshots();
      if (list) setSnapshots(list);
      else onResult("Couldn't load the snapshots from the server.", false);
    } catch {
      onResult("Couldn't reach the server.", false);
    } finally {
      setLoading(false);
    }
  }

  async function restore(snapshot: ServerSnapshot) {
    setRestoring(true);
    try {
      const data = await fetchSnapshot(snapshot.id);
      if (!data) { onResult("Couldn't load that snapshot.", false); return; }
      const result = restoreBackupData(data);
      onResult(result.ok ? "Snapshot restored — syncing to your other devices." : `Restore failed: ${result.error}`, result.ok);
      if (result.ok) setConfirmingId(null);
    } catch {
      onResult("Couldn't reach the server.", false);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">Server snapshots</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          The server keeps the copy each change replaced: one an hour for a day, then one a day for 30 days.
          Restoring one replaces what&apos;s on this device and then syncs to your other devices.
        </p>
      </div>

      {snapshots === null ? (
        <button
          onClick={load}
          disabled={loading}
          className="self-start px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Show snapshots"}
        </button>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-gray-400">No snapshots yet — the first one is kept when the synced data next changes.</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto rounded-lg border border-gray-800">
          {snapshots.map((snapshot) => {
            const label = formatTime(snapshot.savedAt ?? `${snapshot.id}:00:00Z`);
            return (
              <li key={snapshot.id} className="px-3 py-2 border-b border-gray-800 last:border-b-0">
                {confirmingId !== snapshot.id ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-200">{label}</span>
                    <button
                      onClick={() => setConfirmingId(snapshot.id)}
                      className="flex-shrink-0 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200 font-medium transition-colors"
                    >
                      Restore…
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2" role="alertdialog" aria-label="Confirm restoring a snapshot">
                    <p className="text-sm text-gray-200">
                      Replace the marks, Designer slots, PC boxes and saves list on this device with the copy saved {label}?
                      Your other devices follow at their next sync.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => restore(snapshot)}
                        disabled={restoring}
                        className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm text-white font-medium transition-colors disabled:opacity-50"
                      >
                        {restoring ? "Restoring…" : "Restore this copy"}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={restoring}
                        className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
