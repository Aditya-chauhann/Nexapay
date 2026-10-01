import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Ban,
  Check,
  Clock,
  FileText,
  User as UserIcon,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TablePagination from "@/components/shared/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { formatIst } from "@/lib/format-date";
import {
  type TicketAssignmentStatus,
  type TicketResolutionStatus,
  type TicketTeam,
} from "@/lib/api-tickets";
import {
  type AdminDisputeFilters,
  type DisputeDirection,
  type DisputeReason,
  type WithdrawalDispute,
  approveDispute,
  assignDisputeToMe,
  declineDispute,
  listAdminDisputes,
  resolveDispute,
  transferDispute,
} from "@/lib/api-withdrawal-disputes";

const PAGE_LIMIT = 25;

type TeamFilter = "all" | TicketTeam;
type StatusFilter = "all" | TicketResolutionStatus;
type AssignmentFilter = "all" | TicketAssignmentStatus | "mine";

const TEAM_LABEL: Record<TicketTeam, string> = { support: "Support", tech: "Tech" };
const TEAM_BADGE: Record<TicketTeam, string> = {
  support: "bg-primary/15 text-primary",
  tech: "bg-warning/15 text-warning",
};
const RESOLUTION_BADGE: Record<TicketResolutionStatus, string> = {
  pending: "badge-pending",
  resolved: "badge-success",
};
const RESOLUTION_LABEL: Record<TicketResolutionStatus, string> = {
  pending: "Pending",
  resolved: "Resolved",
};
const REASON_LABEL: Record<DisputeReason, string> = {
  not_received: "Not received",
  wrong_amount: "Wrong amount",
  other: "Other",
};

