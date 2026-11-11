import { useState } from "react";
import { fetchSnapshot, listSnapshots, type ServerSnapshot } from "../../lib/sync";
import { applyRestore, prepareRestore, type BackupData } from "../../lib/backup";
import RestoreConfirm from "./RestoreConfirm";
import Button from "../shared/Button";

interface Props {
  onResult: (message: string, ok: boolean) => void;
  /** After a restore, so Settings can offer to undo it */
  onRestored?: () => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Older copies of the synced data that the server kept. Restoring one goes
 * through the same path as a backup file: it is validated, shown side by side
 * with what is here now, and then syncs to the other devices like any other change.
 */
export default function ServerSnapshots({ onResult, onRestored }: Props) {
  const [snapshots, setSnapshots] = useState<ServerSnapshot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; label: string; data: BackupData; skipped: string[] } | null>(
    null,
  );
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

  async function prepare(snapshot: ServerSnapshot, label: string) {
    setLoadingId(snapshot.id);
    try {
      const raw = await fetchSnapshot(snapshot.id);
      if (!raw) {
        onResult("Couldn't load that snapshot.", false);
        return;
      }
      const prepared = prepareRestore(raw, { lenient: true });
      if (!prepared.ok) {
        onResult(`Restore failed: ${prepared.error}`, false);
        return;
      }
      setPending({ id: snapshot.id, label, data: prepared.data, skipped: prepared.skipped });
    } catch {
      onResult("Couldn't reach the server.", false);
    } finally {
      setLoadingId(null);
    }
  }

  async function restore() {
    if (!pending) return;
    setRestoring(true);
    try {
      const { undoKept } = await applyRestore(pending.data, `the server copy saved ${pending.label}`);
      onResult(
        undoKept
          ? "Snapshot restored — syncing to your other devices."
          : "Snapshot restored, but this device couldn't keep a copy to undo it.",
        true,
      );
      setPending(null);
      onRestored?.();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">Server snapshots</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          The server keeps the copy each change replaced: one an hour for a day, then one a day for 30 days. Restoring
          one replaces everything on this device (marks, notes, journal, Working on, hunts, roamers, game progress,
          trips, Designer, PC boxes and saves) and then syncs to your other devices.
        </p>
      </div>

      {snapshots === null ? (
        <Button onClick={load} disabled={loading} className="self-start">
          {loading ? "Loading…" : "Show snapshots"}
        </Button>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-gray-400">
          No snapshots yet — the first one is kept when the synced data next changes.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-[32rem] overflow-y-auto rounded-lg border border-gray-800">
          {snapshots.map((snapshot) => {
            const label = formatTime(snapshot.savedAt ?? `${snapshot.id}:00:00Z`);
            return (
              <li key={snapshot.id} className="px-3 py-2 border-b border-gray-800 last:border-b-0">
                {pending?.id !== snapshot.id ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-200">{label}</span>
                    <Button
                      size="sm"
                      onClick={() => prepare(snapshot, label)}
                      disabled={loadingId !== null || restoring}
                      className="flex-shrink-0"
                    >
                      {loadingId === snapshot.id ? "Loading…" : "Restore…"}
                    </Button>
                  </div>
                ) : (
                  <RestoreConfirm
                    source={`the copy saved ${label}`}
                    data={pending.data}
                    skipped={pending.skipped}
                    busy={restoring}
                    onConfirm={restore}
                    onCancel={() => setPending(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
