import { Search, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import ExportButton from "@/components/shared/ExportButton";
import { TronLink } from "@/components/shared/TronLink";
import type { CsvColumn } from "@/lib/export-csv";
import { useAuth } from "@/contexts/AuthContext";
import { getSmartUpiSelection } from "@/lib/api-upi";
import SmartWithdrawals from "@/components/user/SmartWithdrawals";
import { useWithdrawalDispute } from "@/contexts/WithdrawalDisputeContext";

interface UnifiedTransaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  currency: string;
  status: string;
  inrAmount: number | null;
  walletAddress: string | null;
  transactionId: string | null;
  txHash: string | null;
  utr?: string | null;
  disputeWindowExpiresAt?: string | null;
  userConfirmedAt?: string | null;
  destination: Record<string, unknown> | null;
  timestamp: string | null;
  createdAt: string;
  userId?: string | null;
  remark?: string;
  decisionReason?: string | null;
  disputeRaised?: boolean;
  secondDisputeAttempted?: boolean;
  disputeDetails?: {
    id?: string;
    reason?: string;
    description?: string | null;
    resolutionStatus?: string;
    resolutionDecision?: string | null;
    resolutionNotes?: string | null;
    resolvedAt?: string | null;
  } | null;
}

type FilterValue = "All" | "Deposit" | "Withdrawal" | "Smart";
type StatusFilter = "all" | "completed" | "pending" | "failed";
type TimeFilter = "all" | "24h" | "7d" | "30d";

function statusGroup(status: string): "completed" | "pending" | "failed" {
  const s = status.toLowerCase();
  if (["completed", "confirmed", "credited", "success", "paid", "resolved"].includes(s))
    return "completed";
  if (["processing", "pending", "awaiting_payment", "reserved"].includes(s)) return "pending";
  return "failed";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (["completed", "confirmed", "credited", "success", "paid", "resolved"].includes(s))
    return "badge-success";
  if (["processing", "pending", "awaiting_payment", "reserved"].includes(s)) return "badge-pending";
  return "badge-destructive";
}

function statusLabel(txn: { status: string }) {
  const s = txn.status.toLowerCase();
  if (s === "pending") return "Pending";
  if (s === "processing") return "Processing";
  if (s === "awaiting_payment") return "Awaiting Payment";
  if (s === "reserved") return "On Hold";
  if (s === "paid") return "Paid";
  if (s === "failed") return "Failed";
  if (s === "resolved") return "Resolved";
  return txn.status;
}

function getCleanAdminRemark(txn: UnifiedTransaction): string | null {
  const raw =
    txn.disputeDetails?.resolutionNotes ||
    txn.decisionReason ||
    txn.remark;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().includes("smart auto-liquidation")) {
    return null;
  }
  return trimmed;
}

