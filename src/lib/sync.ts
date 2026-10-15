/**
 * Sync utilities for the Pokédex Tracker.
 *
 * Token management: stored in both localStorage (for immediate sync reads) and
 * @capacitor/preferences (iOS UserDefaults — survives SideStore/AltStore updates).
 * On boot, initStorage() recovers values from Preferences into localStorage if
 * the latter was cleared by iOS.
 * Transport: HTTP polling — GET /api/pull every 30s, POST /api/push on changes.
 * Requests time out after 30 s, and a push names the server version it was
 * merged against so the server can refuse one that would replace a newer copy.
 *
 * The server is a dumb blob store. All merging happens here: every sync pulls,
 * merges the server copy into local state (see sync-merge.ts), and only then
 * pushes — so two devices can't erase each other's changes.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { useDexStore, emptyTimestamps } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { useDesignerStore } from "../store/useDesignerStore";
import { useSaveStore } from "../store/useSaveStore";
import { BACKUP_VERSION, ENTRY_SECTIONS, type BackupData, type EntrySectionName, type SectionName } from "./backup";
import { mergePayload, payloadsEqual } from "./sync-merge";

const STORAGE_KEY = "pokedex_sync_token";
const SERVER_URL_KEY = "pokedex_server_url";
// "1" when the user chose to use the app without a sync server
const LOCAL_MODE_KEY = "pokedex_local_mode";
// When each last-write-wins section was last changed (JSON: { designer: ms, … })
const SECTIONS_KEY = "pokedex_sync_sections";

// ── Dual-write helpers ─────────────────────────────────────────────────────────

function prefSet(key: string, value: string) {
  if (Capacitor.isNativePlatform()) {
    Preferences.set({ key, value }).catch(() => {});
  }
}

function prefRemove(key: string) {
  if (Capacitor.isNativePlatform()) {
    Preferences.remove({ key }).catch(() => {});
  }
}

/**
 * Called once on native app boot. If localStorage was wiped by iOS after a
 * SideStore/AltStore update, this restores the token, server URL and local-mode
 * flag from the more-durable Preferences (iOS UserDefaults) store.
 */
export async function initStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  for (const key of [STORAGE_KEY, SERVER_URL_KEY, LOCAL_MODE_KEY]) {
    if (localStorage.getItem(key)) continue;
    const { value } = await Preferences.get({ key });
    if (value) localStorage.setItem(key, value);
  }
}

// ── Server URL (configured during onboarding on native app) ──────────────────

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? "";
}

export function setServerUrl(url: string): void {
  const clean = url.replace(/\/$/, "");
  localStorage.setItem(SERVER_URL_KEY, clean);
  prefSet(SERVER_URL_KEY, clean);
}

export function hasServerUrl(): boolean {
  return Boolean(localStorage.getItem(SERVER_URL_KEY));
}

// ── Token management (called by LoginScreen / logout) ─────────────────────────

export function getToken(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
  prefSet(STORAGE_KEY, token);
  if (token) setLocalMode(false);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  prefRemove(STORAGE_KEY);
}

