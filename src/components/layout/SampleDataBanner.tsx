import { FlaskConical } from "lucide-react";
import { isSampleData } from "../../lib/sample-data";
import { leaveSampleData } from "../../lib/local-data";

/** Shown while the made-up collection from "Try it with sample data" is on this device. */
export default function SampleDataBanner() {
  if (!isSampleData()) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 px-4 py-1.5 bg-indigo-900/40 border-b border-indigo-700/50 text-sm text-indigo-100"
    >
      <FlaskConical size={15} className="flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0">
        You&apos;re looking at sample data. Nothing you change here is saved anywhere but this browser.
      </p>
      <button
        onClick={() => void leaveSampleData()}
        className="flex-shrink-0 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
      >
        Start fresh
      </button>
    </div>
  );
}
