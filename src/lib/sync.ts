/**
 * Sync utilities for the Pokédex Tracker.
 *
 * Token management: SYNC_TOKEN stored in localStorage after login.
 * Transport: HTTP polling — GET /api/pull every 30s, POST /api/push on changes.
 */

import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { useDesignerStore } from "../store/useDesignerStore";
import type { BackupData } from "./backup";

const STORAGE_KEY = "pokedex_sync_token";
const SERVER_URL_KEY = "pokedex_server_url";

// ── Server URL (configured during onboarding on native app) ──────────────────

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? "";
}

export function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ""));
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
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
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
