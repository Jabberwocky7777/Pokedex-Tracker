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
import { useSyncStatus } from "./useSyncStatus";
import { useWorkingOnStore } from "../store/useWorkingOnStore";

const DEBOUNCE_MS  = 2_000;
const POLL_INTERVAL_MS = 30_000;
// A poll is put off while the user is in a text field, but not for ever: a tab
// left with the cursor in the search box would otherwise never hear from the server
const MAX_POLLS_SKIPPED_FOR_TYPING = 2;

/** Sync is off in local (offline) mode and whenever there is no token. */
function syncEnabled(): boolean {
  return hasToken() && !isLocalMode();
}

export function useSyncEngine() {
  const { setSyncing, setLastSynced, setError, setForcePush, noteChange } = useSyncStatus();

  const isSyncing      = useRef(false);
  const rerunRequested = useRef(false);
  const hasPendingPush = useRef(false);
  const isFirstRender  = useRef(true);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedPolls   = useRef(0);

  // One sync = pull → merge → push (see syncOnce). Only one runs at a time;
  // a request that arrives mid-sync queues a single follow-up run.
  const runSync = useRef(async (showSpinner: boolean) => {
    if (!syncEnabled()) return;
    if (isSyncing.current) { rerunRequested.current = true; return; }
    isSyncing.current = true;
    if (showSpinner) setSyncing(true);
    try {
      const result = await syncOnce();
      if (result.ok) {
        if (result.savedAt) setLastSynced(new Date(result.savedAt));
        setError(null);
        if (result.changed) noteChange();
      } else {
        setError("Sync failed — retrying…");
      }
    } catch {
      setError("Sync failed — retrying…");
    } finally {
      isSyncing.current = false;
      if (showSpinner) setSyncing(false);
      if (rerunRequested.current) {
        rerunRequested.current = false;
        void runSync.current(showSpinner);
      }
    }
  });

  // ── Sync on mount + every 30s (pauses when tab is hidden) ───────────────
  useEffect(() => {
    if (!syncEnabled()) return;

    function poll() {
      // Don't apply remote changes under the user's fingers: skip this tick if
      // they are typing, or if a debounced push is about to sync anyway.
      const tag = document.activeElement?.tagName?.toLowerCase();
      const userIsTyping = tag === "input" || tag === "textarea" || tag === "select";
      if (hasPendingPush.current) return;
      if (userIsTyping && skippedPolls.current < MAX_POLLS_SKIPPED_FOR_TYPING) {
        skippedPolls.current++;
        return;
      }
      skippedPolls.current = 0;
      void runSync.current(false);
    }

    let timer: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (timer !== null) return;
      timer = setInterval(poll, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (timer !== null) { clearInterval(timer); timer = null; }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        // Coming back to the tab: catch up right away, then resume the 30s timer.
        void runSync.current(false);
        startPolling();
      }
    }

    void runSync.current(false);
    if (!document.hidden) startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    setForcePush(() => { void runSync.current(true); });

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

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Stores also change when a sync applies remote data; that needs no push.
    if (!syncEnabled() || !hasUnsyncedChanges()) {
      if (hasPendingPush.current) { hasPendingPush.current = false; setSyncing(false); }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    hasPendingPush.current = true;
    setSyncing(true);

    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      try {
        await runSync.current(true);
      } finally {
        hasPendingPush.current = false;
        setSyncing(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [caughtByGen, pendingByGen, shinyByGen, placedByGen, savedSessions, slotsByGen, designerSlots, saveProfiles, saveSummaries, roamers, notes, shinyHunts, workingOn]); // eslint-disable-line react-hooks/exhaustive-deps
}
