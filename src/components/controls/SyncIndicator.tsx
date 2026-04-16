import { useSyncStatus } from "../../hooks/useSyncStatus";

function formatAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/**
 * Shows sync status in the header. Renders nothing when sync is disabled
 * (no SYNC_TOKEN configured) so non-sync users see zero UI change.
 */
export default function SyncIndicator() {
  const { syncing, lastSynced, error } = useSyncStatus();

  // Never touched — sync is disabled or hasn't run yet
  if (!syncing && !lastSynced && !error) return null;

  if (error) {
    return (
      <div
        title={`Sync error: ${error}`}
        className="flex items-center gap-1 text-xs font-medium text-red-400 cursor-default select-none"
        aria-live="polite"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
        </svg>
        Sync error
      </div>
    );
  }

  if (syncing) {
    return (
      <div
        className="flex items-center gap-1 text-xs font-medium text-blue-400 select-none"
        aria-live="polite"
      >
        <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Syncing…
      </div>
    );
  }

  // Synced successfully
  return (
    <div
      className="flex items-center gap-1 text-xs font-medium text-emerald-400 select-none"
      aria-live="polite"
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd" />
      </svg>
      {lastSynced ? `Synced ${formatAgo(lastSynced)}` : "Synced"}
    </div>
  );
}