export function hasToken(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

// ── Local (offline) mode ─────────────────────────────────────────────────────
// An explicit flag rather than an empty token, so "Use offline" survives reloads.

export function isLocalMode(): boolean {
  return localStorage.getItem(LOCAL_MODE_KEY) === "1";
}

export function setLocalMode(on: boolean): void {
  if (on) {
    localStorage.setItem(LOCAL_MODE_KEY, "1");
    prefSet(LOCAL_MODE_KEY, "1");
  } else {
    localStorage.removeItem(LOCAL_MODE_KEY);
    prefRemove(LOCAL_MODE_KEY);
  }
}

/** Signed in to a sync server, or deliberately using the app offline. */
export function isSignedIn(): boolean {
  return hasToken() || isLocalMode();
}

// ── Section timestamps ───────────────────────────────────────────────────────
// Designer slots, IV sessions, box slots and save summaries are last-write-wins per section.
// Each local edit stamps its section; changes applied from the server do not.
// The subscriptions run in local mode too, so data edited offline carries a
// timestamp into the first sign-in merge.

let applyingRemote = false;

export function getSectionUpdatedAt(): Partial<Record<SectionName, number>> {
  try {
    return JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function setSectionUpdatedAt(sections: Partial<Record<SectionName, number>>): void {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
}

function stampSection(name: SectionName): void {
  if (applyingRemote) return;
  setSectionUpdatedAt({ ...getSectionUpdatedAt(), [name]: Date.now() });
}

useDesignerStore.subscribe((s, prev) => { if (s.slots !== prev.slots) stampSection("designer"); });
useIvStore.subscribe((s, prev) => { if (s.savedSessions !== prev.savedSessions) stampSection("ivChecker"); });
useBoxSlotStore.subscribe((s, prev) => { if (s.slotsByGen !== prev.slotsByGen) stampSection("boxSlots"); });
useSaveStore.subscribe((s, prev) => {
  // Loading the summaries from device storage at boot is not an edit
  if (s.hydrated !== prev.hydrated) return;
  if (s.profiles !== prev.profiles || s.summaries !== prev.summaries || s.removedProfiles !== prev.removedProfiles) stampSection("saveSummaries");
});

// ── HTTP sync ────────────────────────────────────────────────────────────────

function authHeaders() {
  return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

function handleUnauthorized() {
  clearToken();
  window.dispatchEvent(new CustomEvent("pdx:unauthorized"));
}

// A request that hasn't finished by then is given up on. Without this, a
// request left hanging by a phone changing networks would hold up every later sync.
// Generous, because a slow server path (a tunnel, a busy NAS) can take 20 s to answer.
const REQUEST_TIMEOUT_MS = 30_000;

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  // Older WebViews (iOS 15) don't have AbortSignal.timeout
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * One authenticated API call. `body` is the parsed response, or null for
 * anything that isn't a 2xx with JSON: offline, timed out, a server error.
 * A 401 also signs the user out. `conflict` is set for a 409.
 */
async function api<T>(path: string, init?: RequestInit): Promise<{ body: T | null; conflict: boolean }> {
  try {
    const res = await fetch(`${getServerUrl()}${path}`, {
      ...init, headers: authHeaders(), signal: timeoutSignal(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 401) handleUnauthorized();
    if (!res.ok) return { body: null, conflict: res.status === 409 };
    return { body: await res.json() as T, conflict: false };
  } catch {
    return { body: null, conflict: false };
  }
}

export type PullResult =
  | { ok: true; data: BackupData | null; savedAt: string | null; /** Absent from servers older than the version check */ version?: number }
  | { ok: false };

export type PushResult =
  | { ok: true; savedAt?: string; version?: number }
  /** conflict: another device pushed since the pull this push was merged against */
  | { ok: false; conflict: boolean };

export async function pullData(): Promise<PullResult> {
  const { body } = await api<{ data?: BackupData | null; savedAt?: string | null; version?: number }>("/api/pull");
  if (!body) return { ok: false };
  return { ok: true, data: body.data ?? null, savedAt: body.savedAt ?? null, version: body.version };
}

/** `baseVersion` is the version the pull returned; the server refuses the push (409) if it has moved on since. */
export async function pushData(payload: BackupData, baseVersion?: number): Promise<PushResult> {
  const { body, conflict } = await api<{ savedAt?: string; version?: number }>("/api/push", {
    method: "POST",
    body: JSON.stringify({ data: payload, baseVersion }),
  });
  if (!body) return { ok: false, conflict };
  return { ok: true, savedAt: body.savedAt, version: body.version };
}

// ── Server snapshots ─────────────────────────────────────────────────────────
// The server keeps the copy each push replaced (hourly for a day, daily for 30
// days). Restoring one is done on the client, through restoreBackupData().

export interface ServerSnapshot {
  /** The UTC hour in which this copy was replaced by a newer one, e.g. "2026-10-11T14". */
  id: string;
  /** When this copy was pushed. */
  savedAt: string | null;
}

export async function listSnapshots(): Promise<ServerSnapshot[] | null> {
  const { body } = await api<{ snapshots?: ServerSnapshot[] }>("/api/snapshots");
  return Array.isArray(body?.snapshots) ? body.snapshots : null;
}

/** The contents of one snapshot — unvalidated; hand it to restoreBackupData(). */
export async function fetchSnapshot(id: string): Promise<unknown | null> {
  const { body } = await api<{ data?: unknown }>(`/api/snapshots/${encodeURIComponent(id)}`);
  return body?.data ?? null;
}

// ── Payload builder (shared by push and backup export) ───────────────────────
// Every synced field of every persisted store must appear here — there is a
// test (sync.test.ts) that fails if a store's `partialize` gains a field that
// this function doesn't include.

/** The entry-merged sections (roamers, …), each straight from its store. */
function entrySections(): Pick<BackupData, EntrySectionName> {
  const sections: Record<string, unknown> = {};
  for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) sections[name] = ENTRY_SECTIONS[name].getState().entries;
  return sections as Pick<BackupData, EntrySectionName>;
}

export function buildPayload(): BackupData {
  const { caughtByGen, pendingByGen, shinyByGen, placedByGen, updatedAt } = useDexStore.getState();
  const { savedSessions } = useIvStore.getState();
  const { slotsByGen } = useBoxSlotStore.getState();
  const { slots: designerSlots } = useDesignerStore.getState();
  const { profiles, summaries, removedProfiles } = useSaveStore.getState();
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tracker: { caughtByGen, pendingByGen, shinyByGen, placedByGen, updatedAt },
    ivChecker: { savedSessions },
    boxSlots: slotsByGen,
    designer: designerSlots,
    saveSummaries: { profiles, summaries, removed: removedProfiles },
    sectionUpdatedAt: getSectionUpdatedAt(),
    ...entrySections(),
  };
}

// ── Applying a payload to the stores ─────────────────────────────────────────

/** Writes a (merged) payload into the stores without stamping anything as a local edit. */
export function applySnapshot(data: BackupData): void {
  applyingRemote = true;
  try {
    if (data?.tracker) {
      useDexStore.setState({
        caughtByGen: data.tracker.caughtByGen ?? {},
        pendingByGen: data.tracker.pendingByGen ?? {},
        shinyByGen: data.tracker.shinyByGen ?? {},
        placedByGen: data.tracker.placedByGen ?? {},
        updatedAt: { ...emptyTimestamps(), ...data.tracker.updatedAt },
      });
    }
    if (data?.ivChecker) {
      useIvStore.setState({ savedSessions: data.ivChecker.savedSessions });
    }
    if (data?.boxSlots) {
      useBoxSlotStore.getState().setSlotsByGen(data.boxSlots);
    }
    if (Array.isArray(data?.designer)) {
      useDesignerStore.getState().setSlots(data.designer as ReturnType<typeof useDesignerStore.getState>["slots"]);
    }
    if (data?.saveSummaries && Array.isArray(data.saveSummaries.profiles)) {
      useSaveStore.getState().replaceAll(
        data.saveSummaries.profiles, data.saveSummaries.summaries ?? {}, data.saveSummaries.removed ?? {},
      );
    }
    if (data?.sectionUpdatedAt) {
      setSectionUpdatedAt({ ...getSectionUpdatedAt(), ...data.sectionUpdatedAt });
    }
    for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) {
      if (data?.[name]) ENTRY_SECTIONS[name].getState().replaceAll(data[name] as never);
    }
  } finally {
    applyingRemote = false;
  }
}

// ── One full sync: pull → merge → push ───────────────────────────────────────

let lastSyncedPayload: BackupData | null = null;
// What a push that is still on its way will leave on the server. Store changes
// made by applying the merge happen before the push returns; without this they
// would look like new local edits and start a second sync.
let pushingPayload: BackupData | null = null;

// How many times one sync pulls again after the server refuses a stale push
const MAX_SYNC_ATTEMPTS = 3;

/** True when local state differs from what the last successful sync left on the server. */
export function hasUnsyncedChanges(): boolean {
  return !payloadsEqual(buildPayload(), pushingPayload ?? lastSyncedPayload);
}

/**
 * `changed` is true when the sync brought changes in from the server or sent
 * this device's changes up — the only syncs worth telling the user about.
 */
export type SyncResult = { ok: true; changed: boolean; savedAt?: string | null } | { ok: false };

/**
 * Pulls the server copy, merges it into local state, and pushes the result
 * if the server doesn't already have it. Never pushes local state blindly.
 * Also used for the first sign-in, where it merges local-mode data with
 * whatever the server already holds.
 */
export async function syncOnce(): Promise<SyncResult> {
  // Save summaries load from device storage asynchronously; merging before they
  // are in would treat "not loaded yet" as "deleted".
  await useSaveStore.getState().hydrate();

  // If another device pushes between our pull and our push, the server refuses
  // the push (409) rather than letting it replace theirs; pull again and re-merge.
  for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt++) {
    const pulled = await pullData();
    if (!pulled.ok) return { ok: false };

    // Everything between the pull and the push below is synchronous, so a local
    // edit can't slip in between reading state and applying the merge.
    const local = buildPayload();
    const merged = mergePayload(local, pulled.data);
    const broughtIn = !payloadsEqual(merged, local);
    if (broughtIn) applySnapshot(merged);

    if (pulled.data && payloadsEqual(merged, pulled.data)) {
      lastSyncedPayload = merged;
      return { ok: true, changed: broughtIn, savedAt: pulled.savedAt };
    }

    pushingPayload = merged;
    let pushed: Awaited<ReturnType<typeof pushData>>;
    try {
      pushed = await pushData(merged, pulled.version);
    } finally {
      pushingPayload = null;
    }
    if (pushed.ok) {
      lastSyncedPayload = merged;
      return { ok: true, changed: true, savedAt: pushed.savedAt };
    }
    if (!pushed.conflict) return { ok: false };
  }
  // Still losing the race after several tries; the next poll starts again
  return { ok: false };
}
