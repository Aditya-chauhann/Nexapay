import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canUserAccessPath, defaultRedirectForUser, isAdminConsoleUser } from "@/lib/admin-access";

type GuestAudience = "user" | "admin";

interface GuestRouteProps {
  children: React.ReactNode;
  /** When set, signed-in users are redirected to the matching panel. */
  audience?: GuestAudience;
}

/** Redirect signed-in users away from login/register/forgot */
export function GuestRoute({ children, audience = "user" }: GuestRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      </div>
    );
  }

  if (user) {
    if (user.type === "staff" && user.mustChangePassword) {
      return <Navigate to="/core-control/dashboard" replace />;
    }

    const from = (location.state as { from?: string } | null)?.from;
    const defaultTarget =
      audience === "admin" || isAdminConsoleUser(user)
        ? "/core-control/dashboard"
        : defaultRedirectForUser(user);

    const target =
      from && from.startsWith("/") && canUserAccessPath(user, from) ? from : defaultTarget;
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
