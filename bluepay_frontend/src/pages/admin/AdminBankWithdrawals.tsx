import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { subDays, subMonths, subYears, startOfDay, endOfDay, format } from "date-fns";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";
import { formatIst } from "@/lib/format-date";
import TablePagination from "@/components/shared/TablePagination";
import { usePagination } from "@/hooks/usePagination";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  Search,
  X,
  Filter,
  RefreshCw,
  Eye,
  Landmark,
  ShieldAlert,
  Users,
  Copy,
  ExternalLink,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Building2,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  MoreHorizontal,
  ChevronDown,
  LayoutGrid,
  List,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

type WithdrawalStatus = "pending" | "processing" | "paid" | "failed" | "awaiting_payment" | "resolved";

interface AdminWithdrawal {
  id: string;
  userId: string;
  serialId?: string | null;
  method?: string;
  amount: number;
  feeRate?: number;
  fxRate?: number;
  feeUsdt?: number;
  netUsdt?: number;
  grossInr?: number | null;
  feeInr?: number | null;
  netInr?: number | null;
  bankName?: string | null;
  accountNumber?: string | number | null;
  ifscCode?: string | null;
  accountHolderName?: string | null;
  upiId?: string | null;
  status: WithdrawalStatus;
  userConfirmedAt?: string | null;
  disputeRaised?: boolean;
  disputeDetails?: {
    id: string;
    reason: string;
    description: string;
    bankStatementUrl: string | null;
    bankStatementName: string | null;
    resolutionStatus: string;
    resolutionDecision: string | null;
    resolutionNotes?: string | null;
    resolvedAt?: string | null;
    createdAt: string;
  } | null;
  paymentProofUrl?: string | null;
  txHash?: string | null;
  utr?: string | null;
  notes?: string | null;
  processedBy?: string | null;
  processedAt?: string | null;
  decisionReason?: string | null;
  processedByRole?: string | null;
  processedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminUser {
  id: string;
  serialId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  isBlocked?: boolean;
  isFrozen?: boolean;
  isOnWatch?: boolean;
}

interface AdminWithdrawalsResponse {
  items: AdminWithdrawal[];
  total: number;
  page: number;
  limit: number;
}

interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
}

const WITHDRAWALS_PAGE_LIMIT = 200;
const USERS_PAGE_LIMIT = 100;
const UTR_RE = /^[A-Z0-9]{8,25}$/;

function normalizeAccount(account: unknown): string {
  if (account === null || account === undefined) return "";
  return String(account).replace(/\s+/g, "").toUpperCase();
}

function maskAccount(account: unknown): string {
  if (account === null || account === undefined) return "";
  const v = String(account).replace(/\s/g, "");
  if (!v) return "";
  if (v.length <= 4) return `XXXX${v}`;
  return `XXXX${v.slice(-4)}`;
}

function getInitials(name: string): string {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
];

function getAvatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

