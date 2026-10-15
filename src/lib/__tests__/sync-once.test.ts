import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPayload, hasToken, hasUnsyncedChanges, setToken, syncOnce } from "../sync";
import type { BackupData } from "../backup";
import { emptyTimestamps, useDexStore } from "../../store/useDexStore";
import { useIvStore } from "../../store/useIvStore";
import { useBoxSlotStore } from "../../store/useBoxSlotStore";
import { useSaveStore } from "../../store/useSaveStore";

// syncOnce() end to end against a stand-in for sync-server/server.js: the same
// endpoints, status codes and version rule, answered from memory through fetch.

const TOKEN = "test-token";

class FakeServer {
  blob: { data: BackupData; savedAt: string; version: number } | null = null;
  /** Every request that reached the server, e.g. "pull", "push 200", "push 409" */
  log: string[] = [];
  /** Answers like a server from before the version check: no version, no 409 */
  legacy = false;
  rejectToken = false;
  /** Runs when a push arrives, before the server looks at it */
  onPush: (() => void) | null = null;
  lastInit: RequestInit | undefined;

  /** Another device's push, straight into the server's copy. */
  put(data: BackupData) {
    this.blob = { data, savedAt: new Date().toISOString(), version: (this.blob?.version ?? 0) + 1 };
  }

  caught(gen = 4): number[] {
    return [...(this.blob?.data.tracker.caughtByGen[gen] ?? [])].sort((a, b) => a - b);
  }

  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    this.lastInit = init;
    const path = String(url);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

    const auth = (init?.headers as Record<string, string>)?.Authorization;
    if (this.rejectToken || auth !== `Bearer ${TOKEN}`) {
      this.log.push(`${path.slice(5)} 401`);
      return json(401, { error: "Unauthorized" });
    }

    if (path === "/api/pull") {
      this.log.push("pull");
      const version = this.legacy ? undefined : this.blob?.version ?? 0;
      return json(200, { ok: true, data: this.blob?.data ?? null, savedAt: this.blob?.savedAt ?? null, version });
    }

    if (path === "/api/push") {
      const hook = this.onPush;
      this.onPush = null;
      hook?.();
      const { data, baseVersion } = JSON.parse(String(init?.body));
      const version = this.blob?.version ?? 0;
      if (!this.legacy && Number.isInteger(baseVersion) && baseVersion !== version) {
        this.log.push("push 409");
        return json(409, { error: "stale", version });
      }
      this.blob = { data, savedAt: new Date().toISOString(), version: version + 1 };
      this.log.push("push 200");
      return json(200, this.legacy ? { ok: true, savedAt: this.blob.savedAt } : { ok: true, savedAt: this.blob.savedAt, version: version + 1 });
    }

    return json(404, { error: "Not found" });
  };
}

/** A payload as another device would have pushed it: these Pokémon caught in Gen 4, at a fixed time. */
function remotePayload(caught: number[], at = 1000): BackupData {
  const payload: BackupData = JSON.parse(JSON.stringify(buildPayload()));
  payload.tracker.caughtByGen = { 4: caught };
  payload.tracker.updatedAt = { ...emptyTimestamps(), caught: { 4: Object.fromEntries(caught.map((id) => [id, at])) } };
  return payload;
}

const localCaught = () => [...(useDexStore.getState().caughtByGen[4] ?? [])].sort((a, b) => a - b);

let server: FakeServer;