const UserTransactions = () => {
  const { user } = useAuth();
  const { openDisputeModal, getPendingDispute } = useWithdrawalDispute();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterValue>("All");
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [smartEnabled, setSmartEnabled] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Synchronize state with URL parameters
  useEffect(() => {
    const typeParam = searchParams.get("type");
    const statusParam = searchParams.get("status");
    const timeParam = searchParams.get("time");
    const searchParam = searchParams.get("search");

    if (typeParam) {
      const lower = typeParam.toLowerCase();
      if (lower === "deposit") setFilter("Deposit");
      else if (lower === "withdrawal") setFilter("Withdrawal");
      else if (lower === "smart") setFilter("Smart");
      else if (lower === "all") setFilter("All");
    }

    if (statusParam) {
      const s = statusParam.toLowerCase();
      if (["all", "completed", "pending", "failed"].includes(s)) {
        setStatusFilter(s as StatusFilter);
      }
    }

    if (timeParam) {
      const t = timeParam.toLowerCase();
      if (t === "today" || t === "1d" || t === "24h") {
        setTimeFilter("24h");
      } else if (t === "3d" || t === "7d") {
        setTimeFilter("7d");
      } else if (t === "1m" || t === "30d") {
        setTimeFilter("30d");
      } else if (t === "all" || t === "1y") {
        setTimeFilter("all");
      }
    }

    if (searchParam) {
      setSearch(searchParam);
    }
  }, [searchParams]);

  // Tick every second to drive active row dispute timers
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Listen for custom dispute event to instantly remove active timer for second dispute attempt
  useEffect(() => {
    const handleDisputed = (e: Event) => {
      const customEv = e as CustomEvent<{ withdrawalId?: string }>;
      const targetId = customEv.detail?.withdrawalId;
      if (targetId) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === targetId
              ? {
                  ...t,
                  secondDisputeAttempted: true,
                }
              : t
          )
        );
      }
    };
    window.addEventListener("withdrawal:disputed", handleDisputed);
    return () => window.removeEventListener("withdrawal:disputed", handleDisputed);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getSmartUpiSelection(controller.signal)
      .then(setSmartEnabled)
      .catch(() => setSmartEnabled(false));
    return () => controller.abort();
  }, []);

  // If the toggle is off (or turns off), never leave the user stuck on Smart.
  useEffect(() => {
    if (!smartEnabled && filter === "Smart") setFilter("All");
  }, [smartEnabled, filter]);

  const fetchTransactions = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/user/transactions?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.message ?? "Could not load transactions");
        return;
      }
      setTransactions(Array.isArray(body) ? (body as UnifiedTransaction[]) : []);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/user/transactions?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(body?.message ?? "Could not load transactions");
          return;
        }
        setTransactions(Array.isArray(body) ? (body as UnifiedTransaction[]) : []);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    };
    load();

    const handleRefetch = () => {
      load();
    };

    window.addEventListener("withdrawal:disputed", handleRefetch);
    window.addEventListener("withdrawal:confirmed", handleRefetch);

    return () => {
      controller.abort();
      window.removeEventListener("withdrawal:disputed", handleRefetch);
      window.removeEventListener("withdrawal:confirmed", handleRefetch);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minAmount === "" ? null : parseFloat(minAmount);
    const max = maxAmount === "" ? null : parseFloat(maxAmount);
    const now = Date.now();
    const cutoff =
      timeFilter === "24h" ? now - 24 * 60 * 60 * 1000
      : timeFilter === "7d" ? now - 7 * 24 * 60 * 60 * 1000
      : timeFilter === "30d" ? now - 30 * 24 * 60 * 60 * 1000
      : null;
    const myId = user?.id ?? null;
    return transactions.filter((t) => {
      if (myId && t.userId && t.userId !== myId) return false;
      if (filter === "Deposit" && t.type !== "deposit") return false;
      if (filter === "Withdrawal" && t.type !== "withdrawal") return false;
      if (statusFilter !== "all" && statusGroup(t.status) !== statusFilter) return false;
      if (min != null && Number.isFinite(min) && t.amount < min) return false;
      if (max != null && Number.isFinite(max) && t.amount > max) return false;
      if (cutoff != null) {
        const ts = new Date(t.createdAt).getTime();
        if (Number.isNaN(ts) || ts < cutoff) return false;
      }
      if (q !== "") {
        const matches =
          t.id.toLowerCase().includes(q) ||
          (t.transactionId?.toLowerCase().includes(q) ?? false) ||
          (t.txHash?.toLowerCase().includes(q) ?? false) ||
          (t.utr?.toLowerCase().includes(q) ?? false) ||
          t.type.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime());
  }, [transactions, filter, search, minAmount, maxAmount, statusFilter, timeFilter, user?.id]);

  const transactionExportColumns: CsvColumn<UnifiedTransaction>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "Transaction ID", value: (t) => t.transactionId ?? t.id },
    { header: "Type", value: (t) => t.type },
    { header: "Amount (USDT)", value: (t) => Number(t.amount).toFixed(2) },
    { header: "Currency", value: (t) => t.currency },
    { header: "Net INR", value: (t) => (t.inrAmount != null ? Number(t.inrAmount).toFixed(2) : "") },
    { header: "Status", value: (t) => t.status },
    { header: "Date & Time", value: (t) => t.createdAt },
    { header: "Tx Hash / UTR", value: (t) => t.utr ? `UTR: ${t.utr}` : (t.txHash ?? "") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Transactions</h1>
          <p className="mt-1 text-muted-foreground">Complete history of all your transactions</p>
        </div>
        {filter !== "Smart" && (
          <ExportButton
            filename="transactions"
            rows={filtered}
            columns={transactionExportColumns}
            disabled={loading}
            label="Export"
          />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-full flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="table-scroll flex gap-1 rounded-lg bg-secondary p-1 sm:shrink-0">
            {(["All", "Deposit", "Withdrawal", ...(smartEnabled ? ["Smart"] : [])] as FilterValue[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors sm:py-1.5 ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {filter !== "Smart" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            inputMode="decimal"
            value={minAmount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) setMinAmount(v);
            }}
            placeholder="Min amount"
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="text"
            inputMode="decimal"
            value={maxAmount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) setMaxAmount(v);
            }}
            placeholder="Max amount"
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        )}
      </div>

      {filter === "Smart" ? (
        <SmartWithdrawals search={search} />
      ) : (
      /* Table */
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden p-1 sm:p-0">
        <div className="table-scroll sm:rounded-xl">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">ID</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Type</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Amount</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">INR Value</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Status</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Tx Hash</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Date</th>
              <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Remark</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No transactions found
                </td>
              </tr>
            ) : (
              filtered.map((txn) => {
                const idDisplay = (txn.transactionId ?? txn.txHash ?? txn.id).slice(0, 10);
                const inrDisplay = txn.inrAmount != null
                  ? `₹${txn.inrAmount.toLocaleString("en-IN")}`
                  : "-";

                // Check active dispute window
                const hasPastDispute = Boolean(txn.disputeRaised && txn.secondDisputeAttempted);
                const pendingDisp = getPendingDispute(txn.id);
                const expiresMs = txn.disputeWindowExpiresAt ? Date.parse(txn.disputeWindowExpiresAt) : 0;
                const activeExpires = pendingDisp?.expiresAt || expiresMs;
                const isWindowActive = Boolean(activeExpires && activeExpires > nowTick);

                const isDisputeResolved =
                  txn.status.toLowerCase() === "resolved" ||
                  txn.disputeDetails?.resolutionStatus?.toLowerCase() === "resolved" ||
                  Boolean(txn.disputeDetails?.resolvedAt);

                const isTimerActive =
                  isWindowActive &&
                  !txn.userConfirmedAt &&
                  !txn.disputeRaised &&
                  !txn.secondDisputeAttempted;

                const secondsLeft = isTimerActive ? Math.max(0, Math.ceil((activeExpires - nowTick) / 1000)) : 0;
                const mmSs = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
                
                const showActionButton =
                  isTimerActive &&
                  !txn.userConfirmedAt &&
                  !txn.disputeRaised;

                return (
                  <tr key={txn.id} className="table-row-hover border-b border-border/50">
                    <td className="px-6 py-4 text-sm font-mono">{idDisplay}</td>
                    <td className="px-6 py-4 text-sm capitalize">{txn.type}</td>
                    <td className="px-6 py-4 text-sm font-medium">{txn.amount} {txn.currency}</td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{inrDisplay}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusBadgeClass(txn.status)}`}>
                          {statusLabel(txn)}
                        </span>
                        {txn.utr && (
                          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap" title={`UTR ${txn.utr}`}>
                            UTR · {txn.utr}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-primary">
                      {txn.txHash ? (
                        <TronLink type="transaction" value={txn.txHash} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(txn.createdAt)}</td>
                    <td className="px-6 py-4 text-sm">
                      {(() => {
                        const statusLower = txn.status.toLowerCase();
                        const isPending = ["pending", "processing", "awaiting_payment", "reserved"].includes(statusLower);
                        if (isPending) {
                          return <span className="text-muted-foreground">—</span>;
                        }

                        const adminRemark = getCleanAdminRemark(txn);
                        if (isDisputeResolved) {
                          const rawAdmin = (txn.disputeDetails?.resolvedBy || "").trim();
                          const adminName =
                            rawAdmin && rawAdmin.toLowerCase() !== "admin"
                              ? rawAdmin
                              : null;
                          const note =
                            txn.disputeDetails?.resolutionNotes ||
                            txn.decisionReason ||
                            adminRemark;
                          const isGenericNote =
                            !note ||
                            note.toLowerCase() === "payment verified and completed by admin." ||
                            note.toLowerCase() === "dispute reviewed and resolved by admin.";
                          const byPart = adminName ? `Resolved by ${adminName}` : "Resolved by Admin";
                          const notePart = !isGenericNote ? ` (${note})` : "";
                          const labelText = `${byPart}${notePart}`;
                          const hoverTooltip = note ? `Admin note: ${note}` : labelText;
                          return (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400" title={hoverTooltip}>
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>{labelText}</span>
                            </div>
                          );
                        }
                        if (showActionButton) {
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                openDisputeModal(txn.id, {
                                  withdrawalId: txn.id,
                                  amount: txn.amount,
                                  netInr: txn.inrAmount,
                                  utr: txn.utr,
                                  expiresAt: activeExpires,
                                  hasPastDispute,
                                })
                              }
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors shadow-sm"
                            >
                              {isTimerActive && (
                                <>
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span className="font-mono min-w-[36px] text-center">{mmSs}</span>
                                </>
                              )}
                              <span className="underline">Confirm / Dispute</span>
                            </button>
                          );
                        }
                        if (txn.userConfirmedAt) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium whitespace-nowrap">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Confirmed
                            </span>
                          );
                        }
                        if (txn.disputeRaised) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium whitespace-nowrap" title={txn.disputeDetails?.description || "Dispute under review"}>
                              <Clock className="h-3.5 w-3.5 shrink-0" /> Under process
                            </span>
                          );
                        }
                        if (adminRemark) {
                          const isSuccess = ["paid", "completed", "resolved"].includes(statusLower);
                          return (
                            <div className="flex items-center gap-1.5 text-xs font-medium" title={adminRemark}>
                              {isSuccess ? (
                                <span className="text-emerald-400 inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  {adminRemark}
                                </span>
                              ) : (
                                <span className="text-red-400 inline-flex items-center gap-1">
                                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                  Failed by Admin ({adminRemark})
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (statusLower === "failed") {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium whitespace-nowrap">
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Failed by Admin
                            </span>
                          );
                        }
                        return <span className="text-muted-foreground">—</span>;
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>

      </motion.div>
      )}
    </div>
  );
};

export default UserTransactions;
