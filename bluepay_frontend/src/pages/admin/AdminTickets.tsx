import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { subDays, subMonths, subYears, startOfDay, endOfDay, format } from "date-fns";
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Filter,
  LifeBuoy,
  Plus,
  User as UserIcon,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
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
  type AdminTicketFilters,
  type Ticket,
  type TicketAssignmentStatus,
  type TicketResolutionStatus,
  type TicketTeam,
  assignTicketToMe,
  createAdminTicket,
  listAdminTickets,
  resolveTicket,
  transferTicket,
} from "@/lib/api-tickets";
import AdminDisputes from "./AdminDisputes";

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

const AdminTickets = () => {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;

  const [view, setView] = useState<"tickets" | "disputes">("tickets");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_LIMIT);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<null | "assign" | "transfer" | "resolve">(
    null,
  );

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "1d" | "3d" | "7d" | "1m" | "1y" | "custom" | "all">("all");
  const [customRange, setCustomRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (dateFilter !== "all") {
        let dateStart: Date | null = null;
        let dateEnd: Date = endOfDay(new Date());

        if (dateFilter === "today") dateStart = startOfDay(new Date());
        else if (dateFilter === "1d") dateStart = subDays(new Date(), 1);
        else if (dateFilter === "3d") dateStart = subDays(new Date(), 3);
        else if (dateFilter === "7d") dateStart = subDays(new Date(), 7);
        else if (dateFilter === "1m") dateStart = subMonths(new Date(), 1);
        else if (dateFilter === "1y") dateStart = subYears(new Date(), 1);
        else if (dateFilter === "custom") {
          if (customRange.start && customRange.end) {
            dateStart = startOfDay(customRange.start);
            dateEnd = endOfDay(customRange.end);
          }
        }

        if (dateStart !== null) {
          const dt = new Date(t.createdAt);
          if (Number.isNaN(dt.getTime()) || dt < dateStart || dt > dateEnd) return false;
        }
      }
      return true;
    });
  }, [tickets, dateFilter, customRange]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createTeam, setCreateTeam] = useState<TicketTeam>("support");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(
    async (signal?: AbortSignal, pageArg = page) => {
      setLoading(true);
      try {
        const filters: AdminTicketFilters = {
          page: pageArg,
          limit: pageSize,
        };
        // Only super admin can filter by team. Other staff are scoped by their role.team server-side.
        if (isSuperAdmin && teamFilter !== "all") filters.team = teamFilter;
        if (statusFilter !== "all") filters.resolutionStatus = statusFilter;
        if (assignmentFilter === "unassigned") filters.assignmentStatus = "unassigned";
        else if (assignmentFilter === "assigned") filters.assignmentStatus = "assigned";
        else if (assignmentFilter === "mine" && user?.id) filters.assigneeId = user.id;
        const res = await listAdminTickets(filters, signal);
        setTickets(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load tickets");
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
    // refresh isn't in the deps — filter changes trigger reload, pagination is manual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, statusFilter, assignmentFilter, isSuperAdmin, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const active = useMemo(
    () => (activeId ? tickets.find((t) => t.id === activeId) ?? null : null),
    [tickets, activeId],
  );

  const replaceTicket = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleAssignToMe = async (ticketId: string) => {
    setActionInFlight("assign");
    try {
      const updated = await assignTicketToMe(ticketId);
      replaceTicket(updated);
      toast.success("Ticket assigned to you");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign");
    } finally {
      setActionInFlight(null);
    }
  };

  const handleTransfer = async (ticketId: string, toTeam: TicketTeam) => {
    setActionInFlight("transfer");
    try {
      const updated = await transferTicket(ticketId, toTeam);
      replaceTicket(updated);
      toast.success(`Transferred to ${TEAM_LABEL[toTeam]} team`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not transfer");
    } finally {
      setActionInFlight(null);
    }
  };

  const resetCreateForm = () => {
    setCreateTitle("");
    setCreateDescription("");
    setCreateTeam("support");
  };

  const handleCreateTicket = async () => {
    const title = createTitle.trim();
    const description = createDescription.trim();
    if (title.length < 3 || title.length > 140) {
      toast.error("Title must be 3–140 characters");
      return;
    }
    if (description.length < 10 || description.length > 4000) {
      toast.error("Description must be 10–4000 characters");
      return;
    }
    setCreating(true);
    try {
      const created = await createAdminTicket({ title, description, team: createTeam });
      setTickets((prev) => [created, ...prev]);
      setTotal((prev) => prev + 1);
      toast.success("Ticket created");
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create ticket");
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    setActionInFlight("resolve");
    try {
      const updated = await resolveTicket(ticketId);
      replaceTicket(updated);
      toast.success("Ticket resolved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve");
    } finally {
      setActionInFlight(null);
    }
  };

  const meIsAssignee = (t: Ticket) => !!user?.id && t.assignee?.id === user.id;
  const canAct = (t: Ticket) => isSuperAdmin || meIsAssignee(t);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            {view === "disputes" ? "Withdrawal disputes" : "Tickets"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {view === "disputes"
              ? "Payout disputes raised by users. Claim with 'Assign to me', then resolve."
              : isSuperAdmin
              ? "Triage user-reported issues across both teams."
              : "Tickets assigned to your team. New ones come in unassigned — claim them with 'Assign to me'."}
          </p>
        </div>
        {view === "tickets" && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New ticket
          </button>
        )}
      </div>

      {/* Tickets and withdrawal disputes share the staff lifecycle but live in
          separate collections — toggle between the two queues. */}
      <div className="flex w-fit gap-1 rounded-lg bg-secondary p-1">
        {(["tickets", "disputes"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v === "disputes" ? "Disputes" : "Tickets"}
          </button>
        ))}
      </div>

      {view === "disputes" ? (
        <AdminDisputes />
      ) : (
        <>
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
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Range</label>
          <div className="flex items-center gap-2">
            <Select value={dateFilter} onValueChange={(val: any) => setDateFilter(val)}>
              <SelectTrigger className="w-[140px] h-[34px] bg-secondary border-border/80 text-foreground font-medium text-xs rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Time" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur border-border/80 rounded-xl shadow-2xl">
                <SelectItem value="today" className="text-xs font-medium">Today</SelectItem>
                <SelectItem value="1d" className="text-xs font-medium">Last 24 Hours</SelectItem>
                <SelectItem value="3d" className="text-xs font-medium">Last 3 Days</SelectItem>
                <SelectItem value="7d" className="text-xs font-medium">Last 7 Days</SelectItem>
                <SelectItem value="1m" className="text-xs font-medium">Last 1 Month</SelectItem>
                <SelectItem value="1y" className="text-xs font-medium">Last 1 Year</SelectItem>
                <SelectItem value="custom" className="text-xs font-medium">Custom Range</SelectItem>
                <SelectItem value="all" className="text-xs font-medium">All Time</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-[34px] text-xs border-border/80 bg-secondary justify-start text-left font-normal w-[110px]">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      {customRange.start ? format(customRange.start, "MMM dd, yyyy") : <span>Start</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={customRange.start}
                      onSelect={(date) => setCustomRange((prev) => ({ ...prev, start: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-[10px]">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-[34px] text-xs border-border/80 bg-secondary justify-start text-left font-normal w-[110px]">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      {customRange.end ? format(customRange.end, "MMM dd, yyyy") : <span>End</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={customRange.end}
                      onSelect={(date) => setCustomRange((prev) => ({ ...prev, end: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
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
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Title</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">User</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Team</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Assignee</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Status</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No tickets match the filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className="table-row-hover cursor-pointer border-b border-border/50"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium truncate max-w-[280px]" title={t.title}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {t.id.slice(-8).toUpperCase()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p className="font-medium">
                        {t.userName || (t.userId ? `User ${t.userId.slice(-6).toUpperCase()}` : "—")}
                      </p>
                      {t.userEmail && (
                        <p
                          className="text-[11px] text-muted-foreground truncate max-w-[200px]"
                          title={t.userEmail}
                        >
                          {t.userEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TEAM_BADGE[t.team]}`}
                      >
                        {t.team === "support" ? (
                          <Users className="h-3 w-3" />
                        ) : (
                          <Wrench className="h-3 w-3" />
                        )}
                        {TEAM_LABEL[t.team]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {t.assignee ? (
                        <span className="text-foreground">{t.assignee.fullName}</span>
                      ) : (
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${RESOLUTION_BADGE[t.resolutionStatus]}`}
                      >
                        {RESOLUTION_LABEL[t.resolutionStatus]}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap"
                      title={t.createdAt}
                    >
                      {formatIst(t.createdAt)}
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
        label="tickets"
        id="ticketsPageSize"
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (creating) return;
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise a ticket</DialogTitle>
            <DialogDescription>
              Use this when you need help from another team. The ticket will land in their queue
              unassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. My laptop won't connect to VPN"
                maxLength={140}
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {createTitle.trim().length}/140 — 3 characters minimum
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="What's the issue, what have you tried, anything we should know."
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {createDescription.trim().length}/4000 — 10 characters minimum
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Send to team</label>
              <div className="mt-1.5 flex gap-1 rounded-lg bg-secondary p-1">
                {(["support", "tech"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCreateTeam(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      createTeam === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "support" ? <Users className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                    {TEAM_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
              disabled={creating}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateTicket}
              disabled={creating}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Submitting…" : "Submit ticket"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <DialogTitle>{active.title}</DialogTitle>
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

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/20 p-3 text-sm">
                    {active.description}
                  </p>
                </div>

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
                  canAct(active) && (
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
        </>
      )}
    </div>
  );
};

export default AdminTickets;