beforeEach(() => {
  localStorage.clear();
  useDexStore.setState({ caughtByGen: {}, pendingByGen: {}, shinyByGen: {}, placedByGen: {}, updatedAt: emptyTimestamps() });
  useSaveStore.getState().replaceAll([], {});
  useIvStore.setState({ savedSessions: [] });
  useBoxSlotStore.getState().setSlotsByGen({});
  localStorage.clear();
  setToken(TOKEN);

  server = new FakeServer();
  vi.stubGlobal("fetch", server.fetch);
  // sync.ts announces a 401 on window; the test setup's window has no events
  (window as unknown as { dispatchEvent: unknown }).dispatchEvent = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe("syncOnce", () => {
  it("pushes local data to an empty server", async () => {
    useDexStore.getState().setCaught(1, true, 4);
    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.log).toEqual(["pull", "push 200"]);
    expect(server.caught()).toEqual([1]);
    expect(hasUnsyncedChanges()).toBe(false);
  });

  it("merges the server's copy into local state and pushes the union", async () => {
    server.put(remotePayload([1, 2]));
    useDexStore.getState().setCaught(3, true, 4);

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(localCaught()).toEqual([1, 2, 3]);
    expect(server.caught()).toEqual([1, 2, 3]);
    expect(server.log).toEqual(["pull", "push 200"]);
  });

  it("only pulls when the server already has everything", async () => {
    server.put(remotePayload([1, 2]));
    await syncOnce();
    server.log = [];

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.log).toEqual(["pull"]);
    expect(localCaught()).toEqual([1, 2]);
  });

  it("keeps an un-mark that is newer than the server's mark", async () => {
    server.put(remotePayload([5], 1000));
    await syncOnce();
    useDexStore.getState().setCaught(5, false, 4);

    await syncOnce();
    expect(server.caught()).toEqual([]);
  });

  it("notices an edit made while the push was in flight, and syncs it next time", async () => {
    useDexStore.getState().setCaught(1, true, 4);
    server.onPush = () => useDexStore.getState().setCaught(7, true, 4);

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.caught()).toEqual([1]);
    // The edit is not on the server, and the engine can tell
    expect(hasUnsyncedChanges()).toBe(true);

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.caught()).toEqual([1, 7]);
    expect(hasUnsyncedChanges()).toBe(false);
  });

  it("signs out on a 401 and reports failure", async () => {
    server.rejectToken = true;
    useDexStore.getState().setCaught(1, true, 4);

    expect(await syncOnce()).toEqual({ ok: false });
    expect(hasToken()).toBe(false);
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
    // Local data is untouched
    expect(localCaught()).toEqual([1]);
    expect(server.log).toEqual(["pull 401"]);
  });

  it("pulls and merges again when another device pushed in between (409)", async () => {
    server.put(remotePayload([1]));
    useDexStore.getState().setCaught(2, true, 4);
    // The other device's push lands after our pull, just before our push
    server.onPush = () => server.put(remotePayload([1, 9]));

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.log).toEqual(["pull", "push 409", "pull", "push 200"]);
    // Neither device's mark was lost
    expect(server.caught()).toEqual([1, 2, 9]);
    expect(localCaught()).toEqual([1, 2, 9]);
    expect(hasUnsyncedChanges()).toBe(false);
  });

  it("gives up after a few conflicts in a row, without losing local data", async () => {
    useDexStore.getState().setCaught(2, true, 4);
    let other = 100;
    const interfere = () => { server.put(remotePayload([other++])); server.onPush = interfere; };
    server.onPush = interfere;

    expect(await syncOnce()).toEqual({ ok: false });
    expect(server.log.filter((entry) => entry === "push 409")).toHaveLength(3);
    expect(server.log).not.toContain("push 200");
    expect(localCaught()).toContain(2);
    expect(hasUnsyncedChanges()).toBe(true);

    // Once the other device stops, the next sync goes through
    server.onPush = null;
    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.caught()).toContain(2);
  });

  it("still works with a server from before the version check", async () => {
    server.legacy = true;
    useDexStore.getState().setCaught(1, true, 4);

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(JSON.parse(String(server.lastInit?.body))).not.toHaveProperty("baseVersion");
    expect(server.caught()).toEqual([1]);
  });

  it("gives every request a timeout, and treats a timed-out one as a failed sync", async () => {
    await syncOnce();
    expect(server.lastInit?.signal).toBeInstanceOf(AbortSignal);

    vi.stubGlobal("fetch", () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")));
    expect(await syncOnce()).toEqual({ ok: false });
    // Not a sign-out
    expect(hasToken()).toBe(true);
  });
});

