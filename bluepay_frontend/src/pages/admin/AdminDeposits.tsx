import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { subDays, subMonths, subYears, startOfDay, endOfDay, format } from "date-fns";
import ExportButton from "@/components/shared/ExportButton";
import { TronLink } from "@/components/shared/TronLink";
import type { CsvColumn } from "@/lib/export-csv";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  Zap,
  Database,
  Columns as ColumnsIcon,
  ChevronDown,
  Check,
  ArrowRight,
  PieChart as PieChartIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  listAdminDisputes,
  resolveDispute,
} from "@/lib/api-withdrawal-disputes";
import {
  listAdminDeposits,
  sweepWalletNow,
  type AdminDepositItem,
} from "@/lib/api-deposits";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/shared/TablePagination";

const PAGE_LIMIT = 25;

type TabType = "all_deposits" | "disputes";
type TeamFilter = "all" | TicketTeam;
type StatusFilter = "all" | TicketResolutionStatus;
type AssignmentFilter = "all" | TicketAssignmentStatus | "mine";

const TEAM_LABEL: Record<TicketTeam, string> = { support: "Support", tech: "Tech" };
const REASON_LABEL: Record<DisputeReason, string> = {
  not_received: "Not received",
  wrong_amount: "Wrong amount",
  other: "Other",
};

const fmtInr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getTimelineLabel = (filter: string) => {
  switch (filter) {
    case "today":
      return "Today";
    case "1d":
      return "Last 24 Hours";
    case "3d":
      return "Last 3 Days";
    case "7d":
      return "Last 7 Days";
    case "1m":
      return "Last Month";
    case "1y":
      return "Last Year";
    case "custom":
      return "Custom Range";
    case "all":
    default:
      return "All Time";
  }
};

