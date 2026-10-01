import { useHealth } from "@/contexts/HealthContext";
import Maintenance from "@/pages/Maintenance";

/**
 * Hard lockout. Until GET /health answers 200 with maintenance mode off, every
 * route renders the maintenance screen instead — the customer panel, the admin
 * console, auth, and anything typed straight into the address bar.
 *
 * There is intentionally no bypass list: an admin escape hatch would be the one
 * hole that makes "no one can reach any page" untrue. The trade-off is that
 * maintenance mode can only be lifted from the backend (PATCH
 * /admin/system-controls or the DB), never from this UI.
 *
 * The gate sits above <Routes>, so it wins before React Router matches a path.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { status, isDown } = useHealth();

  // Block the first paint too: until the initial probe resolves we don't know
  // whether the backend is up, and rendering the app optimistically would let
  // someone interact with a dashboard that is about to be locked.
  if (status === "checking") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-label="Checking service status"
          role="status"
        />
      </div>
    );
  }

  if (isDown) return <Maintenance />;

  return <>{children}</>;
}

export default MaintenanceGate;
