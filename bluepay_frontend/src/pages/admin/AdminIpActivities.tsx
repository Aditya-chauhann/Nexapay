import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Copy,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Activity,
  UserCheck,
  UserX,
  RefreshCw,
  MoreHorizontal,
  Ban,
  Unlock,
  Filter,
  X,
  ExternalLink,
  User as UserIcon,
} from "lucide-react";
import { formatIst } from "@/lib/format-date";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

interface IpActivityItem {
  id: string;
  userId: string | null;
  userSerialId: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userIsBlocked?: boolean;
  userBlockedReason?: string | null;
  userIsFrozen?: boolean;
  userFrozenReason?: string | null;
  actionType: string;
  ipAddress: string;
  isBlocked: boolean;
  blockedUntil: string | null;
  blockedReason: string | null;
  details: Record<string, string> | null;
  createdAt: string;
}

interface ActivityStats {
  totalBlockedIps: number;
  totalBlockedUsers: number;
  totalFrozenIps: number;
  totalLogs: number;
}

export default function AdminIpActivities() {
  const [activities, setActivities] = useState<IpActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ActivityStats>({
    totalBlockedIps: 0,
    totalBlockedUsers: 0,
    totalFrozenIps: 0,
    totalLogs: 0,
  });

  // Modal State for IP Block/Freeze
  const [ipModalOpen, setIpModalOpen] = useState(false);
  const [modalIp, setModalIp] = useState("");
  const [modalIsFreeze, setModalIsFreeze] = useState(false);
  const [ipBlockReason, setIpBlockReason] = useState("");

  // Modal State for IP Unblock
  const [unblockIpModalOpen, setUnblockIpModalOpen] = useState(false);
  const [unblockIpTarget, setUnblockIpTarget] = useState("");

  // Modal State for User Account Block/Unblock
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetUserName, setTargetUserName] = useState("");
  const [targetUserSerialId, setTargetUserSerialId] = useState("");
  const [isUserBlockAction, setIsUserBlockAction] = useState(true); // true = Block, false = Unblock
  const [userBlockReason, setUserBlockReason] = useState("");
  const [actionPending, setActionPending] = useState(false);

  // Filters
  const [actionType, setActionType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadActivities = useCallback(
    async (signal?: AbortSignal) => {
      const headers = authHeaders();
      if (!headers) return;

      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (actionType !== "all") {
          queryParams.append("actionType", actionType);
        }
        if (debouncedSearch.trim()) {
          queryParams.append("q", debouncedSearch.trim());
        }

        const res = await fetch(
          `${API_BASE}/admin/ip-activities?${queryParams.toString()}`,
          {
            headers,
            signal,
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to load activities (HTTP ${res.status})`);
        }

        const data = await res.json();
        setActivities(data.items ?? []);
        setTotal(data.total ?? 0);
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error(
          err instanceof Error ? err.message : "Failed to load activities",
        );
      } finally {
        setLoading(false);
      }
    },
    [page, limit, actionType, debouncedSearch],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void loadActivities(ctrl.signal);
    return () => ctrl.abort();
  }, [loadActivities]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Filter activities on client if statusFilter is active
  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "blocked_ip") return item.isBlocked;
      if (statusFilter === "frozen_ip") {
        return (
          item.isBlocked &&
          Boolean(
            item.blockedUntil &&
              new Date(item.blockedUntil).getTime() - Date.now() <
                30 * 24 * 60 * 60 * 1000,
          )
        );
      }
      if (statusFilter === "blocked_account") return Boolean(item.userIsBlocked);
      if (statusFilter === "active_only")
        return !item.isBlocked && !item.userIsBlocked;
      return true;
    });
  }, [activities, statusFilter]);

  const filtersActive =
    searchQuery.trim() !== "" ||
    actionType !== "all" ||
    statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setActionType("all");
    setStatusFilter("all");
    setPage(1);
  };

  // --- IP BLOCK / UNBLOCK HANDLERS ---
  const handleBlockIp = async (
    ip: string,
    reason: string,
    durationHours: number,
  ) => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/admin/ip-activities/block`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ip, reason, durationHours }),
      });
      if (!res.ok) throw new Error("Failed to block IP");
      toast.success(`IP ${ip} blocked successfully`);
      void loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block IP");
    }
  };

  const handleUnblockIp = async (ip: string) => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/admin/ip-activities/unblock`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) throw new Error("Failed to unblock IP");
      toast.success(`IP ${ip} unblocked successfully`);
      void loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unblock IP");
    }
  };

  const triggerBlockIpModal = (ip: string, isFreeze: boolean) => {
    setModalIp(ip);
    setModalIsFreeze(isFreeze);
    setIpBlockReason("");
    setIpModalOpen(true);
  };

  const handleIpModalSubmit = () => {
    if (!ipBlockReason.trim()) {
      toast.error("Please enter a reason");
      return;
    }
    const hours = modalIsFreeze ? 1 : 99 * 365 * 24;
    void handleBlockIp(modalIp, ipBlockReason.trim(), hours);
    setIpModalOpen(false);
  };

  const triggerUnblockIpModal = (ip: string) => {
    setUnblockIpTarget(ip);
    setUnblockIpModalOpen(true);
  };

  const handleUnblockIpSubmit = () => {
    void handleUnblockIp(unblockIpTarget);
    setUnblockIpModalOpen(false);
  };

  // --- USER ACCOUNT BLOCK / UNBLOCK HANDLERS ---
  const triggerUserAccountModal = (
    userId: string,
    name: string,
    serialId: string,
    isBlock: boolean,
  ) => {
    setTargetUserId(userId);
    setTargetUserName(name || "User");
    setTargetUserSerialId(serialId || userId.slice(-6).toUpperCase());
    setIsUserBlockAction(isBlock);
    setUserBlockReason("");
    setUserModalOpen(true);
  };

  const handleUserModalSubmit = async () => {
    if (!targetUserId) return;
    const headers = authHeaders();
    if (!headers) return;

    setActionPending(true);
    try {
      const endpoint = isUserBlockAction
        ? `${API_BASE}/admin/users/${encodeURIComponent(targetUserId)}/block`
        : `${API_BASE}/admin/users/${encodeURIComponent(targetUserId)}/unblock`;

      const body =
        isUserBlockAction && userBlockReason.trim()
          ? JSON.stringify({ reason: userBlockReason.trim() })
          : undefined;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Failed to update user status");
      }

      toast.success(
        isUserBlockAction
          ? `User ${targetUserSerialId} account blocked`
          : `User ${targetUserSerialId} account unblocked`,
      );
      setUserModalOpen(false);
      void loadActivities();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update user account",
      );
    } finally {
      setActionPending(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Render Action Icon & Badge
  const renderActionBadge = (action: string) => {
    switch (action) {
      case "login_success":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Login Success
          </span>
        );
      case "login_failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" /> Login Failed
          </span>
        );
      case "wrong_password":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <KeyRound className="h-3 w-3" /> Wrong Password
          </span>
        );
      case "wrong_captcha":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-400 border border-orange-500/20">
            <RefreshCw className="h-3 w-3" /> Wrong Captcha
          </span>
        );
      case "account_locked":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600/20 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/30">
            <Lock className="h-3 w-3" /> Account Locked
          </span>
        );
      case "deposit":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
            <ArrowDownCircle className="h-3 w-3" /> Deposit
          </span>
        );
      case "withdrawal":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">
            <ArrowUpCircle className="h-3 w-3" /> Withdrawal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border/40">
            <Activity className="h-3 w-3" /> {action}
          </span>
        );
    }
  };

  const ipExportColumns: CsvColumn<IpActivityItem>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "User ID", value: (a) => a.userSerialId || a.userId || "" },
    { header: "User Name", value: (a) => a.userName || "" },
    { header: "User Email", value: (a) => a.userEmail || "" },
    { header: "User Phone", value: (a) => a.userPhone || "" },
    {
      header: "Blocked Account",
      value: (a) =>
        a.userIsBlocked
          ? `Blocked (${a.userBlockedReason || "N/A"})`
          : a.userIsFrozen
          ? "Frozen"
          : "Active",
    },
    { header: "Action", value: (a) => a.actionType },
    { header: "IP Address", value: (a) => a.ipAddress },
    {
      header: "Blocked IP",
      value: (a) =>
        a.isBlocked
          ? a.blockedUntil
            ? "Frozen (1h)"
            : "Blocked (Permanent)"
          : "Active",
    },
    {
      header: "IP Frozen Until",
      value: (a) => (a.blockedUntil ? formatIst(a.blockedUntil) : ""),
    },
    { header: "IP Block Reason", value: (a) => a.blockedReason || "" },
    {
      header: "Date & Time",
      value: (a) => (a.createdAt ? formatIst(a.createdAt) : ""),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-primary" /> IP Activities Audit
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track user logins, password attempts, and transaction source IP
            addresses with instant block & freeze controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton
            filename="ip-activities"
            rows={filteredActivities}
            columns={ipExportColumns}
            disabled={loading}
          />
        </div>
      </div>

      {/* SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Logs */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
            statusFilter === "all"
              ? "border-primary/50 bg-primary/10 ring-2 ring-primary/30"
              : "border-border bg-card/40 hover:border-primary/40 hover:bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                Total IP Logs
                {statusFilter === "all" && (
                  <span className="text-[10px] text-primary font-bold">● Active</span>
                )}
              </p>
              <h3 className="text-xl font-bold text-foreground">
                {total.toLocaleString()}
              </h3>
            </div>
          </div>
        </button>

        {/* Blocked IPs */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === "blocked_ip" ? "all" : "blocked_ip"));
            setPage(1);
          }}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
            statusFilter === "blocked_ip"
              ? "border-rose-500/60 bg-rose-500/10 ring-2 ring-rose-500/30"
              : "border-border bg-card/40 hover:border-rose-500/40 hover:bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                statusFilter === "blocked_ip"
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}
            >
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                Blocked IPs
                {statusFilter === "blocked_ip" && (
                  <span className="text-[10px] text-rose-400 font-bold">● Active</span>
                )}
              </p>
              <h3 className="text-xl font-bold text-rose-400">
                {stats.totalBlockedIps.toLocaleString()}
              </h3>
            </div>
          </div>
        </button>

        {/* Blocked Accounts */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === "blocked_account" ? "all" : "blocked_account"));
            setPage(1);
          }}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
            statusFilter === "blocked_account"
              ? "border-red-500/60 bg-red-500/10 ring-2 ring-red-500/30"
              : "border-border bg-card/40 hover:border-red-500/40 hover:bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                statusFilter === "blocked_account"
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-red-600/10 text-red-400 border-red-500/20"
              }`}
            >
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                Blocked Accounts
                {statusFilter === "blocked_account" && (
                  <span className="text-[10px] text-red-400 font-bold">● Active</span>
                )}
              </p>
              <h3 className="text-xl font-bold text-red-400">
                {stats.totalBlockedUsers.toLocaleString()}
              </h3>
            </div>
          </div>
        </button>

        {/* Frozen IPs */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter((prev) => (prev === "frozen_ip" ? "all" : "frozen_ip"));
            setPage(1);
          }}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
            statusFilter === "frozen_ip"
              ? "border-amber-500/60 bg-amber-500/10 ring-2 ring-amber-500/30"
              : "border-border bg-card/40 hover:border-amber-500/40 hover:bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                statusFilter === "frozen_ip"
                  ? "bg-amber-500 text-black border-amber-500"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                Frozen IPs (1h)
                {statusFilter === "frozen_ip" && (
                  <span className="text-[10px] text-amber-400 font-bold">● Active</span>
                )}
              </p>
              <h3 className="text-xl font-bold text-amber-400">
                {stats.totalFrozenIps.toLocaleString()}
              </h3>
            </div>
          </div>
        </button>
      </div>

      {/* UNIFIED SHADCN FILTERS PANEL */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-border/60 bg-background/40 backdrop-blur space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Filter IP Activities
            </h3>
            {!loading && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/40 font-semibold">
                Showing {filteredActivities.length.toLocaleString()} of{" "}
                {total.toLocaleString()}
              </span>
            )}
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="h-3.5 w-3.5 text-rose-400" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              htmlFor="ipSearchInput"
            >
              Search Activity
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="ipSearchInput"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IP, Email, Name, TR ID..."
                className="w-full bg-secondary/70 border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/25 transition-all"
              />
            </div>
          </div>

          {/* Action Type Dropdown */}
          <div className="lg:col-span-3 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Action Type
            </label>
            <Select
              value={actionType}
              onValueChange={(val) => {
                setActionType(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-secondary/70 border-border/80 rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/25">
                <SelectValue placeholder="All Action Types" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur border-border/80 rounded-xl shadow-2xl">
                <SelectItem value="all" className="text-xs font-medium">
                  All Action Types
                </SelectItem>
                <SelectItem
                  value="login_success"
                  className="text-xs font-medium"
                >
                  Login Success
                </SelectItem>
                <SelectItem
                  value="login_failed"
                  className="text-xs font-medium"
                >
                  Login Failed
                </SelectItem>
                <SelectItem
                  value="wrong_password"
                  className="text-xs font-medium"
                >
                  Wrong Password
                </SelectItem>
                <SelectItem
                  value="wrong_captcha"
                  className="text-xs font-medium"
                >
                  Wrong Captcha
                </SelectItem>
                <SelectItem
                  value="account_locked"
                  className="text-xs font-medium"
                >
                  Account Locked
                </SelectItem>
                <SelectItem value="deposit" className="text-xs font-medium">
                  Deposits
                </SelectItem>
                <SelectItem value="withdrawal" className="text-xs font-medium">
                  Withdrawals
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Blocked Status Dropdown */}
          <div className="lg:col-span-3 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Block Status
            </label>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-secondary/70 border-border/80 rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/25">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur border-border/80 rounded-xl shadow-2xl">
                <SelectItem value="all" className="text-xs font-medium">
                  All Statuses
                </SelectItem>
                <SelectItem
                  value="blocked_ip"
                  className="text-xs font-medium text-rose-400"
                >
                  🚫 Blocked IPs Only
                </SelectItem>
                <SelectItem
                  value="blocked_account"
                  className="text-xs font-medium text-red-400"
                >
                  🔒 Blocked Accounts Only
                </SelectItem>
                <SelectItem
                  value="frozen_ip"
                  className="text-xs font-medium text-amber-400"
                >
                  ⏳ Frozen IPs (1h) Only
                </SelectItem>
                <SelectItem
                  value="active_only"
                  className="text-xs font-medium text-emerald-400"
                >
                  🟢 Active Only
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Page Size Selector */}
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Per Page
            </label>
            <Select
              value={limit.toString()}
              onValueChange={(val) => {
                setLimit(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-secondary/70 border-border/80 rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/25">
                <SelectValue placeholder="25 per page" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur border-border/80 rounded-xl shadow-2xl">
                <SelectItem value="10" className="text-xs font-medium">
                  10 per page
                </SelectItem>
                <SelectItem value="25" className="text-xs font-medium">
                  25 per page
                </SelectItem>
                <SelectItem value="50" className="text-xs font-medium">
                  50 per page
                </SelectItem>
                <SelectItem value="100" className="text-xs font-medium">
                  100 per page
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden rounded-2xl border border-border"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3.5 text-xs font-semibold text-muted-foreground w-[60px]">
                  S.No.
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground w-[150px]">
                  Action
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground w-[200px]">
                  IP Address & Block Status
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground w-[240px]">
                  User Profile & Account Status
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground">
                  Activity Details
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground w-[160px]">
                  Date & Time (IST)
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-muted-foreground w-[80px] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2.5 text-xs text-muted-foreground">
                      Loading IP activity logs...
                    </p>
                  </td>
                </tr>
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-muted-foreground"
                  >
                    No activity logs matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((item, idx) => {
                  const blockable = item.ipAddress !== "On-Chain";
                  const isIpFrozen =
                    item.isBlocked &&
                    Boolean(
                      item.blockedUntil &&
                        new Date(item.blockedUntil).getTime() - Date.now() <
                          30 * 24 * 60 * 60 * 1000,
                    );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-secondary/30 transition-colors"
                    >
                      {/* S.No */}
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground font-medium">
                        {(page - 1) * limit + idx + 1}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {renderActionBadge(item.actionType)}
                      </td>

                      {/* IP Address & Blocked IP Field */}
                      <td className="px-5 py-4 font-mono text-xs text-foreground font-semibold">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              item.ipAddress === "On-Chain"
                                ? "text-cyan-400 font-sans font-bold"
                                : ""
                            }
                          >
                            {item.ipAddress}
                          </span>
                          {blockable && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.ipAddress)}
                              className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                              title="Copy IP"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Blocked IP Indicator & Controls */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-sans font-normal">
                          {item.isBlocked ? (
                            isIpFrozen ? (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-400 font-semibold"
                                title={`Frozen until: ${
                                  item.blockedUntil
                                    ? formatIst(item.blockedUntil)
                                    : ""
                                }`}
                              >
                                <Lock className="h-2.5 w-2.5" /> Frozen IP (1h)
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-400 font-semibold"
                                title={item.blockedReason || "Blocked"}
                              >
                                <Ban className="h-2.5 w-2.5" /> Blocked IP
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 font-medium">
                              <ShieldCheck className="h-2.5 w-2.5" /> Active IP
                            </span>
                          )}

                          {blockable && (
                            item.isBlocked ? (
                              <button
                                type="button"
                                onClick={() =>
                                  triggerUnblockIpModal(item.ipAddress)
                                }
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold border border-emerald-500/25 transition-colors"
                              >
                                <Unlock className="h-2.5 w-2.5" /> Unblock IP
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  triggerBlockIpModal(item.ipAddress, false)
                                }
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium border border-rose-500/20 transition-colors"
                                title="Block IP permanently"
                              >
                                <Ban className="h-2.5 w-2.5" /> Block IP
                              </button>
                            )
                          )}
                        </div>

                        {item.isBlocked && item.blockedReason && (
                          <p
                            className="text-[10px] text-muted-foreground font-sans font-normal mt-1 truncate max-w-[190px]"
                            title={item.blockedReason}
                          >
                            Reason: {item.blockedReason}
                          </p>
                        )}
                      </td>

                      {/* User Profile & Blocked Account Field */}
                      <td className="px-5 py-4">
                        {item.userId ? (
                          <div className="flex flex-col gap-1">
                            <Link
                              to={`/admin/users/${item.userId}`}
                              className="group flex flex-col hover:underline"
                            >
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1 text-xs">
                                <UserCheck className="h-3.5 w-3.5 opacity-60 text-primary" />
                                {item.userName || "User"} (
                                {item.userSerialId ||
                                  item.userId.slice(-6).toUpperCase()}
                                )
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {item.userEmail || item.userPhone || "—"}
                              </span>
                            </Link>

                            {/* Blocked Account Indicator */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.userIsBlocked ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded bg-red-600/15 border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 font-semibold"
                                  title={
                                    item.userBlockedReason || "Account Blocked"
                                  }
                                >
                                  <UserX className="h-2.5 w-2.5" /> Blocked Account
                                </span>
                              ) : item.userIsFrozen ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-400 font-semibold">
                                  <Lock className="h-2.5 w-2.5" /> Frozen Account
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 font-medium">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Active Account
                                </span>
                              )}

                              {item.userIsBlocked ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerUserAccountModal(
                                      item.userId!,
                                      item.userName || "User",
                                      item.userSerialId || "",
                                      false,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold border border-emerald-500/25 transition-colors"
                                >
                                  <Unlock className="h-2.5 w-2.5" /> Unblock
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerUserAccountModal(
                                      item.userId!,
                                      item.userName || "User",
                                      item.userSerialId || "",
                                      true,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium border border-red-500/20 transition-colors"
                                >
                                  <Lock className="h-2.5 w-2.5" /> Block
                                </button>
                              )}
                            </div>
                          </div>
                        ) : item.userEmail || item.userPhone ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <UserIcon className="h-3 w-3 opacity-50" /> Guest /
                              Unregistered
                            </span>
                            {item.userEmail && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {item.userEmail}
                              </span>
                            )}
                            {item.userPhone && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {item.userPhone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">
                            Anonymous Request
                          </span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                        {item.details ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(item.details).map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded bg-secondary/80 border border-border/50 px-2 py-0.5 font-mono text-[10px]"
                              >
                                {k}:{" "}
                                <strong className="text-foreground">{v}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">
                            —
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {formatIst(item.createdAt)}
                      </td>

                      {/* Actions Dropdown */}
                      <td className="px-5 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors"
                              aria-label="More actions"
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-52 bg-background/95 backdrop-blur border border-border shadow-2xl rounded-xl p-1"
                          >
                            {/* IP Actions */}
                            {blockable && (
                              <>
                                {item.isBlocked ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      triggerUnblockIpModal(item.ipAddress)
                                    }
                                    className="text-emerald-400 focus:text-emerald-400 flex items-center gap-2 cursor-pointer text-xs"
                                  >
                                    <Unlock className="h-3.5 w-3.5" /> Unblock IP{" "}
                                    {item.ipAddress}
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        triggerBlockIpModal(
                                          item.ipAddress,
                                          false,
                                        )
                                      }
                                      className="text-rose-400 focus:text-rose-400 flex items-center gap-2 cursor-pointer text-xs"
                                    >
                                      <Ban className="h-3.5 w-3.5" /> Block IP
                                      (Permanent)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        triggerBlockIpModal(item.ipAddress, true)
                                      }
                                      className="text-amber-400 focus:text-amber-400 flex items-center gap-2 cursor-pointer text-xs"
                                    >
                                      <Lock className="h-3.5 w-3.5" /> Freeze IP
                                      (1 Hour)
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}

                            {/* User Account Actions */}
                            {item.userId && (
                              <>
                                {blockable && <DropdownMenuSeparator />}
                                {item.userIsBlocked ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      triggerUserAccountModal(
                                        item.userId!,
                                        item.userName || "User",
                                        item.userSerialId || "",
                                        false,
                                      )
                                    }
                                    className="text-emerald-400 focus:text-emerald-400 flex items-center gap-2 cursor-pointer text-xs"
                                  >
                                    <UserCheck className="h-3.5 w-3.5" /> Unblock
                                    User Account
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      triggerUserAccountModal(
                                        item.userId!,
                                        item.userName || "User",
                                        item.userSerialId || "",
                                        true,
                                      )
                                    }
                                    className="text-red-400 focus:text-red-400 flex items-center gap-2 cursor-pointer text-xs"
                                  >
                                    <UserX className="h-3.5 w-3.5" /> Block User
                                    Account
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem asChild>
                                   <Link
                                     to={`/admin/users/${item.userId}`}
                                     className="flex items-center gap-2 cursor-pointer text-xs text-foreground"
                                   >
                                    <ExternalLink className="h-3.5 w-3.5" /> View
                                    User Profile
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border bg-secondary/25 px-4 py-3">
            <div className="text-xs text-muted-foreground">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> (
              {total.toLocaleString()} records)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-background transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono font-semibold px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-background transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* MODAL: BLOCK / FREEZE IP */}
      <Dialog open={ipModalOpen} onOpenChange={setIpModalOpen}>
        <DialogContent className="sm:max-w-md border-border/80 bg-background text-foreground shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Ban
                className={
                  modalIsFreeze
                    ? "h-5 w-5 text-amber-500"
                    : "h-5 w-5 text-rose-500"
                }
              />
              {modalIsFreeze ? "Freeze IP Address" : "Block IP Address"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              You are about to{" "}
              {modalIsFreeze
                ? "freeze this IP for 1 hour"
                : "block this IP permanently (99 years)"}
              . This will prevent all login and transaction requests from{" "}
              <strong className="text-foreground">{modalIp}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <label className="text-xs font-semibold text-muted-foreground">
              Reason for Action
            </label>
            <input
              type="text"
              placeholder="e.g. Brute-forcing passwords, suspicious bot activity"
              value={ipBlockReason}
              onChange={(e) => setIpBlockReason(e.target.value)}
              className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIpModalOpen(false)}
              className="border-border hover:bg-secondary text-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleIpModalSubmit}
              className={
                modalIsFreeze
                  ? "bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded-xl shadow-md"
                  : "bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs rounded-xl shadow-md"
              }
            >
              {modalIsFreeze ? "Freeze IP (1 Hour)" : "Block IP (Permanent)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: UNBLOCK IP */}
      <Dialog open={unblockIpModalOpen} onOpenChange={setUnblockIpModalOpen}>
        <DialogContent className="sm:max-w-md border-border/80 bg-background text-foreground shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
              <Unlock className="h-5 w-5 text-emerald-400" /> Unblock IP Address
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to remove all blocks from IP{" "}
              <strong className="text-foreground">{unblockIpTarget}</strong>?
              Traffic from this IP will be allowed immediately.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex sm:justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnblockIpModalOpen(false)}
              className="border-border hover:bg-secondary text-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUnblockIpSubmit}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl shadow-md"
            >
              Confirm Unblock IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: USER ACCOUNT BLOCK / UNBLOCK */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="sm:max-w-md border-border/80 bg-background text-foreground shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {isUserBlockAction ? (
                <>
                  <UserX className="h-5 w-5 text-red-400" /> Block User Account
                </>
              ) : (
                <>
                  <UserCheck className="h-5 w-5 text-emerald-400" /> Unblock
                  User Account
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {isUserBlockAction ? (
                <>
                  You are about to block the account for{" "}
                  <strong className="text-foreground">{targetUserName}</strong> (
                  <code>{targetUserSerialId}</code>). The user will be logged
                  out and prevented from signing in or executing transactions.
                </>
              ) : (
                <>
                  Are you sure you want to unblock the account for{" "}
                  <strong className="text-foreground">{targetUserName}</strong> (
                  <code>{targetUserSerialId}</code>)? The user will regain full
                  platform access.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {isUserBlockAction && (
            <div className="space-y-2 py-4">
              <label className="text-xs font-semibold text-muted-foreground">
                Reason for Account Block
              </label>
              <input
                type="text"
                placeholder="e.g. Fraudulent behavior, repeated suspicious logins"
                value={userBlockReason}
                onChange={(e) => setUserBlockReason(e.target.value)}
                className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          <DialogFooter className="flex sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={actionPending}
              onClick={() => setUserModalOpen(false)}
              className="border-border hover:bg-secondary text-foreground text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={actionPending}
              onClick={handleUserModalSubmit}
              className={
                isUserBlockAction
                  ? "bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl shadow-md"
                  : "bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-xl shadow-md"
              }
            >
              {actionPending
                ? "Processing..."
                : isUserBlockAction
                ? "Confirm Block Account"
                : "Confirm Unblock Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
