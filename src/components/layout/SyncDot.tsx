import { useState, useEffect, useRef, useCallback } from "react";
import { useSyncStatus } from "../../hooks/useSyncStatus";

function formatRelativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type DotState = "synced" | "syncing" | "stale" | "error" | "idle";

interface Props {
  /** Extra CSS classes for positioning in the parent layout */
  className?: string;
}

export default function SyncDot({ className = "" }: Props) {
  const { syncing, lastSynced, error, forcePush } = useSyncStatus();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh the relative timestamp every 30s so it stays accurate
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Determine dot state
  let state: DotState = "idle";
  if (syncing) {
    state = "syncing";
  } else if (error) {
    state = "error";
  } else if (lastSynced) {
    const ageMs = now - lastSynced.getTime();
    state = ageMs > 60 * 60 * 1000 ? "stale" : "synced";
  }

  // Build tooltip text
  const tooltipText =
    state === "syncing"  ? "Syncing…" :
    state === "error"    ? `Sync failed — tap to retry` :
    state === "stale"    ? `Last synced ${lastSynced ? formatRelativeTime(lastSynced) : "unknown"} — tap to retry` :
    state === "synced"   ? `Synced ${lastSynced ? formatRelativeTime(lastSynced) : ""}` :
    null;

  const handleClick = useCallback(() => {
    if ((state === "error" || state === "stale") && forcePush) forcePush();
  }, [state, forcePush]);

  if (state === "idle") return null;

  const dotClasses =
    state === "syncing" ? "bg-yellow-400 animate-pulse" :
    state === "error"   ? "bg-red-500" :
    state === "stale"   ? "bg-amber-400" :
    "bg-emerald-500";

  const isClickable = state === "error" || state === "stale";

  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        aria-label={tooltipText ?? "Sync status"}
        // The dot stays 8 px; the padding around it is what you tap
        className={`p-[18px] -m-[18px] flex-shrink-0 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className={`block w-2 h-2 rounded-full ${dotClasses}`} />
      </button>
      {tooltipVisible && tooltipText && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-200 pointer-events-none z-50 shadow-lg">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