/* ─────────────────────────────────────────────────────────────
   3D HEADER WALLET ARTWORK (NexaPay style)
───────────────────────────────────────────────────────────── */
const DepositsHeaderIllustration = () => {
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
          <linearGradient id="walletBodyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          <linearGradient id="walletFlapGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          <linearGradient id="arrowUpGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          <linearGradient id="goldCoinGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          <radialGradient id="softOrbGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#38bdf8" />
          </radialGradient>
        </defs>

        {/* 3D Arrow Upward Rising behind wallet */}
        <g transform="translate(190, 20) rotate(12)">
          <path
            d="M30 75 L30 30 L10 40 L45 0 L80 40 L60 30 L60 75 Z"
            fill="url(#arrowUpGrad)"
            className="drop-shadow-lg"
          />
        </g>

        {/* Floating Soft Blue Spheres */}
        <circle cx="80" cy="50" r="12" fill="url(#softOrbGrad)" opacity="0.75" />
        <circle cx="270" cy="140" r="8" fill="url(#softOrbGrad)" opacity="0.6" />

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
            fill="url(#walletBodyGrad)"
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
            fill="url(#walletFlapGrad)"
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
          <ellipse cx="18" cy="18" rx="16" ry="16" fill="url(#goldCoinGrad)" className="drop-shadow-md" />
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
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="relative w-36 h-32 flex items-center justify-center">
        {/* Soft background blue aura */}
        <div className="absolute inset-0 bg-blue-400/15 rounded-full blur-xl pointer-events-none" />

        <svg
          viewBox="0 0 140 120"
          className="w-full h-full drop-shadow-md overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="boxFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfdbfe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>
            <linearGradient id="boxRight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <linearGradient id="boxInside" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
            <linearGradient id="boxFlap" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>
          </defs>

          {/* Little 4-point Sparkle Stars */}
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
          <path
            d="M 70 8 Q 70 14 65 14 Q 70 14 70 20 Q 70 14 75 14 Q 70 14 70 8 Z"
            fill="#93c5fd"
            opacity="0.7"
          />

          {/* Box base / interior */}
          <path d="M 35 48 L 70 65 L 105 48 L 70 34 Z" fill="url(#boxInside)" />

          {/* Left front wall */}
          <path d="M 35 48 L 70 65 L 70 102 L 35 84 Z" fill="url(#boxFront)" />

          {/* Right front wall */}
          <path d="M 70 65 L 105 48 L 105 84 L 70 102 Z" fill="url(#boxRight)" />

          {/* Front Center Crease / Tape line */}
          <path d="M 70 65 L 70 102" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />

          {/* Open Top Flaps folded outwards */}
          {/* Front-left flap */}
          <path d="M 35 48 L 70 65 L 60 76 L 24 58 Z" fill="url(#boxFlap)" opacity="0.95" />
          {/* Front-right flap */}
          <path d="M 70 65 L 105 48 L 116 58 L 80 76 Z" fill="url(#boxFlap)" opacity="0.95" />
          {/* Back-left flap */}
          <path d="M 35 48 L 70 34 L 62 20 L 25 36 Z" fill="url(#boxFlap)" opacity="0.75" />
          {/* Back-right flap */}
          <path d="M 70 34 L 105 48 L 115 36 L 78 20 Z" fill="url(#boxFlap)" opacity="0.75" />
        </svg>
      </div>

      <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
        No deposits found.
      </h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center max-w-sm">
        Try adjusting your filters or select a different date range.
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

const isAdminDeposit = (d: AdminDepositItem) =>
  d.walletAddress === "MANUAL_ADJUSTMENT" ||
  d.sweepStatus === "manual" ||
  (Boolean(d.transactionId) &&
    (d.transactionId.startsWith("ADMIN_") || d.transactionId.startsWith("MANUAL_")));

const isUserDeposit = (d: AdminDepositItem) =>
  !isAdminDeposit(d) && (d.visibleToUser || Boolean(d.userId) || Boolean(d.user));

export default function AdminDeposits() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = !!user?.isSuperAdmin;

  const [activeTab, setActiveTab] = useState<TabType>("all_deposits");

  // ───────── TAB 1: ALL DEPOSITS STATE ─────────
  const [deposits, setDeposits] = useState<AdminDepositItem[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);
  const [depositSearch, setDepositSearch] = useState("");
  const [depositSource, setDepositSource] = useState<"all" | "onchain" | "manual">("all");
  const [depositVisibility, setDepositVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [depositSweepFilter, setDepositSweepFilter] = useState<"all" | "completed" | "pending" | "in_progress" | "failed">("all");
  const [depositDateFilter, setDepositDateFilter] = useState<"today" | "1d" | "3d" | "7d" | "1m" | "1y" | "custom" | "all">("all");
  const [pipelineRange, setPipelineRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [depositCustomRange, setDepositCustomRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  const [depositSortKey, setDepositSortKey] = useState<"newest" | "amount">("newest");
  const [depositSortDir, setDepositSortDir] = useState<"asc" | "desc">("desc");
  const [depositMin, setDepositMin] = useState("");
  const [depositMax, setDepositMax] = useState("");
  const [depositPageSize, setDepositPageSize] = useState(10);
  const [sweepingWallet, setSweepingWallet] = useState<string | null>(null);

  // Checkbox selection in table
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Advanced Filters toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (depositDateFilter !== "all") count++;
    if (depositSweepFilter !== "all") count++;
    if (depositVisibility !== "all") count++;
    if (depositSource !== "all") count++;
    if (depositMin.trim() !== "") count++;
    if (depositMax.trim() !== "") count++;
    return count;
  }, [depositDateFilter, depositSweepFilter, depositVisibility, depositSource, depositMin, depositMax]);

  useEffect(() => {
    const dateParam = searchParams.get("dateFilter");
    if (dateParam) {
      setDepositDateFilter(dateParam as any);
    }
  }, [searchParams]);

  const loadDeposits = useCallback(async (signal?: AbortSignal) => {
    setLoadingDeposits(true);
    try {
      const data = await listAdminDeposits(signal);
      setDeposits(Array.isArray(data) ? data : []);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Failed to load deposits");
    } finally {
      setLoadingDeposits(false);
    }
  }, []);

  const handleSweepWallet = async (walletAddress: string) => {
    if (!walletAddress || walletAddress === "MANUAL_ADJUSTMENT") return;
    setSweepingWallet(walletAddress);
    try {
      const res = await sweepWalletNow(walletAddress);
      toast.success(res.message || "Manual sweep initiated successfully!");
      void loadDeposits();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger instant sweep");
    } finally {
      setSweepingWallet(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadDeposits(controller.signal);
    return () => controller.abort();
  }, [loadDeposits]);

  const filteredDeposits = useMemo(() => {
    const q = depositSearch.trim().toLowerCase();
    const rawMin = depositMin.trim() === "" ? null : Number(depositMin);
    const rawMax = depositMax.trim() === "" ? null : Number(depositMax);
    const min = rawMin !== null && Number.isFinite(rawMin) ? rawMin : null;
    const max = rawMax !== null && Number.isFinite(rawMax) ? rawMax : null;

    return deposits
      .filter((d) => {
        if (q) {
          const matches =
            d.transactionId.toLowerCase().includes(q) ||
            d.walletAddress.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            d.amount.toString().includes(q) ||
            (d.remark && d.remark.toLowerCase().includes(q)) ||
            (d.user?.id && d.user.id.toLowerCase().includes(q)) ||
            (d.user?.serialId && d.user.serialId.toLowerCase().includes(q)) ||
            (d.user?.name && d.user.name.toLowerCase().includes(q)) ||
            (d.user?.email && d.user.email.toLowerCase().includes(q)) ||
            (d.user?.phone && d.user.phone.toLowerCase().includes(q));
          if (!matches) return false;
        }

        const isManual = isAdminDeposit(d);
        if (depositSource === "manual" && !isManual) return false;
        if (depositSource === "onchain" && isManual) return false;
        if (depositVisibility === "visible" && !d.visibleToUser) return false;
        if (depositVisibility === "hidden" && d.visibleToUser) return false;
        if (min !== null && d.amount < min) return false;
        if (max !== null && d.amount > max) return false;

        if (depositSweepFilter !== "all") {
          const status = d.sweepStatus || "pending";
          if (depositSweepFilter === "completed" && status !== "completed") return false;
          if (depositSweepFilter === "pending" && status !== "pending" && status !== null) return false;
          if (depositSweepFilter === "in_progress" && status !== "funding_gas" && status !== "sweeping") return false;
          if (depositSweepFilter === "failed" && status !== "failed") return false;
        }

        if (depositDateFilter !== "all") {
          let dateStart: Date | null = null;
          let dateEnd: Date = endOfDay(new Date());

          if (depositDateFilter === "today") dateStart = startOfDay(new Date());
          else if (depositDateFilter === "1d") dateStart = subDays(new Date(), 1);
          else if (depositDateFilter === "3d") dateStart = subDays(new Date(), 3);
          else if (depositDateFilter === "7d") dateStart = subDays(new Date(), 7);
          else if (depositDateFilter === "1m") dateStart = subMonths(new Date(), 1);
          else if (depositDateFilter === "1y") dateStart = subYears(new Date(), 1);
          else if (depositDateFilter === "custom") {
            if (depositCustomRange.start && depositCustomRange.end) {
              dateStart = startOfDay(depositCustomRange.start);
              dateEnd = endOfDay(depositCustomRange.end);
            }
          }

          if (dateStart !== null) {
            const rawDate = d.createdAt || d.timestamp;
            const dt = rawDate ? new Date(rawDate) : null;
            if (!dt || Number.isNaN(dt.getTime()) || dt < dateStart || dt > dateEnd) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (depositSortKey === "amount") {
          const diff = a.amount - b.amount;
          return depositSortDir === "desc" ? -diff : diff;
        }
        const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
        const diff = dateA - dateB;
        return depositSortDir === "desc" ? -diff : diff;
      });
  }, [
    deposits,
    depositSearch,
    depositSource,
    depositVisibility,
    depositSweepFilter,
    depositMin,
    depositMax,
    depositDateFilter,
    depositCustomRange,
    depositSortKey,
    depositSortDir,
  ]);

  const depositFiltersActive =
    depositSearch.trim() !== "" ||
    depositSource !== "all" ||
    depositVisibility !== "all" ||
    depositSweepFilter !== "all" ||
    depositDateFilter !== "today" ||
    depositMin.trim() !== "" ||
    depositMax.trim() !== "";

  const clearDepositFilters = () => {
    setDepositSearch("");
    setDepositSource("all");
    setDepositVisibility("all");
    setDepositSweepFilter("all");
    setDepositDateFilter("today");
    setDepositCustomRange({ start: undefined, end: undefined });
    setDepositMin("");
    setDepositMax("");
  };

  const depositExportColumns: CsvColumn<AdminDepositItem>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "User ID", value: (d) => (d.user as any)?.serialId || "" },
    { header: "User Name", value: (d) => d.user?.name ?? "Unknown" },
    { header: "User Email", value: (d) => d.user?.email ?? "" },
    { header: "User Phone", value: (d) => (d.user as any)?.phone ?? "" },
    { header: "Deposit ID", value: (d) => d.id },
    { header: "Amount (USDT)", value: (d) => Number(d.amount).toFixed(2) },
    { header: "Currency", value: (d) => d.currency ?? "USDT" },
    { header: "Method / Address", value: (d) => d.walletAddress },
    { header: "Remark", value: (d) => d.remark ?? "" },
    { header: "Status", value: (d) => (d.visibleToUser ? "Completed" : "Hidden") },
    { header: "Deposit Date", value: (d) => (d.createdAt || d.timestamp ? format(new Date(d.createdAt || d.timestamp), "yyyy-MM-dd") : "") },
    { header: "Deposit Time", value: (d) => (d.createdAt || d.timestamp ? format(new Date(d.createdAt || d.timestamp), "hh:mm:ss a") : "") },
    { header: "Hash Key", value: (d) => d.transactionId },
    {
      header: "Transferred to Admin",
      value: (d) => {
        if (d.sweepStatus === "completed") return `Transferred (${d.sweepTxHash || "On-Chain"})`;
        if (d.sweepStatus === "funding_gas") return "Funding Gas";
        if (d.sweepStatus === "sweeping") return "Sweeping";
        if (d.sweepStatus === "failed") return "Sweep Failed";
        if (d.sweepStatus === "manual") return "Internal";
        return "Pending Transfer";
      },
    },
  ];

  const {
    currentPage: depositPage,
    totalPages: depositTotalPages,
    paginatedData: paginatedDeposits,
    setPage: setDepositPage,
    nextPage: nextDepositPage,
    prevPage: prevDepositPage,
  } = usePagination(filteredDeposits, depositPageSize);

  const filteredByDate = useMemo(() => {
    if (depositDateFilter === "all") return deposits;

    let dateStart: Date | null = null;
    let dateEnd: Date = endOfDay(new Date());

    if (depositDateFilter === "today") dateStart = startOfDay(new Date());
    else if (depositDateFilter === "1d") dateStart = subDays(new Date(), 1);
    else if (depositDateFilter === "3d") dateStart = subDays(new Date(), 3);
    else if (depositDateFilter === "7d") dateStart = subDays(new Date(), 7);
    else if (depositDateFilter === "1m") dateStart = subMonths(new Date(), 1);
    else if (depositDateFilter === "1y") dateStart = subYears(new Date(), 1);
    else if (depositDateFilter === "custom") {
      if (depositCustomRange.start && depositCustomRange.end) {
        dateStart = startOfDay(depositCustomRange.start);
        dateEnd = endOfDay(depositCustomRange.end);
      }
    }

    if (!dateStart) return deposits;

    return deposits.filter((d) => {
      const rawDate = d.createdAt || d.timestamp;
      const dt = rawDate ? new Date(rawDate) : null;
      return dt && !Number.isNaN(dt.getTime()) && dt >= dateStart && dt <= dateEnd;
    });
  }, [deposits, depositDateFilter, depositCustomRange]);

  const depositStats = useMemo(() => {
    let totalCount = 0;
    let totalUsdt = 0;

    let completedCount = 0;
    let completedUsdt = 0;

    let pendingCount = 0;
    let pendingUsdt = 0;

    let inProgressCount = 0;
    let inProgressUsdt = 0;

    let failedCount = 0;
    let failedUsdt = 0;

    let manualCount = 0;
    let manualUsdt = 0;

    for (const d of filteredByDate) {
      const amt = typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : 0;
      totalCount += 1;
      totalUsdt += amt;

      const isManual = isAdminDeposit(d);
      if (isManual) {
        manualCount += 1;
        manualUsdt += amt;
      }

      if (d.sweepStatus === "completed") {
        completedCount += 1;
        completedUsdt += amt;
      } else if (d.sweepStatus === "funding_gas" || d.sweepStatus === "sweeping") {
        inProgressCount += 1;
        inProgressUsdt += amt;
      } else if (d.sweepStatus === "failed") {
        failedCount += 1;
        failedUsdt += amt;
      } else if (!isManual) {
        pendingCount += 1;
        pendingUsdt += amt;
      }
    }

    return {
      totalCount,
      totalUsdt,
      completedCount,
      completedUsdt,
      pendingCount,
      pendingUsdt,
      inProgressCount,
      inProgressUsdt,
      failedCount,
      failedUsdt,
      manualCount,
      manualUsdt,
    };
  }, [filteredByDate]);

  // Pipeline Overview (User deposits, Pending, Admin, Failed)
  const pipelineStats = useMemo(() => {
    let dateStart: Date | null = null;
    const now = new Date();
    if (pipelineRange === "today") dateStart = startOfDay(now);
    else if (pipelineRange === "7d") dateStart = subDays(now, 7);
    else if (pipelineRange === "30d") dateStart = subDays(now, 30);
    else if (pipelineRange === "90d") dateStart = subDays(now, 90);

    const depositList = Array.isArray(deposits) ? deposits : [];
    const relevant = dateStart
      ? depositList.filter((d) => {
          if (!d) return false;
          const raw = d.createdAt || d.timestamp;
          if (!raw) return false;
          const dt = new Date(raw);
          return !Number.isNaN(dt.getTime()) && dt >= dateStart!;
        })
      : depositList;

    let userCount = 0;
    let userUsdt = 0;
    let pendingCount = 0;
    let pendingUsdt = 0;
    let failedCount = 0;
    let failedUsdt = 0;
    let adminCount = 0;
    let adminUsdt = 0;
    let transferredCount = 0;
    let transferredUsdt = 0;
    let totalUsdt = 0;

    for (const d of relevant) {
      if (!d) continue;
      const amt = typeof d.amount === "number" ? d.amount : Number(d.amount) || 0;
      totalUsdt += amt;

      if (isAdminDeposit(d)) {
        adminCount++;
        adminUsdt += amt;
      } else if (isUserDeposit(d)) {
        userCount++;
        userUsdt += amt;

        if (d.sweepStatus === "completed") {
          transferredCount++;
          transferredUsdt += amt;
        } else if (d.sweepStatus === "failed") {
          failedCount++;
          failedUsdt += amt;
        } else {
          pendingCount++;
          pendingUsdt += amt;
        }
      }
    }

    const calcPct = (cnt: number, base: number) => (base > 0 ? Math.round((cnt / base) * 100) : 0);
    const userBase = userCount || 1;
    const totalBase = (userCount + adminCount) || 1;

    return {
      totalUsdt,
      userDeposits: { count: userCount, usdt: userUsdt, pct: calcPct(userCount, totalBase), color: "#10b981" },
      pending: { count: pendingCount, usdt: pendingUsdt, pct: calcPct(pendingCount, userBase), color: "#f59e0b" },
      failed: { count: failedCount, usdt: failedUsdt, pct: calcPct(failedCount, userBase), color: "#f43f5e" },
      admin: { count: adminCount, usdt: adminUsdt, pct: calcPct(adminCount, totalBase), color: "#8b5cf6" },
      transferred: { count: transferredCount, usdt: transferredUsdt, pct: calcPct(transferredCount, userBase), color: "#0ea5e9" },
    };
  }, [deposits, pipelineRange]);

  // Donut Arc calculation
  const donutArcs = useMemo(() => {
    const C = 2 * Math.PI * 48; // ~301.59
    const total = (pipelineStats?.userDeposits?.count ?? 0) + (pipelineStats?.admin?.count ?? 0);

    if (!total || total <= 0) {
      return [{ color: "#e2e8f0", strokeDasharray: `${C} 0`, strokeDashoffset: 0 }];
    }

    const segments = [
      { count: pipelineStats?.transferred?.count ?? 0, color: "#0ea5e9" },
      { count: pipelineStats?.pending?.count ?? 0, color: "#f59e0b" },
      { count: pipelineStats?.admin?.count ?? 0, color: "#8b5cf6" },
      { count: pipelineStats?.failed?.count ?? 0, color: "#f43f5e" },
    ];

    let accum = 0;
    return segments
      .filter((s) => s.count > 0)
      .map((s) => {
        const arc = (s.count / total) * C;
        const offset = accum;
        accum += arc;
        return {
          color: s.color,
          strokeDasharray: `${arc} ${C - arc}`,
          strokeDashoffset: -offset,
        };
      });
  }, [pipelineStats]);

  // ───────── TAB 2: DISPUTES STATE ─────────
  const [disputes, setDisputes] = useState<WithdrawalDispute[]>([]);
  const [totalDisputes, setTotalDisputes] = useState(0);
  const [disputePage, setDisputePage] = useState(1);
  const [disputeLimit, setDisputeLimit] = useState(PAGE_LIMIT);
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [activeDisputeId, setActiveDisputeId] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<null | "resolve">(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");

  const loadDisputes = useCallback(
    async (signal?: AbortSignal, pageArg = disputePage) => {
      setLoadingDisputes(true);
      try {
        const filters: AdminDisputeFilters = { page: pageArg, limit: disputeLimit };
        if (isSuperAdmin && teamFilter !== "all") filters.team = teamFilter;
        if (statusFilter !== "all") filters.resolutionStatus = statusFilter;
        if (assignmentFilter === "unassigned") filters.assignmentStatus = "unassigned";
        else if (assignmentFilter === "assigned") filters.assignmentStatus = "assigned";
        else if (assignmentFilter === "mine" && user?.id) filters.assigneeId = user.id;
        const res = await listAdminDisputes(filters, signal);
        setDisputes(res.items);
        setTotalDisputes(res.total);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load disputes");
      } finally {
        setLoadingDisputes(false);
      }
    },
    [disputePage, disputeLimit, isSuperAdmin, teamFilter, statusFilter, assignmentFilter, user?.id],
  );

  useEffect(() => {
    if (activeTab === "disputes") {
      const controller = new AbortController();
      void loadDisputes(controller.signal);
      return () => controller.abort();
    }
  }, [activeTab, loadDisputes]);

  const activeDispute = useMemo(
    () => disputes.find((d) => d.id === activeDisputeId) || null,
    [disputes, activeDisputeId],
  );

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleResolve = async (id: string) => {
    setActionInFlight("resolve");
    try {
      const updated = await resolveDispute(id, resolutionNotes.trim() || undefined);
      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      toast.success("Dispute resolved");
      setActiveDisputeId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve");
    } finally {
      setActionInFlight(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedDeposits.length && paginatedDeposits.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedDeposits.map((d) => d.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 max-w-full relative pb-10">
      {/* ─────────────────────────────────────────────────────────────
          TOP BANNER: Title, Description, Actions & 3D Illustration
      ───────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div className="max-w-xl z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Deposits Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
            Track user account deposits, manual balance adjustments, and deposit issue tickets.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 z-10 shrink-0">
          {activeTab === "all_deposits" && (
            <ExportButton
              filename="deposits"
              rows={filteredDeposits}
              columns={depositExportColumns}
              disabled={loadingDeposits}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-xs transition-all cursor-pointer"
            />
          )}

          <button
            type="button"
            onClick={() => (activeTab === "all_deposits" ? loadDeposits() : loadDisputes())}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingDeposits || loadingDisputes ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* 3D Decorative Floating Wallet Artwork */}
        <DepositsHeaderIllustration />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB NAVIGATION (All Deposits / Deposit Issues)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800/80 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("all_deposits")}
          className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === "all_deposits"
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" />
          <span>All Deposits</span>
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
            {deposits.length}
          </span>
          {activeTab === "all_deposits" && (
            <motion.div
              layoutId="depositTabIndicator"
              className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full"
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("disputes")}
          className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === "disputes"
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Deposit Issues & Disputes</span>
          {totalDisputes > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500">
              {totalDisputes}
            </span>
          )}
          {activeTab === "disputes" && (
            <motion.div
              layoutId="depositTabIndicator"
              className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full"
            />
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ALL DEPOSITS CONTENT
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "all_deposits" && (
        <div className="space-y-6">
          {/* ─────────────────────────────────────────────────────────────
              ROW 1: 6 TOP METRIC CARDS (Exact match to screenshot)
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Total Deposits */}
            <button
              type="button"
              onClick={() => {
                setDepositSweepFilter("all");
                setDepositSource("all");
                setDepositPage(1);
              }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer bg-white dark:bg-[#111726] border shadow-xs flex flex-col justify-between min-h-[118px] ${
                depositSweepFilter === "all" && depositSource === "all"
                  ? "border-blue-500 ring-2 ring-blue-500/20"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Total Deposits
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
                    {loadingDeposits ? "—" : depositStats.totalUsdt.toFixed(2)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">USDT</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {loadingDeposits ? "—" : depositStats.totalCount} records (
                    {getTimelineLabel(depositDateFilter)})
                  </p>
                </div>
              </div>
              <SparklineWave color="#3b82f6" />
            </button>

            {/* 2. Transferred */}
            <button
              type="button"
              onClick={() => {
                setDepositSweepFilter((curr) => (curr === "completed" ? "all" : "completed"));
                setDepositSource("all");
                setDepositPage(1);
              }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer bg-white dark:bg-[#111726] border shadow-xs flex flex-col justify-between min-h-[118px] ${
                depositSweepFilter === "completed"
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-400/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ArrowUp className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Transferred
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
                    {loadingDeposits ? "—" : depositStats.completedUsdt.toFixed(2)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">USDT</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {loadingDeposits ? "—" : depositStats.completedCount} swept to admin
                  </p>
                </div>
              </div>
              <SparklineWave color="#10b981" />
            </button>

            {/* 3. Pending Transfer */}
            <button
              type="button"
              onClick={() => {
                setDepositSweepFilter((curr) => (curr === "pending" ? "all" : "pending"));
                setDepositSource("all");
                setDepositPage(1);
              }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer bg-white dark:bg-[#111726] border shadow-xs flex flex-col justify-between min-h-[118px] ${
                depositSweepFilter === "pending"
                  ? "border-amber-500 ring-2 ring-amber-500/20"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-amber-400/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Pending Transfer
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
                    {loadingDeposits ? "—" : depositStats.pendingUsdt.toFixed(2)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">USDT</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {loadingDeposits ? "—" : depositStats.pendingCount} in delay queue
                  </p>
                </div>
              </div>
              <SparklineWave color="#f59e0b" />
            </button>

            {/* 4. In Progress */}
            <button
              type="button"
              onClick={() => {
                setDepositSweepFilter((curr) => (curr === "in_progress" ? "all" : "in_progress"));
                setDepositSource("all");
                setDepositPage(1);
              }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer bg-white dark:bg-[#111726] border shadow-xs flex flex-col justify-between min-h-[118px] ${
                depositSweepFilter === "in_progress"
                  ? "border-sky-500 ring-2 ring-sky-500/20"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-sky-400/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    In Progress
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
                    {loadingDeposits ? "—" : depositStats.inProgressUsdt.toFixed(2)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">USDT</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {loadingDeposits ? "—" : depositStats.inProgressCount} funding/sweeping
                  </p>
                </div>
              </div>
              <SparklineWave color="#0ea5e9" />
            </button>

            {/* 5. Failed Sweep */}
            <button
              type="button"
              onClick={() => {
                setDepositSweepFilter((curr) => (curr === "failed" ? "all" : "failed"));
                setDepositSource("all");
                setDepositPage(1);
              }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer bg-white dark:bg-[#111726] border shadow-xs flex flex-col justify-between min-h-[118px] ${
                depositSweepFilter === "failed"
                  ? "border-rose-500 ring-2 ring-rose-500/20"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-rose-400/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Failed Sweep
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
                    {loadingDeposits ? "—" : depositStats.failedUsdt.toFixed(2)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">USDT</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {loadingDeposits ? "—" : depositStats.failedCount} needs action
                  </p>
                </div>
              </div>
              <SparklineWave color="#f43f5e" />
            </button>

            {/* 6. Manual Credits */}
            <button
              type="button"
              onClick={() => {
                setDepositSource((curr) => (curr === "manual" ? "all" : "manual"));
                setDepositSweepFilter("all");
                setDepositPage(1);
              }}
              className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all cursor-pointer bg-white dark:bg-[#111726] border shadow-xs flex flex-col justify-between min-h-[118px] ${
                depositSource === "manual"
                  ? "border-purple-500 ring-2 ring-purple-500/20"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-purple-400/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Manual Credits
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
                    {loadingDeposits ? "—" : depositStats.manualUsdt.toFixed(2)}{" "}
                    <span className="text-[11px] font-normal text-slate-400">USDT</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {loadingDeposits ? "—" : depositStats.manualCount} admin adjustments
                  </p>
                </div>
              </div>
              <SparklineWave color="#8b5cf6" />
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              ROW 2: SUMMARY & ANALYTICS CARDS (Side-by-side balanced row)
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* Card 1: Deposit Pipeline Overview */}
            <div className="rounded-2xl p-5 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <PieChartIcon className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Deposit Pipeline Overview
                    </h3>
                  </div>

                  <Select
                    value={pipelineRange}
                    onValueChange={(val: any) => setPipelineRange(val)}
                  >
                    <SelectTrigger className="h-7 px-2 text-[11px] font-semibold bg-slate-100/70 dark:bg-slate-800/70 border-none rounded-lg text-slate-700 dark:text-slate-300">
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-xs">
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Donut Chart & Breakdown */}
                <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  {/* Circular Donut Ring */}
                  <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      {/* Gray base circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="14"
                        fill="none"
                        className="text-slate-100 dark:text-slate-800/50"
                      />
                      {donutArcs.map((arc, i) => (
                        <circle
                          key={i}
                          cx="60"
                          cy="60"
                          r="48"
                          stroke={arc.color}
                          strokeWidth="14"
                          strokeDasharray={arc.strokeDasharray}
                          strokeDashoffset={arc.strokeDashoffset}
                          strokeLinecap="round"
                          fill="none"
                          className="transition-all duration-500"
                        />
                      ))}
                    </svg>

                    {/* Donut Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono leading-none">
                        {(Number(pipelineStats?.totalUsdt) || 0).toFixed(2)}
                      </p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                        USDT
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">Total Deposits</span>
                    </div>
                  </div>

                  {/* Legend list */}
                  <div className="flex-1 space-y-2 text-xs w-full">
                    {/* User Deposits */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          User Deposits
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {pipelineStats?.userDeposits?.count ?? 0} ({pipelineStats?.userDeposits?.pct ?? 0}%)
                      </span>
                    </div>

                    {/* Pending Deposits */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          Pending Deposits
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {pipelineStats?.pending?.count ?? 0} ({pipelineStats?.pending?.pct ?? 0}%)
                      </span>
                    </div>

                    {/* Admin Deposits */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          Admin Deposits
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {pipelineStats?.admin?.count ?? 0} ({pipelineStats?.admin?.pct ?? 0}%)
                      </span>
                    </div>

                    {/* Failed Sweep */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          Failed Sweep
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {pipelineStats?.failed?.count ?? 0} ({pipelineStats?.failed?.pct ?? 0}%)
                      </span>
                    </div>

                    {/* Transferred */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          Transferred
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                        {pipelineStats?.transferred?.count ?? 0} ({pipelineStats?.transferred?.pct ?? 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            {/* Card 2: Recent Deposit Activity */}
            <div className="rounded-2xl p-5 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Database className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Recent Deposit Activity
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDepositDateFilter("all");
                      setDepositSearch("");
                      setDepositSweepFilter("all");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* List items */}
                <div className="space-y-3">
                  {deposits && deposits.length > 0 ? (
                    deposits.slice(0, 4).map((d, idx) => {
                      const rawName = d.user?.name || d.user?.email || "Unknown User";
                      const name = typeof rawName === "string" ? rawName : String(rawName || "User");
                      const initials = (name.slice(0, 2) || "DP").toUpperCase();
                      const amt = typeof d.amount === "number" ? d.amount : Number(d.amount) || 0;
                      let dateStr = "Deposit";
                      try {
                        const raw = d.createdAt || d.timestamp;
                        if (raw) {
                          const dt = new Date(raw);
                          if (!Number.isNaN(dt.getTime())) {
                            dateStr = format(dt, "MMM dd, yyyy");
                          }
                        }
                      } catch {
                        dateStr = "Deposit";
                      }
                      return (
                        <div key={d.id || d.transactionId || idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                                {name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {dateStr}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold font-mono text-emerald-500 shrink-0">
                            +{amt.toFixed(2)} USDT
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    // Exact Mockup Placeholder when no recent deposits found
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                            TE
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              testuser25
                            </p>
                            <p className="text-[11px] text-slate-400">No deposits yet</p>
                          </div>
                        </div>
                        <span className="text-slate-400 font-mono">—</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                            TE
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              testuser23
                            </p>
                            <p className="text-[11px] text-slate-400">No deposits yet</p>
                          </div>
                        </div>
                        <span className="text-slate-400 font-mono">—</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                            RS
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              Rohan Sharma
                            </p>
                            <p className="text-[11px] text-slate-400">No deposits yet</p>
                          </div>
                        </div>
                        <span className="text-slate-400 font-mono">—</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                            NV
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              Neha Verma
                            </p>
                            <p className="text-[11px] text-slate-400">No deposits yet</p>
                          </div>
                        </div>
                        <span className="text-slate-400 font-mono">—</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          {/* ─────────────────────────────────────────────────────────────
              ROW 3: FULL WIDTH DEPOSITS TABLE & SEARCH (Takes entire area)
          ───────────────────────────────────────────────────────────── */}
          <div className="space-y-5 w-full">
            {/* Card 1: Filter & Search Deposits */}
              <div className="rounded-2xl p-5 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Filter className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Filter & Search Deposits
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer py-1 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Advanced Filters</span>
                    {activeAdvancedFilterCount > 0 && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {activeAdvancedFilterCount}
                      </span>
                    )}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${showAdvancedFilters ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>

                {/* Full-width Search Input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={depositSearch}
                    onChange={(e) => {
                      setDepositSearch(e.target.value);
                      setDepositPage(1);
                    }}
                    placeholder="User name, email, hash key, wallet address..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
                  />
                  {depositSearch && (
                    <button
                      type="button"
                      onClick={() => setDepositSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Collapsible Advanced Filters Section */}
                <AnimatePresence initial={false}>
                  {showAdvancedFilters && (
                    <motion.div
                      key="advanced-filters-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="space-y-4 pt-1 overflow-hidden"
                    >
                      {/* Filter Options Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {/* Date Range */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Date Range
                    </label>
                    <Select
                      value={depositDateFilter}
                      onValueChange={(val: any) => {
                        setDepositDateFilter(val);
                        setDepositPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 rounded-xl font-medium">
                        <SelectValue placeholder="Today" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-xs">
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="1d">Last 24 Hours</SelectItem>
                        <SelectItem value="3d">Last 3 Days</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="1m">Last 1 Month</SelectItem>
                        <SelectItem value="1y">Last 1 Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Consolidation */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Consolidation
                    </label>
                    <Select
                      value={depositSweepFilter}
                      onValueChange={(val: any) => {
                        setDepositSweepFilter(val);
                        setDepositPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 rounded-xl font-medium">
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-xs">
                        <SelectItem value="all">All States</SelectItem>
                        <SelectItem value="completed">Transferred</SelectItem>
                        <SelectItem value="pending">Pending Transfer</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="failed">Failed Sweep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Visibility */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Visibility
                    </label>
                    <Select
                      value={depositVisibility}
                      onValueChange={(val: any) => {
                        setDepositVisibility(val);
                        setDepositPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 rounded-xl font-medium">
                        <SelectValue placeholder="All Deposits" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-xs">
                        <SelectItem value="all">All Deposits</SelectItem>
                        <SelectItem value="visible">Visible</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Source */}
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Source
                    </label>
                    <Select
                      value={depositSource}
                      onValueChange={(val: any) => {
                        setDepositSource(val);
                        setDepositPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 rounded-xl font-medium">
                        <SelectValue placeholder="All Sources" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 text-xs">
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="onchain">On-chain</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Min USDT */}
                  <div className="col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Min USDT
                    </label>
                    <input
                      type="number"
                      placeholder="Any"
                      value={depositMin}
                      onChange={(e) => {
                        setDepositMin(e.target.value);
                        setDepositPage(1);
                      }}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Max USDT */}
                  <div className="col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Max USDT
                    </label>
                    <input
                      type="number"
                      placeholder="Any"
                      value={depositMax}
                      onChange={(e) => {
                        setDepositMax(e.target.value);
                        setDepositPage(1);
                      }}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Custom Date Range Popovers if selected */}
                {depositDateFilter === "custom" && (
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8.5 text-xs border-slate-200 dark:border-slate-800 font-normal"
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                          {depositCustomRange.start
                            ? format(depositCustomRange.start, "MMM dd, yyyy")
                            : "Start Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={depositCustomRange.start}
                          onSelect={(d) => setDepositCustomRange((p) => ({ ...p, start: d }))}
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
                          className="h-8.5 text-xs border-slate-200 dark:border-slate-800 font-normal"
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                          {depositCustomRange.end
                            ? format(depositCustomRange.end, "MMM dd, yyyy")
                            : "End Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={depositCustomRange.end}
                          onSelect={(d) => setDepositCustomRange((p) => ({ ...p, end: d }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Filter Action Buttons at Bottom Right */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositPage(1);
                      toast.success(`Applied filters: ${filteredDeposits.length} deposits found`);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Apply Filters</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearDepositFilters}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

              {/* Card 2: All Deposits Table */}
              <div className="rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
                {/* Table Header Row */}
                <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Database className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      All Deposits ({filteredDeposits.length} of {deposits.length})
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] text-slate-700 dark:text-slate-300 font-semibold text-xs shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          <ColumnsIcon className="h-3.5 w-3.5 text-slate-500" />
                          <span>Columns</span>
                          <ChevronDown className="h-3 w-3 text-slate-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2.5 text-xs space-y-1.5" align="end">
                        <p className="font-bold text-[11px] text-slate-400 uppercase tracking-wider pb-1">
                          Visible Columns
                        </p>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>S.No.</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>User Name</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Amount</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Method / Address</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Remark</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Date & Time</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Status</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Hash Key</span>
                        </label>
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                          <span>Transferred to Admin</span>
                        </label>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/30">
                        <th className="w-10 px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedIds.length === paginatedDeposits.length &&
                              paginatedDeposits.length > 0
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-3 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          S.No.
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          User Name
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => {
                              if (depositSortKey === "amount") {
                                setDepositSortDir((d) => (d === "desc" ? "asc" : "desc"));
                              } else {
                                setDepositSortKey("amount");
                                setDepositSortDir("desc");
                              }
                            }}
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                          >
                            <span>Amount</span>
                            {depositSortKey === "amount" ? (
                              depositSortDir === "desc" ? (
                                <ArrowDown className="h-3 w-3 text-blue-500" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-blue-500" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          Method / Address
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          Remark
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => {
                              if (depositSortKey === "newest") {
                                setDepositSortDir((d) => (d === "desc" ? "asc" : "desc"));
                              } else {
                                setDepositSortKey("newest");
                                setDepositSortDir("desc");
                              }
                            }}
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                          >
                            <span>Date & Time</span>
                            {depositSortKey === "newest" ? (
                              depositSortDir === "desc" ? (
                                <ArrowDown className="h-3 w-3 text-blue-500" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-blue-500" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          Status
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400">
                          Hash Key
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Transferred to Admin
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {loadingDeposits ? (
                        <tr>
                          <td colSpan={10} className="py-14 text-center">
                            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            <p className="mt-2 text-xs text-slate-400 font-medium">
                              Loading deposits...
                            </p>
                          </td>
                        </tr>
                      ) : filteredDeposits.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-0">
                            {/* Empty State Box matching user's design */}
                            <EmptyParcelIllustration />
                          </td>
                        </tr>
                      ) : (
                        paginatedDeposits.map((item, idx) => {
                          const isSelected = selectedIds.includes(item.id);
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                                isSelected ? "bg-blue-50/40 dark:bg-blue-900/10" : ""
                              }`}
                            >
                              <td className="w-10 px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectRow(item.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>

                              <td className="px-3 py-3.5 font-mono text-slate-400 font-medium">
                                {(depositPage - 1) * depositPageSize + idx + 1}
                              </td>

                              {/* User Name */}
                              <td className="px-4 py-3.5">
                                {item.user ? (
                                  <Link
                                    to={`/admin/users/${item.user.id}`}
                                    className="group flex flex-col hover:underline"
                                  >
                                    <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                      {item.user.name}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {item.user.email}
                                    </span>
                                  </Link>
                                ) : (
                                  <span className="text-slate-400 italic">Guest / External</span>
                                )}
                              </td>

                              {/* Amount */}
                              <td className="px-4 py-3.5 font-mono font-bold text-emerald-500">
                                {item.amount.toFixed(2)} {item.currency}
                              </td>

                              {/* Method / Address */}
                              <td className="px-4 py-3.5 font-mono text-slate-500">
                                {item.walletAddress === "MANUAL_ADJUSTMENT" ? (
                                  <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-purple-600 dark:text-purple-400 font-sans text-xs border border-purple-500/20">
                                    Manual Admin Credit
                                  </span>
                                ) : (
                                  <TronLink type="address" value={item.walletAddress} />
                                )}
                              </td>

                              {/* Remark */}
                              <td className="px-4 py-3.5 text-slate-500">
                                {item.remark || "Standard Deposit"}
                              </td>

                              {/* Date & Time */}
                              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                                {formatIst(item.timestamp || item.createdAt)}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="h-3 w-3" /> Completed
                                </span>
                              </td>

                              {/* Hash Key */}
                              <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-1.5">
                                  {item.transactionId &&
                                  item.transactionId !== "MANUAL_ADJUSTMENT" &&
                                  !item.transactionId.startsWith("MANUAL_") ? (
                                    <TronLink type="transaction" value={item.transactionId} />
                                  ) : (
                                    <span className="font-semibold text-blue-600">
                                      {item.transactionId}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(item.transactionId)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Copy Hash Key"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Transferred to Admin */}
                              <td className="px-4 py-3.5">
                                {item.sweepStatus === "completed" ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit">
                                      <CheckCircle2 className="h-3 w-3" /> Transferred
                                    </span>
                                    {item.sweepTxHash && (
                                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                                        <span>Tx:</span>
                                        <TronLink type="transaction" value={item.sweepTxHash} />
                                      </div>
                                    )}
                                  </div>
                                ) : item.sweepStatus === "funding_gas" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 w-fit">
                                    <Zap className="h-3 w-3 animate-pulse" /> Funding Gas
                                  </span>
                                ) : item.sweepStatus === "sweeping" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400 border border-sky-500/20 w-fit">
                                    <RefreshCw className="h-3 w-3 animate-spin" /> Sweeping...
                                  </span>
                                ) : item.sweepStatus === "failed" ? (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 w-fit">
                                      <AlertTriangle className="h-3 w-3" /> Sweep Failed
                                    </span>
                                    {isSuperAdmin &&
                                      item.walletAddress &&
                                      item.walletAddress !== "MANUAL_ADJUSTMENT" && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleSweepWallet(item.walletAddress)}
                                          disabled={sweepingWallet === item.walletAddress}
                                          className="h-6 px-2 text-[10px] font-bold border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer"
                                        >
                                          {sweepingWallet === item.walletAddress ? (
                                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                          ) : (
                                            <Zap className="h-3 w-3 mr-1 text-amber-500 fill-amber-500" />
                                          )}
                                          Sweep Now
                                        </Button>
                                      )}
                                  </div>
                                ) : item.sweepStatus === "manual" ? (
                                  <span className="text-slate-400 italic">— Internal</span>
                                ) : (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 w-fit">
                                      <Clock className="h-3 w-3" /> Pending Transfer
                                    </span>
                                    {isSuperAdmin &&
                                      item.walletAddress &&
                                      item.walletAddress !== "MANUAL_ADJUSTMENT" && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleSweepWallet(item.walletAddress)}
                                          disabled={sweepingWallet === item.walletAddress}
                                          className="h-6 px-2 text-[10px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all cursor-pointer"
                                        >
                                          {sweepingWallet === item.walletAddress ? (
                                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                          ) : (
                                            <Zap className="h-3 w-3 mr-1 text-amber-500 fill-amber-500" />
                                          )}
                                          Sweep Now
                                        </Button>
                                      )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredDeposits.length > 0 && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
                    <TablePagination
                      currentPage={depositPage}
                      totalPages={depositTotalPages}
                      pageSize={depositPageSize}
                      totalItems={filteredDeposits.length}
                      setPage={setDepositPage}
                      nextPage={nextDepositPage}
                      prevPage={prevDepositPage}
                      onPageSizeChange={setDepositPageSize}
                      label="deposits"
                      id="depositsPageSize"
                    />
                  </div>
                )}
              </div>
            </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: DEPOSIT ISSUES & DISPUTES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "disputes" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            {isSuperAdmin && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">
                  Team
                </label>
                <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  {(["all", "support", "tech"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTeamFilter(t)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                        teamFilter === t
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">
                Status
              </label>
              <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {(["all", "pending", "resolved"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      statusFilter === s
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">
                Assignment
              </label>
              <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {(["all", "unassigned", "assigned", "mine"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAssignmentFilter(a)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      assignmentFilter === a
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/30">
                    <th className="px-4 py-3.5 font-semibold text-slate-500">S.No.</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">Issue</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">User Name</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">Amount</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">Team</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">Assignee</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">Status</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loadingDisputes ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Loading deposit disputes...
                      </td>
                    </tr>
                  ) : disputes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        No deposit disputes match criteria.
                      </td>
                    </tr>
                  ) : (
                    disputes.map((d, idx) => (
                      <tr
                        key={d.id}
                        onClick={() => setActiveDisputeId(d.id)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-4 font-mono text-slate-400">
                          {(disputePage - 1) * disputeLimit + idx + 1}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {REASON_LABEL[d.reason]}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            WD {d.withdrawalId.slice(-8).toUpperCase()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {d.userName ||
                              (d.userId ? `User ${d.userId.slice(-6).toUpperCase()}` : "—")}
                          </p>
                          {d.userEmail && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {d.userEmail}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-emerald-500">
                          {d.amountUsdt != null ? `${d.amountUsdt} USDT` : d.netInr ? fmtInr(d.netInr) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                            {TEAM_LABEL[d.team]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {d.assignee ? d.assignee.fullName : "Not assigned"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`capitalize font-semibold ${
                              d.resolutionStatus === "resolved" ? "text-emerald-500" : "text-amber-500"
                            }`}
                          >
                            {d.resolutionStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {formatIst(d.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
              <TablePagination
                currentPage={disputePage}
                totalPages={Math.max(1, Math.ceil(totalDisputes / disputeLimit))}
                pageSize={disputeLimit}
                totalItems={totalDisputes}
                setPage={setDisputePage}
                nextPage={() =>
                  setDisputePage((p) =>
                    Math.min(p + 1, Math.max(1, Math.ceil(totalDisputes / disputeLimit))),
                  )
                }
                prevPage={() => setDisputePage((p) => Math.max(1, p - 1))}
                onPageSizeChange={setDisputeLimit}
                label="disputes"
                id="disputesPageSize"
              />
            </div>
          </div>
        </div>
      )}

      {/* DISPUTE RESOLUTION DIALOG */}
      <Dialog open={!!activeDispute} onOpenChange={() => setActiveDisputeId(null)}>
        <DialogContent className="max-w-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xl rounded-2xl p-6">
          {activeDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Deposit Issue Details
                </DialogTitle>
                <DialogDescription>
                  Review and resolve deposit issue for user{" "}
                  {activeDispute.userName || activeDispute.userEmail || activeDispute.userId}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-3 text-sm">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Issue Type:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {REASON_LABEL[activeDispute.reason]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">User:</span>
                    {activeDispute.userId ? (
                      <Link
                        to={`/admin/users/${encodeURIComponent(activeDispute.userId)}`}
                        className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {activeDispute.userName || activeDispute.userEmail || activeDispute.userId}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="font-semibold">
                        {activeDispute.userName || activeDispute.userEmail || "—"}
                      </span>
                    )}
                  </div>
                  {activeDispute.amountUsdt && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400">Claimed Amount:</span>
                      <span className="font-semibold font-mono text-emerald-500">
                        {activeDispute.amountUsdt} USDT
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter notes about resolution..."
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs focus:border-blue-500 focus:outline-none"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDisputeId(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(activeDispute.id)}
                  disabled={!!actionInFlight}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Mark Resolved
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
