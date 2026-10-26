import { useEffect, useRef } from "react";
import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { useDesignerStore } from "../store/useDesignerStore";
import { useSaveStore } from "../store/useSaveStore";
import { useRoamerStore } from "../store/useRoamerStore";
import { useNotesStore } from "../store/useNotesStore";
import { useHuntStore } from "../store/useHuntStore";
import { hasToken, isLocalMode, syncOnce, hasUnsyncedChanges } from "../lib/sync";
import { createSyncScheduler, POLL_INTERVAL_MS, type SyncScheduler } from "../lib/sync-scheduler";
import { useSyncStatus } from "./useSyncStatus";
import { useWorkingOnStore } from "../store/useWorkingOnStore";
import { useJournalStore } from "../store/useJournalStore";

/** Sync is off in local (offline) mode and whenever there is no token. */
function syncEnabled(): boolean {
  return hasToken() && !isLocalMode();
}

function userIsTyping(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

/**
 * Mounts sync: on load, every 30 s while the tab is visible, when it becomes
 * visible again, and 2 s after a local change. When syncs run is decided by
 * lib/sync-scheduler.ts; this hook connects it to the timers, the page and the stores.
 */
export function useSyncEngine() {
  const { setSyncing, setLastSynced, setError, setForcePush, noteChange } = useSyncStatus();

  const schedulerRef = useRef<SyncScheduler | null>(null);
  schedulerRef.current ??= createSyncScheduler({
    syncOnce,
    enabled: syncEnabled,
    isTyping: userIsTyping,
    setSyncing,
    onResult: (result) => {
      if (result?.ok) {
        // When this device last synced — not the server's savedAt, which is
        // when anyone last pushed and would make a quiet hour look "stale"
        setLastSynced(new Date());
        setError(null);
        if (result.changed) noteChange();
      } else {
        setError("Sync failed — retrying…");
      }
    },
  });
  const isFirstRender = useRef(true);

  // ── Sync on mount + every 30s (pauses when tab is hidden) ───────────────
  useEffect(() => {
    const scheduler = schedulerRef.current!;
    if (!syncEnabled()) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (timer !== null) return;
      timer = setInterval(scheduler.poll, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (timer !== null) { clearInterval(timer); timer = null; }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        // Coming back to the tab: catch up right away, then resume the 30s timer.
        void scheduler.run(false);
        startPolling();
      }
    }

    void scheduler.run(false);
    if (!document.hidden) startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    setForcePush(() => { void scheduler.run(true); });

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setForcePush(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // one timer for the app lifetime

  // ── Sync on state changes (debounced) ────────────────────────────────────
  const caughtByGen   = useDexStore((s) => s.caughtByGen);
  const pendingByGen  = useDexStore((s) => s.pendingByGen);
  const shinyByGen    = useDexStore((s) => s.shinyByGen);
  const placedByGen   = useDexStore((s) => s.placedByGen);
  const savedSessions = useIvStore((s) => s.savedSessions);
  const slotsByGen    = useBoxSlotStore((s) => s.slotsByGen);
  const designerSlots = useDesignerStore((s) => s.slots);
  const saveProfiles  = useSaveStore((s) => s.profiles);
  const saveSummaries = useSaveStore((s) => s.summaries);
  const roamers       = useRoamerStore((s) => s.entries);
  const notes         = useNotesStore((s) => s.entries);
  const shinyHunts    = useHuntStore((s) => s.entries);
  const workingOn     = useWorkingOnStore((s) => s.entries);
  const journal       = useJournalStore((s) => s.entries);

  useEffect(() => {
    const scheduler = schedulerRef.current!;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Stores also change when a sync applies remote data; that needs no push.
    if (!syncEnabled() || !hasUnsyncedChanges()) {
      scheduler.settle();
      return;
    }
    scheduler.changed();
  }, [caughtByGen, pendingByGen, shinyByGen, placedByGen, savedSessions, slotsByGen, designerSlots, saveProfiles, saveSummaries, roamers, notes, shinyHunts, workingOn, journal]);

  // A waiting push doesn't outlive the app shell (sign-out shows the login screen)
  useEffect(() => () => schedulerRef.current?.cancelPending(), []);
}
