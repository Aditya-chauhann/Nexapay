import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import UserSidebar, { UserSidebarPanel } from "./UserSidebar";
import AnnouncementBanner from "../shared/AnnouncementBanner";
import { NotificationBell } from "../shared/NotificationBell";
import { InactivityTimerBadge } from "../shared/InactivityTimerBadge";
import ThemeToggle from "../shared/ThemeToggle";
import { TwoFactorProvider } from "@/contexts/TwoFactorContext";

const UserLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <TwoFactorProvider>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <div className="flex min-h-[100dvh] min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background">
          <UserSidebar />
          <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
            <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="flex items-center gap-3">
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 touch-manipulation lg:hidden"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <Link to="/" className="flex min-w-0 items-center gap-2 hover:opacity-90 transition-opacity lg:hidden">
                  <div className="h-5 w-5 shrink-0 overflow-hidden flex items-center justify-center bg-transparent" aria-hidden>
                    <img src="/favicon.png" alt="NexoPay Logo" className="h-full w-full object-contain scale-[4]" />
                  </div>
                  <span className="truncate font-bold gradient-text">NexoPay</span>
                </Link>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <InactivityTimerBadge />
                <NotificationBell />
                <ThemeToggle />
              </div>
            </header>

            <main className="w-full min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <AnnouncementBanner />
              <Outlet />
            </main>
          </div>
        </div>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] border-sidebar-border bg-sidebar p-0 [&>button]:right-3 [&>button]:top-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <UserSidebarPanel onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </TwoFactorProvider>
  );
};

export default UserLayout;
