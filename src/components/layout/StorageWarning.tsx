import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useStorageHealth } from "../../lib/safe-storage";

/**
 * Shown once this browser has refused to save a change (storage full or
 * blocked): edits still work until the page is closed, but are not kept.
 */
export default function StorageWarning() {
  const failed = useStorageHealth((s) => s.writeFailed);
  const [dismissed, setDismissed] = useState(false);
  if (!failed || dismissed) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 px-4 py-2 bg-amber-900/40 border-b border-amber-700/60 text-sm text-amber-100"
    >
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Couldn&apos;t save on this device: the browser&apos;s storage is full or blocked. Changes you make now are lost
        when this page closes. Export a backup from Settings, or sign in to sync, to keep them.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="p-1 rounded hover:bg-amber-800/50 flex-shrink-0"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
