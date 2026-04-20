import { useEffect, useRef } from "react";
import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { useDesignerStore } from "../store/useDesignerStore";
import { getToken, hasToken, clearToken, buildPayload } from "../lib/sync";
import { connect } from "../lib/ws-sync";
import type { WsSyncConnection, WsMessage } from "../lib/ws-sync";
import { useSyncStatus } from "./useSyncStatus";
import type { BackupData } from "../lib/backup";

const DEBOUNCE_MS = 2_000;
const WS_ENDPOINT = "/api/ws";

function applySnapshot(data: BackupData) {
  if (data?.tracker) {
    useDexStore.setState({
      caughtByGen: data.tracker.caughtByGen,
      pendingByGen: data.tracker.pendingByGen,
    });
  }
  if (data?.ivChecker) {
    useIvStore.setState({ savedSessions: data.ivChecker.savedSessions });
  }
  if (data?.boxSlots) {
    useBoxSlotStore.getState().setSlotsByGen(data.boxSlots);
  }
  if (Array.isArray(data?.designer)) {
    useDesignerStore.getState().setSlots(data.designer as ReturnType<typeof useDesignerStore.getState>["slots"]);
  }
}

export function useSyncEngine() {
  const { setSyncing, setLastSynced, setError, setForcePush } = useSyncStatus();

  const connRef       = useRef<WsSyncConnection | null>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPulling     = useRef(false);
  const isFirstRender = useRef(true);
  const isConnected   = useRef(false);

  useEffect(() => {
    if (!hasToken()) return;

    const token = getToken();
    const wsUrl = `${window.location.protocol}//${window.location.host}${WS_ENDPOINT}`;

    function handleMessage(msg: WsMessage) {
      if (msg.type === "snapshot") {
        isPulling.current = true;
        applySnapshot(msg.data as BackupData);
        setLastSynced(new Date(msg.savedAt));
        setTimeout(() => { isPulling.current = false; }, 0);
      } else if (msg.type === "no-data") {
        // Server is up but has no saved data yet — clear any stale error
        isPulling.current = false;
        setError(null);
      } else if (msg.type === "error") {
        if (msg.message === "Unauthorized") {
          // Stale token — clear it and reload so the login screen appears
          clearToken();
          window.location.reload();
        } else {
          setError(msg.message);
        }
      }
    }

    function handleConnected() {
      isConnected.current = true;
      setError(null); // clear "Disconnected" as soon as we're back
    }

    function handleDisconnected() {
      isConnected.current = false;
      setError("Disconnected — reconnecting…");
    }

    connRef.current = connect(wsUrl, token, handleMessage, handleConnected, handleDisconnected);

    setForcePush(() => {
      if (connRef.current && isConnected.current) {
        connRef.current.push(buildPayload());
      }
    });

    return () => {
      connRef.current?.close();
      connRef.current = null;
      setForcePush(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // one connection for the app lifetime

  // ── Push on state changes (debounced) ──────────────────────────────────────
  // Must watch ALL synced stores — missing any means changes in that store are
  // never pushed to the server.
  const caughtByGen   = useDexStore((s) => s.caughtByGen);
  const pendingByGen  = useDexStore((s) => s.pendingByGen);
  const savedSessions = useIvStore((s) => s.savedSessions);
  const slotsByGen    = useBoxSlotStore((s) => s.slotsByGen);
  const designerSlots = useDesignerStore((s) => s.slots);

  useEffect(() => {
    if (isFirstRender.current || isPulling.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSyncing(true);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (!connRef.current || !isConnected.current) {
        setSyncing(false);
        return;
      }
      connRef.current.push(buildPayload());
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [caughtByGen, pendingByGen, savedSessions, slotsByGen, designerSlots]); // eslint-disable-line react-hooks/exhaustive-deps
}
