import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { subDays, subMonths, subYears, startOfDay, endOfDay, format } from "date-fns";
import ExportButton from "@/components/shared/ExportButton";
import { TronLink } from "@/components/shared/TronLink";
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
  HandCoins,
  ShieldAlert,
  FileText,
  ExternalLink,
  CheckCircle2,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Clock,
  XCircle,
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  MoreHorizontal,
  ChevronDown,
  Layers,
  Copy,
  Landmark,
  QrCode,
  Coins,
  User,
} from "lucide-react";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

type WithdrawalStatus = "pending" | "processing" | "paid" | "failed" | "awaiting_payment" | "resolved" | "reserved";
type WithdrawalMethod = "bank" | "upi" | "crypto" | "smart_upi";

interface AdminWithdrawal {
  id: string;
  userId: string;
  serialId?: string | null;
  method: WithdrawalMethod;
  amount: number;
  feeRate?: number;
  fxRate?: number;
  feeUsdt?: number;
  netUsdt?: number;
  grossInr?: number | null;
  feeInr?: number | null;
  netInr?: number | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  accountHolderName?: string | null;
  upiId?: string | null;
  network?: string | null;
  destinationAddress?: string | null;
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
  isSmart?: boolean;
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

const UTR_RE = /^[A-Z0-9]{8,25}$/;

interface AdminWithdrawalsResponse {
  items: AdminWithdrawal[];
  total: number;
  page: number;
  limit: number;
}

interface AdminUser {
  id: string;
  serialId?: string | null;
  name: string | null;
  email: string | null;
  phone?: string | null;
}

interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
}

const WITHDRAWALS_PAGE_LIMIT = 200;
const USERS_PAGE_LIMIT = 100;

