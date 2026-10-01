import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { copyText } from "@/lib/copy";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Wallet,
  Copy,
  TrendingUp,
  IndianRupee,
  Clock,
  Eye,
  EyeOff,
  ChevronRight,
  FileText,
  Users,
  Search,
  Calendar as CalendarIcon,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api-base";
import { tagBadgeStyle, tagEmoji } from "@/lib/tag-colors";
import { getPublicPricing } from "@/lib/api-pricing";
import { exportToCsv } from "@/lib/export-csv";

interface DashboardProfile {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  createdAt: string;
}

interface DashboardBalances {
  totalDeposits: string;
  totalWithdrawals: string;
  totalWithdrawalsInr?: string;
  onHold?: string;
  available: string;
  referralEarnings: string;
  currency: string;
}

interface DashboardData {
  profile: DashboardProfile;
  walletAddress: string;
  balances: DashboardBalances;
}

interface UserTagInfo {
  id: string;
  name: string;
  rank: number;
  color: string | null;
  benefitInr: number;
}

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
  destination: Record<string, unknown> | null;
  timestamp: string | null;
  createdAt: string;
  userId?: string | null;
}

function formatTxnDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Period = "30d" | "3m" | "1y" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [recentMinAmount, setRecentMinAmount] = useState("");
  const [recentMaxAmount, setRecentMaxAmount] = useState("");
  const [recentStatusFilter, setRecentStatusFilter] = useState<"all" | "completed" | "pending" | "failed">("all");
  const [recentTimeFilter, setRecentTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [userTag, setUserTag] = useState<UserTagInfo | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [inrRate, setInrRate] = useState<number>(100);
  const [heroMetricMode, setHeroMetricMode] = useState<"available" | "deposits" | "withdrawals">("available");

  // Fetch Pricing for INR conversion preview
  useEffect(() => {
    let mounted = true;
    getPublicPricing()
      .then((p) => {
        if (mounted && p?.inrPrice) {
          const r = parseFloat(p.inrPrice);
          if (Number.isFinite(r) && r > 0) setInrRate(r);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Dashboard Profile & Balances
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/user`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(body?.message ?? "Could not load dashboard");
          return;
        }
        setData(body as DashboardData);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  // Fetch Transactions
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/user/transactions?limit=100`, {
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
      }
    };
    load();
    return () => controller.abort();
  }, []);

  // Fetch User Tag
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/user/me/tag`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.status === 404) {
          setUserTag(null);
          return;
        }
        const body = await response.json().catch(() => null);
        if (!response.ok) return;
        const raw = (body && typeof body === "object" && "tag" in body
          ? (body as { tag: unknown }).tag
          : body) as Record<string, unknown> | null;
        if (!raw || typeof raw !== "object") {
          setUserTag(null);
          return;
        }
        const id = (raw.id as string | undefined) ?? (raw._id as string | undefined);
        const name = (raw.name as string | undefined)?.trim();
        if (!id || !name) {
          setUserTag(null);
          return;
        }
        setUserTag({
          id,
          name,
          rank: Number.isFinite(Number(raw.rank)) ? Number(raw.rank) : 1,
          color: (raw.color as string | null | undefined) ?? null,
          benefitInr: Number.isFinite(Number(raw.benefitInr)) ? Number(raw.benefitInr) : 0,
        });
      } catch {
        // ignore
      }
    };
    load();
    return () => controller.abort();
  }, []);

  // Real-time socket updates
  useEffect(() => {
    const s = io(API_BASE_URL, { transports: ["websocket"] });
    s.on("transaction_update", () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) return;
      fetch(`${API_BASE_URL}/user`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => {});
      fetch(`${API_BASE_URL}/user/transactions?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((t) => setTransactions(Array.isArray(t) ? t : []))
        .catch(() => {});
    });
    return () => {
      s.disconnect();
    };
  }, []);

  // Today totals
  const todayTotals = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTs = startOfToday.getTime();

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const prevStartTs = startOfYesterday.getTime();

    let depToday = 0;
    let depYest = 0;
    let withToday = 0;
    let withYest = 0;
    let withInrToday = 0;

    for (const t of transactions) {
      const ts = new Date(t.createdAt).getTime();
      if (Number.isNaN(ts)) continue;
      const isPaid = ["paid", "completed", "confirmed", "resolved"].includes((t.status ?? "").toLowerCase());

      if (t.type === "deposit") {
        if (ts >= startTs) depToday += t.amount;
        else if (ts >= prevStartTs && ts < startTs) depYest += t.amount;
      } else if (isPaid) {
        if (ts >= startTs) {
          withToday += t.amount;
          if (t.inrAmount) withInrToday += t.inrAmount;
        } else if (ts >= prevStartTs && ts < startTs) {
          withYest += t.amount;
        }
      }
    }

    const pct = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return ((cur - prev) / prev) * 100;
    };

    return {
      depositedToday: depToday,
      depDelta: pct(depToday, depYest),
      withdrawnToday: withToday,
      withDelta: pct(withToday, withYest),
      withdrawnInr: withInrToday,
    };
  }, [transactions]);

  // All time On Hold
  const { allTimeOnHold, allTimePendingCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const t of transactions) {
      if (t.type === "deposit") continue;
      const s = (t.status ?? "").toLowerCase();
      if (["pending", "processing", "awaiting_payment", "reserved"].includes(s)) {
        sum += t.amount;
        count += 1;
      }
    }
    return { allTimeOnHold: sum, allTimePendingCount: count };
  }, [transactions]);

  // Lifetime totals so far
  const { totalDepositedSoFar, totalWithdrawnSoFar, totalWithdrawnInrSoFar } = useMemo(() => {
    let dep = 0;
    let wit = 0;
    let witInr = 0;
    for (const t of transactions) {
      const isPaid = ["paid", "completed", "confirmed", "resolved"].includes((t.status ?? "").toLowerCase());
      if (t.type === "deposit") {
        dep += t.amount;
      } else if (isPaid) {
        wit += t.amount;
        if (t.inrAmount) witInr += t.inrAmount;
      }
    }
    return {
      totalDepositedSoFar: dep,
      totalWithdrawnSoFar: wit,
      totalWithdrawnInrSoFar: witInr,
    };
  }, [transactions]);

  // Chart Data
  const chartData = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let cutoff = now - 30 * day;
    if (period === "3m") cutoff = now - 90 * day;
    else if (period === "1y") cutoff = now - 365 * day;
    else if (period === "all") cutoff = 0;

    const filtered = transactions.filter((t) => {
      const ts = new Date(t.createdAt).getTime();
      return ts >= cutoff;
    });

    const buckets = new Map<string, { date: Date; label: string; deposits: number; withdrawals: number }>();
    for (const t of filtered) {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const existing = buckets.get(key) ?? { date: d, label, deposits: 0, withdrawals: 0 };
      if (t.type === "deposit") existing.deposits += t.amount;
      else {
        const s = (t.status ?? "").toLowerCase();
        if (["paid", "completed", "confirmed", "resolved"].includes(s)) {
          existing.withdrawals += t.amount;
        }
      }
      buckets.set(key, existing);
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sorted.length === 0) {
      // Return placeholder empty curve points
      return [
        { label: "Jul 21", deposits: 0, withdrawals: 0 },
        { label: "Aug 1", deposits: 0, withdrawals: 0 },
        { label: "Sep 1", deposits: 0, withdrawals: 0 },
        { label: "Today", deposits: 0, withdrawals: 0 },
      ];
    }
    return sorted;
  }, [transactions, period]);

  // Filtered recent transactions for table
  const filteredRecent = useMemo(() => {
    const min = recentMinAmount === "" ? null : parseFloat(recentMinAmount);
    const max = recentMaxAmount === "" ? null : parseFloat(recentMaxAmount);
    const now = Date.now();
    const cutoff =
      recentTimeFilter === "24h"
        ? now - 24 * 60 * 60 * 1000
        : recentTimeFilter === "7d"
        ? now - 7 * 24 * 60 * 60 * 1000
        : recentTimeFilter === "30d"
        ? now - 30 * 24 * 60 * 60 * 1000
        : null;

    const groupOf = (s: string) => {
      const x = s.toLowerCase();
      if (["completed", "confirmed", "paid", "success", "resolved"].includes(x)) return "completed";
      if (["processing", "pending", "awaiting_payment"].includes(x)) return "pending";
      return "failed";
    };

    return transactions.filter((t) => {
      if (recentStatusFilter !== "all" && groupOf(t.status) !== recentStatusFilter) return false;
      if (min != null && Number.isFinite(min) && t.amount < min) return false;
      if (max != null && Number.isFinite(max) && t.amount > max) return false;
      if (cutoff != null) {
        const ts = new Date(t.createdAt).getTime();
        if (Number.isNaN(ts) || ts < cutoff) return false;
      }
      return true;
    });
  }, [transactions, recentMinAmount, recentMaxAmount, recentStatusFilter, recentTimeFilter]);

  const handleExportCsv = () => {
    exportToCsv("user-transactions.csv", filteredRecent, [
      { key: "id", label: "ID" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Date" },
    ]);
  };

  const firstName = data?.profile?.name ?? user?.name ?? "User";

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here's your account overview and live activity.
          </p>
        </div>

        {userTag && (
          <div
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 self-start sm:self-auto bg-white shadow-sm"
            style={tagBadgeStyle(userTag.color)}
          >
            {tagEmoji(userTag.name) ? (
              <span className="text-lg leading-none">{tagEmoji(userTag.name)}</span>
            ) : null}
            <span className="text-xs font-semibold">{userTag.name}</span>
          </div>
        )}
      </div>

      {/* Top Row: Two Balance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Available / Total Balance (Blue Gradient) */}
        <div className="lg:col-span-7 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 rounded-3xl p-6 sm:p-7 text-white relative overflow-hidden shadow-lg shadow-blue-500/15 flex flex-col justify-between min-h-[220px] hover:shadow-blue-500/25 transition-all duration-300">
          {/* Subtle wavy background overlay */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <svg
            className="absolute -right-10 -bottom-10 w-72 h-72 text-white/10 pointer-events-none"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path
              d="M40,-65C52,-58,62,-47,68,-34C74,-21,76,-6,73,8C70,22,62,35,52,46C42,57,30,66,16,70C2,74,-14,73,-28,67C-42,61,-54,50,-62,37C-70,24,-74,9,-72,-5C-70,-19,-62,-32,-51,-40C-40,-48,-26,-51,-12,-55C2,-59,16,-64,28,-72Z"
              transform="translate(100 100)"
            />
          </svg>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                {heroMetricMode === "deposits" ? (
                  <ArrowDownToLine className="w-5 h-5" />
                ) : heroMetricMode === "withdrawals" ? (
                  <ArrowUpFromLine className="w-5 h-5" />
                ) : (
                  <Wallet className="w-5 h-5" />
                )}
              </div>
              <span className="text-sm font-medium text-blue-100">
                {heroMetricMode === "deposits"
                  ? "Total Deposited So Far"
                  : heroMetricMode === "withdrawals"
                  ? "Total Withdrawn So Far"
                  : "Available Balance"}
              </span>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="text-blue-200 hover:text-white transition-colors"
                aria-label="Toggle balance visibility"
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
              heroMetricMode === "deposits"
                ? "bg-emerald-400/25 text-emerald-100 border-emerald-300/40"
                : heroMetricMode === "withdrawals"
                ? "bg-purple-400/25 text-purple-100 border-purple-300/40"
                : "bg-emerald-400/20 text-emerald-200 border-emerald-400/30"
            }`}>
              {heroMetricMode === "deposits"
                ? "Lifetime Deposits"
                : heroMetricMode === "withdrawals"
                ? "Lifetime Withdrawals"
                : "Ready for withdrawal"}
            </span>
          </div>

          <div className="relative z-10 my-3">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight transition-all">
              {showBalance ? (
                heroMetricMode === "deposits" ? (
                  `${totalDepositedSoFar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                ) : heroMetricMode === "withdrawals" ? (
                  `${totalWithdrawnSoFar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                ) : data ? (
                  `${parseFloat(data.balances.available || "0").toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USDT`
                ) : (
                  "0.00 USDT"
                )
              ) : (
                "•••••• USDT"
              )}
            </div>
            <div className="text-sm text-blue-200 font-medium mt-1">
              {showBalance ? (
                heroMetricMode === "deposits" ? (
                  `Total cumulative deposits credited (≈ ₹${(totalDepositedSoFar * inrRate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                ) : heroMetricMode === "withdrawals" ? (
                  `Total lifetime payouts completed (≈ ₹${totalWithdrawnInrSoFar.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                ) : (
                  `≈ ₹${(parseFloat(data?.balances.available || "0") * inrRate).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                )
              ) : (
                "≈ ₹••••••"
              )}
            </div>
          </div>

          {/* Action / View toggle buttons */}
          <div className="relative z-10 flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setHeroMetricMode((prev) => (prev === "deposits" ? "available" : "deposits"))}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-1.5 ${
                heroMetricMode === "deposits"
                  ? "bg-emerald-400 text-slate-900 font-bold ring-2 ring-white shadow-md"
                  : "bg-white text-blue-700 hover:bg-blue-50"
              }`}
              title={heroMetricMode === "deposits" ? "Click to view Available Balance" : "Click to view Total Deposited so far"}
            >
              Deposit
              {heroMetricMode === "deposits" && <span className="text-[10px] bg-slate-900/10 px-1 rounded font-bold">Active</span>}
            </button>
            <button
              type="button"
              onClick={() => setHeroMetricMode((prev) => (prev === "withdrawals" ? "available" : "withdrawals"))}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-1.5 ${
                heroMetricMode === "withdrawals"
                  ? "bg-white text-blue-700 font-bold ring-2 ring-white shadow-md"
                  : "bg-blue-700/60 hover:bg-blue-700 text-white border border-blue-400/30"
              }`}
              title={heroMetricMode === "withdrawals" ? "Click to view Available Balance" : "Click to view Total Withdrawn so far"}
            >
              Withdraw
              {heroMetricMode === "withdrawals" && <span className="text-[10px] bg-blue-100 px-1 rounded font-bold text-blue-800">Active</span>}
            </button>
          </div>
        </div>

        {/* On Hold (Warm Amber) - Clickable with Hover Lift */}
        <div
          onClick={() => navigate("/user/transactions?status=pending")}
          className="lg:col-span-5 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white border border-amber-200/60 rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-sm min-h-[220px] cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-amber-300 transition-all duration-300 group"
          title="Click to view all pending / in-flight withdrawals"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 border border-orange-200/80 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-600">On Hold</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-amber-100 group-hover:text-amber-800 shadow-sm transition-colors">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          <div className="my-auto py-2">
            <div className="text-3xl font-extrabold text-slate-900 group-hover:text-amber-950 transition-colors">
              {allTimeOnHold.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {allTimePendingCount} withdrawal{allTimePendingCount === 1 ? "" : "s"} in-flight • Click to view
            </div>
          </div>
          <div />
        </div>
      </div>

      {/* Row 2: 4 Statistic Cards with Mini Sparklines - Clickable & Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Deposited Today */}
        <div
          onClick={() => navigate("/user/transactions?type=deposit")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-blue-300 transition-all duration-300 group"
          title="Click to view deposits history"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Deposited Today</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2">
              {todayTotals.depositedToday.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </div>
            <div className="text-xs font-semibold text-emerald-600 mt-1">
              {todayTotals.depDelta >= 0 ? "+" : ""}
              {todayTotals.depDelta.toFixed(1)}% vs prev Today
            </div>
          </div>
          <svg className="w-16 h-8 text-emerald-500 group-hover:translate-x-1 transition-transform" viewBox="0 0 64 32" fill="none">
            <path
              d="M2 24 C14 24, 18 10, 30 18 C42 26, 48 4, 62 8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Withdrawn Today */}
        <div
          onClick={() => navigate("/user/transactions?type=withdrawal")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-rose-300 transition-all duration-300 group"
          title="Click to view withdrawals"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowUpFromLine className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Withdrawn Today</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2">
              {todayTotals.withdrawnToday.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </div>
            <div className="text-xs font-semibold text-rose-500 mt-1">
              {todayTotals.withDelta >= 0 ? "+" : ""}
              {todayTotals.withDelta.toFixed(1)}% vs prev Today
            </div>
          </div>
          <svg className="w-16 h-8 text-rose-500 group-hover:translate-x-1 transition-transform" viewBox="0 0 64 32" fill="none">
            <path
              d="M2 10 C14 8, 22 28, 34 20 C46 12, 52 26, 62 14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Withdrawn INR */}
        <div
          onClick={() => navigate("/user/transactions?type=withdrawal&status=completed")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-purple-300 transition-all duration-300 group"
          title="Click to view completed INR payouts"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <IndianRupee className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Withdrawn INR</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2">
              ₹
              {todayTotals.withdrawnInr.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs font-semibold text-purple-600 mt-1">
              {todayTotals.withdrawnInr > 0 ? "Completed payouts" : "0 completed"}
            </div>
          </div>
          <svg className="w-16 h-8 text-purple-500 group-hover:translate-x-1 transition-transform" viewBox="0 0 64 32" fill="none">
            <path
              d="M2 22 C12 18, 24 24, 34 16 C44 8, 52 20, 62 10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Total Withdrawals (In-flight) */}
        <div
          onClick={() => navigate("/user/transactions?type=withdrawal&status=pending")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-blue-400 transition-all duration-300 group"
          title="Click to view processing in-flight withdrawals"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500">Total Withdrawals (In-flight)</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2">{allTimePendingCount}</div>
            <div className="text-xs font-semibold text-blue-600 mt-1">Processing</div>
          </div>
          <svg className="w-16 h-8 text-blue-500 group-hover:translate-x-1 transition-transform" viewBox="0 0 64 32" fill="none">
            <path
              d="M2 26 C16 26, 26 12, 38 18 C50 24, 56 6, 62 8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Row 3: Chart & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Deposits vs Withdrawals Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-bold text-slate-900">Deposits vs Withdrawals</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                Deposits
              </div>
            </div>

            {/* Time Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {PERIODS.map(({ key, label }) => {
                const active = period === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPeriod(key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Select date range"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="depGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="deposits"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#depGradient)"
                  name="Deposits"
                />
                <Area
                  type="monotone"
                  dataKey="withdrawals"
                  stroke="#f97316"
                  strokeWidth={2}
                  fillOpacity={0}
                  fill="#ffffff"
                  name="Withdrawals"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <h2 className="text-base font-bold text-slate-900">Quick Actions</h2>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* Deposit */}
            <button
              onClick={() => navigate("/user/deposit")}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3">
                <ArrowDownToLine className="w-5 h-5" />
                <span>Deposit</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-80" />
            </button>

            {/* Withdraw */}
            <button
              onClick={() => navigate("/user/withdraw")}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3 text-slate-700">
                <ArrowUpFromLine className="w-5 h-5 text-blue-600" />
                <span>Withdraw</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* View Transactions */}
            <button
              onClick={() => navigate("/user/transactions")}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3 text-slate-700">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>View Transactions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Distribution Portal */}
            <button
              onClick={() => navigate("/user/distribution")}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm transition-colors shadow-sm"
            >
              <div className="flex items-center gap-3 text-slate-700">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Distribution Portal</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Transactions Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            Export CSV
          </button>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="number"
            placeholder="Min amount"
            value={recentMinAmount}
            onChange={(e) => setRecentMinAmount(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
          />
          <input
            type="number"
            placeholder="Max amount"
            value={recentMaxAmount}
            onChange={(e) => setRecentMaxAmount(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
          />
          <select
            value={recentStatusFilter}
            onChange={(e) => setRecentStatusFilter(e.target.value as any)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 text-slate-700"
          >
            <option value="all">All statuses</option>
            <option value="completed">Paid / Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={recentTimeFilter}
            onChange={(e) => setRecentTimeFilter(e.target.value as any)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 text-slate-700"
          >
            <option value="all">All time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-medium">
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredRecent.slice(0, 10).map((t) => {
                  const s = (t.status ?? "").toLowerCase();
                  const isPaid = ["paid", "completed", "confirmed", "resolved"].includes(s);
                  const isFailed = ["failed", "rejected", "cancelled"].includes(s);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {t.id ? `${t.id.slice(0, 10)}...` : "—"}
                      </td>
                      <td className="py-3 px-3 capitalize font-medium text-slate-800">
                        {t.type}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {t.inrAmount ? `₹${t.inrAmount.toLocaleString("en-IN")}` : `${t.amount} ${t.currency}`}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-600"
                              : isFailed
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {isPaid ? "Paid" : isFailed ? "Failed" : "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatTxnDate(t.createdAt)}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => navigate(`/user/transactions`)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
