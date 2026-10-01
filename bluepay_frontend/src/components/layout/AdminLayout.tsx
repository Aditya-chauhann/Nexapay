import { useState, useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { Menu, Search, Calendar, Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AdminPathGuard } from "@/components/auth/ProtectedRoute";
import { MandatoryChangePasswordModal } from "@/components/auth/MandatoryChangePasswordModal";
import { SuperAdminPinGate } from "@/components/auth/SuperAdminPinGate";
import AdminSidebar, { AdminSidebarPanel } from "./AdminSidebar";
import ThemeToggle from "../shared/ThemeToggle";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { TwoFactorProvider } from "@/contexts/TwoFactorContext";
import { format } from "date-fns";

const AdminLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <TwoFactorProvider>
      <MandatoryChangePasswordModal />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <div className="flex min-h-[100dvh] min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50/70 dark:bg-[#080c16] text-slate-900 dark:text-slate-100 transition-colors">
          <AdminSidebar />
          <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
            {/* Top Navbar */}
            <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0c101d]/85 px-4 sm:px-6 lg:px-8 backdrop-blur-md pt-[max(0.25rem,env(safe-area-inset-top))]">
              {/* Left Search Bar & Mobile Trigger */}
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 touch-manipulation lg:hidden h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800"
                    aria-label="Open admin navigation menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>

                <div className="relative w-full hidden sm:block">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users, transactions, tickets..."
                    className="w-full h-9 pl-9 pr-14 rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 px-1.5 py-0.5 rounded shadow-2xs">
                    Ctrl K
                  </span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 ml-auto">
                {/* System Online Badge */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold select-none">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>System Online</span>
                </div>

                {/* Date & Time */}
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70 text-slate-600 dark:text-slate-300 text-xs font-medium select-none">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{format(currentTime, "MMM dd, yyyy • hh:mm a")}</span>
                </div>

                {/* Notification Bell */}
                <NotificationBell />

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Profile Avatar */}
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm select-none">
                  SA
                </div>
              </div>
            </header>

            {/* Main Page Content */}
            <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <AdminPathGuard>
                <Outlet />
              </AdminPathGuard>
            </main>
          </div>
        </div>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101d] p-0 [&>button]:right-3 [&>button]:top-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <AdminSidebarPanel onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </TwoFactorProvider>
  );
};

/**
 * Super admins hit the PIN gate before any of this mounts.
 */
const GatedAdminLayout = () => (
  <SuperAdminPinGate>
    <AdminLayout />
  </SuperAdminPinGate>
);

export default GatedAdminLayout;