/* ─────────────────────────────────────────────────────────────
   BANK LOGOS (Indian Bank Icons)
───────────────────────────────────────────────────────────── */
const BankLogo = ({ bankName, className = "w-5 h-5" }: { bankName: string; className?: string }) => {
  const norm = String(bankName || "").toLowerCase();

  if (norm.includes("hdfc")) {
    return (
      <div className={`${className} rounded bg-[#ed232a] flex items-center justify-center p-0.5 shrink-0`}>
        <div className="w-full h-full bg-[#004c8f] flex items-center justify-center text-[8px] font-black text-white rounded-[2px]">
          <span className="leading-none tracking-tighter">H</span>
        </div>
      </div>
    );
  }

  if (norm.includes("sbi") || norm.includes("state bank")) {
    return (
      <div className={`${className} rounded-full bg-[#00a5ec] flex items-center justify-center p-0.5 shrink-0`}>
        <div className="w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#002e6e]" />
        </div>
      </div>
    );
  }

  if (norm.includes("axis")) {
    return (
      <div className={`${className} rounded bg-[#97144d] flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
        ▲
      </div>
    );
  }

  if (norm.includes("icici")) {
    return (
      <div className={`${className} rounded-full bg-gradient-to-tr from-[#f37021] to-[#a02021] flex items-center justify-center text-white text-[8px] font-black shrink-0`}>
        i
      </div>
    );
  }

  if (norm.includes("kotak")) {
    return (
      <div className={`${className} rounded bg-[#ed1c24] flex items-center justify-center text-white text-[9px] font-extrabold shrink-0`}>
        K
      </div>
    );
  }

  // Default Bank Icon
  return (
    <div className={`${className} rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/50 shrink-0`}>
      <Building2 className="w-3.5 h-3.5" />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   3D HEADER NETWORK / BANK ARTWORK
───────────────────────────────────────────────────────────── */
const BankHeaderIllustration = () => {
  return (
    <div className="absolute right-0 -top-8 w-[340px] h-[180px] pointer-events-none select-none hidden lg:block overflow-visible">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-36 bg-gradient-to-r from-blue-400/20 via-sky-300/30 to-indigo-400/15 rounded-full blur-2xl pointer-events-none" />
      <svg
        viewBox="0 0 340 180"
        className="w-full h-full overflow-visible drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bankNetGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id="bankOrbGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#38bdf8" />
          </radialGradient>
        </defs>

        {/* Network Connector Lines */}
        <path d="M 60 90 L 150 45 L 240 70 L 300 35" stroke="url(#bankNetGrad)" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M 150 45 L 180 120 L 260 140" stroke="url(#bankNetGrad)" strokeWidth="2" strokeDasharray="4 4" />

        {/* Floating Glowing Nodes */}
        <circle cx="60" cy="90" r="8" fill="url(#bankOrbGrad)" />
        <circle cx="150" cy="45" r="14" fill="url(#bankOrbGrad)" />
        <circle cx="240" cy="70" r="10" fill="url(#bankOrbGrad)" />
        <circle cx="180" cy="120" r="9" fill="url(#bankOrbGrad)" />
        <circle cx="300" cy="35" r="7" fill="url(#bankOrbGrad)" />
        <circle cx="260" cy="140" r="11" fill="url(#bankOrbGrad)" />
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BOTTOM MINI BAR CHART / HISTOGRAM FOR FIRST CARD
───────────────────────────────────────────────────────────── */
const MiniHistogramBars = () => {
  return (
    <div className="absolute -bottom-1 right-3 flex items-end gap-1.5 h-10 pointer-events-none opacity-85">
      <div className="w-1.5 h-3 bg-blue-400/50 rounded-t-sm" />
      <div className="w-1.5 h-5 bg-blue-500/60 rounded-t-sm" />
      <div className="w-1.5 h-4 bg-blue-400/50 rounded-t-sm" />
      <div className="w-1.5 h-7 bg-blue-500/70 rounded-t-sm" />
      <div className="w-1.5 h-6 bg-blue-500/80 rounded-t-sm" />
      <div className="w-1.5 h-9 bg-blue-600 rounded-t-sm" />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BOTTOM SPARKLINE WAVE
───────────────────────────────────────────────────────────── */
const SparklineWave = ({ color }: { color: string }) => {
  return (
    <div className="absolute -bottom-1 left-0 right-0 w-full h-7 overflow-hidden pointer-events-none opacity-80">
      <svg
        className="w-full h-full"
        viewBox="0 0 200 35"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 0 26 C 45 26, 65 14, 105 18 C 145 22, 165 8, 200 8"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default function AdminBankWithdrawals() {
  const [searchParams] = useSearchParams();
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WithdrawalStatus>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "1d" | "3d" | "7d" | "1m" | "1y" | "custom" | "all">("7d");
  const [customRange, setCustomRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [trendRange, setTrendRange] = useState<"7d" | "30d" | "all">("7d");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [selectedDispute, setSelectedDispute] = useState<AdminWithdrawal | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    id: string;
    displayName: string;
    amount: number;
    inrAmount: number;
    accountNumber: string;
    bankName: string;
    action: "approve" | "reject";
    reason: string;
    utr: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Read initial query params
  useEffect(() => {
    const qParam = searchParams.get("search") || searchParams.get("accountNumber");
    const dateParam = searchParams.get("dateFilter");
    const statusParam = searchParams.get("statusFilter");

    if (qParam) setSearch(qParam);
    if (dateParam) setDateFilter(dateParam as any);
    if (statusParam) setStatusFilter(statusParam as any);
  }, [searchParams]);

  // Load Data
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const fetchAllWithdrawals = async (): Promise<AdminWithdrawal[]> => {
        const first = await fetch(
          `${API_BASE}/admin/withdrawals?page=1&limit=${WITHDRAWALS_PAGE_LIMIT}`,
          { headers },
        );
        const firstBody = (await first.json().catch(() => null)) as AdminWithdrawalsResponse | null;
        if (!first.ok || !firstBody) {
          throw new Error(
            (firstBody as unknown as { message?: string })?.message ?? "Could not load withdrawals",
          );
        }
        const all = [...(firstBody.items ?? [])];
        const total = firstBody.total ?? all.length;
        const totalPages = Math.max(1, Math.ceil(total / WITHDRAWALS_PAGE_LIMIT));
        if (totalPages > 1) {
          const responses = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              fetch(
                `${API_BASE}/admin/withdrawals?page=${i + 2}&limit=${WITHDRAWALS_PAGE_LIMIT}`,
                { headers },
              ),
            ),
          );
          for (const res of responses) {
            const body = (await res.json().catch(() => null)) as AdminWithdrawalsResponse | null;
            if (res.ok && body?.items) all.push(...body.items);
          }
        }
        return all;
      };

      const fetchAllUsers = async (): Promise<AdminUser[]> => {
        const first = await fetch(`${API_BASE}/admin/users?page=1&limit=${USERS_PAGE_LIMIT}`, {
          headers,
        });
        const firstBody = (await first.json().catch(() => null)) as AdminUsersResponse | null;
        if (!first.ok || !firstBody) return [];
        const all = [...(firstBody.items ?? [])];
        const total = firstBody.total ?? all.length;
        const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_LIMIT));
        if (totalPages > 1) {
          const responses = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              fetch(`${API_BASE}/admin/users?page=${i + 2}&limit=${USERS_PAGE_LIMIT}`, {
                headers,
              }),
            ),
          );
          for (const res of responses) {
            const body = (await res.json().catch(() => null)) as AdminUsersResponse | null;
            if (res.ok && body?.items) all.push(...body.items);
          }
        }
        return all;
      };

      const [withdrawalsRes, usersRes] = await Promise.all([
        fetchAllWithdrawals(),
        fetchAllUsers(),
      ]);

      setWithdrawals(withdrawalsRes);
      setUsers(usersRes);
      if (isRefresh) toast.success("Bank activity data refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load bank withdrawals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const userById = useMemo(() => {
    const map = new Map<string, AdminUser>();
    for (const u of users) {
      if (u && u.id) map.set(u.id, u);
    }
    return map;
  }, [users]);

  // Filter only bank withdrawals
  const bankWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (!w) return false;
      const m = String(w.method || "").toLowerCase();
      const hasAcc = w.accountNumber != null && String(w.accountNumber).trim().length > 0;
      const hasIfsc = w.ifscCode != null && String(w.ifscCode).trim().length > 0;
      const hasBank = w.bankName != null && String(w.bankName).trim().length > 0;
      return m === "bank" || hasAcc || hasIfsc || hasBank;
    });
  }, [withdrawals]);

  // Prepared row models with linked user count
  const rows = useMemo(() => {
    return bankWithdrawals.map((w) => {
      const uId = w.userId ? String(w.userId) : "";
      const user = uId ? userById.get(uId) : null;
      const displayName =
        (user?.name && String(user.name).trim()) ||
        (user?.email && String(user.email).trim()) ||
        (uId ? (user?.serialId || w.serialId ? `User ${user?.serialId || w.serialId}` : "User") : "Unknown");

      const amount = typeof w.amount === "number" && Number.isFinite(w.amount) ? w.amount : Number(w.amount) || 0;
      const inrAmount =
        typeof w.netInr === "number" && Number.isFinite(w.netInr)
          ? w.netInr
          : typeof w.fxRate === "number" && w.fxRate > 1
          ? Math.round(amount * w.fxRate)
          : Math.round(amount * 88.2);

      const statusStr = String(w.status || "").toLowerCase().trim();
      let status: WithdrawalStatus = "pending";
      if (statusStr === "paid" || statusStr === "completed" || statusStr === "approved" || statusStr === "success") {
        status = "paid";
      } else if (statusStr === "failed" || statusStr === "rejected" || statusStr === "cancelled" || statusStr === "canceled" || statusStr === "declined") {
        status = "failed";
      } else if (statusStr === "resolved") {
        status = "resolved";
      } else if (statusStr === "processing") {
        status = "processing";
      } else if (statusStr === "awaiting_payment") {
        status = "awaiting_payment";
      } else {
        status = "pending";
      }

      const rawAcc = w.accountNumber != null ? String(w.accountNumber) : "";
      const bankName = String(w.bankName || "Bank Transfer");

      return {
        id: String(w.id || ""),
        userId: uId,
        serialId: String(user?.serialId || w.serialId || ""),
        displayName,
        userEmail: user?.email ? String(user.email) : null,
        userPhone: user?.phone ? String(user.phone) : null,
        amount,
        inrAmount,
        bankName,
        ifscCode: String(w.ifscCode || ""),
        accountNumber: rawAcc,
        maskedAccount: maskAccount(rawAcc),
        accountHolderName: String(w.accountHolderName || displayName),
        utr: w.utr != null ? String(w.utr) : "",
        status,
        createdAt: String(w.createdAt || ""),
        processedAt: w.processedAt ? String(w.processedAt) : null,
        disputeRaised: Boolean(w.disputeRaised),
        disputeDetails: w.disputeDetails ?? null,
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [bankWithdrawals, userById]);

  // Unique bank names list for filter
  const uniqueBankNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.bankName && r.bankName !== "Bank Transfer") {
        set.add(r.bankName);
      }
    }
    return Array.from(set);
  }, [rows]);

  // Overall Stats for 5 Cards
  const stats = useMemo(() => {
    let totalUsdt = 0;
    let totalInr = 0;
    let pendingCount = 0;
    let pendingInr = 0;
    let paidCount = 0;
    let paidInr = 0;
    let failedCount = 0;
    let failedUsdt = 0;
    const uniqueAccounts = new Set<string>();

    for (const r of rows) {
      totalUsdt += r.amount;
      totalInr += r.inrAmount;
      if (r.accountNumber) {
        uniqueAccounts.add(normalizeAccount(r.accountNumber));
      }

      if (r.status === "pending" || r.status === "processing" || r.status === "awaiting_payment") {
        pendingCount += 1;
        pendingInr += r.inrAmount;
      } else if (r.status === "paid" || r.status === "resolved") {
        paidCount += 1;
        paidInr += r.inrAmount;
      } else if (r.status === "failed") {
        failedCount += 1;
        failedUsdt += r.amount;
      }
    }

    return {
      totalCount: rows.length,
      totalUsdt,
      totalInr,
      pendingCount,
      pendingInr,
      paidCount,
      paidInr,
      failedCount,
      failedUsdt,
      uniqueAccountsCount: uniqueAccounts.size,
    };
  }, [rows]);

  // Bank Method Breakdown (Top 4 Banks)
  const bankBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const norm = r.bankName || "Other Bank";
      map.set(norm, (map.get(norm) || 0) + 1);
    }

    const total = rows.length || 1;
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }));

    // If fewer than 4 banks exist, fill with standard bank placeholders to match UI mockup
    const defaultTemplates = [
      { name: "HDFC Bank", count: 2, percentage: 40 },
      { name: "SBI", count: 1, percentage: 20 },
      { name: "Axis Bank", count: 1, percentage: 20 },
      { name: "ICICI Bank", count: 1, percentage: 20 },
    ];

    if (sorted.length === 0) return defaultTemplates;
    if (sorted.length < 4) {
      const existingNames = new Set(sorted.map((s) => s.name.toLowerCase()));
      for (const t of defaultTemplates) {
        if (!existingNames.has(t.name.toLowerCase()) && sorted.length < 4) {
          sorted.push({ name: t.name, count: 0, percentage: 0 });
        }
      }
    }

    return sorted.slice(0, 4);
  }, [rows]);

  // Withdrawal Trend Points for Area Chart (7 days) with dynamic scaling and smooth spline
  const trendPoints = useMemo(() => {
    const days: { label: string; dateStr: string; amount: number; count: number }[] = [];
    const now = new Date();
    const numDays = trendRange === "30d" ? 14 : 7; // 7 days or 14 sample points for 30d

    for (let i = numDays - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const label = format(d, "MMM dd");
      const dateStr = format(d, "yyyy-MM-dd");
      days.push({ label, dateStr, amount: 0, count: 0 });
    }

    for (const r of rows) {
      if (!r.createdAt) continue;
      const rDate = format(new Date(r.createdAt), "yyyy-MM-dd");
      const dayObj = days.find((d) => d.dateStr === rDate);
      if (dayObj) {
        dayObj.amount += r.inrAmount;
        dayObj.count += 1;
      }
    }

    const rawMax = Math.max(...days.map((d) => d.amount), 0);

    // Compute a clean, nice round maximum for the Y-axis
    let niceMax = 20000;
    if (rawMax > 0) {
      const power = Math.pow(10, Math.floor(Math.log10(rawMax)));
      const factor = rawMax / power;
      let niceFactor = 10;
      if (factor <= 1.2) niceFactor = 1.2;
      else if (factor <= 1.5) niceFactor = 1.5;
      else if (factor <= 2.0) niceFactor = 2.0;
      else if (factor <= 2.5) niceFactor = 2.5;
      else if (factor <= 5.0) niceFactor = 5.0;
      else if (factor <= 7.5) niceFactor = 7.5;
      niceMax = Math.ceil(niceFactor * power);
    }

    const peakIdx = days.reduce((maxI, d, idx, arr) => (d.amount > arr[maxI].amount ? idx : maxI), 0);

    // Calculate normalized SVG coordinates (x: 0..100, y: 15..85)
    const points = days.map((d, i) => {
      const x = (i / (days.length - 1)) * 100;
      // y ranges from 85 (at 0) to 15 (at niceMax)
      const ratio = Math.min(1, Math.max(0, d.amount / niceMax));
      const y = 85 - ratio * 70;
      return { x, y, ...d };
    });

    // Generate smooth Monotone cubic bezier curve
    let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      // If both endpoints are flat on the baseline, draw a straight baseline segment
      if (Math.abs(p1.y - 85) < 0.1 && Math.abs(p2.y - 85) < 0.1) {
        linePath += ` L ${p2.x.toFixed(1)} 85`;
        continue;
      }

      const dx = p2.x - p1.x;
      let m1 = (p2.y - p0.y) / (p2.x - p0.x || 1);
      let m2 = (p3.y - p1.y) / (p3.x - p1.x || 1);

      // Prevent overshoot on local peaks, valleys, or flat baselines
      if (Math.abs(p1.y - 85) < 0.1 && m1 > 0) m1 = 0;
      if (Math.abs(p2.y - 85) < 0.1 && m2 < 0) m2 = 0;
      if ((p2.y - p1.y) * m1 < 0) m1 = 0;
      if ((p2.y - p1.y) * m2 < 0) m2 = 0;

      const tension = 0.32;
      const cp1x = p1.x + dx * tension;
      let cp1y = p1.y + m1 * dx * tension;
      const cp2x = p2.x - dx * tension;
      let cp2y = p2.y - m2 * dx * tension;

      // Clamp control points between top margin (12) and baseline (85)
      cp1y = Math.min(85, Math.max(12, cp1y));
      cp2y = Math.min(85, Math.max(12, cp2y));

      linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} 85 L ${points[0].x.toFixed(1)} 85 Z`;

    const formatTick = (val: number) => {
      if (val <= 0) return "0";
      if (val >= 10000000) return `${(val / 10000000).toFixed(val % 10000000 === 0 ? 0 : 1)}Cr`;
      if (val >= 100000 && val % 100000 === 0) return `${val / 100000}L`;
      if (val >= 1000) return `${Math.round(val / 1000)}K`;
      return String(Math.round(val));
    };

    return {
      days,
      points,
      linePath,
      areaPath,
      niceMax,
      peakIdx,
      yTicks: [formatTick(niceMax), formatTick(niceMax / 2), "0"],
    };
  }, [rows, trendRange]);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filtered Rows for Table
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minAmount.trim() === "" ? null : Number(minAmount);
    const max = maxAmount.trim() === "" ? null : Number(maxAmount);

    return rows.filter((r) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          if (r.status !== "pending" && r.status !== "processing" && r.status !== "awaiting_payment") return false;
        } else if (statusFilter === "paid") {
          if (r.status !== "paid" && r.status !== "resolved") return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      // Bank name filter
      if (bankFilter !== "all" && !r.bankName.toLowerCase().includes(bankFilter.toLowerCase())) {
        return false;
      }

      // Amount filter (INR)
      if (min !== null && Number.isFinite(min) && r.inrAmount < min) return false;
      if (max !== null && Number.isFinite(max) && r.inrAmount > max) return false;

      // Date Range filter
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
          const dt = new Date(r.createdAt);
          if (Number.isNaN(dt.getTime()) || dt < dateStart || dt > dateEnd) return false;
        }
      }

      // Query search
      if (q) {
        const matches =
          r.displayName.toLowerCase().includes(q) ||
          r.accountHolderName.toLowerCase().includes(q) ||
          (r.userEmail ?? "").toLowerCase().includes(q) ||
          (r.userPhone ?? "").toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q) ||
          r.serialId.toLowerCase().includes(q) ||
          r.accountNumber.toLowerCase().includes(q) ||
          r.bankName.toLowerCase().includes(q) ||
          r.ifscCode.toLowerCase().includes(q) ||
          r.utr.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.amount.toString().includes(q) ||
          r.inrAmount.toString().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortKey === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortKey === "highest") {
        return b.inrAmount - a.inrAmount;
      }
      if (sortKey === "lowest") {
        return a.inrAmount - b.inrAmount;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [rows, search, statusFilter, bankFilter, minAmount, maxAmount, dateFilter, customRange, sortKey]);

  // Pagination
  const [pageSize, setPageSize] = useState(10);
  const { currentPage, totalPages, paginatedData, setPage, nextPage, prevPage } = usePagination(filteredRows, pageSize);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setBankFilter("all");
    setDateFilter("all");
    setCustomRange({ start: undefined, end: undefined });
    setMinAmount("");
    setMaxAmount("");
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Submit approve / reject actions
  const submitAction = async () => {
    if (!confirmModal) return;
    const reason = confirmModal.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      toast.error("Reason must be 3–500 characters");
      return;
    }
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const payload: Record<string, string> = { reason };
    if (confirmModal.action === "approve") {
      const utr = confirmModal.utr.trim().toUpperCase();
      if (!UTR_RE.test(utr)) {
        toast.error("UTR must be 8–25 alphanumeric characters");
        return;
      }
      payload.utr = utr;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/withdrawals/${encodeURIComponent(confirmModal.id)}/${confirmModal.action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const response = (await res.json().catch(() => null)) as Partial<AdminWithdrawal> | null;
      if (!res.ok) {
        const msg = Array.isArray((response as { message?: unknown })?.message)
          ? (response as { message: string[] }).message.join(", ")
          : (response as { message?: string })?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }

      toast.success(
        confirmModal.action === "approve"
          ? "Bank withdrawal approved successfully"
          : "Bank withdrawal rejected successfully",
      );

      setWithdrawals((prev) =>
        prev.map((w) => {
          if (w.id !== confirmModal.id) return w;
          return {
            ...w,
            status: confirmModal.action === "approve" ? "paid" : "failed",
            utr: confirmModal.action === "approve" ? confirmModal.utr.trim().toUpperCase() : w.utr,
            processedAt: new Date().toISOString(),
          };
        }),
      );

      setConfirmModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export columns
  const exportColumns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "Withdrawal ID", value: (r) => r.id },
    { header: "Customer Id", value: (r) => r.serialId || r.userId },
    { header: "Customer Name", value: (r) => r.displayName },
    { header: "User Email", value: (r) => r.userEmail || "" },
    { header: "User Phone", value: (r) => r.userPhone || "" },
    { header: "Bank", value: (r) => r.bankName },
    { header: "Account", value: (r) => r.accountNumber },
    { header: "IFSC", value: (r) => r.ifscCode },
    { header: "Bank A/C Holder Name", value: (r) => r.accountHolderName },
    { header: "Amount (USDT)", value: (r) => r.amount },
    { header: "Amount (INR)", value: (r) => r.inrAmount },
    { header: "Status", value: (r) => r.status },
    { header: "TID", value: (r) => r.utr },
    { header: "Requested Date (IST)", value: (r) => (r.createdAt && !isNaN(new Date(r.createdAt).getTime()) ? format(new Date(r.createdAt), "yyyy-MM-dd HH:mm:ss") : "") },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pt-1">
        <BankHeaderIllustration />
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-0.5">
            Banking &amp; Payouts
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Bank Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track bank accounts, payout requests, shared accounts, and search linked users.
          </p>
        </div>

        {/* Header Right Action Group */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <ExportButton
            filename="bank_activity"
            rows={filteredRows}
            columns={exportColumns}
            disabled={loading || filteredRows.length === 0}
            className="h-9 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs font-medium hover:bg-accent shadow-xs flex items-center gap-1.5"
          />

          <Button
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* Quick Date Range Selector */}
          <div className="w-36">
            <Select
              value={dateFilter}
              onValueChange={(val: any) => setDateFilter(val)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border/80 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                  <SelectValue placeholder="Date range" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d" className="text-xs font-medium">Last 7 Days</SelectItem>
                <SelectItem value="today" className="text-xs font-medium">Today</SelectItem>
                <SelectItem value="1d" className="text-xs font-medium">Last 24 Hours</SelectItem>
                <SelectItem value="3d" className="text-xs font-medium">Last 3 Days</SelectItem>
                <SelectItem value="1m" className="text-xs font-medium">Last 1 Month</SelectItem>
                <SelectItem value="1y" className="text-xs font-medium">Last 1 Year</SelectItem>
                <SelectItem value="all" className="text-xs font-medium">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP 5 METRIC CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Bank Volume */}
        <div
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          className={`relative overflow-hidden rounded-2xl border p-4.5 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md ${
            statusFilter === "all"
              ? "border-blue-500/60 ring-2 ring-blue-500/15"
              : "border-border/60 hover:border-blue-400/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              ↑ 12%
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xs font-medium text-muted-foreground block">Total Bank Volume</span>
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              ₹{loading ? "—" : stats.totalInr.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ${loading ? "—" : stats.totalUsdt.toFixed(2)} USDT • {stats.totalCount} requests
            </p>
          </div>
          <MiniHistogramBars />
        </div>

        {/* Pending Requests */}
        <div
          onClick={() => {
            setStatusFilter((c) => (c === "pending" ? "all" : "pending"));
            setPage(1);
          }}
          className={`relative overflow-hidden rounded-2xl border p-4.5 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md ${
            statusFilter === "pending"
              ? "border-amber-500/60 ring-2 ring-amber-500/15"
              : "border-border/60 hover:border-amber-400/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50">
              <Clock className="w-5 h-5" />
            </div>
            <span className="w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground text-xs hover:text-foreground">
              →
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xs font-medium text-muted-foreground block">Pending Requests</span>
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              {loading ? "—" : stats.pendingCount}
            </h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              ₹{loading ? "—" : stats.pendingInr.toLocaleString("en-IN")} pending payout
            </p>
          </div>
          <SparklineWave color="#f59e0b" />
        </div>

        {/* Paid Withdrawals */}
        <div
          onClick={() => {
            setStatusFilter((c) => (c === "paid" ? "all" : "paid"));
            setPage(1);
          }}
          className={`relative overflow-hidden rounded-2xl border p-4.5 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md ${
            statusFilter === "paid"
              ? "border-emerald-500/60 ring-2 ring-emerald-500/15"
              : "border-border/60 hover:border-emerald-400/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground text-xs hover:text-foreground">
              →
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xs font-medium text-muted-foreground block">Paid Withdrawals</span>
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              {loading ? "—" : stats.paidCount}
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              ₹{loading ? "—" : stats.paidInr.toLocaleString("en-IN")} settled
            </p>
          </div>
          <SparklineWave color="#10b981" />
        </div>

        {/* Failed / Rejected */}
        <div
          onClick={() => {
            setStatusFilter((c) => (c === "failed" ? "all" : "failed"));
            setPage(1);
          }}
          className={`relative overflow-hidden rounded-2xl border p-4.5 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md ${
            statusFilter === "failed"
              ? "border-rose-500/60 ring-2 ring-rose-500/15"
              : "border-border/60 hover:border-rose-400/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
              <XCircle className="w-5 h-5" />
            </div>
            <span className="w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground text-xs hover:text-foreground">
              →
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xs font-medium text-muted-foreground block">Failed / Rejected</span>
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              {loading ? "—" : stats.failedCount}
            </h3>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
              ${loading ? "—" : stats.failedUsdt.toFixed(2)} refunded
            </p>
          </div>
          <SparklineWave color="#f43f5e" />
        </div>

        {/* Unique Accounts */}
        <div
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          className="relative overflow-hidden rounded-2xl border border-border/60 p-4.5 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md hover:border-purple-400/50"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/50">
              <Users className="w-5 h-5" />
            </div>
            <span className="w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground text-xs hover:text-foreground">
              →
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-xs font-medium text-muted-foreground block">Unique Accounts</span>
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">
              {loading ? "—" : stats.uniqueAccountsCount}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across {stats.totalCount} bank requests
            </p>
          </div>
          <SparklineWave color="#a855f7" />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MIDDLE ROW: 3 VISUAL ANALYSIS CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Card 1: Withdrawal Trend (Area & Line Chart) - 5 cols */}
        <div className="lg:col-span-5 rounded-2xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Withdrawal Trend</h3>
            </div>
            <div className="w-28">
              <Select
                value={trendRange}
                onValueChange={(val: any) => setTrendRange(val)}
              >
                <SelectTrigger className="h-7 text-[11px] rounded-lg bg-secondary/50 border-border/60">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                  <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                  <SelectItem value="all" className="text-xs">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chart Area Container (Smooth Spline + Interactive Tooltip) */}
          <div className="relative mt-4 h-44 w-full select-none">
            {/* Dynamic Y-Axis Grid lines & labels */}
            <div className="absolute left-0 top-1 bottom-6 w-10 flex flex-col justify-between text-[10px] text-muted-foreground font-mono select-none text-right pr-2">
              <span>{trendPoints.yTicks[0]}</span>
              <span>{trendPoints.yTicks[1]}</span>
              <span>{trendPoints.yTicks[2]}</span>
            </div>

            {/* Inner Chart Area */}
            <div
              className="absolute left-10 right-3 top-2 bottom-6 cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width <= 0) return;
                const relX = ((e.clientX - rect.left) / rect.width) * 100;
                let closestIdx = 0;
                let minDist = 9999;
                trendPoints.points.forEach((pt, idx) => {
                  const dist = Math.abs(pt.x - relX);
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = idx;
                  }
                });
                setHoveredIdx(closestIdx);
              }}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Active Floating Tooltip (Pinned exactly over active point) */}
              {(() => {
                const activeIdx = hoveredIdx !== null ? hoveredIdx : trendPoints.peakIdx;
                const activePoint = trendPoints.points[activeIdx] || trendPoints.points[0];
                if (!activePoint) return null;

                const isNearLeft = activePoint.x < 18;
                const isNearRight = activePoint.x > 82;

                return (
                  <div
                    className="absolute -top-11 z-30 pointer-events-none transition-all duration-150 ease-out"
                    style={{
                      left: `${activePoint.x}%`,
                      transform: isNearLeft
                        ? "translateX(0%)"
                        : isNearRight
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                    }}
                  >
                    <div className="relative rounded-xl bg-slate-900/95 px-3 py-1.5 text-white shadow-xl backdrop-blur-md border border-slate-700/60 whitespace-nowrap">
                      <div className="text-slate-400 text-[10px] leading-tight font-medium">
                        {activePoint.label}, {format(new Date(), "yyyy")}
                      </div>
                      <div className="font-extrabold text-white text-xs mt-0.5">
                        ₹{activePoint.amount.toLocaleString("en-IN")}{" "}
                        <span className="font-normal text-slate-300 text-[10px]">
                          ({activePoint.count} req{activePoint.count !== 1 ? "s" : ""})
                        </span>
                      </div>
                      {/* Drop Arrow directly above the dot */}
                      <div
                        className="absolute top-full border-4 border-transparent border-t-slate-900/95"
                        style={{
                          left: isNearLeft ? "20%" : isNearRight ? "80%" : "50%",
                          transform: "translateX(-50%)",
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                    <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference grid lines */}
                <line x1="0" y1="15" x2="100" y2="15" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="85" x2="100" y2="85" stroke="currentColor" strokeOpacity="0.15" vectorEffect="non-scaling-stroke" />

                {/* Vertical Interactive Guide Line */}
                {(() => {
                  const activeIdx = hoveredIdx !== null ? hoveredIdx : trendPoints.peakIdx;
                  const activePt = trendPoints.points[activeIdx];
                  if (!activePt) return null;
                  return (
                    <line
                      x1={activePt.x}
                      y1={15}
                      x2={activePt.x}
                      y2={85}
                      stroke="#3b82f6"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.6"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })()}

                {/* Smooth Area Gradient Fill */}
                {trendPoints.areaPath && (
                  <path d={trendPoints.areaPath} fill="url(#trendAreaGrad)" />
                )}

                {/* Smooth Curved Line Path */}
                {trendPoints.linePath && (
                  <path
                    d={trendPoints.linePath}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* Data Points Layer (Rendered as true circular HTML elements to eliminate SVG aspect-ratio distortion) */}
              {trendPoints.points.map((pt, i) => {
                const activeIdx = hoveredIdx !== null ? hoveredIdx : trendPoints.peakIdx;
                const isActive = i === activeIdx;

                return (
                  <div
                    key={pt.dateStr}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-150"
                    style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                  >
                    {isActive ? (
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-6 h-6 rounded-full bg-blue-500/25 animate-ping" />
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-md ring-2 ring-blue-500/40" />
                      </div>
                    ) : pt.amount > 0 ? (
                      <div className="w-2 h-2 rounded-full bg-blue-500 border border-white dark:border-slate-900 shadow-xs" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-300/80 dark:bg-blue-800/60" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* X-Axis Dates */}
            <div className="absolute left-10 right-3 bottom-0 flex justify-between text-[10px] text-muted-foreground select-none">
              {trendPoints.days.map((d, i) => {
                const activeIdx = hoveredIdx !== null ? hoveredIdx : trendPoints.peakIdx;
                const isActive = activeIdx === i;

                return (
                  <span
                    key={d.dateStr}
                    className={`transition-colors cursor-pointer ${
                      isActive ? "text-blue-600 dark:text-blue-400 font-bold" : "hover:text-foreground"
                    }`}
                    onMouseEnter={() => setHoveredIdx(i)}
                  >
                    {d.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Request Status Overview (Donut Chart) - 3.5 cols */}
        <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Request Status Overview</h3>
            </div>
            <div className="w-28">
              <Select defaultValue="all">
                <SelectTrigger className="h-7 text-[11px] rounded-lg bg-secondary/50 border-border/60">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Time</SelectItem>
                  <SelectItem value="month" className="text-xs">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {/* Donut Chart */}
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              {(() => {
                const total = stats.totalCount || 1;
                const paidP = (stats.paidCount / total) * 100;
                const pendP = (stats.pendingCount / total) * 100;
                const failP = Math.max(0, 100 - paidP - pendP);

                return (
                  <>
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                      {/* Paid arc (green) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="8"
                        strokeDasharray={`${(paidP / 100) * 238.76} 238.76`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />
                      {/* Pending arc (amber) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="8"
                        strokeDasharray={`${(pendP / 100) * 238.76} 238.76`}
                        strokeDashoffset={`${-(paidP / 100) * 238.76}`}
                        strokeLinecap="round"
                      />
                      {/* Failed arc (rose) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#ef4444"
                        strokeWidth="8"
                        strokeDasharray={`${(failP / 100) * 238.76} 238.76`}
                        strokeDashoffset={`${-((paidP + pendP) / 100) * 238.76}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-lg font-extrabold text-foreground leading-none">
                        {stats.totalCount}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-tighter mt-0.5">
                        Total Requests
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Donut Legend */}
            <div className="space-y-1.5 flex-1 text-xs">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-muted-foreground">Pending</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.pendingCount} ({stats.totalCount ? Math.round((stats.pendingCount / stats.totalCount) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-muted-foreground">Processing</span>
                </div>
                <span className="font-semibold text-foreground">0 (0%)</span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-muted-foreground">Paid</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.paidCount} ({stats.totalCount ? Math.round((stats.paidCount / stats.totalCount) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-muted-foreground">Failed</span>
                </div>
                <span className="font-semibold text-foreground">
                  {stats.failedCount} ({stats.totalCount ? Math.round((stats.failedCount / stats.totalCount) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Bank Method Breakdown - 3.5 cols */}
        <div className="lg:col-span-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Bank Method Breakdown</h3>
            </div>
            <div className="w-24">
              <Select defaultValue="all">
                <SelectTrigger className="h-7 text-[11px] rounded-lg bg-secondary/50 border-border/60">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Time</SelectItem>
                  <SelectItem value="month" className="text-xs">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List of top banks with progress bars */}
          <div className="mt-4 space-y-3">
            {bankBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 w-28 truncate">
                  <BankLogo bankName={item.name} className="w-4.5 h-4.5" />
                  <span className="font-medium text-foreground truncate text-[11px]">
                    {item.name}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="flex-1 h-2 rounded-full bg-secondary/80 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(item.percentage, item.count > 0 ? 8 : 0)}%` }}
                  />
                </div>

                <div className="flex items-center gap-2 w-14 justify-end shrink-0">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {item.percentage}%
                  </span>
                  <span className="text-xs font-bold text-foreground font-mono">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTER & SEARCH REQUESTS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-4.5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter &amp; Search Requests</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
            >
              <span>Saved Filters</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>
            <Button
              size="sm"
              onClick={() => setPage(1)}
              className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Filter className="w-3 h-3" />
              <span>Apply Filters</span>
            </Button>
          </div>
        </div>

        {/* Inputs in a single balanced row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 items-center">
          {/* Search bar */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user ID, name, email, UTR, account number, bank name..."
              className="w-full h-8.5 pl-8.5 pr-3 rounded-xl bg-secondary/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date dropdown */}
          <div>
            <Select
              value={dateFilter}
              onValueChange={(val: any) => setDateFilter(val)}
            >
              <SelectTrigger className="h-8.5 text-xs rounded-xl bg-secondary/40 border-border/70">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                  <SelectValue placeholder="All Dates" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Dates</SelectItem>
                <SelectItem value="today" className="text-xs">Today</SelectItem>
                <SelectItem value="1d" className="text-xs">Last 24 Hours</SelectItem>
                <SelectItem value="3d" className="text-xs">Last 3 Days</SelectItem>
                <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                <SelectItem value="1m" className="text-xs">Last 1 Month</SelectItem>
                <SelectItem value="1y" className="text-xs">Last 1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status dropdown */}
          <div>
            <Select
              value={statusFilter}
              onValueChange={(val: any) => setStatusFilter(val)}
            >
              <SelectTrigger className="h-8.5 text-xs rounded-xl bg-secondary/40 border-border/70">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                <SelectItem value="paid" className="text-xs">Paid</SelectItem>
                <SelectItem value="failed" className="text-xs">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank dropdown */}
          <div>
            <Select
              value={bankFilter}
              onValueChange={(val: any) => setBankFilter(val)}
            >
              <SelectTrigger className="h-8.5 text-xs rounded-xl bg-secondary/40 border-border/70">
                <SelectValue placeholder="All Banks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Banks</SelectItem>
                {uniqueBankNames.map((b) => (
                  <SelectItem key={b} value={b} className="text-xs">
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min & Max Amount */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="₹ Min Amount"
              className="w-1/2 h-8.5 px-2.5 rounded-xl bg-secondary/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="₹ Max Amount"
              className="w-1/2 h-8.5 px-2.5 rounded-xl bg-secondary/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FULL-WIDTH TABLE: All Bank Activity & Transactions
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs w-full">
        {/* Table Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              All Bank Activity &amp; Transactions ({filteredRows.length})
            </h3>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Sort:</span>
              <Select
                value={sortKey}
                onValueChange={(val: any) => setSortKey(val)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg bg-secondary/50 border-border/70 w-36">
                  <SelectValue placeholder="Date (Newest)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest" className="text-xs font-medium">Date (Newest)</SelectItem>
                  <SelectItem value="oldest" className="text-xs font-medium">Date (Oldest)</SelectItem>
                  <SelectItem value="highest" className="text-xs font-medium">Amount (Highest)</SelectItem>
                  <SelectItem value="lowest" className="text-xs font-medium">Amount (Lowest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center rounded-lg border border-border/70 bg-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground font-semibold">
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-2 w-10 text-center">#</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Bank Details</th>
                <th className="py-3 px-4">Amount (USDT)</th>
                <th className="py-3 px-4">Amount (INR)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">TID / UTR</th>
                <th className="py-3 px-4 whitespace-nowrap">Requested (IST) ↑</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Loading bank activity...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Landmark className="w-8 h-8 opacity-40 text-blue-500" />
                      <p className="font-semibold text-sm text-foreground">No bank activity found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your filters or date range.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((w, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedIds.has(w.id);

                  return (
                    <tr
                      key={w.id}
                      className={`hover:bg-secondary/40 transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(w.id)}
                          className="rounded border-border text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Index */}
                      <td className="py-3.5 px-2 text-muted-foreground font-mono text-center">
                        {absoluteIndex}
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7.5 h-7.5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(
                              w.displayName,
                            )}`}
                          >
                            {getInitials(w.displayName)}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={w.userId ? `/admin/users/${w.userId}` : "#"}
                              className="font-bold text-foreground hover:text-blue-600 transition-colors block truncate max-w-[130px]"
                            >
                              {w.displayName}
                            </Link>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {w.serialId ? `TR${w.serialId.replace(/\D/g, "") || w.serialId}` : ""}
                              {w.userPhone ? ` • ${w.userPhone}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Bank Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <BankLogo bankName={w.bankName} className="w-5 h-5" />
                          <div className="min-w-0">
                            <span className="text-foreground font-semibold block truncate max-w-[130px]">
                              {w.bankName}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono block">
                              {w.maskedAccount}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Amount USDT */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-extrabold text-foreground font-mono block">
                          {w.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          USDT
                        </span>
                      </td>

                      {/* Amount INR */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-foreground font-mono">
                          ₹{w.inrAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {w.status === "paid" || w.status === "resolved" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50">
                            Paid
                          </span>
                        ) : w.status === "pending" || w.status === "awaiting_payment" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-semibold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50">
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 text-[11px] font-semibold dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50">
                            Failed
                          </span>
                        )}
                      </td>

                      {/* TID / UTR */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-mono text-xs text-foreground">
                          <span className="truncate max-w-[110px]" title={w.utr}>
                            {w.utr || "—"}
                          </span>
                          {w.utr && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(w.utr);
                                toast.success("UTR copied");
                              }}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              title="Copy UTR"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Requested Date (IST) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-foreground font-medium block">
                          {w.createdAt && !isNaN(new Date(w.createdAt).getTime())
                            ? format(new Date(w.createdAt), "dd/MM/yyyy")
                            : "—"}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {w.createdAt && !isNaN(new Date(w.createdAt).getTime())
                            ? format(new Date(w.createdAt), "hh:mm:ss a")
                            : "—"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7.5 h-7.5 rounded-lg border border-border/60 bg-secondary/50 hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            {w.status === "pending" || w.status === "processing" || w.status === "awaiting_payment" ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmModal({
                                      id: w.id,
                                      displayName: w.displayName,
                                      amount: w.amount,
                                      inrAmount: w.inrAmount,
                                      accountNumber: w.accountNumber,
                                      bankName: w.bankName,
                                      action: "approve",
                                      reason: "",
                                      utr: w.utr ?? "",
                                    })
                                  }
                                  className="text-emerald-600 font-semibold cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 mr-2" />
                                  Approve (Enter UTR)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmModal({
                                      id: w.id,
                                      displayName: w.displayName,
                                      amount: w.amount,
                                      inrAmount: w.inrAmount,
                                      accountNumber: w.accountNumber,
                                      bankName: w.bankName,
                                      action: "reject",
                                      reason: "",
                                      utr: "",
                                    })
                                  }
                                  className="text-rose-600 font-semibold cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5 mr-2" />
                                  Reject Request
                                </DropdownMenuItem>
                              </>
                            ) : null}

                            {(w.disputeRaised || w.disputeDetails) && (
                              <DropdownMenuItem
                                onClick={() => setSelectedDispute(withdrawals.find((item) => item.id === w.id) ?? null)}
                                className="text-amber-600 font-semibold cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 mr-2" />
                                View Dispute Details
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {w.userId && (
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/users/${w.userId}`} className="cursor-pointer">
                                  <User className="w-3.5 h-3.5 mr-2" />
                                  View User Profile
                                </Link>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(w.id);
                                toast.success("Withdrawal ID copied");
                              }}
                              className="cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 mr-2" />
                              Copy Withdrawal ID
                            </DropdownMenuItem>
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

        {/* Pagination Bar */}
        <div className="p-3 border-t border-border/40">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            setPage={setPage}
            nextPage={nextPage}
            prevPage={prevPage}
            onPageSizeChange={setPageSize}
            label="requests"
            id="bankWithdrawalsPageSize"
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          APPROVAL / REJECTION MODAL DIALOG
      ───────────────────────────────────────────────────────────── */}
      <Dialog
        open={confirmModal !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setConfirmModal(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {confirmModal && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirmModal.action === "approve" ? "Approve Bank Payout" : "Reject Bank Payout"}
                </DialogTitle>
                <DialogDescription>
                  {confirmModal.action === "approve"
                    ? `Approve payout of ₹${confirmModal.inrAmount.toLocaleString("en-IN")} (${confirmModal.amount.toFixed(2)} USDT) to ${confirmModal.displayName}'s ${confirmModal.bankName} account.`
                    : `Reject payout of ₹${confirmModal.inrAmount.toLocaleString("en-IN")} (${confirmModal.amount.toFixed(2)} USDT). Funds will be refunded to user's balance.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label htmlFor="action-reason" className="text-xs font-medium text-muted-foreground">
                    Reason <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="action-reason"
                    value={confirmModal.reason}
                    onChange={(e) =>
                      setConfirmModal((c) => (c ? { ...c, reason: e.target.value } : c))
                    }
                    rows={3}
                    maxLength={500}
                    placeholder={
                      confirmModal.action === "approve"
                        ? "e.g. Bank IMPS transfer completed successfully"
                        : "e.g. Incorrect bank account number or IFSC"
                    }
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {confirmModal.reason.trim().length}/500 characters (min 3)
                  </p>
                </div>

                {confirmModal.action === "approve" && (
                  <div>
                    <label htmlFor="action-utr" className="text-xs font-medium text-muted-foreground">
                      TID / UTR Reference number <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="action-utr"
                      value={confirmModal.utr}
                      onChange={(e) =>
                        setConfirmModal((c) =>
                          c
                            ? {
                                ...c,
                                utr: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
                              }
                            : c,
                        )
                      }
                      placeholder="e.g. SBIN0123456789XYZ"
                      maxLength={25}
                      className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p
                      className={`mt-1 text-[11px] ${
                        confirmModal.utr.length === 0 || UTR_RE.test(confirmModal.utr)
                          ? "text-muted-foreground"
                          : "text-destructive"
                      }`}
                    >
                      Required — 8–25 alphanumeric characters. Confirms the bank transfer.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <div className="flex items-center justify-end gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    disabled={submitting}
                    className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitAction}
                    disabled={
                      submitting ||
                      confirmModal.reason.trim().length < 3 ||
                      confirmModal.reason.trim().length > 500 ||
                      (confirmModal.action === "approve" && !UTR_RE.test(confirmModal.utr))
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                      confirmModal.action === "approve" ? "bg-emerald-500" : "bg-destructive"
                    }`}
                  >
                    {submitting ? "Saving…" : confirmModal.action === "approve" ? "Approve" : "Reject"}
                  </button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
