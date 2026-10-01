import { Megaphone, X } from "lucide-react";
import { useState } from "react";

// Mock active announcements - in production these would come from the database
const activeAnnouncements: Array<{ id: number; title: string; message: string; type: "info" | "warning" | "critical" }> = [
  // { id: 1, title: "Scheduled Maintenance", message: "Platform will undergo maintenance on April 5, 2025 from 2:00 AM - 4:00 AM IST.", type: "warning" }, // hidden for now
  // { id: 2, title: "New Feature: Instant Withdrawals", message: "We've launched instant UPI withdrawals for verified users. Enjoy faster payouts!", type: "info" }, // hidden for now
];

const AnnouncementBanner = () => {
  const [dismissed, setDismissed] = useState<number[]>([]);

  const visible = activeAnnouncements.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            a.type === "warning"
              ? "bg-warning/10 border border-warning/20 text-warning"
              : a.type === "critical"
              ? "bg-destructive/10 border border-destructive/20 text-destructive"
              : "bg-primary/10 border border-primary/20 text-primary"
          }`}
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{a.title}:</span> {a.message}
          </span>
          <button
            type="button"
            onClick={() => setDismissed([...dismissed, a.id])}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
