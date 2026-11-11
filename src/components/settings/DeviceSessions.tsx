import { useEffect, useState } from "react";
import { listSessions, revokeSession, type DeviceSession } from "../../lib/sync";
import Button from "../shared/Button";

interface Props {
  onResult: (message: string, ok: boolean) => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The devices signed in to the sync server, each of which can be signed out on
 * its own (a lost phone, say). Hidden when the server is older than sessions.
 */
export default function DeviceSessions({ onResult }: Props) {
  const [state, setState] = useState<{ sessions: DeviceSession[]; legacyToken: boolean } | null | "loading">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listSessions().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading" || state === null) return null;

  async function signOut(session: DeviceSession) {
    setBusyId(session.id);
    try {
      if (await revokeSession(session.id)) {
        setState((s) => (s && s !== "loading" ? { ...s, sessions: s.sessions.filter((x) => x.id !== session.id) } : s));
        onResult(`Signed out ${session.label}.`, true);
      } else onResult(`Couldn't sign out ${session.label}.`, false);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">Signed-in devices</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Each sign-in is listed here. Signing a device out stops it syncing until someone signs in on it again.
        </p>
      </div>
      {state.legacyToken && (
        <p className="text-xs text-gray-400">
          This device signed in before devices were listed. Sign out and in again to see it here.
        </p>
      )}
      {state.sessions.length === 0 ? (
        <p className="text-sm text-gray-400">No other devices.</p>
      ) : (
        <ul className="flex flex-col rounded-lg border border-gray-800">
          {state.sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-800 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">
                  {session.label}
                  {session.current && <span className="ml-2 text-xs text-emerald-300">This device</span>}
                </p>
                <p className="text-xs text-gray-500">
                  Signed in {when(session.createdAt)} · last used {when(session.lastUsedAt)}
                </p>
              </div>
              {!session.current && (
                <Button
                  size="sm"
                  variant="danger-soft"
                  onClick={() => signOut(session)}
                  disabled={busyId !== null}
                  className="flex-shrink-0"
                >
                  {busyId === session.id ? "Signing out…" : "Sign out"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
