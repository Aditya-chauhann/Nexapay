import { Wrench, Clock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useHealth } from "@/contexts/HealthContext";

/** "~2 hours" / "~35 min" — relative copy from the backend's ETA. */
function formatEta(iso: string | null): string | null {
  if (!iso) return null;
  const eta = new Date(iso);
  if (Number.isNaN(eta.getTime())) return null;
  const minutes = Math.round((eta.getTime() - Date.now()) / 60_000);
  if (minutes <= 0) return "any moment now";
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `~${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Shown in place of every route while the backend is unreachable or in
 * maintenance mode. Deliberately a dead end: no logo link, no Home, no Sign in.
 * The only control is "Try again", which re-probes /health — the single way
 * back into the app.
 */
const Maintenance = () => {
  const { maintenanceMessage, maintenanceEta, lastCheckedAt, isChecking, refresh } = useHealth();

  // A planned window and an unreachable backend look identical to the user:
  // both mean "the site isn't usable right now", so both show maintenance copy.
  const eta = formatEta(maintenanceEta);

  return (
    <div className="relative flex min-h-[100dvh] min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      {/* Ambient glow backdrop — matches the 404 page. */}
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
        {/* Brand lockup, not a link — there is nowhere to navigate to. */}
        <div className="mb-8 inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
            <img src="/favicon.png" alt="" className="h-full w-full scale-[4] object-contain" />
          </span>
          <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Nexa<span className="text-primary">Pay</span></span>
        </div>

        <div className="w-full px-6 py-10 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 glow-border">
            <Wrench className="h-8 w-8 text-primary" aria-hidden />
          </div>

          <h1 className="text-4xl font-extrabold leading-tight gradient-text sm:text-5xl lg:text-6xl">
            Under Maintenance
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground lg:text-base">
            {maintenanceMessage ||
              "We're performing scheduled maintenance to improve your experience. Please check back shortly."}
          </p>

          {/* Only shown when the backend actually published an estimate — an
              unplanned outage has no honest ETA to quote. */}
          {eta && (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                Estimated downtime:{" "}
                <span className="font-mono font-medium text-foreground">{eta}</span>
              </span>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={refresh}
              disabled={isChecking}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} aria-hidden />
              {isChecking ? "Checking…" : "Try again"}
            </button>
          </div>

          {lastCheckedAt && (
            <p className="mt-8 text-xs text-muted-foreground">
              Last checked at {lastCheckedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
      </motion.main>
    </div>
  );
};

export default Maintenance;
