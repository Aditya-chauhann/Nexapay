import { useAuth } from "@/contexts/AuthContext";
import { Clock } from "lucide-react";

export function InactivityTimerBadge() {
  const { inactivitySeconds } = useAuth();

  if (inactivitySeconds === null || inactivitySeconds === undefined) return null;

  const minutes = Math.floor(inactivitySeconds / 60);
  const seconds = inactivitySeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isWarning = inactivitySeconds <= 60;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors shadow-sm ${
        isWarning
          ? "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse"
          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
      }`}
      title="Inactivity Countdown to Session Expiration (Resets on Click/Key/Scroll)"
    >
      <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      <span>Idle Exp: {formatted}</span>
    </div>
  );
}
