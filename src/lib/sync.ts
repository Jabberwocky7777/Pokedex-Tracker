/**
 * Sync client for the Pokédex Tracker.
 *
 * Reads runtime config from window.__ENV__ (written by docker-entrypoint.sh
 * and served as /env.js). If SYNC_TOKEN is absent or empty, all functions
 * return early and sync is silently disabled.
 *
 * SYNC_URL behaviour:
 *   - Set (e.g. "http://192.168.1.x:7778"): calls the sync server directly.
 *     Use this when the tracker and sync server are separate TrueNAS apps.
 *   - Empty / unset: uses relative "/api/sync" — nginx proxies it to the sync
 *     container. Use this with docker-compose where both share a network.
 *
 * API contract:
 *   GET  /api/sync         → 200 { data, savedAt } | 204 (no data yet) | 401
 *   POST /api/sync  {data} → 200 { ok, savedAt }                        | 401
 */

import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import type { BackupData } from "./backup";

// Written at container startup by docker-entrypoint.sh, served as /env.js
declare global {
  interface Window {
    __ENV__?: {
      SYNC_TOKEN?: string;
      /** Base URL of the sync server. Empty = use nginx proxy (relative path). */
      SYNC_URL?: string;
    };
  }
}

function getToken(): string {
  return window.__ENV__?.SYNC_TOKEN ?? "";
}

function isEnabled(): boolean {
  return Boolean(getToken());
}

/** Returns the API endpoint URL — absolute if SYNC_URL is set, relative otherwise. */
function endpoint(): string {
  const base = (window.__ENV__?.SYNC_URL ?? "").replace(/\/$/, "");
  return `${base}/api/sync`;
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
    res = await fetch(endpoint(), {
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
    res = await fetch(endpoint(), {
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
