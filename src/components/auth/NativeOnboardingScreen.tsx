import { useState } from "react";
import {
  setServerUrl,
  setToken,
  clearToken,
  setLocalMode,
  getServerUrl,
  timeoutSignal,
  requestLogin,
  lockedMessage,
} from "../../lib/sync";
import { isInsecureRemote } from "../../lib/local-address";
import PokeBall from "../shared/PokeBall";
import Spinner from "../shared/Spinner";
import Button from "../shared/Button";

interface Props {
  onSuccess: () => void;
}

export default function NativeOnboardingScreen({ onSuccess }: Props) {
  const existingUrl = getServerUrl();

  const [url, setUrl] = useState(existingUrl || "http://");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim().replace(/\/$/, "");

    // Basic URL validation
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setError("Server address must start with http:// or https://");
      return;
    }
    if (trimmedUrl === "http://" || trimmedUrl === "https://") {
      setError("Enter your server's address and port, e.g. http://192.168.1.50:7777");
      return;
    }
    // iOS allows plain HTTP to local addresses only (Info.plist), so a public
    // http:// address would fail with a misleading "same Wi-Fi" message
    if (isInsecureRemote(trimmedUrl)) {
      setError(
        "iOS only allows https:// for an address outside your local network. Use the server's HTTPS address, or its local address on the same Wi-Fi.",
      );
      return;
    }
    if (!username.trim()) {
      setError("Enter your username.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Step 1: Check server is reachable
      let healthOk = false;
      try {
        // timeoutSignal, not AbortSignal.timeout: iOS 15 (the deployment target) lacks the latter
        const healthRes = await fetch(`${trimmedUrl}/health`, { signal: timeoutSignal(8000) });
        healthOk = healthRes.ok;
      } catch {
        setError(
          `Cannot reach server at ${trimmedUrl}. Check the IP address and port, and make sure you're on the same Wi-Fi network.`,
        );
        return;
      }

      if (!healthOk) {
        setError(`Server responded with an error. Check the address and try again.`);
        return;
      }

      // Step 2: Log in
      const result = await requestLogin(trimmedUrl, username.trim(), password);
      if (!result.ok) {
        if (result.reason === "credentials") setPassword("");
        setError(
          result.reason === "credentials"
            ? "Wrong username or password. Try again."
            : result.reason === "locked"
              ? lockedMessage(result.retryAfter)
              : result.reason === "not-server"
                ? `${trimmedUrl} doesn't look like a Pokédex Tracker server. Check the address.`
                : result.reason === "unreachable"
                  ? "Connection timed out. Check your network and try again."
                  : (result.message ?? `Server error (${result.status}). Try again.`),
        );
        return;
      }

      // Success — store both and proceed
      setServerUrl(trimmedUrl);
      setToken(result.token);
      onSuccess();
    } catch {
      setError("Connection timed out. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
    placeholder-gray-500 text-base focus:outline-none focus:border-indigo-500
    focus:ring-1 focus:ring-indigo-500 transition-colors`;

  return (
    <div
      className="min-h-screen bg-gray-950 flex items-center justify-center px-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <PokeBall size="lg" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Pokédex Tracker</h1>
            <p className="text-sm text-gray-400 mt-1">Connect to your server</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Server address */}
          <div>
            <label htmlFor="server-url" className="block text-sm font-medium text-gray-300 mb-1.5">
              Server address
            </label>
            <input
              id="server-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              placeholder="http://192.168.1.50:7777"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Your server&apos;s address and port — e.g.{" "}
              <span className="font-mono text-gray-400">http://192.168.1.50:7777</span>
            </p>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5">
              Username
            </label>
            <input
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
              className={inputClass}
            />
          </div>

          {/* Password */}
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
              className={inputClass}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400 leading-relaxed" role="alert">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700
              disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors
              flex items-center justify-center gap-2 min-h-[48px] mt-1"
          >
            {loading ? (
              <>
                <Spinner />
                Connecting…
              </>
            ) : (
              "Connect"
            )}
          </button>
        </form>

        {/* Always offered: skip sync and keep data on this device */}
        <div className="flex flex-col items-center gap-1.5 mt-5">
          <Button
            onClick={() => {
              clearToken();
              setLocalMode(true);
              onSuccess();
            }}
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
