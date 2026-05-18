/**
 * Sync utilities for the Pokédex Tracker.
 *
 * Token management: stored in both localStorage (for immediate sync reads) and
 * @capacitor/preferences (iOS UserDefaults — survives SideStore/AltStore updates).
 * On boot, initStorage() recovers values from Preferences into localStorage if
 * the latter was cleared by iOS.
 * Transport: HTTP polling — GET /api/pull every 30s, POST /api/push on changes.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { useDesignerStore } from "../store/useDesignerStore";
import type { BackupData } from "./backup";

const STORAGE_KEY = "pokedex_sync_token";
const SERVER_URL_KEY = "pokedex_server_url";

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
 * SideStore/AltStore update, this restores the token and server URL from
 * the more-durable Preferences (iOS UserDefaults) store.
 */
export async function initStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!localStorage.getItem(STORAGE_KEY)) {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) localStorage.setItem(STORAGE_KEY, value);
  }
  if (!localStorage.getItem(SERVER_URL_KEY)) {
    const { value } = await Preferences.get({ key: SERVER_URL_KEY });
    if (value) localStorage.setItem(SERVER_URL_KEY, value);
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
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
  prefRemove(STORAGE_KEY);
}

export function hasToken(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

// ── HTTP sync ────────────────────────────────────────────────────────────────

function authHeaders() {
  return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

function handleUnauthorized() {
  clearToken();
  window.dispatchEvent(new CustomEvent("pdx:unauthorized"));
}

export async function pullData(): Promise<{ ok: boolean; data?: BackupData; savedAt?: string }> {
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

export function buildPayload(): BackupData {
  const { caughtByGen, pendingByGen } = useDexStore.getState();
  const { savedSessions } = useIvStore.getState();
  const { slotsByGen } = useBoxSlotStore.getState();
  const { slots: designerSlots } = useDesignerStore.getState();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tracker: { caughtByGen, pendingByGen },
    ivChecker: { savedSessions },
    boxSlots: slotsByGen,
    designer: designerSlots,
  };
}
