/**
 * The Android app's glue, loaded only there (main.tsx imports it dynamically when
 * IS_ANDROID): the system Back button and a controller's buttons, launcher
 * shortcuts and saves handed over by other apps, and the per-device window
 * settings. docs/android.md describes each from the user's side.
 */
import { App } from "@capacitor/app";
import { registerPlugin, SystemBars } from "@capacitor/core";
import { closeTopLayer } from "./layers";
import { openSearch } from "./search-open";
import { openMyGames, openTab } from "./navigate";
import { toggleWithUndo } from "./dex-actions";
import { receiveSave } from "./save/incoming";
import { useSettingsStore } from "../store/useSettingsStore";
import { APP_TABS } from "../types";

interface AppWindowPlugin {
  setKeepControllerOnGame(options: { keep: boolean }): Promise<void>;
  setInitialScale(options: { percent: number }): Promise<void>;
}
const AppWindow = registerPlugin<AppWindowPlugin>("AppWindow");

// ── Back (system Back, and B on a controller) ────────────────────────────────

/**
 * Back closes whatever is on top (a dialog, a sheet, the detail panel, a menu, an
 * edit); with nothing open it goes back through the tabs and sections visited (the
 * address bar's history, lib/url-route.ts); at the first screen it minimises the
 * app — never exits, so nothing is lost and reopening is instant.
 */
export function goBack(canGoBack?: boolean): void {
  if (closeTopLayer()) return;
  if (canGoBack === false) {
    void App.minimizeApp();
    return;
  }
  const before = location.href;
  history.back();
  // B doesn't know whether there was anywhere to go: if the address didn't change, minimise
  if (canGoBack === undefined)
    setTimeout(() => {
      if (location.href === before) void App.minimizeApp();
    }, 200);
}

// ── Controller buttons (MainActivity forwards them as "padbutton") ───────────

type PadButton = "A" | "B" | "X" | "Y" | "L1" | "R1" | "Start" | "Select";

/** What each button does; also listed in the shortcuts help (ShortcutModal) on Android */
export const PAD_ACTIONS: Record<PadButton, () => void> = {
  A: pressFocused,
  B: () => goBack(),
  X: toggleCaughtHere,
  Y: openSearch,
  L1: () => stepTab(-1),
  R1: () => stepTab(1),
  Start: openSectionMenu,
  Select: () => {},
};

/**
 * A: presses the focused element. On a tracker cell it opens the Pokémon's details
 * rather than doing what a tap does (with Quick mark a tap marks it caught; X does that).
 */
function pressFocused(): void {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return;
  const settings = useSettingsStore.getState();
  if (settings.activeTab === "tracker" && el.matches("[data-pokemon-id]")) {
    settings.setSelectedPokemonId(Number(el.dataset.pokemonId));
    return;
  }
  if (el instanceof HTMLSelectElement && typeof el.showPicker === "function") el.showPicker();
  else el.click();
}

/** X: caught on the focused Pokémon (a tracker cell or list row), or the selected one */
function toggleCaughtHere(): void {
  const settings = useSettingsStore.getState();
  if (settings.activeTab !== "tracker") return;
  const focused = document.activeElement?.closest<HTMLElement>("[data-pokemon-id]");
  const id = focused ? Number(focused.dataset.pokemonId) : settings.selectedPokemonId;
  if (!id) return;
  const name = focused?.getAttribute("aria-label")?.split(",")[0] ?? `#${id}`;
  toggleWithUndo("caught", id, settings.activeGeneration, name);
}

/** L1 / R1: the previous or next tab, wrapping around */
function stepTab(step: number): void {
  const tabs = APP_TABS;
  const at = tabs.indexOf(useSettingsStore.getState().activeTab);
  openTab(tabs[(at + step + tabs.length) % tabs.length]);
}

