import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  type SmartWithdrawal,
  type SmartWithdrawalStatus,
  declineWithdrawal,
  listSmartWithdrawals,
} from "@/lib/api-withdrawals";

const STATUS_LABEL: Record<SmartWithdrawalStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
};

const STATUS_BADGE: Record<SmartWithdrawalStatus, string> = {
  awaiting_payment: "badge-pending",
  paid: "badge-success",
  failed: "badge-destructive",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mmSs(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Transactions → Smart tab: the user's smart UPI auto-liquidation payouts.
 * Rendered only when Smart UPI Selection is enabled. While a payout's decline
 * window is open, the user can decline it here; the paid-row dispute window is
 * handled app-wide by the withdrawal-dispute modal.
 */
export default function SmartWithdrawals({ search = "" }: { search?: string }) {
  const [rows, setRows] = useState<SmartWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      setRows(await listSmartWithdrawals(200, signal));
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Could not load smart transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const declineDeadline = (w: SmartWithdrawal) =>
    w.status === "awaiting_payment" && w.declineWindowExpiresAt
      ? Date.parse(w.declineWindowExpiresAt)
      : NaN;

  // Tick once a second only while some row still has an open decline window.
  const hasOpenWindow = rows.some((w) => {
    const t = declineDeadline(w);
    return Number.isFinite(t) && t > nowTick;
  });
  useEffect(() => {
    if (!hasOpenWindow) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasOpenWindow]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (w) =>
        w.id.toLowerCase().includes(q) ||
        (w.upiId?.toLowerCase().includes(q) ?? false) ||
        STATUS_LABEL[w.status].toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleDecline = async (id: string) => {
    setDecliningId(id);
    try {
      await declineWithdrawal(id);
      toast.success("Payout declined");
      setConfirmingId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline");
    } finally {
      setDecliningId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card overflow-hidden p-1 sm:p-0"
    >
      <div className="table-scroll sm:rounded-xl">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">ID</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Amount</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">INR Paid</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">UPI ID</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Status</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Action</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No smart UPI payouts yet.
                </td>
              </tr>
            ) : (
              filtered.map((w) => {
                const deadline = declineDeadline(w);
                const secondsLeft = Number.isFinite(deadline)
                  ? Math.max(0, Math.ceil((deadline - nowTick) / 1000))
                  : 0;
                const canDecline = secondsLeft > 0;
                return (
                  <tr key={w.id} className="table-row-hover border-b border-border/50">
                    <td className="px-6 py-4 text-sm font-mono">{w.id.slice(0, 10)}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {w.amount != null ? `${w.amount} USDT` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {w.netInr != null ? `₹${w.netInr.toLocaleString("en-IN")}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">{w.upiId || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[w.status]}`}
                        >
                          {STATUS_LABEL[w.status]}
                        </span>
                        {w.overpaidBy != null && w.overpaidBy > 0 && (
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30"
                            title={
                              w.screenshotAmountInr != null
                                ? `Payer sent ₹${w.screenshotAmountInr.toLocaleString("en-IN")} vs ₹${(w.netInr ?? 0).toLocaleString("en-IN")} expected`
                                : "Payer sent more than the announced amount"
                            }
                          >
                            ⚠️ Overpaid +₹{w.overpaidBy.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canDecline ? (
                        confirmingId === w.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDecline(w.id)}
                              disabled={decliningId === w.id}
                              className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {decliningId === w.id ? "Declining…" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              disabled={decliningId === w.id}
                              className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/70 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmingId(w.id)}
                              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                            >
                              Decline
                            </button>
                            <span
                              className="font-mono text-xs text-muted-foreground"
                              title="Time left to decline"
                            >
                              {mmSs(secondsLeft)}
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(w.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
