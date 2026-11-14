import { IS_NATIVE } from "./platform";

/**
 * Calls `listener` whenever the user comes back to the app: the page becoming
 * visible again in a browser, and the app's `resume` event in the iOS and
 * Android apps (an Android web view isn't always told it was hidden). Used to
 * check linked saves for changes made by an emulator or a save editor meanwhile.
 * Returns the function that stops listening.
 */
export function onAppResume(listener: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") listener();
  };
  document.addEventListener("visibilitychange", onVisible);

  let removeNative: (() => void) | null = null;
  let stopped = false;
  if (IS_NATIVE) {
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("resume", listener).then((handle) => {
        if (stopped) void handle.remove();
        else removeNative = () => void handle.remove();
      }),
    );
  }
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    removeNative?.();
  };
}
