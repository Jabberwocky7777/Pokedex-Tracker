import { useState } from "react";
import { HardDriveDownload, X } from "lucide-react";
import { IS_NATIVE } from "../../lib/platform";
import { isLocalMode } from "../../lib/sync";
import { isSampleData } from "../../lib/sample-data";
import { lastBackupAt, noteBackupMade, WEEK_MS } from "../../lib/backup-reminder";
import { useDexStore } from "../../store/useDexStore";
import { safeSetItem } from "../../lib/safe-storage";

const SNOOZE_KEY = "pokedex_backup_nudge_snoozed";
const DUE_AFTER_MS = 2 * WEEK_MS;

function snoozedUntil(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * The iOS and Android apps in "Use offline" mode: the data is only on this device,
 * and uninstalling the app (or, on Android, a signature mismatch that forces one)
 * deletes it. With marks and no backup in two weeks, this asks for one; Not now
 * waits a week.
 */
export default function BackupNudge() {
  const [now] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);
  const hasMarks = useDexStore((s) => Object.values(s.caughtByGen).some((ids) => ids.length > 0));
  const last = lastBackupAt();
  if (
    hidden ||
    !IS_NATIVE ||
    !isLocalMode() ||
    isSampleData() ||
    !hasMarks ||
    (last !== null && now - last < DUE_AFTER_MS) ||
    snoozedUntil() > now
  )
    return null;

  async function backUp() {
    const { downloadBackup } = await import("../../lib/backup");
    if ((await downloadBackup()) === "saved") {
      noteBackupMade();
      setHidden(true);
    }
  }

  return (
    <div
      role="status"
      className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-sm text-amber-100"
    >
      <HardDriveDownload size={15} className="flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0">
        Your data is only on this device{last ? "" : " and has never been backed up"}. Uninstalling the app removes it.
      </p>
      <button
        onClick={() => void backUp()}
        className="flex-shrink-0 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
      >
        Back up
      </button>
      <button
        onClick={() => {
          safeSetItem(SNOOZE_KEY, String(now + WEEK_MS));
          setHidden(true);
        }}
        aria-label="Not now"
        title="Not now"
        className="flex-shrink-0 p-1.5 rounded-md text-amber-200 hover:bg-amber-500/20"
      >
        <X size={14} />
      </button>
    </div>
  );
}
