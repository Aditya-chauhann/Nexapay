import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccessAdminPath,
  canUserAccessPath,
  defaultRedirectForUser,
  isAdminConsoleUser,
} from "@/lib/admin-access";

type RouteAudience = "user" | "admin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Audience for this subtree. 'user' = customer panel, 'admin' = admin console. */
  audience: RouteAudience;
}

function loginPathForAudience(audience: RouteAudience): string {
  return audience === "admin" ? "/core-control/signin" : "/auth/login";
}

export function ProtectedRoute({ children, audience }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={loginPathForAudience(audience)}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (audience === "admin") {
    if (!isAdminConsoleUser(user)) return <Navigate to="/user" replace />;
    return <>{children}</>;
  }

  // audience === 'user'
  if (isAdminConsoleUser(user)) return <Navigate to="/core-control/dashboard" replace />;
  return <>{children}</>;
}

/** Used inside admin layout to block paths the user lacks permission for. */
export function AdminPathGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || !user) return <>{children}</>;

  if (!canAccessAdminPath(user, location.pathname)) {
    return <Navigate to={defaultRedirectForUser(user)} replace />;
  }

  return <>{children}</>;
}
