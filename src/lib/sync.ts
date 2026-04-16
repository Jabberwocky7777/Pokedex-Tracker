/**
 * Sync client for the Pokédex Tracker.
 *
 * The SYNC_TOKEN is entered by the user in the login screen and stored in
 * localStorage. If absent, all functions return early and sync is silently
 * disabled.
 *
 * API contract:
 *   GET  /health              → 200 { ok, syncEnabled }
 *   GET  /api/sync            → 200 { data, savedAt } | 204 (no data yet) | 401
 *   POST /api/sync  { data }  → 200 { ok, savedAt }                        | 401
 */

import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import type { BackupData } from "./backup";

const STORAGE_KEY = "pokedex_sync_token";
const ENDPOINT    = "/api/sync";

// ── Token management (called by LoginScreen / logout) ─────────────────────────

export function getToken(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasToken(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

function isEnabled(): boolean {
  return Boolean(getToken());
}

// ── Payload builder ───────────────────────────────────────────────────────────

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

// ── Sync result type ──────────────────────────────────────────────────────────

export type SyncResult =
  | { ok: true;  savedAt?: string }
  | { ok: false; error: string };

// ── Pull ──────────────────────────────────────────────────────────────────────

/** Pull the latest snapshot from the server and overwrite local stores.
 *  If `skipIfNotNewerThan` is provided, skips applying state when the remote
 *  savedAt is not newer — used by the polling interval to avoid overwriting
 *  local data with an unchanged server snapshot.
 */
export async function pullSync(opts?: { skipIfNotNewerThan?: Date }): Promise<SyncResult> {
  if (!isEnabled()) return { ok: false, error: "Sync not configured" };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
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

  // If the caller supplied a reference time, skip applying when remote isn't newer.
  if (opts?.skipIfNotNewerThan && new Date(body.savedAt) <= opts.skipIfNotNewerThan) {
    return { ok: true, savedAt: body.savedAt };
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

// ── Push ──────────────────────────────────────────────────────────────────────

/** Push the current local state to the server (last-write-wins). */
export async function pushSync(): Promise<SyncResult> {
  if (!isEnabled()) return { ok: false, error: "Sync not configured" };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
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
