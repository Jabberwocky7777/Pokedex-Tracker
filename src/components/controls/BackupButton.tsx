import { useRef, useState, useEffect } from "react";
import { downloadBackup, restoreBackup } from "../../lib/backup";

type Status = { type: "idle" } | { type: "success" } | { type: "error"; message: string };

export default function BackupButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [restoring, setRestoring] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Auto-clear status after 3 s
  useEffect(() => {
    if (status.type === "idle") return;
    const t = setTimeout(() => setStatus({ type: "idle" }), 3000);
    return () => clearTimeout(t);
  }, [status]);

  function handleSave() {
    setOpen(false);
    downloadBackup();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected later
    e.target.value = "";
    if (!file) return;

    setOpen(false);
    setRestoring(true);
    const result = await restoreBackup(file);
    setRestoring(false);
    setStatus(result.ok ? { type: "success" } : { type: "error", message: result.error });
  }

  const statusColor =
    status.type === "success"
      ? "text-green-400"
      : status.type === "error"
      ? "text-red-400"
      : "";

  return (
    <div className="relative" ref={menuRef}>
      {/* Hidden file input — triggered programmatically */}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={restoring}
        title="Backup & Restore"
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all
          ${open
            ? "bg-indigo-700 text-white"
            : "bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white"
          }
          ${restoring ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {/* Archive icon */}
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        <span className="hidden sm:inline">
          {restoring ? "Restoring…" : "Backup"}
        </span>
        {/* Status dot */}
        {status.type !== "idle" && (
          <span className={`text-xs leading-none ${statusColor}`}>
            {status.type === "success" ? "✓" : "✕"}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Status message inside menu when relevant */}
          {status.type === "error" && (
            <div className="px-3 py-2 text-xs text-red-400 bg-red-900/20 border-b border-gray-700 leading-snug">
              {status.message}
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors text-left"
          >
            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <div>
              <div className="font-medium">Save backup</div>
              <div className="text-xs text-gray-500 mt-0.5">Downloads a .json file</div>
            </div>
          </button>

          <div className="border-t border-gray-700" />

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors text-left"
          >
            <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <div>
              <div className="font-medium">Restore from file</div>
              <div className="text-xs text-gray-500 mt-0.5">Replaces current data</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
