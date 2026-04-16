import { useEffect, useRef } from "react";
import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { pullSync, pushSync } from "../lib/sync";
import { useSyncStatus } from "./useSyncStatus";

const DEBOUNCE_MS  = 2_000;  // wait 2 s after the last change before pushing
const RETRY_MS     = 10_000; // retry a failed push after 10 s

/**
 * Mounts sync behaviour into the app:
 *  - Pulls from server once on mount (after Zustand localStorage rehydration)
 *  - Pushes to server on every caught/pending/session change, debounced 2 s
 *
 * Does nothing if SYNC_TOKEN is not configured (sync silently disabled).
 */
export function useSyncEngine() {
  const { setSyncing, setLastSynced, setError } = useSyncStatus();

  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const isPulling     = useRef(false); // true while pull is writing to stores, suppresses push

  // ── Pull once on mount ──────────────────────────────────────────────────────
  // useEffect fires after the first render, which is after Zustand rehydrates
  // from localStorage — so the pull correctly overwrites the hydrated state.
  useEffect(() => {
    isPulling.current = true;
    pullSync().then((result) => {
      if (result.ok) {
        if (result.savedAt) setLastSynced(new Date(result.savedAt));
      } else if (result.error !== "Sync not configured") {
        setError(result.error);
      }
    }).finally(() => {
      // Allow a tick for the store setState calls to settle before re-enabling push
      setTimeout(() => { isPulling.current = false; }, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional — one pull on mount only

  // ── Push on state changes (debounced) ──────────────────────────────────────
  const caughtByGen   = useDexStore((s) => s.caughtByGen);
  const pendingByGen  = useDexStore((s) => s.pendingByGen);
  const savedSessions = useIvStore((s) => s.savedSessions);

  useEffect(() => {
    // Skip the very first render — data came from localStorage, not a user action.
    // Also skip while a pull is in progress — we don't want to echo pulled data back.
    if (isFirstRender.current || isPulling.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear any pending debounce / retry
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current)    clearTimeout(retryRef.current);

    setSyncing(true);

    debounceRef.current = setTimeout(async () => {
      const result = await pushSync();

      if (result.ok) {
        setLastSynced(new Date());
      } else if (result.error !== "Sync not configured") {
        setError(result.error);
        // Schedule one automatic retry
        retryRef.current = setTimeout(async () => {
          const retry = await pushSync();
          if (retry.ok) setLastSynced(new Date());
          else setError(retry.error);
        }, RETRY_MS);
      } else {
        // Sync not configured — clear the syncing spinner silently
        setSyncing(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [caughtByGen, pendingByGen, savedSessions]); // eslint-disable-line react-hooks/exhaustive-deps
}
