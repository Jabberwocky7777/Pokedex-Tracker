/**
 * The Android app's window plugin (AppWindowPlugin.java): full screen, the
 * controller and keyboard on a dual-screen handheld, and what Android reports
 * about the screens. Calls reject in a browser and the iOS app, where it doesn't exist.
 */
import { registerPlugin } from "@capacitor/core";

/** One screen as Android reports it */
export interface AndroidDisplay {
  id: number;
  name: string;
  widthPx: number;
  heightPx: number;
  /** Android's main display; on the AYN Thor the top screen */
  isDefault: boolean;
  /** Offered for a second screen's content (the Thor's bottom screen is one) */
  presentation: boolean;
  on: boolean;
}

export interface AndroidDisplayInfo {
  /** The screen the app is on */
  displayId: number;
  widthPx: number;
  heightPx: number;
  density: number;
  hasFocus: boolean;
  notFocusable: boolean;
  manufacturer: string;
  model: string;
  android: string;
  displays: AndroidDisplay[];
}

interface AppWindowPlugin {
  setFullScreen(options: { full: boolean }): Promise<void>;
  setKeepControllerOnGame(options: { keep: boolean }): Promise<void>;
  setInitialScale(options: { percent: number }): Promise<void>;
  displayInfo(): Promise<AndroidDisplayInfo>;
}

export const AppWindow = registerPlugin<AppWindowPlugin>("AppWindow");

/** The WebView's Chromium version, from its user agent; null if it isn't one */
export function webViewVersion(userAgent = navigator.userAgent): number | null {
  const match = /Chrome\/(\d+)/.exec(userAgent);
  return match ? Number(match[1]) : null;
}
