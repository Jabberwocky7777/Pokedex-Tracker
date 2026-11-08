import { useSettingsStore } from "../../store/useSettingsStore";

/** One-time, dismissible explanation of how marking works (box and list views). */
export default function GestureHint() {
  const quickMark = useSettingsStore((s) => s.quickMark);
  const dismissed = useSettingsStore((s) => s.gestureHintDismissed);
  const dismiss = useSettingsStore((s) => s.dismissGestureHint);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 mb-4 px-3 py-2.5 rounded-lg border border-gray-800 text-xs text-gray-400 leading-relaxed">
      <div className="flex-1">
        {quickMark ? (
          <>
            <span className="font-medium text-gray-200">Quick mark is on.</span> Tap or click a Pokémon to mark it
            caught. Long-press (or right-click) marks it pending. Turn Quick mark off in the toolbar to open a
            Pokémon&apos;s details with a tap instead.
          </>
        ) : (
          <>
            Tap or click a Pokémon to open its details. Double-click marks it caught; long-press (or right-click) marks
            it pending. <span className="font-medium text-gray-200">Quick mark</span> in the toolbar lets a single tap
            mark caught.
          </>
        )}{" "}
        Every change shows an Undo button for a few seconds.
      </div>
      <button
        onClick={dismiss}
        className="px-2.5 py-1 pointer-coarse:min-h-11 rounded-md hover:bg-gray-800 border border-gray-700 text-gray-200 font-medium flex-shrink-0"
      >
        Got it
      </button>
    </div>
  );
}
