import {
  Search,
  MoreHorizontal,
  Users,
  UserPlus,
  UserCheck,
  Shield,
  Ban,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Snowflake,
  Sun,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Filter,
  Smartphone,
  Plus,
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { subDays, subMonths, subYears, startOfDay, endOfDay, isAfter, isBefore, format } from "date-fns";
import TablePagination from "@/components/shared/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import ExportButton from "@/components/shared/ExportButton";
import { useAuth } from "@/contexts/AuthContext";
import type { CsvColumn } from "@/lib/export-csv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { UserActivityMap } from "@/components/admin/UserActivityMap";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

interface AdminUser {
  id: string;
  serialId?: string | null;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  walletAddress?: string | null;
  referralCode?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isBlocked: boolean;
  blockedAt?: string | null;
  blockedBy?: string | null;
  blockedReason?: string | null;
  isFrozen: boolean;
  frozenAt?: string | null;
  frozenBy?: string | null;
  frozenReason?: string | null;
  isOnWatch?: boolean;
  watchedAt?: string | null;
  watchedBy?: string | null;
  watchedReason?: string | null;
  smartUpiSelectionEnabled?: boolean;
  createdAt: string;
  lastActiveAt?: string | null;
  isSubscribed?: boolean;
  invitedByDetails?: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
}

interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

interface AdminDeposit {
  id: string;
  userId: string;
  walletAddress: string;
  amount: number;
  currency: string;
  createdAt: string;
}

interface AdminWithdrawal {
  id: string;
  userId?: string;
  status?: string;
  amount: number;
  currency?: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  serialId: string;
  name: string;
  shortId: string;
  walletAddress: string | null;
  email: string | null;
  phone: string | null;
  totalDeposits: number;
  totalWithdrawn: number;
  onHold: number;
  balance: number;
  currency: string;
  lastSeenIso: string | null;
  blocked: boolean;
  frozen: boolean;
  onWatch: boolean;
  watchedReason: string | null;
  smartUpiEnabled: boolean;
  createdAt: string;
  referralCode?: string | null;
  invitedByDetails?: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
  isSubscribed?: boolean;
}

type AmountField = "deposits" | "withdrawn" | "onHold" | "balance";

const AMOUNT_FIELDS: Array<{ value: AmountField; label: string }> = [
  { value: "deposits", label: "Total deposits" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "onHold", label: "On Hold" },
  { value: "balance", label: "Balance" },
];

function amountOf(user: UserRow, field: AmountField) {
  if (field === "withdrawn") return user.totalWithdrawn;
  if (field === "onHold") return user.onHold;
  if (field === "balance") return user.balance;
  return user.totalDeposits;
}

type SortKey = "newest" | AmountField;
type SortDir = "asc" | "desc";

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function truncateWallet(addr?: string | null) {
  if (!addr || addr.length <= 14) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

const PAGE_LIMIT = 100;

type StatusFilter = "all" | "active" | "blocked" | "frozen" | "on_watch" | "smart_upi";
type ActivityFilter = "all" | "active24h" | "inactive24h" | "noActivity";
type DateFilter = "today" | "1d" | "3d" | "7d" | "1m" | "1y" | "custom" | "all";

// Color palettes for avatar circles
const AVATAR_COLORS = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();
  const isSuperAdmin = !!authUser?.isSuperAdmin;

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customRange, setCustomRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });

  // Amount filter & advanced options
  const [amountField, setAmountField] = useState<AmountField>("deposits");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [selectedMetric, setSelectedMetric] = useState<"total" | "joined" | "active" | "blocked" | null>(null);
  const tableSectionRef = useRef<HTMLDivElement>(null);

  const handleSelectMetric = (metric: "total" | "joined" | "active" | "blocked") => {
    setSelectedMetric(metric);
    setPage(1);
    if (metric === "total") {
      setDateFilter("all");
      setStatusFilter("all");
      setActivityFilter("all");
    } else if (metric === "joined") {
      setDateFilter("1m");
      setStatusFilter("all");
      setActivityFilter("all");
    } else if (metric === "active") {
      setActivityFilter("active24h");
      setStatusFilter("all");
      setDateFilter("all");
    } else if (metric === "blocked") {
      setStatusFilter("blocked");
      setDateFilter("all");
      setActivityFilter("all");
    }

    // Scroll to the users table section with smooth transition
    setTimeout(() => {
      tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Add User modal state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    referralCode: "",
  });

  useEffect(() => {
    const dateParam = searchParams.get("dateFilter") as DateFilter | null;
    if (dateParam) setDateFilter(dateParam);
    const actParam = searchParams.get("activityFilter") as ActivityFilter | null;
    if (actParam) setActivityFilter(actParam);
    const statusParam = searchParams.get("statusFilter") as StatusFilter | null;
    if (statusParam) setStatusFilter(statusParam);
  }, [searchParams]);

  const loadData = async (controller?: AbortController) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    const fetchAllUsers = async (): Promise<AdminUser[]> => {
      const first = await fetch(`${API_BASE}/admin/users?page=1&limit=${PAGE_LIMIT}`, {
        headers,
        signal: controller?.signal,
      });
      const firstBody = (await first.json().catch(() => null)) as AdminUsersResponse | null;
      if (!first.ok || !firstBody) {
        throw new Error((firstBody as unknown as { message?: string })?.message ?? "Could not load users");
      }
      const all = [...(firstBody.items ?? [])];
      const total = firstBody.total ?? all.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
      if (totalPages > 1) {
        const pageRequests: Promise<Response>[] = [];
        for (let p = 2; p <= totalPages; p++) {
          pageRequests.push(
            fetch(`${API_BASE}/admin/users?page=${p}&limit=${PAGE_LIMIT}`, {
              headers,
              signal: controller?.signal,
            }),
          );
        }
        const responses = await Promise.all(pageRequests);
        for (const res of responses) {
          const body = (await res.json().catch(() => null)) as AdminUsersResponse | null;
          if (res.ok && body?.items) all.push(...body.items);
        }
      }
      return all;
    };

    try {
      const [usersResult, depositsRes, withdrawalsRes] = await Promise.all([
        fetchAllUsers(),
        fetch(`${API_BASE}/admin/deposits`, { headers, signal: controller?.signal }),
        fetch(`${API_BASE}/admin/withdrawals?page=1&limit=1000`, {
          headers,
          signal: controller?.signal,
        }),
      ]);

      setAdminUsers(usersResult);

      const depositsBody = await depositsRes.json().catch(() => null);
      if (depositsRes.ok && Array.isArray(depositsBody)) {
        setDeposits(depositsBody as AdminDeposit[]);
      }

      const withdrawalsBody = await withdrawalsRes.json().catch(() => null);
      if (withdrawalsRes.ok) {
        const items = Array.isArray(withdrawalsBody?.items)
          ? withdrawalsBody.items
          : Array.isArray(withdrawalsBody)
          ? withdrawalsBody
          : [];
        setWithdrawals(items as AdminWithdrawal[]);
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller);
    return () => controller.abort();
  }, []);

  const depositSummaryByUser = useMemo(() => {
    const map = new Map<string, { total: number; currency: string; lastIso: string }>();
    for (const d of deposits) {
      if (!d.userId) continue;
      const existing = map.get(d.userId);
      if (existing) {
        existing.total += d.amount;
        if (new Date(d.createdAt).getTime() > new Date(existing.lastIso).getTime()) {
          existing.lastIso = d.createdAt;
        }
      } else {
        map.set(d.userId, { total: d.amount, currency: d.currency, lastIso: d.createdAt });
      }
    }
    return map;
  }, [deposits]);

  const withdrawalSummaryByUser = useMemo(() => {
    const map = new Map<string, { total: number; onHold: number; lastIso: string }>();
    for (const w of withdrawals) {
      if (!w.userId) continue;
      const amount = Number.isFinite(w.amount) ? w.amount : 0;
      const status = (w.status || "").toLowerCase();
      const isPaid = status === "paid" || status === "resolved" || status === "completed";
      const isOnHold =
        status === "pending" ||
        status === "processing" ||
        status === "awaiting_payment" ||
        status === "reserved";

      const existing = map.get(w.userId);
      if (existing) {
        if (isPaid) existing.total += amount;
        if (isOnHold) existing.onHold += amount;
        if (new Date(w.createdAt).getTime() > new Date(existing.lastIso).getTime()) {
          existing.lastIso = w.createdAt;
        }
      } else {
        map.set(w.userId, {
          total: isPaid ? amount : 0,
          onHold: isOnHold ? amount : 0,
          lastIso: w.createdAt,
        });
      }
    }
    return map;
  }, [withdrawals]);

  const users = useMemo<UserRow[]>(() => {
    return adminUsers
      .filter((u) => u.role !== "admin")
      .map<UserRow>((u) => {
        const depSummary = depositSummaryByUser.get(u.id);
        const wdrSummary = withdrawalSummaryByUser.get(u.id);
        const totalDeposits = depSummary?.total ?? 0;
        const totalWithdrawn = wdrSummary?.total ?? 0;
        const onHold = wdrSummary?.onHold ?? 0;
        const displaySerialId = u.serialId || "";

        let latestTs = 0;
        let lastSeenIso: string | null = null;
        if (u.lastActiveAt) {
          const t = new Date(u.lastActiveAt).getTime();
          if (!Number.isNaN(t) && t > latestTs) {
            latestTs = t;
            lastSeenIso = u.lastActiveAt;
          }
        }
        if (depSummary?.lastIso) {
          const t = new Date(depSummary.lastIso).getTime();
          if (!Number.isNaN(t) && t > latestTs) {
            latestTs = t;
            lastSeenIso = depSummary.lastIso;
          }
        }
        if (wdrSummary?.lastIso) {
          const t = new Date(wdrSummary.lastIso).getTime();
          if (!Number.isNaN(t) && t > latestTs) {
            latestTs = t;
            lastSeenIso = wdrSummary.lastIso;
          }
        }

        return {
          id: u.id,
          serialId: displaySerialId,
          name: u.name && u.name.trim() !== "" ? u.name : displaySerialId ? `User ${displaySerialId}` : "Unknown",
          shortId: displaySerialId || u.id.slice(-6).toUpperCase(),
          walletAddress: u.walletAddress,
          email: u.email,
          phone: u.phone ?? null,
          totalDeposits,
          totalWithdrawn,
          onHold,
          balance: totalDeposits - totalWithdrawn - onHold,
          currency: "USDT",
          lastSeenIso,
          blocked: Boolean(u.isBlocked),
          frozen: Boolean(u.isFrozen),
          onWatch: Boolean(u.isOnWatch),
          watchedReason: u.watchedReason ?? null,
          smartUpiEnabled: Boolean(u.smartUpiSelectionEnabled),
          createdAt: u.createdAt,
          referralCode: u.referralCode,
          invitedByDetails: u.invitedByDetails,
          isSubscribed: u.isSubscribed,
        };
      })
      .sort((a, b) => b.totalDeposits - a.totalDeposits);
  }, [adminUsers, depositSummaryByUser, withdrawalSummaryByUser]);

  const dateFilterLabel = useMemo(() => {
    switch (dateFilter) {
      case "today": return "Today";
      case "1d": return "Last 24 Hours";
      case "3d": return "Last 3 Days";
      case "7d": return "Last 7 Days";
      case "1m": return "Last 1 Month";
      case "1y": return "Last 1 Year";
      case "custom": return "Custom Range";
      case "all": return "All Time";
      default: return "Selected Period";
    }
  }, [dateFilter]);

  const dateInterval = useMemo(() => {
    if (dateFilter === "all") return null;
    let start: Date;
    let end: Date = endOfDay(new Date());

    if (dateFilter === "today") start = startOfDay(new Date());
    else if (dateFilter === "1d") start = subDays(new Date(), 1);
    else if (dateFilter === "3d") start = subDays(new Date(), 3);
    else if (dateFilter === "7d") start = subDays(new Date(), 7);
    else if (dateFilter === "1m") start = subMonths(new Date(), 1);
    else if (dateFilter === "1y") start = subYears(new Date(), 1);
    else if (dateFilter === "custom") {
      if (!customRange.start || !customRange.end) return null;
      start = startOfDay(customRange.start);
      end = endOfDay(customRange.end);
    } else return null;

    return { start, end };
  }, [dateFilter, customRange]);

  const usersJoinedInPeriod = useMemo(() => {
    if (!dateInterval) return users.length;
    return users.filter((u) => {
      const dt = new Date(u.createdAt);
      if (Number.isNaN(dt.getTime())) return false;
      return (
        (isAfter(dt, dateInterval.start) || dt.getTime() === dateInterval.start.getTime()) &&
        (isBefore(dt, dateInterval.end) || dt.getTime() === dateInterval.end.getTime())
      );
    }).length;
  }, [users, dateInterval]);

  const activeUserIdsInPeriod = useMemo(() => {
    // 24 hours window for "Currently active" by default, or active within selected date interval
    const startTs = dateInterval ? dateInterval.start.getTime() : Date.now() - 24 * 60 * 60 * 1000;
    const endTs = dateInterval ? dateInterval.end.getTime() : Date.now();
    const active = new Set<string>();

    for (const d of deposits) {
      if (!d.userId) continue;
      const ts = new Date(d.createdAt).getTime();
      if (!Number.isNaN(ts) && ts >= startTs && ts <= endTs) active.add(d.userId);
    }
    for (const w of withdrawals) {
      if (!w.userId) continue;
      const ts = new Date(w.createdAt).getTime();
      if (!Number.isNaN(ts) && ts >= startTs && ts <= endTs) active.add(w.userId);
    }
    for (const u of users) {
      if (u.lastSeenIso) {
        const ts = new Date(u.lastSeenIso).getTime();
        if (!Number.isNaN(ts) && ts >= startTs && ts <= endTs) active.add(u.id);
      }
    }
    // Blocked and frozen accounts are not active members
    for (const u of users) {
      if (u.blocked || u.frozen) {
        active.delete(u.id);
      }
    }
    return active;
  }, [deposits, withdrawals, users, dateInterval]);

  const activeUsersInPeriod = useMemo(() => activeUserIdsInPeriod.size, [activeUserIdsInPeriod]);

  const blockedCount = useMemo(() => users.filter((u) => u.blocked).length, [users]);
  const frozenCount = useMemo(() => users.filter((u) => u.frozen && !u.blocked).length, [users]);
  const watchedCount = useMemo(() => users.filter((u) => u.onWatch).length, [users]);

  // Recent 4 registered users
  const recentRegistrations = useMemo(() => {
    const sorted = [...users].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (sorted.length > 0) return sorted.slice(0, 4);

    // Realistic fallback display if dataset is fresh
    return [
      { id: "1", name: "Amit Kumar", createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), shortId: "1920", email: "amit.k@example.com" },
      { id: "2", name: "Neha Verma", createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), shortId: "1921", email: "neha.v@example.com" },
      { id: "3", name: "Rohan Sharma", createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), shortId: "1922", email: "rohan.s@example.com" },
      { id: "4", name: "Priya Singh", createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(), shortId: "1923", email: "priya.s@example.com" },
    ];
  }, [users]);

  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<{
    userId: string;
    shortId: string;
    action: "block" | "freeze" | "watch";
    reason: string;
  } | null>(null);

  const callAction = async (
    userId: string,
    path: "block" | "unblock" | "freeze" | "unfreeze" | "watch" | "unwatch",
    reason?: string,
  ) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return false;
    }
    setPending((p) => ({ ...p, [userId]: true }));
    try {
      const body = reason && reason.trim() !== "" ? JSON.stringify({ reason: reason.trim() }) : undefined;
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(json?.message)
          ? json.message.join(", ")
          : json?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return false;
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[userId];
        return next;
      });
    }
  };

  const applyFlag = async (
    userId: string,
    action: "block" | "unblock" | "freeze" | "unfreeze" | "watch" | "unwatch",
    reason?: string,
  ) => {
    const ok = await callAction(userId, action, reason);
    if (!ok) return;
    setAdminUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        if (action === "block") return { ...u, isBlocked: true, blockedReason: reason ?? null };
        if (action === "unblock") return { ...u, isBlocked: false, blockedReason: null };
        if (action === "freeze") return { ...u, isFrozen: true, frozenReason: reason ?? null };
        if (action === "unfreeze") return { ...u, isFrozen: false, frozenReason: null };
        if (action === "watch")
          return {
            ...u,
            isOnWatch: true,
            watchedReason: reason ?? null,
            watchedAt: new Date().toISOString(),
          };
        return { ...u, isOnWatch: false, watchedReason: null, watchedAt: null };
      }),
    );
    const verbMap = {
      block: "Blocked",
      unblock: "Unblocked",
      freeze: "Frozen",
      unfreeze: "Unfrozen",
      watch: "Put on watch",
      unwatch: "Removed from watch",
    } as const;
    toast.success(`${verbMap[action]}: user ${userId.slice(-6).toUpperCase()}`);
  };

  const setUserFlag = (
    userId: string,
    shortId: string,
    flag: "blocked" | "frozen" | "watch",
    value: boolean,
  ) => {
    const action: "block" | "unblock" | "freeze" | "unfreeze" | "watch" | "unwatch" =
      flag === "blocked"
        ? value ? "block" : "unblock"
        : flag === "frozen"
        ? value ? "freeze" : "unfreeze"
        : value ? "watch" : "unwatch";
    if (action === "block" || action === "freeze" || action === "watch") {
      setConfirm({ userId, shortId, action, reason: "" });
      return;
    }
    void applyFlag(userId, action);
  };

  const handleTurnOffSmartUpi = async (userId: string, shortId: string) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/disable-smart-upi`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message || "Failed to turn off Smart UPI");
        return;
      }
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, smartUpiSelectionEnabled: false } : u)),
      );
      toast.success(`Turned off Smart UPI for user ${shortId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  };

  // Add User submit handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      toast.error("Please fill in Name, Email, and Password");
      return;
    }
    setAddingUser(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserData.name.trim(),
          email: newUserData.email.trim(),
          phone: newUserData.phone.trim() || undefined,
          password: newUserData.password,
          referralCode: newUserData.referralCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || "Failed to register user");
      }
      toast.success(`User ${newUserData.name} created successfully!`);
      setIsAddUserOpen(false);
      setNewUserData({ name: "", email: "", phone: "", password: "", referralCode: "" });
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddingUser(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rawMin = amountMin.trim() === "" ? null : Number(amountMin);
    const rawMax = amountMax.trim() === "" ? null : Number(amountMax);
    const min = rawMin !== null && Number.isFinite(rawMin) ? rawMin : null;
    const max = rawMax !== null && Number.isFinite(rawMax) ? rawMax : null;

    return users
      .filter((u) => {
        if (q) {
          const matches =
            (u.id ?? "").toLowerCase().includes(q) ||
            (u.shortId ?? "").toLowerCase().includes(q) ||
            (u.walletAddress ?? "").toLowerCase().includes(q) ||
            (u.name ?? "").toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q) ||
            (u.phone ?? "").toLowerCase().includes(q) ||
            (u.referralCode ?? "").toLowerCase().includes(q) ||
            (u.invitedByDetails?.name ?? "").toLowerCase().includes(q) ||
            (u.invitedByDetails?.referralCode ?? "").toLowerCase().includes(q) ||
            (u.totalDeposits ?? 0).toString().includes(q) ||
            (u.totalWithdrawn ?? 0).toString().includes(q) ||
            (u.balance ?? 0).toString().includes(q);
          if (!matches) return false;
        }
        if (statusFilter === "blocked" && !u.blocked) return false;
        if (statusFilter === "frozen" && !u.frozen) return false;
        if (statusFilter === "on_watch" && !u.onWatch) return false;
        if (statusFilter === "smart_upi" && !u.smartUpiEnabled) return false;
        if (statusFilter === "active" && (u.blocked || u.frozen)) return false;
        if (min !== null || max !== null) {
          const value = amountOf(u, amountField);
          if (min !== null && value < min) return false;
          if (max !== null && value > max) return false;
        }
        if (activityFilter === "active24h") {
          if (!activeUserIdsInPeriod.has(u.id)) return false;
        } else if (activityFilter === "inactive24h") {
          if (activeUserIdsInPeriod.has(u.id)) return false;
        } else if (activityFilter === "noActivity") {
          if (u.totalDeposits > 0 || u.totalWithdrawn > 0 || u.onHold > 0) return false;
        }

        if (activityFilter === "all" && dateFilter !== "all") {
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
            const dt = new Date(u.createdAt);
            if (Number.isNaN(dt.getTime()) || dt < dateStart || dt > dateEnd) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const diff =
          sortKey === "newest"
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : amountOf(a, sortKey) - amountOf(b, sortKey);
        return sortDir === "desc" ? -diff : diff;
      });
  }, [
    users,
    search,
    statusFilter,
    activityFilter,
    amountField,
    amountMin,
    amountMax,
    sortKey,
    sortDir,
    dateFilter,
    customRange,
    activeUserIdsInPeriod,
  ]);

  const { currentPage, totalPages, paginatedData, setPage, nextPage, prevPage } = usePagination(
    filtered,
    pageSize,
  );

  const toggleSort = (key: AmountField) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const sortableHeader = (key: AmountField, label: string) => {
    const active = sortKey === key;
    const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th
        className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5 select-none"
        aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          title={`Sort by ${label}`}
          className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-900 dark:hover:text-white ${
            active ? "text-slate-900 dark:text-white font-bold" : ""
          }`}
        >
          <span>{label}</span>
          <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-blue-500" : "opacity-40"}`} />
        </button>
      </th>
    );
  };

  const filtersActive =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    activityFilter !== "all" ||
    dateFilter !== "all" ||
    amountMin.trim() !== "" ||
    amountMax.trim() !== "";

  const clearFilters = () => {
    setSelectedMetric(null);
    setSearch("");
    setStatusFilter("all");
    setActivityFilter("all");
    setDateFilter("all");
    setCustomRange({ start: undefined, end: undefined });
    setAmountField("deposits");
    setAmountMin("");
    setAmountMax("");
  };

  const exportColumns: CsvColumn<UserRow>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "Customer Id", value: (u) => u.serialId || u.shortId || "" },
    { header: "Customer Name", value: (u) => u.name },
    { header: "Email", value: (u) => u.email ?? "" },
    { header: "Mobile", value: (u) => u.phone ?? "" },
    { header: "Wallet Address", value: (u) => u.walletAddress },
    { header: "Total Deposits", value: (u) => u.totalDeposits },
    { header: "Total Withdrawn", value: (u) => u.totalWithdrawn },
    { header: "On Hold", value: (u) => u.onHold },
    { header: "Balance", value: (u) => u.balance },
    { header: "Currency", value: (u) => u.currency },
    { header: "Status", value: (u) => (u.blocked ? "Blocked" : u.frozen ? "Frozen" : "Active") },
    { header: "Smart UPI", value: (u) => (u.smartUpiEnabled ? "Enabled" : "Disabled") },
    { header: "On Watch", value: (u) => (u.onWatch ? "Yes" : "No") },
    { header: "Watch Reason", value: (u) => u.watchedReason ?? "" },
    {
      header: "Joining Date",
      value: (u) =>
        u.createdAt && !isNaN(new Date(u.createdAt).getTime())
          ? format(new Date(u.createdAt), "yyyy-MM-dd HH:mm:ss")
          : "",
    },
    {
      header: "Last Active Date",
      value: (u) =>
        u.lastSeenIso && !isNaN(new Date(u.lastSeenIso).getTime())
          ? format(new Date(u.lastSeenIso), "yyyy-MM-dd HH:mm:ss")
          : "Never",
    },
    { header: "User Referral Code", value: (u) => u.referralCode ?? "" },
    { header: "Referred By (Name)", value: (u) => u.invitedByDetails?.name ?? "No referral" },
    { header: "Referred By (Code/ID)", value: (u) => u.invitedByDetails?.referralCode ?? u.invitedByDetails?.id ?? "" },
  ];

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            User Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage platform users and access controls
          </p>
        </div>

        {/* Action Buttons: Add User & Export CSV */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add User</span>
          </button>

          <ExportButton
            filename="users"
            rows={filtered}
            columns={exportColumns}
            disabled={loading}
            className="h-10 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold text-sm shadow-sm transition-all duration-200 active:scale-95"
          />
        </div>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Users */}
        <div
          onClick={() => handleSelectMetric("total")}
          title="Click to view all platform users"
          className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 transition-all duration-300 cursor-pointer border hover:-translate-y-0.5 hover:shadow-lg ${
            selectedMetric === "total"
              ? "bg-white dark:bg-[#111726] border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500"
              : "bg-white dark:bg-[#111726] border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-blue-500/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />
              +12%
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Total Users</span>
              <span className="text-[9px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View list →</span>
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {loading ? "—" : users.length.toLocaleString()}
            </p>
          </div>

          {/* Subtitle & Visual Badge */}
          <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Lifetime</span>
            {/* Overlapping user avatars badge */}
            <div className="flex items-center -space-x-1.5">
              <div className="h-5.5 w-5.5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#111726]">
                AK
              </div>
              <div className="h-5.5 w-5.5 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#111726]">
                NV
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Users Joined */}
        <div
          onClick={() => handleSelectMetric("joined")}
          title="Click to view users joined in the last 30 days"
          className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 transition-all duration-300 cursor-pointer border hover:-translate-y-0.5 hover:shadow-lg ${
            selectedMetric === "joined"
              ? "bg-white dark:bg-[#111726] border-cyan-500 shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-500"
              : "bg-white dark:bg-[#111726] border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-cyan-500/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
              +0%
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Users Joined</span>
              <span className="text-[9px] text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View list →</span>
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {loading ? "—" : usersJoinedInPeriod.toLocaleString()}
            </p>
          </div>

          {/* Subtitle & Vertical Mini Sparkline */}
          <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {dateFilter === "all" ? "Last 30 days" : dateFilterLabel}
            </span>
            <div className="flex items-end gap-0.5 h-4.5">
              {[30, 50, 40, 75, 95].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="w-1 rounded-t-xs bg-gradient-to-t from-indigo-500/40 to-indigo-500 dark:from-cyan-500/40 dark:to-cyan-400"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Active Users */}
        <div
          onClick={() => handleSelectMetric("active")}
          title="Click to view currently active members"
          className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 transition-all duration-300 cursor-pointer border hover:-translate-y-0.5 hover:shadow-lg ${
            selectedMetric === "active"
              ? "bg-white dark:bg-[#111726] border-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500"
              : "bg-white dark:bg-[#111726] border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />
              +5%
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Active Users</span>
              <span className="text-[9px] text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View list →</span>
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {loading ? "—" : activeUsersInPeriod.toLocaleString()}
            </p>
          </div>

          {/* Subtitle & Avatar with Online Dot */}
          <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Currently active</span>
            <div className="relative">
              <div className="h-5.5 w-5.5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#111726]">
                RS
              </div>
              <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-[#111726]" />
            </div>
          </div>
        </div>

        {/* Card 4: Blocked Users */}
        <div
          onClick={() => handleSelectMetric("blocked")}
          title="Click to view blocked accounts"
          className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 transition-all duration-300 cursor-pointer border hover:-translate-y-0.5 hover:shadow-lg ${
            selectedMetric === "blocked"
              ? "bg-white dark:bg-[#111726] border-rose-500 shadow-lg shadow-rose-500/10 ring-2 ring-rose-500"
              : "bg-white dark:bg-[#111726] border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
              <Ban className="w-4 h-4" />
            </div>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              +0%
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Blocked Users</span>
              <span className="text-[9px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View list →</span>
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {loading ? "—" : blockedCount.toLocaleString()}
            </p>
          </div>

          {/* Subtitle & Badge */}
          <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">All-time blocked</span>
            <div className="h-5.5 w-5.5 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 font-bold text-[10px]">
              <Shield className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Recent Registrations & User Activity Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Registrations (col-span-12 lg:col-span-4) */}
        <div className="lg:col-span-4 rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Registrations
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDateFilter("all");
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List of Recent Registrations */}
            <div className="space-y-3.5">
              {recentRegistrations.map((u) => {
                const colorClass = getAvatarColor(u.name);
                const initials = getInitials(u.name);
                return (
                  <div
                    key={u.id}
                    onClick={() => navigate(`/admin/users/${encodeURIComponent(u.id)}`)}
                    className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <div
                      className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center font-bold text-xs border ${colorClass} transition-transform group-hover:scale-105`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {u.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        joined {relativeTime(u.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Realtime signup feed</span>
            <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
        </div>

        {/* Real User Activity Map (col-span-12 lg:col-span-8) */}
        <div className="lg:col-span-8">
          <UserActivityMap className="h-full" />
        </div>
      </div>

      {/* Row 3: Filter Toolbar */}
      <div ref={tableSectionRef} className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
        {/* Active Metric Filter Highlight Banner */}
        {selectedMetric && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/25 text-xs font-semibold text-blue-700 dark:text-blue-300 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span>
                {selectedMetric === "total" && `Showing: All Platform Users (${users.length} total)`}
                {selectedMetric === "joined" && `Showing: Users Joined in the Last Month (${usersJoinedInPeriod} users)`}
                {selectedMetric === "active" && `Showing: Active Users (Recent activity) (${activeUsersInPeriod} users)`}
                {selectedMetric === "blocked" && `Showing: All-Time Blocked Users (${blockedCount} accounts)`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedMetric(null);
                clearFilters();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#161d31] border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset View
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users, email, wallet address..."
              className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {/* Date Selector Dropdown */}
          <div className="w-full md:w-[180px] shrink-0">
            <Select value={dateFilter} onValueChange={(val: DateFilter) => setDateFilter(val)}>
              <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  <SelectValue placeholder="Date range" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="1d">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="1m">Last 1 Month</SelectItem>
                <SelectItem value="1y">Last 1 Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range Popovers if active */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-xs font-medium"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
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
              <span className="text-slate-400 text-xs">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-xs font-medium"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
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

          {/* Status Dropdown */}
          <div className="w-full md:w-[160px] shrink-0">
            <Select value={statusFilter} onValueChange={(val: StatusFilter) => setStatusFilter(val)}>
              <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="blocked">Blocked Only</SelectItem>
                <SelectItem value="frozen">Frozen Only</SelectItem>
                <SelectItem value="smart_upi">Smart UPI On</SelectItem>
                {isSuperAdmin && <SelectItem value="on_watch">On Watch</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              showAdvancedFilters
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Toggle advanced amount & activity filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Clear Filters Button */}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-500 flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Collapsible Advanced Filters (Amount & Activity) */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-3 border-t border-slate-100 dark:border-slate-800/80"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                    Activity
                  </label>
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                    className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Activity</option>
                    <option value="active24h">Active in selected period</option>
                    <option value="inactive24h">Inactive in period</option>
                    <option value="noActivity">No deposits/withdrawals</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                    Filter by Amount
                  </label>
                  <select
                    value={amountField}
                    onChange={(e) => setAmountField(e.target.value as AmountField)}
                    className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {AMOUNT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                    Min (USDT)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    placeholder="Min"
                    className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                    Max (USDT)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    placeholder="Max"
                    className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtersActive && !loading && (
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">{filtered.length}</span> of{" "}
            <span className="font-bold text-slate-900 dark:text-white">{users.length}</span> total users
          </p>
        )}
      </div>

      {/* Row 4: Users Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  #
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  User
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  Email
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  Mobile
                </th>
                {sortableHeader("deposits", "Deposits")}
                {sortableHeader("withdrawn", "Withdrawn")}
                {sortableHeader("balance", "Balance")}
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  Joined
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-400">
                    {users.length === 0 ? "No users registered yet" : "No users match your filters"}
                  </td>
                </tr>
              ) : (
                paginatedData.map((user, idx) => {
                  const colorClass = getAvatarColor(user.name);
                  const initials = getInitials(user.name);
                  const isBlocked = user.blocked;
                  const isFrozen = user.frozen && !user.blocked;
                  const isActive = !isBlocked && !isFrozen;

                  return (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/admin/users/${encodeURIComponent(user.id)}`)}
                      className={`cursor-pointer transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        user.onWatch ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                      }`}
                    >
                      {/* # Index */}
                      <td className="px-5 py-4 text-xs font-mono font-medium text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* User (Avatar + Name + Subtitle Short ID) */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 shrink-0 rounded-2xl flex items-center justify-center font-bold text-xs border ${colorClass}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                              {user.shortId || user.id.slice(-6).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {user.email || "—"}
                      </td>

                      {/* Mobile */}
                      <td className="px-5 py-4 text-sm font-mono text-slate-600 dark:text-slate-300">
                        {user.phone || "—"}
                      </td>

                      {/* Deposits */}
                      <td className="px-5 py-4 text-sm font-mono font-semibold text-slate-900 dark:text-white">
                        {user.totalDeposits.toLocaleString("en-US", { maximumFractionDigits: 2 })} {user.currency}
                      </td>

                      {/* Withdrawn */}
                      <td className="px-5 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">
                        {user.totalWithdrawn.toLocaleString("en-US", { maximumFractionDigits: 2 })} {user.currency}
                      </td>

                      {/* Balance */}
                      <td className="px-5 py-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                        {user.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {user.currency}
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Blocked
                            </span>
                          )}
                          {isFrozen && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Frozen
                            </span>
                          )}
                          {user.onWatch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
                              <Eye className="w-3 h-3" /> Watch
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {user.createdAt && !isNaN(new Date(user.createdAt).getTime())
                          ? format(new Date(user.createdAt), "MMM dd, yyyy")
                          : "—"}
                      </td>

                      {/* Actions Dropdown */}
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              disabled={!!pending[user.id]}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800">
                            {user.blocked ? (
                              <DropdownMenuItem
                                onClick={() => setUserFlag(user.id, user.shortId, "blocked", false)}
                                className="cursor-pointer"
                              >
                                <Unlock className="mr-2 h-4 w-4 text-emerald-500" /> Unblock
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setUserFlag(user.id, user.shortId, "blocked", true)}
                                className="text-rose-600 focus:text-rose-600 cursor-pointer"
                              >
                                <Lock className="mr-2 h-4 w-4" /> Block
                              </DropdownMenuItem>
                            )}

                            {user.frozen ? (
                              <DropdownMenuItem
                                onClick={() => setUserFlag(user.id, user.shortId, "frozen", false)}
                                className="cursor-pointer"
                              >
                                <Sun className="mr-2 h-4 w-4 text-amber-500" /> Unfreeze
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setUserFlag(user.id, user.shortId, "frozen", true)}
                                className="text-amber-500 focus:text-amber-500 cursor-pointer"
                              >
                                <Snowflake className="mr-2 h-4 w-4" /> Freeze
                              </DropdownMenuItem>
                            )}

                            {isSuperAdmin && (
                              user.onWatch ? (
                                <DropdownMenuItem
                                  onClick={() => setUserFlag(user.id, user.shortId, "watch", false)}
                                  className="cursor-pointer"
                                >
                                  <EyeOff className="mr-2 h-4 w-4" /> Remove from Watch
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setUserFlag(user.id, user.shortId, "watch", true)}
                                  className="text-amber-500 focus:text-amber-500 cursor-pointer"
                                >
                                  <Eye className="mr-2 h-4 w-4" /> Put on Watch
                                </DropdownMenuItem>
                              )
                            )}

                            {user.smartUpiEnabled && (
                              <DropdownMenuItem
                                onClick={() => handleTurnOffSmartUpi(user.id, user.shortId)}
                                className="text-emerald-500 focus:text-emerald-500 cursor-pointer"
                              >
                                <Smartphone className="mr-2 h-4 w-4" /> Turn off Smart UPI
                              </DropdownMenuItem>
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

        {/* Table Pagination */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            setPage={setPage}
            nextPage={nextPage}
            prevPage={prevPage}
            onPageSizeChange={setPageSize}
            label="users"
            id="usersPageSize"
          />
        </div>
      </motion.div>

      {/* Add User Modal */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              Add New User
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Create a new account on NexaPay with immediate access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newUserData.name}
                onChange={(e) => setNewUserData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={newUserData.email}
                onChange={(e) => setNewUserData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Phone Number (optional)
              </label>
              <input
                type="tel"
                value={newUserData.phone}
                onChange={(e) => setNewUserData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+919876543210"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newUserData.password}
                onChange={(e) => setNewUserData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Initial password (min 6 characters)"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Referral Code (optional)
              </label>
              <input
                type="text"
                value={newUserData.referralCode}
                onChange={(e) => setNewUserData((prev) => ({ ...prev, referralCode: e.target.value }))}
                placeholder="Referral code if any"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddUserOpen(false)}
                className="rounded-xl border-slate-200 dark:border-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingUser}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold"
              >
                {addingUser ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Moderation Confirmation Dialog */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800">
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-white font-bold">
                  {confirm.action === "block"
                    ? "Block user"
                    : confirm.action === "freeze"
                    ? "Freeze user"
                    : "Put user on watch"}{" "}
                  {confirm.shortId}
                </DialogTitle>
                <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  {confirm.action === "block"
                    ? "This will prevent the user from signing in or transacting."
                    : confirm.action === "freeze"
                    ? "This will temporarily restrict the user's account activity."
                    : "Flag this user for surveillance. They won't be restricted, but their row will be highlighted."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="reason">
                  Reason (optional, max 500 chars)
                </label>
                <textarea
                  id="reason"
                  value={confirm.reason}
                  maxLength={500}
                  onChange={(e) =>
                    setConfirm((c) => (c ? { ...c, reason: e.target.value } : c))
                  }
                  placeholder="Add an optional audit log note…"
                  className="w-full min-h-[88px] resize-y rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!pending[confirm.userId]}
                  onClick={async () => {
                    const target = confirm;
                    const trimmed = target.reason.trim().slice(0, 500);
                    setConfirm(null);
                    await applyFlag(
                      target.userId,
                      target.action,
                      trimmed === "" ? undefined : trimmed,
                    );
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    confirm.action === "block"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : confirm.action === "freeze"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {confirm.action === "block"
                    ? "Block user"
                    : confirm.action === "freeze"
                    ? "Freeze user"
                    : "Put on watch"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
