import { useState, useEffect, useRef } from "react";
import {
  setToken,
  clearToken,
  setLocalMode,
  getServerUrl,
  requestLogin,
  lockedMessage,
  timeoutSignal,
} from "../../lib/sync";
import { isLocalAddress } from "../../lib/local-address";
import PokeBall from "../shared/PokeBall";
import Spinner from "../shared/Spinner";
import Button from "../shared/Button";

interface Props {
  onSuccess: () => void;
}

type HealthResponse = {
  ok: boolean;
  loginEnabled: boolean;
  syncEnabled: boolean;
  /** Settings still at their .env.example value (treated as not set by the server) */
  placeholders?: string[];
};

/** How long to wait for /health before treating the server as unreachable. */
const HEALTH_TIMEOUT_MS = 8000;

/** True when this page reaches the server over plain HTTP across the internet. */
function insecurePage(): boolean {
  if (typeof location === "undefined" || location.protocol !== "http:") return false;
  return !isLocalAddress(location.href);
}

/**
 * Shown when no sync token is in localStorage.
 *
 * - Fetches /health (8 s timeout) to check server state
 * - loginEnabled: shows username + password form → POST /api/login → stores token
 * - Neither: explains why and offers offline (local-only) mode as the main action
 *
 * "Use offline" is always available, from the first render, whatever the server
 * says or however long it takes to answer. Signing in later from Settings merges
 * the offline data with the server's copy.
 */
export default function LoginScreen({ onSuccess }: Props) {
  const [serverState, setServerState] = useState<HealthResponse | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /** When sign-in opens again after a lock (ms, device clock) */
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const usernameRef = useRef<HTMLInputElement>(null);
  const insecure = insecurePage();

  useEffect(() => {
    let cancelled = false;
    fetch(`${getServerUrl()}/health`, { signal: timeoutSignal(HEALTH_TIMEOUT_MS) })
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((body) => {
        if (cancelled) return;
        setServerState(body);
        // Auto-focus username field once the form appears
        if (body.loginEnabled) setTimeout(() => usernameRef.current?.focus(), 50);
      })
      .catch(() => {
        if (!cancelled) setServerState({ ok: false, loginEnabled: false, syncEnabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Count the lock down, so the button comes back by itself
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);
  const waitSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || waitSeconds > 0) return;
    setError("");
    setLoading(true);
    try {
      const result = await requestLogin(getServerUrl(), username.trim(), password);
      if (result.ok) {
        // Store the token the server returned — user never needs to see it
        setToken(result.token);
        onSuccess();
        return;
      }
      switch (result.reason) {
        case "credentials":
          setError("Incorrect username or password.");
          setPassword("");
          break;
        case "locked":
          setError(lockedMessage(result.retryAfter));
          if (result.retryAfter) {
            setLockedUntil(Date.now() + result.retryAfter * 1000);
            setNow(Date.now());
          }
          break;
        case "unreachable":
          setError("Could not reach the server. Check your network and try again.");
          break;
        default:
          setError(result.message ?? `Server error ${result.status ?? ""} — try again.`);
      }
    } finally {
      setLoading(false);
    }
  }

  function continueWithoutSync() {
    clearToken();
    setLocalMode(true); // explicit flag — survives reloads, sync engine stays off
    onSuccess();
  }

  const placeholders = serverState?.placeholders ?? [];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <PokeBall size="lg" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Pokédex Tracker</h1>
            <p className="text-sm text-gray-400 mt-1">
              {serverState === null
                ? "Checking the sync server…"
                : serverState.loginEnabled
                  ? "Sign in to sync your Pokédex across devices"
                  : "Use the tracker offline on this device"}
            </p>
          </div>
        </div>

        {/* Loading — waiting for /health */}
        {serverState === null && (
          <div className="flex justify-center py-6" role="status" aria-label="Checking the sync server">
            <Spinner className="w-5 h-5 text-gray-500" />
          </div>
        )}

        {/* Login form */}
        {serverState?.loginEnabled && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {insecure && (
              <p className="text-xs text-amber-300 leading-relaxed" role="note">
                This page isn&apos;t using HTTPS, so your password is sent unencrypted. Put the server behind HTTPS
                before signing in from outside your home network.
              </p>
            )}
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
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                    placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500
                    focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                    placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500
                    focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password || waitSeconds > 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700
                disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors
                flex items-center justify-center gap-2 min-h-[48px] mt-1"
            >
              {loading ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : waitSeconds > 0 ? (
                `Try again in ${waitSeconds} s`
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        )}

        {/* No login configured or server unreachable — say why */}
        {serverState !== null && !serverState.loginEnabled && (
          <p className="text-sm text-gray-400 text-center leading-relaxed">
            {placeholders.length > 0
              ? `This server still has the example value for ${placeholders.join(" and ")}, so sign-in is switched off until it is changed. You can use the tracker offline — your data is saved in this browser.`
              : serverState.ok
                ? "This server doesn't have login configured. You can use the tracker offline — your data is saved in this browser."
                : "Could not reach the server. You can still use the tracker offline — your data is saved in this browser."}
          </p>
        )}

        {/* Always offered, from the first render: skip sync and keep data on this device */}
        <div className="flex flex-col items-center gap-1.5 mt-5">
          <Button
            onClick={continueWithoutSync}
            // The only way in when there is no login: make it the main button
            variant={serverState !== null && !serverState.loginEnabled ? "primary" : "secondary"}
            className="min-h-[44px]"
          >
            Use offline
          </Button>
          <p className="text-xs text-gray-500 text-center">
            No sync — data stays on this device. You can sign in later from Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
