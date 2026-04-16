/**
 * Sync client for the Pokédex Tracker.
 *
 * Reads runtime config from window.__ENV__ (injected by nginx via /env.js).
 * If SYNC_TOKEN is absent or empty, all functions return early and sync is
 * silently disabled — the app works exactly as before.
 *
 * API contract:
 *   GET  /api/sync         → 200 { data, savedAt } | 204 (no data yet) | 401
 *   POST /api/sync  {data} → 200 { ok, savedAt }                        | 401
 */

import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import type { BackupData } from "./backup";

// Injected at runtime by nginx via /env.js
declare global {
  interface Window {
    __ENV__?: {
      SYNC_TOKEN?: string;
    };
  }
}

function getToken(): string {
  return window.__ENV__?.SYNC_TOKEN ?? "";
}

function isEnabled(): boolean {
  return Boolean(getToken());
}

function buildPayload(): BackupData {
  const { caughtByGen, pendingByGen } = useDexStore.getState();
  const { savedSessions } = useIvStore.getState();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tracker: { caughtByGen, pendingByGen },
    ivChecker: { savedSessions },
  };
}

export type SyncResult =
  | { ok: true;  savedAt?: string }
  | { ok: false; error: string };

/** Pull the latest snapshot from the server and overwrite local stores. */
export async function pullSync(): Promise<SyncResult> {
  if (!isEnabled()) return { ok: false, error: "Sync not configured" };

  let res: Response;
  try {
    res = await fetch("/api/sync", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }

  if (res.status === 204) return { ok: true }; // no remote data yet — perfectly fine
  if (res.status === 401) return { ok: false, error: "Invalid sync token" };
  if (!res.ok) return { ok: false, error: `Server error ${res.status}` };

  let body: { data: BackupData; savedAt: string };
  try {
    body = await res.json() as { data: BackupData; savedAt: string };
  } catch {
    return { ok: false, error: "Invalid response from sync server" };
  }

  const { data } = body;
  if (!data?.tracker || !data?.ivChecker) {
    return { ok: false, error: "Sync data is malformed" };
  }

  useDexStore.setState({
    caughtByGen: data.tracker.caughtByGen,
    pendingByGen: data.tracker.pendingByGen,
  });
  useIvStore.setState({ savedSessions: data.ivChecker.savedSessions });

  return { ok: true, savedAt: body.savedAt };
}

/** Push the current local state to the server (last-write-wins). */
export async function pushSync(): Promise<SyncResult> {
  if (!isEnabled()) return { ok: false, error: "Sync not configured" };

  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: buildPayload() }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }

  if (res.status === 401) return { ok: false, error: "Invalid sync token" };
  if (!res.ok) return { ok: false, error: `Server error ${res.status}` };

  const { savedAt } = await res.json() as { ok: boolean; savedAt: string };
  return { ok: true, savedAt };
}
