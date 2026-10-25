import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncScheduler, DEBOUNCE_MS, MAX_POLLS_SKIPPED_FOR_TYPING, type SchedulerDeps } from "../sync-scheduler";
import type { SyncResult } from "../sync";

/** A syncOnce whose calls each wait until the test lets them finish */
function controllableSync() {
  const pending: ((r: SyncResult) => void)[] = [];
  const fn = vi.fn(() => new Promise<SyncResult>((resolve) => { pending.push(resolve); }));
  return {
    fn,
    /** Finishes the oldest running sync */
    finish: async (result: SyncResult = { ok: true, changed: false }) => {
      pending.shift()!(result);
      await vi.advanceTimersByTimeAsync(0);
    },
    get running() { return pending.length; },
  };
}

let sync: ReturnType<typeof controllableSync>;
let deps: SchedulerDeps & { typing: boolean; on: boolean };

beforeEach(() => {
  vi.useFakeTimers();
  sync = controllableSync();
  const state = { typing: false, on: true };
  deps = Object.assign(state, {
    syncOnce: sync.fn,
    enabled: () => state.on,
    isTyping: () => state.typing,
    setSyncing: vi.fn(),
    onResult: vi.fn(),
  });
});

afterEach(() => vi.useRealTimers());

describe("sync scheduler", () => {
  it("runs one sync at a time, and queues a single follow-up for any number of requests", async () => {
    const s = createSyncScheduler(deps);
    void s.run(false);
    void s.run(false);
    void s.run(false);
    expect(sync.fn).toHaveBeenCalledTimes(1);

    await sync.finish();
    expect(sync.fn).toHaveBeenCalledTimes(2); // the one queued follow-up
    await sync.finish();
    expect(sync.fn).toHaveBeenCalledTimes(2);
    expect(deps.onResult).toHaveBeenCalledTimes(2);
  });

  it("does nothing while sync is off", async () => {
    deps.on = false;
    const s = createSyncScheduler(deps);
    await s.run(true);
    s.poll();
    expect(sync.fn).not.toHaveBeenCalled();
  });

  it("reports a sync that throws as a failure and carries on", async () => {
    const s = createSyncScheduler({ ...deps, syncOnce: () => Promise.reject(new Error("boom")) });
    await s.run(false);
    expect(deps.onResult).toHaveBeenCalledWith(null);
  });

  it("pushes once, DEBOUNCE_MS after the last of several changes, with the spinner on until it is done", async () => {
    const s = createSyncScheduler(deps);
    s.changed();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 500);
    s.changed();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(sync.fn).not.toHaveBeenCalled();
    expect(s.pushPending).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(sync.fn).toHaveBeenCalledTimes(1);
    await sync.finish();
    expect(s.pushPending).toBe(false);
    expect(deps.setSyncing).toHaveBeenLastCalledWith(false);
  });

  it("skips polls while a push is waiting", async () => {
    const s = createSyncScheduler(deps);
    s.changed();
    s.poll();
    expect(sync.fn).not.toHaveBeenCalled();
  });

  it("skips at most two polls in a row while the user is typing", async () => {
    const s = createSyncScheduler(deps);
    deps.typing = true;
    for (let i = 0; i < MAX_POLLS_SKIPPED_FOR_TYPING; i++) s.poll();
    expect(sync.fn).not.toHaveBeenCalled();
    s.poll();
    expect(sync.fn).toHaveBeenCalledTimes(1);
    await sync.finish();

    // The count starts again after a poll that ran
    s.poll();
    expect(sync.fn).toHaveBeenCalledTimes(1);
  });

  it("drops a waiting push when the stores match the server again", async () => {
    const s = createSyncScheduler(deps);
    s.changed();
    s.settle();
    expect(s.pushPending).toBe(false);
    expect(deps.setSyncing).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(sync.fn).not.toHaveBeenCalled();
  });
});