const fmtInr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AdminDisputes = () => {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;

  const [disputes, setDisputes] = useState<WithdrawalDispute[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_LIMIT);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<
    null | "assign" | "transfer" | "resolve" | "approve" | "decline"
  >(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  // Super-admin approve inputs.
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState<DisputeDirection>("credit");

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");

  const refresh = useCallback(
    async (signal?: AbortSignal, pageArg = page) => {
      setLoading(true);
      try {
        const filters: AdminDisputeFilters = { page: pageArg, limit: pageSize };
        // Only super admin can filter by team; other staff are scoped server-side.
        if (isSuperAdmin && teamFilter !== "all") filters.team = teamFilter;
        if (statusFilter !== "all") filters.resolutionStatus = statusFilter;
        if (assignmentFilter === "unassigned") filters.assignmentStatus = "unassigned";
        else if (assignmentFilter === "assigned") filters.assignmentStatus = "assigned";
        else if (assignmentFilter === "mine" && user?.id) filters.assigneeId = user.id;
        const res = await listAdminDisputes(filters, signal);
        setDisputes(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load disputes");
      } finally {
        setLoading(false);
      }
    },
    [teamFilter, statusFilter, assignmentFilter, isSuperAdmin, user?.id, page, pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal, 1);
    return () => controller.abort();
    // filter changes trigger reload, pagination is manual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, statusFilter, assignmentFilter, isSuperAdmin, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const active = useMemo(
    () => (activeId ? disputes.find((d) => d.id === activeId) ?? null : null),
    [disputes, activeId],
  );

  // Reset the resolution drafts whenever a different dispute is opened.
  useEffect(() => {
    setResolutionNotes("");
    setAdjustmentAmount("");
    setAdjustmentDirection("credit");
  }, [activeId]);

  const replaceDispute = (updated: WithdrawalDispute) => {
    setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleAssignToMe = async (id: string) => {
    setActionInFlight("assign");
    try {
      const updated = await assignDisputeToMe(id);
      replaceDispute(updated);
      toast.success("Dispute assigned to you");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign");
    } finally {
      setActionInFlight(null);
    }
  };

  const handleTransfer = async (id: string, toTeam: TicketTeam) => {
    setActionInFlight("transfer");
    try {
      const updated = await transferDispute(id, toTeam);
      replaceDispute(updated);
      toast.success(`Transferred to ${TEAM_LABEL[toTeam]} team`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not transfer");
    } finally {
      setActionInFlight(null);
    }
  };

  const handleResolve = async (id: string) => {
    setActionInFlight("resolve");
    try {
      const updated = await resolveDispute(id, resolutionNotes.trim() || undefined);
      replaceDispute(updated);
      toast.success("Dispute resolved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve");
    } finally {
      setActionInFlight(null);
    }
  };

  const handleApprove = async (id: string) => {
    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive USDT amount");
      return;
    }
    setActionInFlight("approve");
    try {
      const updated = await approveDispute(id, {
        amountUsdt: amount,
        direction: adjustmentDirection,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });
      replaceDispute(updated);
      toast.success(
        `Dispute approved — ${adjustmentDirection === "credit" ? "credited" : "debited"} ${amount} USDT`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setActionInFlight(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionInFlight("decline");
    try {
      const updated = await declineDispute(id, resolutionNotes.trim() || undefined);
      replaceDispute(updated);
      toast.success("Dispute declined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline");
    } finally {
      setActionInFlight(null);
    }
  };

  const meIsAssignee = (d: WithdrawalDispute) => !!user?.id && d.assignee?.id === user.id;
  const canAct = (d: WithdrawalDispute) => isSuperAdmin || meIsAssignee(d);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        {isSuperAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Team</label>
            <div className="flex gap-1 rounded-lg bg-secondary p-1">
              {(["all", "support", "tech"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeamFilter(t)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    teamFilter === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</label>
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {(["all", "pending", "resolved"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Assignment
          </label>
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {(["all", "unassigned", "assigned", "mine"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAssignmentFilter(a)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  assignmentFilter === a
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden p-1 sm:p-0"
      >
        <div className="table-scroll sm:rounded-xl">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Issue</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">User</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Amount</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Team</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Assignee</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Status</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No disputes match the filters.
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setActiveId(d.id)}
                    className="table-row-hover cursor-pointer border-b border-border/50"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{REASON_LABEL[d.reason]}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        WD {d.withdrawalId.slice(-8).toUpperCase()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p className="font-medium">
                        {d.userName || (d.userId ? `User ${d.userId.slice(-6).toUpperCase()}` : "—")}
                      </p>
                      {d.userEmail && (
                        <p
                          className="text-[11px] text-muted-foreground truncate max-w-[200px]"
                          title={d.userEmail}
                        >
                          {d.userEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {d.amount != null ? (
                        <span className="font-mono">{fmtInr(d.amount)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {d.upiId && (
                        <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px]" title={d.upiId}>
                          {d.upiId}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TEAM_BADGE[d.team]}`}
                      >
                        {d.team === "support" ? (
                          <Users className="h-3 w-3" />
                        ) : (
                          <Wrench className="h-3 w-3" />
                        )}
                        {TEAM_LABEL[d.team]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {d.assignee ? (
                        <span className="text-foreground">{d.assignee.fullName}</span>
                      ) : (
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${RESOLUTION_BADGE[d.resolutionStatus]}`}
                      >
                        {RESOLUTION_LABEL[d.resolutionStatus]}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap"
                      title={d.createdAt}
                    >
                      {formatIst(d.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </motion.div>

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        setPage={(p) => void refresh(undefined, p)}
        nextPage={() => void refresh(undefined, Math.min(page + 1, totalPages))}
        prevPage={() => void refresh(undefined, Math.max(1, page - 1))}
        onPageSizeChange={setPageSize}
        label="disputes"
        id="disputesPageSize"
      />

      <Dialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) setActiveId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Dispute · {REASON_LABEL[active.reason]}</DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {active.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${TEAM_BADGE[active.team]}`}
                  >
                    {active.team === "support" ? (
                      <Users className="h-3 w-3" />
                    ) : (
                      <Wrench className="h-3 w-3" />
                    )}
                    {TEAM_LABEL[active.team]} team
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${RESOLUTION_BADGE[active.resolutionStatus]}`}
                  >
                    {RESOLUTION_LABEL[active.resolutionStatus]}
                  </span>
                  {active.assignee ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      <UserIcon className="h-3 w-3" /> {active.assignee.fullName}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                      Not assigned
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">From</p>
                  <p className="mt-1 text-sm font-medium">
                    {active.userName ||
                      (active.userId ? `User ${active.userId.slice(-6).toUpperCase()}` : "—")}
                  </p>
                  {active.userId && (
                    <Link
                      to={`/admin/users/${encodeURIComponent(active.userId)}`}
                      className="text-xs font-mono text-primary hover:underline"
                    >
                      {active.userEmail || `View user profile`}
                    </Link>
                  )}
                </div>

                {/* Withdrawal snapshot captured when the dispute was raised. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                    <p className="mt-1 font-mono text-sm">
                      {active.amount != null ? fmtInr(active.amount) : "—"}
                    </p>
                  </div>
                  {active.netInr != null && (
                    <div className="rounded-lg border border-border bg-secondary/20 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Net INR
                      </p>
                      <p className="mt-1 font-mono text-sm">{fmtInr(active.netInr)}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">UPI ID</p>
                    <p className="mt-1 font-mono text-sm break-all">{active.upiId || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">UTR</p>
                    <p className="mt-1 font-mono text-sm break-all">{active.utr || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={`/admin/withdrawals?id=${encodeURIComponent(active.withdrawalId)}`}
                    className="text-xs font-mono text-primary hover:underline"
                  >
                    View withdrawal {active.withdrawalId.slice(-8).toUpperCase()}
                  </Link>
                  {active.bankStatementUrl && (
                    <a
                      href={active.bankStatementUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-secondary/70"
                    >
                      <FileText className="h-3.5 w-3.5" /> Bank statement (PDF)
                    </a>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/20 p-3 text-sm">
                    {active.description}
                  </p>
                </div>

                {active.resolutionStatus === "resolved" && active.resolutionDecision && (
                  <div
                    className={`rounded-lg border p-3 ${
                      active.resolutionDecision === "approved"
                        ? "border-success/30 bg-success/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {active.resolutionDecision === "approved" ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Ban className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm font-semibold capitalize">
                        {active.resolutionDecision}
                      </span>
                    </div>
                    {active.resolutionAdjustmentUsd != null && active.resolutionAdjustmentUsd !== 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Balance adjustment:{" "}
                        <span
                          className={`font-mono font-medium ${
                            active.resolutionAdjustmentUsd > 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {active.resolutionAdjustmentUsd > 0 ? "+" : ""}
                          {active.resolutionAdjustmentUsd} USDT
                        </span>{" "}
                        ({active.resolutionAdjustmentUsd > 0 ? "credit" : "debit"})
                      </p>
                    )}
                  </div>
                )}

                {active.resolutionNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                      Resolution notes
                    </p>
                    <p className="whitespace-pre-wrap rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                      {active.resolutionNotes}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-border/60 bg-secondary/10 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Created</span>
                    <span className="font-mono ml-auto text-foreground">{formatIst(active.createdAt)}</span>
                  </div>
                  {active.assignedAt && active.assignee && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Assigned to {active.assignee.fullName}</span>
                      <span className="font-mono ml-auto text-foreground">
                        {formatIst(active.assignedAt)}
                      </span>
                    </div>
                  )}
                  {active.resolvedAt && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Resolved</span>
                      <span className="font-mono ml-auto text-foreground">
                        {formatIst(active.resolvedAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Optional resolution note, captured on close (non-super-admin flow). */}
                {active.resolutionStatus === "pending" &&
                  active.assignmentStatus === "assigned" &&
                  canAct(active) &&
                  !isSuperAdmin && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">
                        Resolution notes (optional)
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value.slice(0, 4000))}
                        rows={3}
                        placeholder="What was done to resolve this dispute?"
                        className="mt-1.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  )}

                {/* Super-admin resolution: approve (adjust balance) or decline. */}
                {isSuperAdmin && active.resolutionStatus === "pending" && (
                  <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Resolve dispute
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Adjustment (USDT)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(e.target.value)}
                          placeholder="0.00"
                          className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Direction
                        </label>
                        <div className="mt-1.5 flex gap-1 rounded-lg bg-secondary p-1">
                          {(["credit", "debit"] as const).map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              onClick={() => setAdjustmentDirection(dir)}
                              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                                adjustmentDirection === dir
                                  ? dir === "credit"
                                    ? "bg-success text-white"
                                    : "bg-destructive text-white"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {dir}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Credit adds to the user's balance, debit removes from it. Approving marks the
                      withdrawal <span className="font-medium">resolved</span>; declining sends it
                      back to <span className="font-medium">paid</span>.
                    </p>
                    <div>
                      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Resolution notes (optional)
                      </label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value.slice(0, 4000))}
                        rows={2}
                        placeholder="e.g. Payment not received, refunding"
                        className="mt-1.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(active.id)}
                        disabled={actionInFlight !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {actionInFlight === "approve" ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(active.id)}
                        disabled={actionInFlight !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                        {actionInFlight === "decline" ? "Declining…" : "Decline"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-start">
                {active.resolutionStatus === "pending" &&
                  active.assignmentStatus === "unassigned" && (
                    <button
                      type="button"
                      onClick={() => handleAssignToMe(active.id)}
                      disabled={actionInFlight !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <UserIcon className="h-4 w-4" />
                      {actionInFlight === "assign" ? "Assigning…" : "Assign to me"}
                    </button>
                  )}
                {active.resolutionStatus === "pending" &&
                  active.team === "support" &&
                  canAct(active) && (
                    <button
                      type="button"
                      onClick={() => handleTransfer(active.id, "tech")}
                      disabled={actionInFlight !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/70 disabled:opacity-50"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      {actionInFlight === "transfer" ? "Transferring…" : "Transfer to Tech"}
                    </button>
                  )}
                {active.resolutionStatus === "pending" &&
                  active.team === "tech" &&
                  canAct(active) && (
                    <button
                      type="button"
                      onClick={() => handleTransfer(active.id, "support")}
                      disabled={actionInFlight !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/70 disabled:opacity-50"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      {actionInFlight === "transfer" ? "Transferring…" : "Send back to Support"}
                    </button>
                  )}
                {active.resolutionStatus === "pending" &&
                  active.assignmentStatus === "assigned" &&
                  canAct(active) &&
                  !isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleResolve(active.id)}
                      disabled={actionInFlight !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      {actionInFlight === "resolve" ? "Resolving…" : "Resolve"}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/70"
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDisputes;
