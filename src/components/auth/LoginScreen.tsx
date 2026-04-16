import { useState, useEffect } from "react";
import { setToken } from "../../lib/sync";

interface Props {
  onSuccess: () => void;
}

type HealthResponse = { ok: boolean; syncEnabled: boolean };

/**
 * Shown when no sync token is in localStorage.
 * - Fetches /health to check if sync is enabled on this server
 * - If syncEnabled: shows token input form; validates by calling GET /api/sync
 * - If not syncEnabled: offers "Continue without sync" button
 * - On success: saves token to localStorage and calls onSuccess()
 */
export default function LoginScreen({ onSuccess }: Props) {
  const [syncEnabled, setSyncEnabled] = useState<boolean | null>(null); // null = loading
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check /health on mount to decide which UI to show
  useEffect(() => {
    fetch("/health")
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((body) => setSyncEnabled(body.syncEnabled))
      .catch(() => setSyncEnabled(false)); // can't reach server — treat as no sync
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/sync", {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });

      if (res.status === 401) {
        setError("Invalid token — check your SYNC_TOKEN and try again.");
        return;
      }
      if (!res.ok && res.status !== 204) {
        setError(`Server error ${res.status} — try again.`);
        return;
      }

      // Token is valid (200 with data, or 204 with no data yet)
      setToken(token.trim());
      onSuccess();
    } catch {
      setError("Could not reach the server. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  function continueWithoutSync() {
    // Store an empty string as a sentinel so we don't prompt again this session.
    // The sync engine checks isEnabled() which returns false for empty string,
    // so sync stays silently disabled.
    setToken("");
    onSuccess();
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-full bg-red-500 relative overflow-hidden border-4 border-gray-300 shadow-lg">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-300" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Pokédex Tracker</h1>
            <p className="text-sm text-gray-400 mt-1">Your personal Pokémon companion</p>
          </div>
        </div>

        {/* Loading state */}
        {syncEnabled === null && (
          <div className="flex justify-center py-4">
            <svg className="w-6 h-6 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Sync enabled — show token form */}
        {syncEnabled === true && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="sync-token" className="block text-sm font-medium text-gray-300 mb-2">
                Sync token
              </label>
              <input
                id="sync-token"
                type="password"
                value={token}
                onChange={(e) => { setTokenValue(e.target.value); setError(""); }}
                placeholder="Paste your SYNC_TOKEN here"
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                  placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500
                  focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors
                flex items-center justify-center gap-2 min-h-[48px]"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying…
                </>
              ) : "Sign in"}
            </button>
          </form>
        )}

        {/* Sync not enabled on this server */}
        {syncEnabled === false && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400 text-center">
              This server doesn't have sync configured. You can still use the tracker — your data will be saved locally in this browser.
            </p>
            <button
              onClick={continueWithoutSync}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold
                rounded-lg transition-colors min-h-[48px]"
            >
              Continue
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
