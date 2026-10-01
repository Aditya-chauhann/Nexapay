import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Compass, FileText, Home, LayoutDashboard, LifeBuoy, LogIn, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { defaultRedirectForUser } from "@/lib/admin-access";

const QUICK_LINKS = [
  { to: "/blog", label: "Blog", description: "Product updates and guides", icon: FileText },
  { to: "/terms", label: "Terms", description: "Terms of service", icon: LifeBuoy },
  { to: "/privacy-policy", label: "Privacy", description: "How we handle your data", icon: ShieldCheck },
] as const;

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const dashboardPath = user ? defaultRedirectForUser(user) : null;

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const goBack = () => {
    // history.length <= 1 means this was a direct hit (pasted/bookmarked URL) — nowhere to go back to.
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  };

  return (
    <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      {/* Ambient glow backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-12rem] right-[-6rem] h-[22rem] w-[22rem] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full text-center"
      >
        <Link to="/" className="mb-8 inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
            <img src="/favicon.png" alt="" className="h-full w-full scale-[4] object-contain" />
          </span>
          <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Nexa<span className="text-primary">Pay</span></span>
        </Link>

        <div className="w-full px-6 py-10 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 glow-border">
            <Compass className="h-8 w-8 text-primary" aria-hidden />
          </div>

          <p className="text-6xl font-extrabold leading-none gradient-text sm:text-7xl lg:text-8xl">404</p>
          <h1 className="mt-4 text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">This page doesn't exist</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground lg:text-base">
            The link may be broken, or the page may have been moved. Your account and funds are unaffected.
          </p>

          <div className="mx-auto mt-5 flex w-full max-w-xl items-center justify-center gap-2 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <code className="truncate font-mono text-xs text-muted-foreground" title={location.pathname}>
              {location.pathname}
            </code>
          </div>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Home className="h-4 w-4" aria-hidden /> Back to home page
            </Link>

            {dashboardPath ? (
              <Link
                to={dashboardPath}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden /> My dashboard
              </Link>
            ) : (
              <Link
                to="/auth/login"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <LogIn className="h-4 w-4" aria-hidden /> Sign in
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={goBack}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Go back to previous page
          </button>
        </div>

        <nav aria-label="Helpful links" className="mx-auto mt-4 grid w-full max-w-3xl gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
          {QUICK_LINKS.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="glass-card group flex items-center justify-center gap-3 p-3 text-center transition-colors hover:bg-secondary/60 sm:flex-col sm:gap-2 sm:p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground group-hover:text-primary">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </Link>
          ))}
        </nav>
      </motion.main>
    </div>
  );
};

export default NotFound;