describe("a request that never answers", () => {
  it("is abandoned at the timeout, and the next sync goes through", async () => {
    useDexStore.getState().setCaught(1, true, 4);
    // Stand in for the 30 s timer with a short one, and for the network with a
    // request that only ever ends when its signal aborts
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("The operation timed out.", "TimeoutError")), 20);
      return controller.signal;
    });
    let hung = 0;
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      hung++;
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    }));

    // Without the timeout this await would never return, and the engine's
    // "a sync is already running" flag would hold every later sync behind it
    expect(await syncOnce()).toEqual({ ok: false });
    expect(hung).toBe(1);
    expect(timeout).toHaveBeenCalledWith(30000);
    expect(hasToken()).toBe(true);

    timeout.mockRestore();
    vi.stubGlobal("fetch", server.fetch);
    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.caught()).toEqual([1]);
  });

  it("also covers a push that hangs after the pull answered", async () => {
    useDexStore.getState().setCaught(1, true, 4);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("The operation timed out.", "TimeoutError")), 20);
      return controller.signal;
    });
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
      String(url).endsWith("/api/pull")
        ? server.fetch(url, init)
        : new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))));

    expect(await syncOnce()).toEqual({ ok: false });
    expect(server.log).toEqual(["pull"]);
    expect(hasUnsyncedChanges()).toBe(true);
    timeout.mockRestore();
  });
});

describe("two devices", () => {
  // One set of stores stands in for both devices: each device's local state is
  // kept aside and put back before that device syncs.
  type Device = ReturnType<typeof useDexStore.getState>;
  const emptyDevice = () => ({ caughtByGen: {}, pendingByGen: {}, shinyByGen: {}, placedByGen: {}, updatedAt: emptyTimestamps() });
  const keep = (): Pick<Device, "caughtByGen" | "pendingByGen" | "shinyByGen" | "placedByGen" | "updatedAt"> => {
    const { caughtByGen, pendingByGen, shinyByGen, placedByGen, updatedAt } = useDexStore.getState();
    return JSON.parse(JSON.stringify({ caughtByGen, pendingByGen, shinyByGen, placedByGen, updatedAt }));
  };

  it("racing to push both end up with each other's marks", async () => {
    // Both start from the same server copy
    server.put(remotePayload([1]));
    await syncOnce();
    const shared = keep();

    // Device B marks #9 and is ready to sync
    useDexStore.setState(shared);
    useDexStore.getState().setCaught(9, true, 4);
    const deviceB = keep();

    // Device A marks #2. Its pull has gone out when B's whole sync runs, so A's
    // push is built on a copy the server no longer has.
    useDexStore.setState(shared);
    useDexStore.getState().setCaught(2, true, 4);
    let deviceBAfter = emptyDevice() as ReturnType<typeof keep>;
    server.onPush = () => {
      const deviceA = keep();
      useDexStore.setState(deviceB);
      // B's sync, in full, through the same server (its requests are synchronous here)
      const pulled = server.blob!;
      const merged = JSON.parse(JSON.stringify(buildPayload())) as BackupData;
      merged.tracker.caughtByGen[4] = [...new Set([...(pulled.data.tracker.caughtByGen[4] ?? []), ...(merged.tracker.caughtByGen[4] ?? [])])];
      merged.tracker.updatedAt = { ...merged.tracker.updatedAt, caught: { 4: { ...pulled.data.tracker.updatedAt?.caught?.[4], ...merged.tracker.updatedAt?.caught?.[4] } } };
      server.put(merged);
      deviceBAfter = keep();
      useDexStore.setState(deviceA);
    };

    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(server.log).toContain("push 409");
    // A has B's mark, and the server has both
    expect(localCaught()).toEqual([1, 2, 9]);
    expect(server.caught()).toEqual([1, 2, 9]);

    // B's next poll, as a real syncOnce from B's own state: it gets A's mark
    useDexStore.setState(deviceBAfter);
    expect(localCaught()).toEqual([1, 9]);
    expect(await syncOnce()).toMatchObject({ ok: true });
    expect(localCaught()).toEqual([1, 2, 9]);
    expect(server.caught()).toEqual([1, 2, 9]);
  });
});
