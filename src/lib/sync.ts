/**
 * Sync utilities for the Pokédex Tracker.
 *
 * Token management: stored in both localStorage (for immediate sync reads) and
 * @capacitor/preferences (iOS UserDefaults — survives SideStore/AltStore updates).
 * On boot, initStorage() recovers values from Preferences into localStorage if
 * the latter was cleared by iOS.
 * Transport: HTTP polling — GET /api/pull every 30s, POST /api/push on changes.
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
import type { BackupData, SectionName } from "./backup";
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
// Designer slots, IV sessions and box slots are last-write-wins per section.
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

// ── HTTP sync ────────────────────────────────────────────────────────────────

function authHeaders() {
  return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

function handleUnauthorized() {
  clearToken();
  window.dispatchEvent(new CustomEvent("pdx:unauthorized"));
}

export async function pullData(): Promise<{ ok: boolean; data?: BackupData | null; savedAt?: string | null }> {
  const res = await fetch(`${getServerUrl()}/api/pull`, { headers: authHeaders() });
  if (res.status === 401) { handleUnauthorized(); return { ok: false }; }
  if (!res.ok) return { ok: false };
  return res.json();
}

export async function pushData(payload: BackupData): Promise<{ ok: boolean; savedAt?: string }> {
  const res = await fetch(`${getServerUrl()}/api/push`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ data: payload }),
  });
  if (res.status === 401) { handleUnauthorized(); return { ok: false }; }
  if (!res.ok) return { ok: false };
  return res.json();
}

// ── Payload builder (shared by push and backup export) ───────────────────────
// Every synced field of every persisted store must appear here — there is a
// test (sync.test.ts) that fails if a store's `partialize` gains a field that
// this function doesn't include.

export function buildPayload(): BackupData {
  const { caughtByGen, pendingByGen, shinyByGen, updatedAt } = useDexStore.getState();
  const { savedSessions } = useIvStore.getState();
  const { slotsByGen } = useBoxSlotStore.getState();
  const { slots: designerSlots } = useDesignerStore.getState();
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    tracker: { caughtByGen, pendingByGen, shinyByGen, updatedAt },
    ivChecker: { savedSessions },
    boxSlots: slotsByGen,
    designer: designerSlots,
    sectionUpdatedAt: getSectionUpdatedAt(),
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
    if (data?.sectionUpdatedAt) {
      setSectionUpdatedAt({ ...getSectionUpdatedAt(), ...data.sectionUpdatedAt });
    }
  } finally {
    applyingRemote = false;
  }
}

// ── One full sync: pull → merge → push ───────────────────────────────────────

let lastSyncedPayload: BackupData | null = null;

/** True when local state differs from what the last successful sync left on the server. */
export function hasUnsyncedChanges(): boolean {
  return !payloadsEqual(buildPayload(), lastSyncedPayload);
}

export type SyncResult = { ok: true; savedAt?: string | null } | { ok: false };

/**
 * Pulls the server copy, merges it into local state, and pushes the result
 * if the server doesn't already have it. Never pushes local state blindly.
 * Also used for the first sign-in, where it merges local-mode data with
 * whatever the server already holds.
 */
export async function syncOnce(): Promise<SyncResult> {
  const pulled = await pullData();
  if (!pulled.ok) return { ok: false };

  // Everything between the pull and the push below is synchronous, so a local
  // edit can't slip in between reading state and applying the merge.
  const local = buildPayload();
  const merged = mergePayload(local, pulled.data);
  if (!payloadsEqual(merged, local)) applySnapshot(merged);

  if (pulled.data && payloadsEqual(merged, pulled.data)) {
    lastSyncedPayload = merged;
    return { ok: true, savedAt: pulled.savedAt };
  }

  const pushed = await pushData(merged);
  if (!pushed.ok) return { ok: false };
  lastSyncedPayload = merged;
  return { ok: true, savedAt: pushed.savedAt };
}