function truncateMiddle(value: string, head = 6, tail = 6) {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function maskAccount(account: string | null | undefined) {
  if (!account) return "";
  const v = account.replace(/\s/g, "");
  if (v.length <= 4) return `****${v}`;
  return `****${v.slice(-4)}`;
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

const DISPUTE_REASON_MAP: Record<string, string> = {
  not_received: "Money not received in bank account",
  wrong_amount: "Amount received is lower than requested",
  amount_mismatch: "Amount received is lower than requested",
  fake_receipt: "Payment proof / UTR looks fake or invalid",
  other: "Other issue",
};

/* ─────────────────────────────────────────────────────────────
   3D HEADER WALLET ARTWORK (NexaPay style)
───────────────────────────────────────────────────────────── */
const WithdrawalsHeaderIllustration = () => {
  return (
    <div className="absolute right-0 -top-6 w-[360px] h-[190px] pointer-events-none select-none hidden lg:block overflow-visible">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-36 bg-gradient-to-r from-blue-400/25 via-sky-300/35 to-indigo-400/15 rounded-full blur-2xl pointer-events-none" />

      <svg
        viewBox="0 0 360 190"
        className="w-full h-full overflow-visible drop-shadow-xl"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wdWalletBodyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          <linearGradient id="wdWalletFlapGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          <linearGradient id="wdArrowUpGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          <linearGradient id="wdGoldCoinGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          <radialGradient id="wdSoftOrbGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#38bdf8" />
          </radialGradient>
        </defs>

        {/* 3D Arrow Upward Rising behind wallet */}
        <g transform="translate(195, 18) rotate(14)">
          <path
            d="M30 75 L30 30 L10 40 L45 0 L80 40 L60 30 L60 75 Z"
            fill="url(#wdArrowUpGrad)"
            className="drop-shadow-lg"
          />
        </g>

        {/* Floating Soft Blue Spheres */}
        <circle cx="75" cy="52" r="12" fill="url(#wdSoftOrbGrad)" opacity="0.75" />
        <circle cx="270" cy="140" r="8" fill="url(#wdSoftOrbGrad)" opacity="0.6" />

        {/* 3D Wallet Body (Tilted claymorphic look) */}
        <g transform="translate(110, 45) rotate(-8)">
          {/* Card peeking out */}
          <rect
            x="20"
            y="-16"
            width="90"
            height="50"
            rx="8"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="1.5"
            className="drop-shadow-sm"
          />
          <rect x="30" y="-8" width="24" height="14" rx="3" fill="#cbd5e1" opacity="0.8" />
          <circle cx="95" cy="-2" r="6" fill="#38bdf8" opacity="0.5" />

          {/* Main Wallet Base */}
          <rect
            x="0"
            y="12"
            width="135"
            height="90"
            rx="18"
            fill="url(#wdWalletBodyGrad)"
            stroke="#93c5fd"
            strokeWidth="2"
            className="drop-shadow-2xl"
          />

          {/* Subtle Top Highlights */}
          <path
            d="M 14 16 Q 67 14 121 16"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.45"
          />

          {/* Wallet Center Clasp / Flap */}
          <rect
            x="35"
            y="42"
            width="65"
            height="30"
            rx="12"
            fill="url(#wdWalletFlapGrad)"
            stroke="#bfdbfe"
            strokeWidth="1.5"
            className="drop-shadow-md"
          />
          {/* Metallic Button */}
          <circle cx="82" cy="57" r="7" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" />
          <circle cx="82" cy="57" r="3.5" fill="#3b82f6" />
        </g>

        {/* 3D Floating Gold Coin on right */}
        <g transform="translate(260, 68)">
          <ellipse cx="18" cy="18" rx="16" ry="16" fill="url(#wdGoldCoinGrad)" className="drop-shadow-md" />
          <ellipse cx="18" cy="18" rx="12" ry="12" fill="none" stroke="#fef08a" strokeWidth="1.5" opacity="0.8" />
          <text
            x="18"
            y="23"
            textAnchor="middle"
            fill="#854d0e"
            fontWeight="bold"
            fontSize="14"
            fontFamily="system-ui, sans-serif"
          >
            $
          </text>
        </g>
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   3D EMPTY PARCEL BOX (Matching Screenshot)
───────────────────────────────────────────────────────────── */
const EmptyParcelIllustration = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative w-36 h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-400/15 rounded-full blur-xl pointer-events-none" />
        <svg
          viewBox="0 0 140 120"
          className="w-full h-full drop-shadow-md overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="wdBoxFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfdbfe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>
            <linearGradient id="wdBoxRight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <linearGradient id="wdBoxInside" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
            <linearGradient id="wdBoxFlap" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>
          </defs>

          <path
            d="M 28 20 Q 28 26 22 26 Q 28 26 28 32 Q 28 26 34 26 Q 28 26 28 20 Z"
            fill="#60a5fa"
            opacity="0.8"
          />
          <path
            d="M 112 18 Q 112 24 106 24 Q 112 24 112 30 Q 112 24 118 24 Q 112 24 112 18 Z"
            fill="#38bdf8"
            opacity="0.9"
          />

          <path d="M 35 48 L 70 65 L 105 48 L 70 34 Z" fill="url(#wdBoxInside)" />
          <path d="M 35 48 L 70 65 L 70 102 L 35 84 Z" fill="url(#wdBoxFront)" />
          <path d="M 70 65 L 105 48 L 105 84 L 70 102 Z" fill="url(#wdBoxRight)" />
          <path d="M 70 65 L 70 102" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />
          <path d="M 35 48 L 70 65 L 60 76 L 24 58 Z" fill="url(#wdBoxFlap)" opacity="0.95" />
          <path d="M 70 65 L 105 48 L 116 58 L 80 76 Z" fill="url(#wdBoxFlap)" opacity="0.95" />
          <path d="M 35 48 L 70 34 L 62 20 L 25 36 Z" fill="url(#wdBoxFlap)" opacity="0.75" />
          <path d="M 70 34 L 105 48 L 115 36 L 78 20 Z" fill="url(#wdBoxFlap)" opacity="0.75" />
        </svg>
      </div>

      <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
        No withdrawal requests found
      </h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center max-w-sm">
        Try adjusting your search criteria, clear filters, or select a wider date range.
      </p>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BOTTOM SPARKLINE WAVE COMPONENT
───────────────────────────────────────────────────────────── */
const SparklineWave = ({ color }: { color: string }) => {
  return (
    <div className="absolute -bottom-1 left-0 right-0 w-full h-8 overflow-hidden pointer-events-none opacity-85">
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

export default function AdminWithdrawals() {
  const [searchParams] = useSearchParams();
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WithdrawalStatus>("all");
  const [methodFilter, setMethodFilter] = useState<"all" | WithdrawalMethod>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "1d" | "3d" | "7d" | "1m" | "1y" | "custom" | "all">("all");
  const [customRange, setCustomRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  const [minAmountUsdt, setMinAmountUsdt] = useState("");
  const [maxAmountUsdt, setMaxAmountUsdt] = useState("");
  const [minAmountInr, setMinAmountInr] = useState("");
  const [maxAmountInr, setMaxAmountInr] = useState("");
  const [pipelineRange, setPipelineRange] = useState<"all" | "30d" | "today">("30d");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal states
  const [selectedDispute, setSelectedDispute] = useState<AdminWithdrawal | null>(null);
  const [confirm, setConfirm] = useState<
    | {
        id: string;
        displayName: string;
        amount: number;
        method: WithdrawalMethod;
        currentStatus: WithdrawalStatus;
        action: "approve" | "reject";
        reason: string;
        txHash: string;
        utr: string;
      }
    | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize from searchParams
  useEffect(() => {
    const dateParam = searchParams.get("dateFilter");
    const statusParam = searchParams.get("statusFilter");
    const searchParam = searchParams.get("search") || searchParams.get("userId") || searchParams.get("q");
    if (dateParam) {
      setDateFilter(dateParam as any);
    }
    if (statusParam) {
      setStatusFilter(statusParam as any);
    }
    if (searchParam) {
      setSearch(searchParam);
    }
  }, [searchParams]);

  // Load Data
  const loadData = useCallback(async (isManualRefresh = false) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      setLoading(false);
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

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
            (firstBody as unknown as { message?: string })?.message ??
              "Could not load withdrawals",
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

      const [withdrawalsResult, usersResult] = await Promise.all([
        fetchAllWithdrawals(),
        fetchAllUsers(),
      ]);
      setWithdrawals(withdrawalsResult);
      setUsers(usersResult);
      if (isManualRefresh) toast.success("Withdrawals data refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const userById = useMemo(() => {
    const map = new Map<string, AdminUser>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  // Normalized Rows
  const rows = useMemo(() => {
    return withdrawals.map((w) => {
      const user = w.userId ? userById.get(w.userId) : null;
      const displayName =
        user?.name?.trim() ||
        user?.email ||
        (w.userId ? (user?.serialId || w.serialId ? `User ${user?.serialId || w.serialId}` : "User") : "Unknown");
      const amount = typeof w.amount === "number" && Number.isFinite(w.amount) ? w.amount : 0;
      const inrAmount =
        typeof w.netInr === "number" && Number.isFinite(w.netInr)
          ? w.netInr
          : typeof w.fxRate === "number" && w.fxRate > 1
          ? Math.round(amount * w.fxRate)
          : Math.round(amount * 88.2);

      const rawStatus = String(w.status || "").toLowerCase().trim();
      let status: WithdrawalStatus = "pending";
      if (rawStatus === "paid" || rawStatus === "completed" || rawStatus === "approved" || rawStatus === "success") {
        status = "paid";
      } else if (rawStatus === "failed" || rawStatus === "rejected" || rawStatus === "cancelled" || rawStatus === "canceled" || rawStatus === "declined") {
        status = "failed";
      } else if (rawStatus === "resolved") {
        status = "resolved";
      } else if (rawStatus === "processing") {
        status = "processing";
      } else if (rawStatus === "awaiting_payment") {
        status = "awaiting_payment";
      } else if (rawStatus === "reserved") {
        status = "reserved";
      } else if (rawStatus === "pending" || rawStatus === "requested") {
        status = "pending";
      } else {
        status = "failed";
      }

      const isSmartUpi =
        Boolean(w.isSmart) ||
        (w.method as string) === "smart_upi" ||
        Boolean(w.notes && w.notes.toLowerCase().includes("smart"));
      const method: WithdrawalMethod =
        isSmartUpi
          ? "smart_upi"
          : w.method === "crypto"
          ? "crypto"
          : w.method === "upi"
          ? "upi"
          : "bank";

      const destinationLine =
        method === "bank"
          ? [w.bankName, w.ifscCode, maskAccount(w.accountNumber)].filter(Boolean).join(" · ")
          : method === "upi" || method === "smart_upi"
          ? w.upiId ?? ""
          : [w.network, w.destinationAddress ? truncateMiddle(w.destinationAddress) : null]
              .filter(Boolean)
              .join(" · ");

      const accountHolderName =
        w.accountHolderName ||
        (method === "bank" ? (user?.name || displayName) : "") ||
        "";

      return {
        id: w.id,
        userId: w.userId,
        serialId: user?.serialId || w.serialId || "",
        displayName,
        accountHolderName,
        userEmail: user?.email ?? null,
        userPhone: user?.phone ?? null,
        amount,
        inrAmount,
        method,
        destinationLine,
        bankName: w.bankName ?? "",
        ifscCode: w.ifscCode ?? "",
        accountNumber: w.accountNumber ?? "",
        upiId: w.upiId ?? "",
        destinationAddress: w.destinationAddress ?? "",
        txHash: w.txHash ?? "",
        utr: w.utr ?? "",
        status,
        disputeRaised: Boolean(w.disputeRaised),
        disputeDetails: w.disputeDetails ?? null,
        paymentProofUrl: w.paymentProofUrl ?? null,
        createdAt: w.createdAt,
        processedAt: w.processedAt ?? null,
        processedBy: w.processedBy ?? null,
        processedByRole: w.processedByRole ?? null,
        processedByName: w.processedByName ?? null,
        decisionReason: w.decisionReason ?? null,
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [withdrawals, userById]);

  // Overall Statistics for 5 Top Cards
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalRequestedUsdt = 0;

    let successfulCount = 0;
    let successfulUsdt = 0;
    let successfulInr = 0;

    let pendingCount = 0;
    let pendingUsdt = 0;

    let failedCount = 0;
    let failedUsdt = 0;

    for (const r of rows) {
      totalCount += 1;
      const amt = r.amount || 0;
      const inr = r.inrAmount || 0;
      totalRequestedUsdt += amt;

      if (r.status === "paid" || r.status === "resolved") {
        successfulCount += 1;
        successfulUsdt += amt;
        successfulInr += inr;
      } else if (r.status === "pending" || r.status === "processing" || r.status === "awaiting_payment" || r.status === "reserved") {
        pendingCount += 1;
        pendingUsdt += amt;
      } else if (r.status === "failed") {
        failedCount += 1;
        failedUsdt += amt;
      }
    }

    return {
      totalCount,
      totalRequestedUsdt,
      successfulCount,
      successfulUsdt,
      successfulInr,
      pendingCount,
      pendingUsdt,
      failedCount,
      failedUsdt,
    };
  }, [rows]);

  // Pipeline Data (filterable by pipelineRange)
  const pipelineStats = useMemo(() => {
    let list = rows;
    if (pipelineRange === "today") {
      const todayStart = startOfDay(new Date());
      list = rows.filter((r) => new Date(r.createdAt) >= todayStart);
    } else if (pipelineRange === "30d") {
      const thirtyDaysAgo = subDays(new Date(), 30);
      list = rows.filter((r) => new Date(r.createdAt) >= thirtyDaysAgo);
    }

    let pending = 0;
    let pendingUsdt = 0;
    let processing = 0;
    let processingUsdt = 0;
    let paid = 0;
    let paidUsdt = 0;
    let failed = 0;
    let failedUsdt = 0;

    for (const r of list) {
      if (r.status === "pending" || r.status === "awaiting_payment" || r.status === "reserved") {
        pending += 1;
        pendingUsdt += r.amount;
      } else if (r.status === "processing") {
        processing += 1;
        processingUsdt += r.amount;
      } else if (r.status === "paid" || r.status === "resolved") {
        paid += 1;
        paidUsdt += r.amount;
      } else if (r.status === "failed") {
        failed += 1;
        failedUsdt += r.amount;
      }
    }

    const total = list.length || 1;
    const pendingPct = Math.round((pending / total) * 100);
    const processingPct = Math.round((processing / total) * 100);
    const paidPct = Math.round((paid / total) * 100);
    const failedPct = Math.max(0, 100 - pendingPct - processingPct - paidPct);

    return {
      total: list.length,
      pending,
      pendingUsdt,
      pendingPct,
      processing,
      processingUsdt,
      processingPct,
      paid,
      paidUsdt,
      paidPct,
      failed,
      failedUsdt,
      failedPct,
    };
  }, [rows, pipelineRange]);

  // Filtered rows for Table
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minU = minAmountUsdt.trim() === "" ? null : Number(minAmountUsdt);
    const maxU = maxAmountUsdt.trim() === "" ? null : Number(maxAmountUsdt);
    const minI = minAmountInr.trim() === "" ? null : Number(minAmountInr);
    const maxI = maxAmountInr.trim() === "" ? null : Number(maxAmountInr);

    return rows.filter((r) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          if (r.status !== "pending" && r.status !== "processing" && r.status !== "awaiting_payment" && r.status !== "reserved") {
            return false;
          }
        } else if (statusFilter === "paid") {
          if (r.status !== "paid" && r.status !== "resolved") return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      // Method filter
      if (methodFilter !== "all") {
        if (methodFilter === "bank" && r.method !== "bank") return false;
        if (methodFilter === "upi" && r.method !== "upi" && r.method !== "smart_upi") return false;
        if (methodFilter === "crypto" && r.method !== "crypto") return false;
      }

      // Amount USDT filters
      if (minU !== null && Number.isFinite(minU) && r.amount < minU) return false;
      if (maxU !== null && Number.isFinite(maxU) && r.amount > maxU) return false;

      // Amount INR filters
      if (minI !== null && Number.isFinite(minI) && r.inrAmount < minI) return false;
      if (maxI !== null && Number.isFinite(maxI) && r.inrAmount > maxI) return false;

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

      // Search query
      if (q) {
        const matches =
          r.displayName.toLowerCase().includes(q) ||
          (r.accountHolderName ?? "").toLowerCase().includes(q) ||
          (r.userEmail ?? "").toLowerCase().includes(q) ||
          (r.userPhone ?? "").toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q) ||
          (r.serialId ?? "").toLowerCase().includes(q) ||
          (r.accountNumber ?? "").toLowerCase().includes(q) ||
          (r.upiId ?? "").toLowerCase().includes(q) ||
          (r.destinationAddress ?? "").toLowerCase().includes(q) ||
          (r.txHash ?? "").toLowerCase().includes(q) ||
          (r.utr ?? "").toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.amount.toString().includes(q) ||
          r.inrAmount.toString().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter, methodFilter, minAmountUsdt, maxAmountUsdt, minAmountInr, maxAmountInr, dateFilter, customRange]);

  // Needs Attention items (Pending, Failed, Disputed)
  const needsAttentionList = useMemo(() => {
    return rows
      .filter((r) => r.status === "pending" || r.status === "failed" || r.disputeRaised)
      .slice(0, 4);
  }, [rows]);

  // Recent Activity items
  const recentActivityList = useMemo(() => {
    return rows.slice(0, 5);
  }, [rows]);

  // Pagination
  const [pageSize, setPageSize] = useState(10);
  const { currentPage, totalPages, paginatedData, setPage, nextPage, prevPage } = usePagination(filtered, pageSize);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMethodFilter("all");
    setDateFilter("all");
    setCustomRange({ start: undefined, end: undefined });
    setMinAmountUsdt("");
    setMaxAmountUsdt("");
    setMinAmountInr("");
    setMaxAmountInr("");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    methodFilter !== "all" ||
    dateFilter !== "all" ||
    minAmountUsdt.trim() !== "" ||
    maxAmountUsdt.trim() !== "" ||
    minAmountInr.trim() !== "" ||
    maxAmountInr.trim() !== "";

  // Action handlers
  const handleCryptoAction = async (actionType: "cancel" | "hold" | "mark_paid") => {
    if (!confirm) return;
    const reason = confirm.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      toast.error("Reason must be 3–500 characters");
      return;
    }
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    if (actionType === "hold" && confirm.currentStatus === "processing") {
      toast.info("Already holding");
      return;
    }

    if (actionType === "mark_paid") {
      const tx = confirm.txHash.trim();
      if (!tx) {
        toast.error("Tx hash is required to mark as paid");
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = actionType === "cancel" ? "reject" : "approve";
      const payload: Record<string, string> = { reason };
      if (actionType === "mark_paid") {
        payload.txHash = confirm.txHash.trim();
      }

      const res = await fetch(
        `${API_BASE}/admin/withdrawals/${encodeURIComponent(confirm.id)}/${endpoint}`,
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
          ? ((response as { message: string[] }).message).join(", ")
          : (response as { message?: string })?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }

      const nextStatus: WithdrawalStatus =
        actionType === "cancel"
          ? "failed"
          : actionType === "hold"
          ? "processing"
          : "paid";

      setWithdrawals((prev) =>
        prev.map((w) => {
          if (w.id !== confirm.id) return w;
          const updatedDisputeDetails = w.disputeDetails
            ? {
                ...w.disputeDetails,
                resolutionStatus: "resolved",
                resolutionDecision: actionType !== "cancel" ? "approved" : "declined",
                resolutionNotes: reason,
                resolvedAt: new Date().toISOString(),
              }
            : null;
          return {
            ...w,
            status: nextStatus,
            disputeRaised: false,
            disputeDetails: updatedDisputeDetails,
            decisionReason: response?.decisionReason ?? reason,
            processedBy: response?.processedBy ?? w.processedBy ?? null,
            processedAt: response?.processedAt ?? w.processedAt ?? new Date().toISOString(),
            processedByRole: response?.processedByRole ?? w.processedByRole ?? null,
            processedByName: response?.processedByName ?? w.processedByName ?? null,
            txHash: actionType === "mark_paid" ? payload.txHash ?? w.txHash : w.txHash,
          };
        }),
      );

      if (actionType === "cancel") {
        toast.success("Withdrawal cancelled & refunded to user balance");
      } else if (actionType === "hold") {
        toast.success("Withdrawal placed on hold (processing)");
      } else {
        toast.success("Withdrawal marked as paid with Tx hash");
      }
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAction = async () => {
    if (!confirm) return;
    const reason = confirm.reason.trim();
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
    if (confirm.action === "approve") {
      const utr = confirm.utr.trim().toUpperCase();
      if (!UTR_RE.test(utr)) {
        toast.error("UTR must be 8–25 alphanumeric characters");
        return;
      }
      payload.utr = utr;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/withdrawals/${encodeURIComponent(confirm.id)}/${confirm.action}`,
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
          ? ((response as { message: string[] }).message).join(", ")
          : (response as { message?: string })?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      const responseStatus = response?.status;
      const nextStatus: WithdrawalStatus =
        responseStatus === "pending" ||
        responseStatus === "processing" ||
        responseStatus === "paid" ||
        responseStatus === "failed"
          ? responseStatus
          : confirm.action === "approve"
          ? "paid"
          : "failed";
      setWithdrawals((prev) =>
        prev.map((w) => {
          if (w.id !== confirm.id) return w;
          const updatedDisputeDetails = w.disputeDetails
            ? {
                ...w.disputeDetails,
                resolutionStatus: "resolved",
                resolutionDecision: confirm.action === "approve" ? "approved" : "declined",
                resolutionNotes: reason,
                resolvedAt: new Date().toISOString(),
              }
            : null;
          return {
            ...w,
            status: nextStatus,
            disputeRaised: false,
            disputeDetails: updatedDisputeDetails,
            decisionReason: response?.decisionReason ?? reason,
            processedBy: response?.processedBy ?? w.processedBy ?? null,
            processedAt: response?.processedAt ?? w.processedAt ?? new Date().toISOString(),
            processedByRole: response?.processedByRole ?? w.processedByRole ?? null,
            processedByName: response?.processedByName ?? w.processedByName ?? null,
            utr:
              confirm.action === "approve"
                ? response?.utr ?? (payload.utr ?? w.utr) ?? null
                : w.utr,
          };
        }),
      );
      toast.success(
        confirm.action === "approve"
          ? "Withdrawal approved"
          : "Withdrawal rejected & refunded to user balance",
      );
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export columns
  const withdrawalExportColumns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "Customer Id", value: (r) => r.serialId },
    { header: "Customer Name", value: (r) => r.displayName },
    { header: "Bank A/C Holder Name", value: (r) => r.accountHolderName || "" },
    { header: "Email", value: (r) => r.userEmail ?? "" },
    { header: "Mobile", value: (r) => r.userPhone ?? "" },
    { header: "Withdrawal ID", value: (r) => r.id },
    { header: "Amount (USDT)", value: (r) => Number(r.amount).toFixed(2) },
    { header: "Amount (INR)", value: (r) => (r.inrAmount !== null ? Number(r.inrAmount).toFixed(2) : "") },
    { header: "Method", value: (r) => r.method },
    { header: "Destination", value: (r) => r.destinationLine },
    { header: "Bank", value: (r) => r.bankName },
    { header: "IFSC", value: (r) => r.ifscCode },
    { header: "Account", value: (r) => r.accountNumber },
    { header: "UPI ID", value: (r) => r.upiId },
    { header: "Crypto Address", value: (r) => r.destinationAddress },
    { header: "TID", value: (r) => r.utr },
    { header: "Status", value: (r) => r.status },
    { header: "Withdrawal Date", value: (r) => (r.createdAt && !isNaN(new Date(r.createdAt).getTime()) ? format(new Date(r.createdAt), "yyyy-MM-dd HH:mm:ss") : "") },
    {
      header: "Processed Date",
      value: (r) => {
        const dtStr = r.processedAt || r.createdAt;
        return dtStr && !isNaN(new Date(dtStr).getTime()) ? format(new Date(dtStr), "yyyy-MM-dd HH:mm:ss") : "";
      },
    },
    { header: "Tx Hash", value: (r) => r.txHash },
  ];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pt-1">
        <WithdrawalsHeaderIllustration />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Withdrawal Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and process user withdrawal requests
          </p>
        </div>

        {/* Header Right Action Group */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          {/* Quick Pending Pill */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"));
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-xs ${
              statusFilter === "pending"
                ? "bg-amber-500/20 text-amber-600 border-amber-500/40 ring-2 ring-amber-500/20 dark:text-amber-400"
                : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </button>

          {/* Quick Today Pill */}
          <button
            type="button"
            onClick={() => {
              setDateFilter((prev) => (prev === "today" ? "all" : "today"));
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-xs ${
              dateFilter === "today"
                ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40 ring-2 ring-emerald-500/20 dark:text-emerald-400"
                : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Today</span>
          </button>

          {/* Export CSV button */}
          <ExportButton
            filename="withdrawal_requests"
            rows={filtered}
            columns={withdrawalExportColumns}
            disabled={loading || filtered.length === 0}
            className="h-9 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs font-medium hover:bg-accent shadow-xs flex items-center gap-1.5"
          />

          {/* Refresh button */}
          <Button
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP 5 METRIC CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Requests */}
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
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Requests</span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
              {loading ? "—" : stats.totalCount.toLocaleString()}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ${loading ? "—" : stats.totalRequestedUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT requested
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            <span className="inline-flex items-center">↑ +12%</span>
          </div>
          <SparklineWave color="#3b82f6" />
        </div>

        {/* Successful Paid */}
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
            <span className="text-xs font-medium text-muted-foreground">Successful Paid</span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
              {loading ? "—" : stats.successfulCount.toLocaleString()}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ${loading ? "—" : stats.successfulUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT settled
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="inline-flex items-center">↑ +8%</span>
          </div>
          <SparklineWave color="#10b981" />
        </div>

        {/* Net INR Sent */}
        <div
          onClick={() => {
            setStatusFilter((c) => (c === "paid" ? "all" : "paid"));
            setPage(1);
          }}
          className={`relative overflow-hidden rounded-2xl border p-4.5 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md ${
            statusFilter === "paid"
              ? "border-indigo-500/60 ring-2 ring-indigo-500/15"
              : "border-border/60 hover:border-indigo-400/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Net INR Sent</span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
              ₹{loading ? "—" : stats.successfulInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              from {loading ? "—" : stats.successfulCount} successful transfers
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            <span className="inline-flex items-center">↑ +15%</span>
          </div>
          <SparklineWave color="#6366f1" />
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
            <span className="text-xs font-medium text-muted-foreground">Pending Requests</span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
              {loading ? "—" : stats.pendingCount.toLocaleString()}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ${loading ? "—" : stats.pendingUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT in queue
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <span className="inline-flex items-center">↑ +0%</span>
          </div>
          <SparklineWave color="#f59e0b" />
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
            <span className="text-xs font-medium text-muted-foreground">Failed / Rejected</span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
              {loading ? "—" : stats.failedCount.toLocaleString()}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ${loading ? "—" : stats.failedUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT refunded
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            <span className="inline-flex items-center">↓ -5%</span>
          </div>
          <SparklineWave color="#f43f5e" />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT 2-COLUMN LAYOUT
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ── LEFT COLUMN (8 cols): Pipeline, Filter & Search, Table ── */}
        <div className="xl:col-span-8 space-y-5">
          {/* Payout Pipeline Card */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Payout Pipeline</h3>
                  <p className="text-xs text-muted-foreground">Live overview of withdrawal request flow</p>
                </div>
              </div>

              {/* Time Range Selector */}
              <div className="w-36">
                <Select
                  value={pipelineRange}
                  onValueChange={(val: any) => setPipelineRange(val)}
                >
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-secondary/50 border-border/70">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today" className="text-xs">Today</SelectItem>
                    <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                    <SelectItem value="all" className="text-xs">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stepper + Donut row */}
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Stepper Flow (7 cols) */}
              <div className="lg:col-span-8 flex flex-wrap items-center justify-between gap-3">
                {/* Step 1: Pending */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-500">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Pending</span>
                    <span className="text-[11px] text-muted-foreground block">
                      {pipelineStats.pending} request{pipelineStats.pending !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      ${pipelineStats.pendingUsdt.toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 hidden sm:block" />

                {/* Step 2: Processing */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-500">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Processing</span>
                    <span className="text-[11px] text-muted-foreground block">
                      {pipelineStats.processing} request{pipelineStats.processing !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      ${pipelineStats.processingUsdt.toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 hidden sm:block" />

                {/* Step 3: Paid */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-500">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Paid</span>
                    <span className="text-[11px] text-muted-foreground block">
                      {pipelineStats.paid} request{pipelineStats.paid !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      ${pipelineStats.paidUsdt.toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 hidden sm:block" />

                {/* Step 4: Failed */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-500">
                    <X className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Failed</span>
                    <span className="text-[11px] text-muted-foreground block">
                      {pipelineStats.failed} request{pipelineStats.failed !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      ${pipelineStats.failedUsdt.toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Donut Chart (4 cols) */}
              <div className="lg:col-span-4 flex items-center justify-center sm:justify-end gap-4 pl-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-border/40 pt-4 lg:pt-0">
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-muted/20"
                    />
                    {/* Paid segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="8"
                      strokeDasharray={`${(pipelineStats.paidPct / 100) * 238.76} 238.76`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                    />
                    {/* Pending segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      strokeDasharray={`${(pipelineStats.pendingPct / 100) * 238.76} 238.76`}
                      strokeDashoffset={`${-(pipelineStats.paidPct / 100) * 238.76}`}
                      strokeLinecap="round"
                    />
                    {/* Failed segment */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#ef4444"
                      strokeWidth="8"
                      strokeDasharray={`${(pipelineStats.failedPct / 100) * 238.76} 238.76`}
                      strokeDashoffset={`${-((pipelineStats.paidPct + pipelineStats.pendingPct) / 100) * 238.76}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-base font-extrabold text-foreground leading-none">
                      {pipelineStats.total}
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-tighter mt-0.5">
                      Total
                    </span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Pending <span className="font-semibold text-foreground">{pipelineStats.pending} ({pipelineStats.pendingPct}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Processing <span className="font-semibold text-foreground">{pipelineStats.processing} ({pipelineStats.processingPct}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Paid <span className="font-semibold text-foreground">{pipelineStats.paid} ({pipelineStats.paidPct}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-muted-foreground text-[11px]">
                      Failed <span className="font-semibold text-foreground">{pipelineStats.failed} ({pipelineStats.failedPct}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Withdrawals Card */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Filter &amp; Search Withdrawals</span>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
              >
                <span>Saved Filters</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by user ID, name, email, UTR, transaction hash..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Pill Filters & Date Picker Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Status Pills (5 cols) */}
              <div className="lg:col-span-5 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Status
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      statusFilter === "all"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/60"
                    }`}
                  >
                    All <span className="opacity-80 font-normal">({stats.totalCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("pending")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      statusFilter === "pending"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-amber-50 text-amber-600 border border-amber-200/80 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40"
                    }`}
                  >
                    Pending <span className="opacity-80 font-normal">({stats.pendingCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("processing")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      statusFilter === "processing"
                        ? "bg-blue-500 text-white shadow-xs"
                        : "bg-blue-50 text-blue-600 border border-blue-200/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40"
                    }`}
                  >
                    Processing <span className="opacity-80 font-normal">({pipelineStats.processing})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("paid")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      statusFilter === "paid"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-200/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                    }`}
                  >
                    Paid <span className="opacity-80 font-normal">({stats.successfulCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("failed")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      statusFilter === "failed"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-rose-50 text-rose-600 border border-rose-200/80 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40"
                    }`}
                  >
                    Failed <span className="opacity-80 font-normal">({stats.failedCount})</span>
                  </button>
                </div>
              </div>

              {/* Payout Method Pills (4 cols) */}
              <div className="lg:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Payout Method
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMethodFilter("all")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      methodFilter === "all"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/60"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethodFilter("bank")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      methodFilter === "bank"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/60"
                    }`}
                  >
                    Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethodFilter("upi")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      methodFilter === "upi"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/60"
                    }`}
                  >
                    UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethodFilter("crypto")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      methodFilter === "crypto"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/60"
                    }`}
                  >
                    Crypto
                  </button>
                </div>
              </div>

              {/* Date Range Dropdown (3 cols) */}
              <div className="lg:col-span-3 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Date Range
                </label>
                <Select
                  value={dateFilter}
                  onValueChange={(val: any) => setDateFilter(val)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/50 border-border/70">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                      <SelectValue placeholder="Date range" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Time</SelectItem>
                    <SelectItem value="today" className="text-xs">Today</SelectItem>
                    <SelectItem value="1d" className="text-xs">Last 24 Hours</SelectItem>
                    <SelectItem value="3d" className="text-xs">Last 3 Days</SelectItem>
                    <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                    <SelectItem value="1m" className="text-xs">Last 1 Month</SelectItem>
                    <SelectItem value="1y" className="text-xs">Last 1 Year</SelectItem>
                    <SelectItem value="custom" className="text-xs">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Popovers if selected */}
            {dateFilter === "custom" && (
              <div className="flex flex-wrap items-center gap-2 p-3 bg-secondary/30 rounded-xl border border-border/60">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs border-border/80 bg-background justify-start text-left font-normal w-[120px]">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      {customRange.start ? format(customRange.start, "MMM dd, yyyy") : <span>Start date</span>}
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
                <span className="text-xs text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs border-border/80 bg-background justify-start text-left font-normal w-[120px]">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      {customRange.end ? format(customRange.end, "MMM dd, yyyy") : <span>End date</span>}
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

            {/* Amounts Inputs & Filter Actions Row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 max-w-2xl">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Min Amount (USDT)
                  </label>
                  <input
                    type="number"
                    value={minAmountUsdt}
                    onChange={(e) => setMinAmountUsdt(e.target.value)}
                    placeholder="Any"
                    className="w-full h-8 px-3 rounded-lg bg-secondary/40 border border-border/70 text-xs text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Max Amount (USDT)
                  </label>
                  <input
                    type="number"
                    value={maxAmountUsdt}
                    onChange={(e) => setMaxAmountUsdt(e.target.value)}
                    placeholder="Any"
                    className="w-full h-8 px-3 rounded-lg bg-secondary/40 border border-border/70 text-xs text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Min Amount (INR)
                  </label>
                  <input
                    type="number"
                    value={minAmountInr}
                    onChange={(e) => setMinAmountInr(e.target.value)}
                    placeholder="Any"
                    className="w-full h-8 px-3 rounded-lg bg-secondary/40 border border-border/70 text-xs text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                    Max Amount (INR)
                  </label>
                  <input
                    type="number"
                    value={maxAmountInr}
                    onChange={(e) => setMaxAmountInr(e.target.value)}
                    placeholder="Any"
                    className="w-full h-8 px-3 rounded-lg bg-secondary/40 border border-border/70 text-xs text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="h-8 px-3.5 rounded-lg border border-border/80 bg-secondary/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5 text-rose-500" />
                    <span>Clear Filters</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Apply Filters</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (4 cols): Needs Attention & Recent Activity (Compact) ── */}
        <div className="xl:col-span-4 space-y-4">
          {/* Needs Attention Card */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Needs Attention</h3>
                <span className="w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {needsAttentionList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("pending");
                  setPage(1);
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
              >
                <span>View All</span>
                <span>&gt;</span>
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {needsAttentionList.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No requests need attention right now.
                </div>
              ) : (
                needsAttentionList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.method === "crypto") {
                        setConfirm({
                          id: item.id,
                          displayName: item.displayName,
                          amount: item.amount,
                          method: item.method,
                          currentStatus: item.status,
                          action: "approve",
                          reason: "",
                          txHash: item.txHash ?? "",
                          utr: "",
                        });
                      } else if (item.status === "pending" || item.status === "processing") {
                        setConfirm({
                          id: item.id,
                          displayName: item.displayName,
                          amount: item.amount,
                          method: item.method,
                          currentStatus: item.status,
                          action: "approve",
                          reason: "",
                          txHash: "",
                          utr: item.utr ?? "",
                        });
                      } else if (item.disputeRaised || item.disputeDetails) {
                        setSelectedDispute(withdrawals.find((w) => w.id === item.id) ?? null);
                      }
                    }}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${getAvatarColor(
                          item.displayName,
                        )}`}
                      >
                        {getInitials(item.displayName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate max-w-[100px]">
                            {item.displayName}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-foreground/80">
                            {item.amount.toFixed(2)} USDT
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {item.serialId ? `TR${item.serialId.replace(/\D/g, "") || item.serialId} • ` : ""}
                          {item.createdAt && !isNaN(new Date(item.createdAt).getTime())
                            ? format(new Date(item.createdAt), "MMM dd, hh:mm a")
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-1.5">
                      {item.status === "pending" || item.status === "processing" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40">
                          Pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity Card (Compact) */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Recent Activity</h3>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
              >
                <span>View All</span>
                <span>&gt;</span>
              </button>
            </div>

            {/* Timeline */}
            <div className="mt-3 relative pl-5 space-y-3">
              {/* Vertical connector line */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border/60" />

              {recentActivityList.slice(0, 4).map((item) => {
                const isPaid = item.status === "paid" || item.status === "resolved";
                const isFailed = item.status === "failed";
                const isPending = !isPaid && !isFailed;

                return (
                  <div key={item.id} className="relative flex items-start gap-2.5">
                    {/* Node dot on connector */}
                    <div
                      className={`absolute -left-5 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-card ${
                        isPaid
                          ? "bg-emerald-500 text-white"
                          : isFailed
                          ? "bg-rose-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {isPaid ? (
                        <Check className="w-2.5 h-2.5" />
                      ) : isFailed ? (
                        <X className="w-2.5 h-2.5" />
                      ) : (
                        <Clock className="w-2 h-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0">
                      <p className="text-[11px] text-foreground leading-snug">
                        {isPaid ? (
                          <>
                            <span className="font-semibold">Withdrawal paid to {item.displayName}</span>
                          </>
                        ) : isFailed ? (
                          <>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">Withdrawal failed</span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">New withdrawal request</span>
                          </>
                        )}
                      </p>
                      <p className="text-[11px] font-mono font-medium text-foreground/80 mt-0.5">
                        {item.amount.toFixed(2)} USDT {isFailed ? `for ${item.displayName}` : isPending ? `from ${item.displayName}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.createdAt && !isNaN(new Date(item.createdAt).getTime())
                          ? format(new Date(item.createdAt), "MMM dd, hh:mm a")
                          : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FULL-WIDTH TABLE: All Withdrawal Requests (Spans Whole Window)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs w-full">
        <div className="flex items-center justify-between p-4.5 border-b border-border/40">
          <h3 className="text-sm font-bold text-foreground">
            All Withdrawal Requests ({filtered.length})
          </h3>
          <ExportButton
            filename="all_withdrawals"
            rows={filtered}
            columns={withdrawalExportColumns}
            disabled={loading || filtered.length === 0}
            className="h-8 px-3 rounded-lg border border-border/80 bg-background text-xs font-medium hover:bg-accent flex items-center gap-1.5"
          />
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground font-semibold">
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-2 w-10 text-center">#</th>
                <th className="py-3 px-3">User</th>
                <th className="py-3 px-3">Amount (USDT)</th>
                <th className="py-3 px-3">Amount (INR)</th>
                <th className="py-3 px-3">Payout Method</th>
                <th className="py-3 px-3">Destination</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Loading withdrawals...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <EmptyParcelIllustration />
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
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(w.id)}
                          className="rounded border-border text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Index */}
                      <td className="py-3 px-2 text-muted-foreground font-mono text-center">
                        {absoluteIndex}
                      </td>

                      {/* User Avatar & Info */}
                      <td className="py-3 px-3">
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
                              className="font-bold text-foreground hover:text-blue-600 transition-colors block truncate max-w-[140px]"
                            >
                              {w.displayName}
                            </Link>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {w.serialId ? `TR${w.serialId.replace(/\D/g, "") || w.serialId}` : "—"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Amount (USDT) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-extrabold text-foreground font-mono">
                          {w.amount.toFixed(2)} USDT
                        </span>
                      </td>

                      {/* Amount (INR) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-medium text-foreground/80 font-mono">
                          ₹{w.inrAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Payout Method */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {w.method === "upi" || w.method === "smart_upi" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 text-[11px] font-semibold dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40">
                            <QrCode className="w-3 h-3 text-purple-500" />
                            <span>UPI</span>
                          </span>
                        ) : w.method === "bank" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 text-[11px] font-semibold dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40">
                            <Landmark className="w-3 h-3 text-sky-500" />
                            <span>Bank Transfer</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200/80 text-[11px] font-semibold dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/40">
                            <Coins className="w-3 h-3 text-violet-500" />
                            <span>Crypto</span>
                          </span>
                        )}
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-3">
                        <div className="text-xs font-mono">
                          {w.method === "bank" ? (
                            <>
                              <span className="text-foreground font-medium block truncate max-w-[160px]">
                                {w.bankName || "Bank"} •••• {w.accountNumber?.slice(-4) || "****"}
                              </span>
                              {w.accountHolderName && (
                                <span className="text-[11px] text-muted-foreground block truncate max-w-[160px]">
                                  {w.accountHolderName}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-foreground font-medium block truncate max-w-[160px]" title={w.destinationLine}>
                              {w.destinationLine || "—"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {w.status === "paid" || w.status === "resolved" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Paid
                          </span>
                        ) : w.status === "pending" || w.status === "awaiting_payment" || w.status === "reserved" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-semibold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        ) : w.status === "processing" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-semibold dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Processing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 text-[11px] font-semibold dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-foreground font-medium block">
                          {w.createdAt && !isNaN(new Date(w.createdAt).getTime())
                            ? format(new Date(w.createdAt), "MMM dd, yyyy")
                            : "—"}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {w.createdAt && !isNaN(new Date(w.createdAt).getTime())
                            ? format(new Date(w.createdAt), "hh:mm a")
                            : "—"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
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
                            {w.status === "pending" || w.status === "processing" || w.status === "awaiting_payment" || w.status === "reserved" ? (
                              <>
                                {w.method === "crypto" ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirm({
                                        id: w.id,
                                        displayName: w.displayName,
                                        amount: w.amount,
                                        method: w.method,
                                        currentStatus: w.status,
                                        action: "approve",
                                        reason: "",
                                        txHash: w.txHash ?? "",
                                        utr: "",
                                      })
                                    }
                                    className="text-blue-600 font-semibold cursor-pointer"
                                  >
                                    <Coins className="w-3.5 h-3.5 mr-2" />
                                    Manage Crypto Payout
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setConfirm({
                                          id: w.id,
                                          displayName: w.displayName,
                                          amount: w.amount,
                                          method: w.method,
                                          currentStatus: w.status,
                                          action: "approve",
                                          reason: "",
                                          txHash: "",
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
                                        setConfirm({
                                          id: w.id,
                                          displayName: w.displayName,
                                          amount: w.amount,
                                          method: w.method,
                                          currentStatus: w.status,
                                          action: "reject",
                                          reason: "",
                                          txHash: "",
                                          utr: "",
                                        })
                                      }
                                      className="text-rose-600 font-semibold cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5 mr-2" />
                                      Reject Request
                                    </DropdownMenuItem>
                                  </>
                                )}
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

        {/* Pagination */}
        <div className="p-3 border-t border-border/40">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            setPage={setPage}
            nextPage={nextPage}
            prevPage={prevPage}
            onPageSizeChange={setPageSize}
            label="requests"
            id="withdrawalsPageSize"
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          APPROVAL / REJECTION / CRYPTO ACTION DIALOG
      ───────────────────────────────────────────────────────────── */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.method === "crypto"
                    ? "Manage Crypto Withdrawal"
                    : confirm.action === "approve"
                    ? "Approve withdrawal"
                    : "Reject withdrawal"}
                </DialogTitle>
                <DialogDescription>
                  {confirm.method === "crypto"
                    ? `Review ${confirm.amount.toFixed(2)} USDT request for ${confirm.displayName}. Choose Cancel (refund to balance), Hold (keep in processing), or Mark as Paid (complete with Tx hash).`
                    : confirm.action === "approve"
                    ? `Approve ${confirm.amount.toFixed(2)} USDT for ${confirm.displayName}. A reason and UTR are required.`
                    : `Reject ${confirm.amount.toFixed(2)} USDT for ${confirm.displayName}. Funds will be refunded to user balance.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label htmlFor="action-reason" className="text-xs font-medium text-muted-foreground">
                    Reason <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="action-reason"
                    value={confirm.reason}
                    onChange={(e) =>
                      setConfirm((c) => (c ? { ...c, reason: e.target.value } : c))
                    }
                    rows={3}
                    maxLength={500}
                    placeholder={
                      confirm.method === "crypto"
                        ? "e.g. Request verified, queued for blockchain transfer"
                        : confirm.action === "approve"
                        ? "e.g. KYC verified, payout cleared"
                        : "e.g. Invalid bank details or rejected by admin"
                    }
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {confirm.reason.trim().length}/500 characters (min 3)
                  </p>
                </div>
                {confirm.method === "crypto" && (
                  <div>
                    <label htmlFor="action-tx" className="text-xs font-medium text-muted-foreground">
                      Tx hash <span className="text-xs text-muted-foreground font-normal">(required only for "Mark as Paid")</span>
                    </label>
                    <input
                      id="action-tx"
                      value={confirm.txHash}
                      onChange={(e) =>
                        setConfirm((c) => (c ? { ...c, txHash: e.target.value } : c))
                      }
                      placeholder="0x… or TRC-20 hash"
                      maxLength={200}
                      className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Enter Tx hash if sending payout now, or leave blank if clicking Hold.
                    </p>
                  </div>
                )}
                {confirm.method !== "crypto" && confirm.action === "approve" && (
                  <div>
                    <label htmlFor="action-utr" className="text-xs font-medium text-muted-foreground">
                      TID / UTR Reference number <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="action-utr"
                      value={confirm.utr}
                      onChange={(e) =>
                        setConfirm((c) =>
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
                        confirm.utr.length === 0 || UTR_RE.test(confirm.utr)
                          ? "text-muted-foreground"
                          : "text-destructive"
                      }`}
                    >
                      Required — 8–25 alphanumeric characters. Confirms the bank transfer
                      actually happened.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="pt-2">
                {confirm.method === "crypto" ? (
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      disabled={submitting}
                      className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/70 disabled:opacity-50"
                    >
                      Close
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCryptoAction("cancel")}
                        disabled={submitting || confirm.reason.trim().length < 3 || confirm.reason.trim().length > 500}
                        className="rounded-lg border border-destructive/40 bg-destructive/15 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white transition disabled:opacity-50"
                        title="Cancel withdrawal & refund money back to user balance"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCryptoAction("hold")}
                        disabled={submitting || confirm.reason.trim().length < 3 || confirm.reason.trim().length > 500}
                        className={`rounded-lg border border-amber-500/40 px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                          confirm.currentStatus === "processing"
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-black"
                        }`}
                        title={confirm.currentStatus === "processing" ? "Already holding" : "Accept request and keep funds on hold in processing"}
                      >
                        {confirm.currentStatus === "processing" ? "Already Holding" : "Hold"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCryptoAction("mark_paid")}
                        disabled={
                          submitting ||
                          confirm.reason.trim().length < 3 ||
                          confirm.reason.trim().length > 500 ||
                          confirm.txHash.trim().length === 0
                        }
                        className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                        title="Complete on-chain payout with Tx hash and mark Paid"
                      >
                        Mark as Paid
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
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
                        confirm.reason.trim().length < 3 ||
                        confirm.reason.trim().length > 500 ||
                        (confirm.action === "approve" && !UTR_RE.test(confirm.utr))
                      }
                      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                        confirm.action === "approve" ? "bg-emerald-500" : "bg-destructive"
                      }`}
                    >
                      {submitting
                        ? "Saving…"
                        : confirm.action === "approve"
                        ? "Approve"
                        : "Reject"}
                    </button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          DISPUTE DETAILS MODAL
      ───────────────────────────────────────────────────────────── */}
      <Dialog
        open={selectedDispute !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDispute(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedDispute && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {selectedDispute.disputeDetails?.resolutionStatus === "resolved" || selectedDispute.status === "resolved" ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <DialogTitle className="text-emerald-400">Dispute Resolved — {selectedDispute.displayName}</DialogTitle>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-5 w-5 text-red-400" />
                      <DialogTitle>Dispute Details — {selectedDispute.displayName}</DialogTitle>
                    </>
                  )}
                </div>
                <DialogDescription>
                  Review the user's dispute submission, uploaded bank statement, and resolution info.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2">
                {/* Resolution Summary Box (If Resolved) */}
                {(selectedDispute.disputeDetails?.resolutionStatus === "resolved" ||
                  selectedDispute.status === "resolved" ||
                  selectedDispute.status === "paid" ||
                  selectedDispute.status === "failed" ||
                  !selectedDispute.disputeRaised) && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Dispute Resolved
                      </span>
                      {selectedDispute.disputeDetails?.resolvedAt && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {formatIst(selectedDispute.disputeDetails.resolvedAt)}
                        </span>
                      )}
                    </div>
                    {selectedDispute.disputeDetails?.resolutionDecision && (
                      <p className="text-xs font-medium text-foreground">
                        Decision:{" "}
                        <span className="font-semibold capitalize text-emerald-400">
                          {selectedDispute.disputeDetails.resolutionDecision === "approved"
                            ? "Approved (User refunded / credited)"
                            : "Declined (Original transaction confirmed valid)"}
                        </span>
                      </p>
                    )}
                    {(selectedDispute.disputeDetails?.resolutionNotes || selectedDispute.decisionReason) && (
                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block mb-1">
                          Admin Resolution Remark / Notes
                        </span>
                        <div className="rounded-lg border border-border/60 bg-background/80 p-2.5 text-xs font-mono text-foreground whitespace-pre-wrap">
                          {selectedDispute.disputeDetails?.resolutionNotes || selectedDispute.decisionReason}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* User & Request Summary */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/80 bg-secondary/30 p-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium">User</span>
                    {selectedDispute.userId ? (
                      <Link
                        to={`/admin/users/${selectedDispute.userId}`}
                        className="font-semibold text-foreground hover:text-primary hover:underline transition-all"
                      >
                        {selectedDispute.displayName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{selectedDispute.displayName}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium">Requested Amount</span>
                    <span className="font-mono font-semibold text-foreground">
                      {selectedDispute.amount.toFixed(2)} USDT {selectedDispute.netInr ? `(₹${selectedDispute.netInr.toFixed(2)})` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium">Payout Method</span>
                    <span className="capitalize text-foreground font-medium">{selectedDispute.method}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium">Destination</span>
                    <span className="font-mono text-foreground font-medium truncate block">
                      {selectedDispute.upiId || selectedDispute.accountNumber || selectedDispute.destinationAddress || "—"}
                    </span>
                  </div>
                </div>

                {/* Dispute Reason & Remark */}
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider block">
                      Reported Issue Reason
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {DISPUTE_REASON_MAP[selectedDispute.disputeDetails?.reason || "not_received"] || selectedDispute.disputeDetails?.reason}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      User Remark / Description
                    </span>
                    <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-mono">
                      {selectedDispute.disputeDetails?.description || "No description provided by user."}
                    </div>
                  </div>

                  {/* Bank Statement PDF */}
                  {selectedDispute.disputeDetails?.bankStatementUrl && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Bank Statement Attachment (PDF)
                      </span>
                      <a
                        href={selectedDispute.disputeDetails.bankStatementUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-sm"
                      >
                        <FileText className="h-4 w-4" />
                        <span>View / Download Bank Statement (PDF)</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                      </a>
                    </div>
                  )}

                  {/* Telegram Payment Proof Screenshot */}
                  {selectedDispute.paymentProofUrl && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Telegram Payment Proof Screenshot
                      </span>
                      <a
                        href={selectedDispute.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-secondary/80 bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
                      >
                        <span>View Sent Payment Screenshot</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70"
                >
                  Close
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
