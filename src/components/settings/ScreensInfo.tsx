import { useCallback, useEffect, useState } from "react";
import { AppWindow, webViewVersion, type AndroidDisplayInfo } from "../../lib/android-window";
import { onAppResume } from "../../lib/app-resume";
import { copyText } from "../../lib/clipboard";
import Button from "../shared/Button";

/**
 * Settings → Appearance in the Android app: the screens Android reports, which one
 * the app is on and how big the page is there — what's needed to tell why a layout
 * or the keyboard misbehaves on a handheld, in a form that can be copied into a message.
 */
export default function ScreensInfo() {
  const [info, setInfo] = useState<AndroidDisplayInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    AppWindow.displayInfo().then(
      (next) => {
        setInfo(next);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    refresh();
    return onAppResume(refresh);
  }, [refresh]);

  if (failed) return <p className="text-xs text-gray-500">Screen details aren&apos;t available.</p>;
  if (!info) return null;

  const lines = describeScreens(info);
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <p className="text-sm text-gray-300">Screens</p>
      <ul className="text-xs text-gray-400 font-mono flex flex-col gap-0.5 break-words">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" onClick={refresh}>
          Check again
        </Button>
        <Button
          size="sm"
          onClick={() =>
            void copyText(lines.join("\n")).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function describeScreens(info: AndroidDisplayInfo): string[] {
  const lines = [
    `${info.manufacturer} ${info.model}, Android ${info.android}, WebView ${webViewVersion() ?? "unknown"}`,
    `This app: screen ${info.displayId}, ${info.widthPx}×${info.heightPx} px at ${info.density}× = page ${window.innerWidth}×${window.innerHeight}`,
    `Window: ${info.hasFocus ? "has focus" : "no focus"}${info.notFocusable ? ", not focusable (keyboard off)" : ""}`,
  ];
  for (const d of info.displays) {
    const tags = [
      d.isDefault ? "main" : null,
      d.presentation ? "second-screen type" : null,
      d.on ? null : "off",
      d.id === info.displayId ? "this app" : null,
    ].filter(Boolean);
    lines.push(`Screen ${d.id}: ${d.name}, ${d.widthPx}×${d.heightPx}${tags.length ? ` (${tags.join(", ")})` : ""}`);
  }
  return lines;
}
