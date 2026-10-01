import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogoutConfirmDialog } from "@/components/shared/LogoutConfirmDialog";
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Users,
  User,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { InactivityTimerBadge } from "../shared/InactivityTimerBadge";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/user" },
  { icon: ArrowDownToLine, label: "Deposit", path: "/user/deposit" },
  { icon: ArrowUpFromLine, label: "Withdraw", path: "/user/withdraw" },
  { icon: History, label: "Transactions", path: "/user/transactions" },
  // { icon: Users, label: "Referrals", path: "/user/referrals" }, // hidden for now
  { icon: User, label: "Profile", path: "/user/profile" },
  { icon: Users, label: "Distribution Portal", path: "/user/distribution" },
];

export interface UserSidebarPanelProps {
  /** Close mobile sheet after navigation */
  onNavigate?: () => void;
  className?: string;
}

export function UserSidebarPanel({ onNavigate, className }: UserSidebarPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    setLogoutOpen(false);
    logout();
    navigate("/auth/login", { replace: true });
    onNavigate?.();
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-sidebar", className)}>
      <div className="shrink-0 border-b border-sidebar-border p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">

        <Link to="/" className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition-opacity">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl flex items-center justify-center bg-white shadow-sm">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-white">
              Nexa<span className="text-blue-200">Pay</span>
            </h1>
            <p className="text-xs font-semibold text-blue-100/80">Off-Ramp Platform</p>
          </div>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => onNavigate?.()}
              className={cn(
                "sidebar-link touch-manipulation active:bg-secondary/80",
                isActive && "sidebar-link-active",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 px-2 py-2 sm:px-4 sm:py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name ?? "User"}</p>
            <p className="truncate text-xs font-medium text-blue-100">{user?.email ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="touch-manipulation text-blue-200 transition-colors hover:text-white"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <LogoutConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleLogout}
        description="You will securely sign out of your session."
      />
    </div>
  );
}

const UserSidebar = () => {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden h-[100dvh] w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
      aria-label="User navigation"
    >
      <UserSidebarPanel />
    </aside>
  );
};

export default UserSidebar;
