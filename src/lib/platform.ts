import { Capacitor } from "@capacitor/core";

/**
 * Where this copy of the app runs. Every native branch reads these, so a
 * difference between the iOS and Android apps is a one-line change.
 */
export const PLATFORM = Capacitor.getPlatform() as "web" | "ios" | "android";
/** The iOS or Android app (Capacitor), not a browser */
export const IS_NATIVE = Capacitor.isNativePlatform();
export const IS_IOS = PLATFORM === "ios";
export const IS_ANDROID = PLATFORM === "android";

/** "the iOS app" / "the Android app" / "this browser", for sentences that name where the user is */
export const HERE = IS_IOS ? "the iOS app" : IS_ANDROID ? "the Android app" : "this browser";