/** Start: the open tab's section menu (sheet on a small screen; the section list otherwise) */
function openSectionMenu(): void {
  const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const menu = [...document.querySelectorAll<HTMLElement>('[data-testid="section-menu"]')].find(visible);
  if (menu) {
    menu.click();
    return;
  }
  const first = [...document.querySelectorAll<HTMLElement>('nav[aria-label$="sections"] button')].find(visible);
  first?.focus();
}

// ── Right stick: scrolls whatever has focus, or the open tab ─────────────────

let velocity = { x: 0, y: 0 };
let frame = 0;

function scrollTarget(): HTMLElement | null {
  const scrollable = (el: HTMLElement) => {
    const style = getComputedStyle(el);
    return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
  };
  for (let el = document.activeElement as HTMLElement | null; el && el !== document.body; el = el.parentElement)
    if (scrollable(el)) return el;
  return (
    [...document.querySelectorAll<HTMLElement>("main, [data-scroll-root]")].find(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && scrollable(el),
    ) ?? null
  );
}

function scrollStep(): void {
  frame = 0;
  if (!velocity.x && !velocity.y) return;
  scrollTarget()?.scrollBy({ left: velocity.x * 16, top: velocity.y * 22 });
  frame = requestAnimationFrame(scrollStep);
}

// ── Saves and shortcuts from other apps ──────────────────────────────────────

interface NativeReceivedSave {
  name: string;
  data?: string;
  error?: "too_big" | "failed";
}

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Window settings ──────────────────────────────────────────────────────────

/** "Display size": a viewport scale below 1 lays the page out as if the screen were bigger */
function applyDisplayScale(scale: number): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const rest = meta.content
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^(initial|minimum|maximum)-scale=/.test(s));
  meta.content = [...rest, `initial-scale=${scale}`, `minimum-scale=${Math.min(scale, 1)}`].join(", ");
}

function applyWindowSettings(): void {
  const { displayScale, showSystemBars, keepControllerOnGame } = useSettingsStore.getState();
  applyDisplayScale(displayScale);
  void (showSystemBars ? SystemBars.show() : SystemBars.hide()).catch(() => {});
  void AppWindow.setKeepControllerOnGame({ keep: keepControllerOnGame }).catch(() => {});
}

// ── Start ────────────────────────────────────────────────────────────────────

export function startAndroid(): void {
  void App.addListener("backButton", ({ canGoBack }) => goBack(canGoBack));

  window.addEventListener("padbutton", (e) => {
    const button = (e as Event & { button?: string }).button as PadButton | undefined;
    if (button && button in PAD_ACTIONS) PAD_ACTIONS[button]();
  });
  window.addEventListener("padscroll", (e) => {
    const { x = 0, y = 0 } = e as Event & { x?: number; y?: number };
    velocity = { x, y };
    if (!frame && (x || y)) frame = requestAnimationFrame(scrollStep);
  });

  // Launcher shortcuts: pokedextracker://plan/where → #/plan/where
  void App.addListener("appUrlOpen", ({ url }) => {
    const match = /^pokedextracker:\/\/(.*)$/.exec(url);
    if (match) location.hash = `#/${match[1].replace(/^\/+/, "")}`;
  });

  // A save from "Open with" / "Share": to the Saves view, which imports it
  void registerPlugin<{
    addListener(event: "saveFileReceived", listener: (save: NativeReceivedSave) => void): Promise<unknown>;
  }>("SaveFolders").addListener("saveFileReceived", (save) => {
    openMyGames("saves");
    receiveSave(
      save.data
        ? { file: new File([bytesOf(save.data).buffer as ArrayBuffer], save.name) }
        : { name: save.name, error: save.error ?? "failed" },
    );
  });

  applyWindowSettings();
  useSettingsStore.subscribe((state, prev) => {
    if (
      state.displayScale !== prev.displayScale ||
      state.showSystemBars !== prev.showSystemBars ||
      state.keepControllerOnGame !== prev.keepControllerOnGame
    )
      applyWindowSettings();
  });
}
