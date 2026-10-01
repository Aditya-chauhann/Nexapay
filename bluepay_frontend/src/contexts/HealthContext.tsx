import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { API_BASE_URL } from "@/lib/api-base";

/** Give up on a probe after this long — a hung socket counts as down. */
const REQUEST_TIMEOUT_MS = 5_000;

export type HealthStatus = "checking" | "online" | "maintenance" | "offline";

interface HealthPayload {
  status?: "ok" | "degraded";
  db?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceEta?: string | null;
}

interface HealthContextValue {
  status: HealthStatus;
  /** Anything other than a healthy 200 locks the app. */
  isDown: boolean;
  /** True while a probe is in flight, so the retry button can show progress. */
  isChecking: boolean;
  maintenanceMessage: string;
  maintenanceEta: string | null;
  lastCheckedAt: Date | null;
  /** Re-probe /health. The only thing that can unlock the app. */
  refresh: () => void;
}

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

/**
 * Owns the single source of truth for "is the backend serving?".
 *
 * There is deliberately no polling: /health is called once when the app loads,
 * and after that only when the user presses "Try again" on the maintenance
 * screen. Until a probe comes back 200-with-maintenance-off, every route in the
 * app stays locked (see MaintenanceGate).
 */
export function HealthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [isChecking, setIsChecking] = useState(true);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceEta, setMaintenanceEta] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const inFlightRef = useRef(false);
  const unmountedRef = useRef(false);

  const check = useCallback(async () => {
    if (inFlightRef.current) return; // ignore double-clicks on "Try again"
    inFlightRef.current = true;
    setIsChecking(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
        // Never let a cached 200 mask a dead backend.
        cache: "no-store",
      });

      // A 503 still carries a body: the process is up but a dependency isn't.
      const body = (await res.json().catch(() => ({}))) as HealthPayload;
      if (unmountedRef.current) return;

      setLastCheckedAt(new Date());

      if (!res.ok) {
        setStatus("offline");
        return;
      }

      setMaintenanceMessage(body.maintenanceMessage ?? "");
      setMaintenanceEta(body.maintenanceEta ?? null);
      setStatus(body.maintenanceMode ? "maintenance" : "online");
    } catch {
      // Network error, DNS failure, CORS rejection, or our own timeout — from
      // the browser's side these are indistinguishable from "server down".
      if (unmountedRef.current) return;
      setLastCheckedAt(new Date());
      setStatus("offline");
    } finally {
      clearTimeout(timeout);
      inFlightRef.current = false;
      if (!unmountedRef.current) setIsChecking(false);
    }
  }, []);

  // One probe on load. Nothing else schedules a check.
  useEffect(() => {
    unmountedRef.current = false;
    void check();
    return () => {
      unmountedRef.current = true;
    };
  }, [check]);

  const refresh = useCallback(() => {
    void check();
  }, [check]);

  const value = useMemo<HealthContextValue>(
    () => ({
      status,
      isDown: status === "offline" || status === "maintenance",
      isChecking,
      maintenanceMessage,
      maintenanceEta,
      lastCheckedAt,
      refresh,
    }),
    [status, isChecking, maintenanceMessage, maintenanceEta, lastCheckedAt, refresh],
  );

  return (
    <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}
