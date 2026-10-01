import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { LogoutConfirmDialog } from "@/components/shared/LogoutConfirmDialog";
import {
  LayoutDashboard,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  FileSpreadsheet,
  Settings,
  FileText,
  Shield,
  ShieldCheck,
  LogOut,
  Wallet,
  Bell,
  LifeBuoy,
  Tag as TagIcon,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAdminPath } from "@/lib/admin-access";
import type { AuthUser } from "@/lib/auth-types";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  /** True if this nav item is restricted to the SuperAdmin only. */
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: ArrowDownToLine, label: "Deposits", path: "/admin/deposits" },
  { icon: ArrowUpFromLine, label: "Withdrawals", path: "/admin/withdrawals" },
  { icon: Landmark, label: "Bank Activity", path: "/admin/bank-activity" },
  { icon: Share2, label: "Distribution", path: "/admin/distribution" },
  { icon: LifeBuoy, label: "Tickets", path: "/admin/tickets" },
  { icon: FileSpreadsheet, label: "Reports", path: "/admin/reports", superAdminOnly: true },
  { icon: Wallet, label: "Wallets", path: "/admin/wallets" },
  { icon: Bell, label: "Notification Centre", path: "/admin/announcements" },
  { icon: Shield, label: "ID Activities", path: "/admin/ip-activities" },
  { icon: ShieldCheck, label: "Roles", path: "/admin/roles", superAdminOnly: true },
  { icon: TagIcon, label: "Tags", path: "/admin/tags" },
  { icon: FileText, label: "Blog", path: "/admin/blogs", superAdminOnly: true },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
];

function sessionLabel(user: AuthUser): string {
  if (user.isSuperAdmin) return "Super Admin";
  if (user.type === "staff") return user.roleName || "Staff";
  return "User";
}

function sessionIdentifier(user: AuthUser): string {
  if (user.type === "staff") return user.username ?? user.fullName ?? "";
  return user.email ?? "admin";
}

export interface AdminSidebarPanelProps {
  /** Close mobile sheet after navigation */
  onNavigate?: () => void;
  className?: string;
}

export function AdminSidebarPanel({ onNavigate, className }: AdminSidebarPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const visibleNav = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => {
      if (item.superAdminOnly && !user.isSuperAdmin) return false;
      return canAccessAdminPath(user, item.path);
    });
  }, [user]);

  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    setLogoutOpen(false);
    logout();
    navigate("/auth/admin/login", { replace: true });
    onNavigate?.();
  };

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-[#0c101d] border-r border-slate-200/80 dark:border-slate-800/80 transition-colors",
        className
      )}
    >
      {/* Decorative ambient corner glow */}
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-blue-500/10 dark:bg-purple-600/20 blur-3xl" />

      {/* Brand Header */}
      <div className="shrink-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-6 border-b border-slate-100 dark:border-slate-800/60">
        <Link
          to="/admin"
          className="flex items-center gap-3 cursor-pointer group hover:opacity-95 transition-opacity"
        >
          <div className="h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/25 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              NexaPay
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 leading-tight">
              Admin Panel
            </p>
          </div>
        </Link>
      </div>

      {/* Nav List */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-3 py-4">
        {visibleNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 select-none",
                isActive
                  ? "bg-blue-600 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 text-white shadow-md shadow-blue-500/25 dark:shadow-indigo-500/35 font-bold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.05]"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-white" : "text-slate-400 dark:text-slate-400"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile */}
      <div className="shrink-0 relative z-10 border-t border-slate-100 dark:border-slate-800/80 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm">
              SA
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                {user ? sessionLabel(user) : "Super Admin"}
              </p>
              <p className="truncate text-[10px] font-medium text-slate-400">
                {user ? sessionIdentifier(user) : "admin"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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
        description="You will securely sign out of your admin session."
      />
    </div>
  );
}

const AdminSidebar = () => {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden h-[100dvh] w-64 flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0c101d] lg:flex"
      aria-label="Admin navigation"
    >
      <AdminSidebarPanel />
    </aside>
  );
};

export default AdminSidebar;
