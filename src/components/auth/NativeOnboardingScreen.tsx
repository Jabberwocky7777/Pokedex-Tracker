import { useState } from "react";
import { setServerUrl, setToken, getServerUrl } from "../../lib/sync";

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
      setError("Enter your server's IP address and port, e.g. http://192.168.1.50:7777");
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
        const healthRes = await fetch(`${trimmedUrl}/health`, { signal: AbortSignal.timeout(8000) });
        healthOk = healthRes.ok;
      } catch {
        setError(`Cannot reach server at ${trimmedUrl}. Check the IP address and port, and make sure you're on the same Wi-Fi network.`);
        return;
      }

      if (!healthOk) {
        setError(`Server responded with an error. Check the address and try again.`);
        return;
      }

      // Step 2: Log in
      const loginRes = await fetch(`${trimmedUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: AbortSignal.timeout(10000),
      });

      const body = await loginRes.json() as { ok?: boolean; token?: string; error?: string };

      if (loginRes.status === 401) {
        setError("Wrong username or password. Try again.");
        setPassword("");
        return;
      }
      if (!loginRes.ok) {
        setError(body.error ?? `Server error (${loginRes.status}). Try again.`);
        return;
      }

      // Success — store both and proceed
      setServerUrl(trimmedUrl);
      setToken(body.token ?? "");
      onSuccess();

    } catch {
      setError("Connection timed out. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
    placeholder-gray-500 text-base focus:outline-none focus:border-blue-500
    focus:ring-1 focus:ring-blue-500 transition-colors`;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-full bg-red-500 relative overflow-hidden border-4 border-gray-300 shadow-lg">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-300" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300" />
          </div>
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
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              placeholder="http://192.168.1.50:7777"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Your TrueNAS IP and port — e.g.{" "}
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
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
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
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete="current-password"
              className={inputClass}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400 leading-relaxed" role="alert">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
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
                Connecting…
              </>
            ) : "Connect"}
          </button>

        </form>
      </div>
    </div>
  );
}
