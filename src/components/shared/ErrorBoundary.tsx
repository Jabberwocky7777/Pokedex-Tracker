import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { downloadBackup } from "../../lib/backup";
import { useSettingsStore } from "../../store/useSettingsStore";

interface Props {
  children: ReactNode;
  /**
   * "app" (the default): the last line of defence, a whole-screen message.
   * "tab": one tab's slot, so the other tabs keep working.
   */
  scope?: "app" | "tab";
  /** The tab's name, for the message ("Routes couldn't be shown") */
  name?: string;
}

interface State {
  error: Error | null;
  /** Bumped by "Try again", which remounts the children from scratch */
  attempt: number;
  backupFailed: boolean;
}

/**
 * Catches a render error so it can't blank the app. The way out never needs
 * the part that broke: "Download backup" builds the file without React, and
 * "Open tracker" switches tab before reloading, so a tab that crashes on every
 * load can't trap anyone.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0, backupFailed: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[error] ${this.props.name ?? "App"} crashed:`, error, info.componentStack);
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1, backupFailed: false }));

  private backup = () => {
    downloadBackup().catch(() => this.setState({ backupFailed: true }));
  };

  private openTracker = () => {
    try {
      useSettingsStore.getState().setActiveTab("tracker");
    } catch {
      // The store itself may be what broke; the address below still lands on the tracker
    }
    window.location.hash = "#/tracker";
    window.location.reload();
  };

  render() {
    const { error, attempt, backupFailed } = this.state;
    if (!error) return <ChildrenKey key={attempt}>{this.props.children}</ChildrenKey>;

    const tab = this.props.scope === "tab";
    const actions = (
      <div className="flex flex-wrap justify-center gap-2">
        {tab ? (
          <button
            onClick={this.retry}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            Try again
          </button>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            Reload page
          </button>
        )}
        <button
          onClick={this.openTracker}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-medium"
        >
          Open tracker
        </button>
        <button
          onClick={this.backup}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-medium"
        >
          Download backup
        </button>
      </div>
    );

    return (
      <div
        role="alert"
        className={
          tab
            ? "h-full flex items-center justify-center p-6 bg-gray-950"
            : "min-h-screen bg-gray-900 flex items-center justify-center p-8"
        }
      >
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-700">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" aria-hidden="true" />
          <h1 className="text-white text-xl font-bold mb-2">
            {tab && this.props.name ? `${this.props.name} couldn't be shown` : "Something went wrong"}
          </h1>
          <p className="text-gray-400 text-sm mb-3">
            {tab
              ? "The other tabs still work. Your data is safe: download a backup if you want a copy before trying again."
              : "An unexpected error occurred. Your data is safe on this device; download a backup to keep a copy."}
          </p>
          {error.message && (
            <p className="text-gray-500 text-xs font-mono bg-gray-900 rounded-lg px-3 py-2 mb-6 break-all">
              {error.message}
            </p>
          )}
          {actions}
          {backupFailed && <p className="text-xs text-red-300 mt-3">Couldn&apos;t make the backup file.</p>}
        </div>
      </div>
    );
  }
}

/** A keyed wrapper, so "Try again" mounts the children fresh */
function ChildrenKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
