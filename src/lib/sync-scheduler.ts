/**
 * When syncs run: the scheduling half of useSyncEngine, kept free of React so
 * it can be tested with fake timers. Pure apart from the callbacks it is given.
 *
 * - One sync at a time. A request that arrives while one is running queues a
 *   single follow-up run (however many arrive), so nothing is lost and nothing
 *   piles up.
 * - A poll is skipped while a debounced push is waiting (that push syncs
 *   anyway), and while the user is typing — but at most MAX_POLLS_SKIPPED_FOR_TYPING
 *   times in a row, so a tab left with the cursor in a text box still hears
 *   from the server.
 * - A local change is pushed DEBOUNCE_MS after the last one.
 */
import type { SyncResult } from "./sync";

export const DEBOUNCE_MS = 2_000;
export const POLL_INTERVAL_MS = 30_000;
export const MAX_POLLS_SKIPPED_FOR_TYPING = 2;

export interface SchedulerDeps {
  syncOnce: () => Promise<SyncResult>;
  /** Signed in with a token and not in offline mode */
  enabled: () => boolean;
  /** Focus is in a text field */
  isTyping: () => boolean;
  /** Spinner on / off (only for syncs asked to show one) */
  setSyncing: (on: boolean) => void;
  /** After each sync: the result, or null when it threw */
  onResult: (result: SyncResult | null) => void;
}

export interface SyncScheduler {
  /** Runs a sync now (or queues one after the running one) */
  run: (showSpinner: boolean) => Promise<void>;
  /** The 30 s timer's tick */
  poll: () => void;
  /** A local change: push after the debounce */
  changed: () => void;
  /** The stores match the server again (a change undone, or one from the server): no push needed */
  settle: () => void;
  /** Stops a waiting debounced push (unmount) */
  cancelPending: () => void;
  /** A debounced push is waiting or running */
  readonly pushPending: boolean;
}

export function createSyncScheduler(deps: SchedulerDeps): SyncScheduler {
  let syncing = false;
  let rerunRequested = false;
  let pushPending = false;
  let skippedPolls = 0;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  async function run(showSpinner: boolean): Promise<void> {
    if (!deps.enabled()) return;
    if (syncing) { rerunRequested = true; return; }
    syncing = true;
    if (showSpinner) deps.setSyncing(true);
    try {
      deps.onResult(await deps.syncOnce());
    } catch {
      deps.onResult(null);
    } finally {
      syncing = false;
      if (showSpinner) deps.setSyncing(false);
      if (rerunRequested) {
        rerunRequested = false;
        void run(showSpinner);
      }
    }
  }

  function poll(): void {
    if (pushPending) return;
    if (deps.isTyping() && skippedPolls < MAX_POLLS_SKIPPED_FOR_TYPING) {
      skippedPolls++;
      return;
    }
    skippedPolls = 0;
    void run(false);
  }

  function changed(): void {
    if (debounce) clearTimeout(debounce);
    pushPending = true;
    deps.setSyncing(true);
    debounce = setTimeout(async () => {
      debounce = null;
      try {
        await run(true);
      } finally {
        pushPending = false;
        deps.setSyncing(false);
      }
    }, DEBOUNCE_MS);
  }

  function cancelPending(): void {
    if (debounce) clearTimeout(debounce);
    debounce = null;
  }

  function settle(): void {
    cancelPending();
    if (pushPending) {
      pushPending = false;
      deps.setSyncing(false);
    }
  }

  return {
    run,
    poll,
    changed,
    settle,
    cancelPending,
    get pushPending() { return pushPending; },
  };
}
