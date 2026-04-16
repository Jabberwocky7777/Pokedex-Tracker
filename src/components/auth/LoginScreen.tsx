import { useState, useEffect, useRef } from "react";
import { setToken } from "../../lib/sync";

interface Props {
  onSuccess: () => void;
}

type HealthResponse = { ok: boolean; loginEnabled: boolean; syncEnabled: boolean };

/**
 * Shown when no sync token is in localStorage.
 *
 * - Fetches /health to check server state
 * - loginEnabled: shows username + password form → POST /api/login → stores token
 * - syncEnabled only (no login creds): shouldn't happen in normal deploy, falls back gracefully
 * - Neither: offers "Continue without sync" (local-only mode)
 */
export default function LoginScreen({ onSuccess }: Props) {
  const [serverState, setServerState] = useState<HealthResponse | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/health")
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((body) => {
        setServerState(body);
        // Auto-focus username field once the form appears
        if (body.loginEnabled) setTimeout(() => usernameRef.current?.focus(), 50);
      })
      .catch(() => setServerState({ ok: false, loginEnabled: false, syncEnabled: false }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const body = await res.json() as { ok?: boolean; token?: string; error?: string };

      if (res.status === 401) {
        setError("Incorrect username or password.");
        setPassword("");
        return;
      }
      if (!res.ok) {
        setError(body.error ?? `Server error ${res.status} — try again.`);
        return;
      }

      // Store the token the server returned — user never needs to see it
      setToken(body.token ?? "");
      onSuccess();
    } catch {
      setError("Could not reach the server. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  function continueWithoutSync() {
    setToken(""); // empty sentinel — sync engine sees isEnabled() = false
    onSuccess();
  }

  const Spinner = () => (
    <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

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
            <p className="text-sm text-gray-400 mt-1">Sign in to access your Pokédex</p>
          </div>
        </div>

        {/* Loading — waiting for /health */}
        {serverState === null && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {/* Login form */}
        {serverState?.loginEnabled && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  ref={usernameRef}
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                    placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500
                    focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                    placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500
                    focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors
                flex items-center justify-center gap-2 min-h-[48px] mt-1"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>
        )}

        {/* No login configured — local-only mode */}
        {serverState !== null && !serverState.loginEnabled && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400 text-center leading-relaxed">
              {serverState.ok
                ? "This server doesn't have login configured. Your data will be saved locally in this browser."
                : "Could not reach the server. You can still use the tracker offline — your data will be saved locally."}
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
