import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Users,
  ArrowUp,
  Upload,
  Clock,
  Laptop,
  Wallet,
  Diamond,
  UserCheck,
  UserMinus,
  Download,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  History,
  ArrowRight,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { downloadReport, type ReportPath } from "@/lib/api-reports";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────────
   REPORT DEFINITIONS & CONFIGURATION (9 CARDS)
───────────────────────────────────────────────────────────── */
interface ReportCardConfig {
  key: ReportPath | "pending-withdrawals-quick";
  path: ReportPath;
  label: string;
  subtitle: string;
  description: string;
  recordsCount: string;
  fallbackFilename: string;
  Icon: React.ComponentType<{ className?: string }>;
  accentColor: string; // hex
  iconBg: string;
  iconColor: string;
  waveVariant: number;
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    key: "customers",
    path: "customers",
    label: "Registered customers",
    subtitle: "All user registrations",
    description: "All registered customers data with phone, email, and registration timestamps.",
    recordsCount: "8.4K records",
    fallbackFilename: "registered_customers.xlsx",
    Icon: Users,
    accentColor: "#3b82f6",
    iconBg: "bg-blue-50 dark:bg-blue-950/60",
    iconColor: "text-blue-600 dark:text-blue-400",
    waveVariant: 1,
  },
  {
    key: "deposits",
    path: "deposits",
    label: "Deposits",
    subtitle: "Deposit transaction history",
    description: "Complete deposit transaction history with USDT, INR amounts, and UTR reference.",
    recordsCount: "12.3K records",
    fallbackFilename: "deposits_report.xlsx",
    Icon: ArrowUp,
    accentColor: "#10b981",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    waveVariant: 2,
  },
  {
    key: "withdrawals",
    path: "withdrawals",
    label: "Withdrawals",
    subtitle: "Withdrawal requests",
    description: "All withdrawal requests with bank credentials, status timeline, and staff approval log.",
    recordsCount: "3.1K records",
    fallbackFilename: "withdrawals_report.xlsx",
    Icon: Upload,
    accentColor: "#f97316",
    iconBg: "bg-orange-50 dark:bg-orange-950/60",
    iconColor: "text-orange-600 dark:text-orange-400",
    waveVariant: 3,
  },
  {
    key: "pending-withdrawals-quick",
    path: "withdrawals",
    label: "Pending withdrawals",
    subtitle: "Awaiting approval",
    description: "Withdrawal requests currently in pending state requiring immediate action.",
    recordsCount: "420 records",
    fallbackFilename: "pending_withdrawals.xlsx",
    Icon: Clock,
    accentColor: "#f59e0b",
    iconBg: "bg-amber-50 dark:bg-amber-950/60",
    iconColor: "text-amber-600 dark:text-amber-400",
    waveVariant: 1,
  },
  {
    key: "customer-ledger",
    path: "customer-ledger",
    label: "Customer ledger",
    subtitle: "Complete ledger",
    description: "Chronological audit trail of credit/debit adjustments and running user balances.",
    recordsCount: "25.6K records",
    fallbackFilename: "customer_ledger.xlsx",
    Icon: Laptop,
    accentColor: "#a855f7",
    iconBg: "bg-purple-50 dark:bg-purple-950/60",
    iconColor: "text-purple-600 dark:text-purple-400",
    waveVariant: 2,
  },
  {
    key: "customer-balances",
    path: "customer-balances",
    label: "Customer balances",
    subtitle: "Wallet balances",
    description: "Current snapshot of user crypto and fiat wallet balances across all tiers.",
    recordsCount: "8.4K records",
    fallbackFilename: "customer_balances.xlsx",
    Icon: Wallet,
    accentColor: "#14b8a6",
    iconBg: "bg-teal-50 dark:bg-teal-950/60",
    iconColor: "text-teal-600 dark:text-teal-400",
    waveVariant: 3,
  },
  {
    key: "tier-users",
    path: "tier-users",
    label: "Diamond / tier users",
    subtitle: "VIP & tier based users",
    description: "High-roller and tier-assigned users with volume thresholds and special privileges.",
    recordsCount: "320 records",
    fallbackFilename: "tier_users.xlsx",
    Icon: Diamond,
    accentColor: "#2563eb",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/60",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    waveVariant: 1,
  },
  {
    key: "active-customers",
    path: "active-customers",
    label: "Active customers",
    subtitle: "Currently active users",
    description: "Users who have performed financial activities within the selected active period.",
    recordsCount: "6.8K records",
    fallbackFilename: "active_customers.xlsx",
    Icon: UserCheck,
    accentColor: "#10b981",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    waveVariant: 2,
  },
  {
    key: "inactive-customers",
    path: "inactive-customers",
    label: "Inactive customers",
    subtitle: "Dormant users",
    description: "Dormant accounts with zero transactions across the specified inactivity window.",
    recordsCount: "1.2K records",
    fallbackFilename: "inactive_customers.xlsx",
    Icon: UserMinus,
    accentColor: "#f43f5e",
    iconBg: "bg-rose-50 dark:bg-rose-950/60",
    iconColor: "text-rose-600 dark:text-rose-400",
    waveVariant: 3,
  },
];

/* ─────────────────────────────────────────────────────────────
   SMOOTH SPARKLINE WAVES (Authentic to NexaPay Mockup)
───────────────────────────────────────────────────────────── */
const SparklineWave = ({ color = "#3b82f6", variant = 1 }: { color?: string; variant?: number }) => {
  const gradId = `rep-wave-${color.replace("#", "")}-${variant}`;

  // Gentle wave that sits in the bottom 30% of the SVG (viewBox 0 0 100 35)
  let pathD = "M 0 26 C 25 33, 45 19, 70 27 C 85 31, 95 19, 100 13";
  if (variant === 2) {
    pathD = "M 0 29 C 20 19, 40 31, 65 21 C 80 15, 92 25, 100 16";
  } else if (variant === 3) {
    pathD = "M 0 23 C 22 33, 50 17, 75 27 C 88 31, 96 19, 100 13";
  }
  const areaD = `${pathD} L 100 35 L 0 35 Z`;

  return (
    <div className="absolute -bottom-0.5 left-0 right-0 h-9 pointer-events-none overflow-hidden rounded-b-2xl">
      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 35">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="70%" stopColor={color} stopOpacity="0.05" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   RECENT EXPORT RECORD SCHEMA
───────────────────────────────────────────────────────────── */
interface ExportHistoryItem {
  id: string;
  reportKey: string;
  reportLabel: string;
  filename: string;
  timestamp: string;
  fileSize?: string;
}

const STORAGE_KEY_RECENT_EXPORTS = "bluepay_recent_exports_v1";

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT: AdminReports
───────────────────────────────────────────────────────────── */
export default function AdminReports() {
  const [selectedKey, setSelectedKey] = useState<ReportCardConfig["key"]>("customers");

  // Filters State
  const [dateRangePreset, setDateRangePreset] = useState<string>("month"); // "today" | "7d" | "30d" | "month" | "all" | "custom"
  const [fromDate, setFromDate] = useState<string>(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [daysFilter, setDaysFilter] = useState<string>("10");
  const [inactivePeriod, setInactivePeriod] = useState<string>("month");
  const [inactiveCount, setInactiveCount] = useState<string>("30");

  // Toggles
  const [includeWalletBalance, setIncludeWalletBalance] = useState<boolean>(false);

  // Download & Modal State
  const [downloading, setDownloading] = useState<boolean>(false);
  const [isRecentModalOpen, setIsRecentModalOpen] = useState<boolean>(false);
  const [recentExports, setRecentExports] = useState<ExportHistoryItem[]>([]);

  // Active Report Object
  const activeReport = useMemo(
    () => REPORT_CARDS.find((r) => r.key === selectedKey) ?? REPORT_CARDS[0],
    [selectedKey]
  );

  // Load Recent Exports from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENT_EXPORTS);
      if (saved) {
        setRecentExports(JSON.parse(saved));
      } else {
        // Initial mock item for empty state showcase
        const initialItem: ExportHistoryItem = {
          id: "exp-init",
          reportKey: "customers",
          reportLabel: "Registered customers",
          filename: "registered_customers_sep2026.xlsx",
          timestamp: "Sep 28, 2026, 04:30 PM",
          fileSize: "142 KB",
        };
        setRecentExports([initialItem]);
        localStorage.setItem(STORAGE_KEY_RECENT_EXPORTS, JSON.stringify([initialItem]));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const saveRecentExport = (item: ExportHistoryItem) => {
    setRecentExports((prev) => {
      const next = [item, ...prev.filter((p) => p.filename !== item.filename)].slice(0, 15);
      try {
        localStorage.setItem(STORAGE_KEY_RECENT_EXPORTS, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Build API Query Payload based on active report
  const buildPayload = (): Record<string, string | number> => {
    const p: Record<string, string | number> = {};
    if (dateRangePreset !== "all") {
      if (fromDate) p.from = fromDate;
      if (toDate) p.to = toDate;
    }

    if (activeReport.key === "deposits" && statusFilter !== "all") {
      p.status = statusFilter;
    } else if (activeReport.key === "withdrawals" && statusFilter !== "all") {
      p.status = statusFilter;
    } else if (activeReport.key === "pending-withdrawals-quick") {
      p.status = "pending";
    }

    if (activeReport.key === "customer-ledger" && userIdFilter) {
      p.userId = userIdFilter.trim();
    }

    if (activeReport.key === "tier-users" && tagFilter) {
      p.tag = tagFilter.trim();
    }

    if (activeReport.key === "active-customers") {
      p.days = Number(daysFilter) || 10;
    }

    if (activeReport.key === "inactive-customers") {
      p.period = inactivePeriod;
      p.count = Number(inactiveCount) || 30;
    }

    if (includeWalletBalance) p.includeBalance = "true";

    return p;
  };

  // Handle XLSX Export
  const handleExport = async () => {
    if (activeReport.key === "customer-ledger" && !userIdFilter.trim()) {
      toast.error("Please specify a User ID for the Customer Ledger report");
      return;
    }

    setDownloading(true);
    const toastId = toast.loading(`Generating ${activeReport.label} XLSX...`);
    try {
      const payload = buildPayload();
      await downloadReport(activeReport.path, payload, activeReport.fallbackFilename);

      // Save to recent exports
      const nowStr = format(new Date(), "MMM dd, yyyy, hh:mm a");
      saveRecentExport({
        id: `exp-${Date.now()}`,
        reportKey: activeReport.key,
        reportLabel: activeReport.label,
        filename: activeReport.fallbackFilename,
        timestamp: nowStr,
        fileSize: "185 KB",
      });

      toast.success(`${activeReport.label} downloaded successfully!`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to download report", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // Date Range Quick Preset Handler
  const handleApplyPreset = (preset: string) => {
    setDateRangePreset(preset);
    const now = new Date();
    if (preset === "today") {
      const s = format(now, "yyyy-MM-dd");
      setFromDate(s);
      setToDate(s);
    } else if (preset === "7d") {
      setFromDate(format(subDays(now, 7), "yyyy-MM-dd"));
      setToDate(format(now, "yyyy-MM-dd"));
    } else if (preset === "30d") {
      setFromDate(format(subDays(now, 30), "yyyy-MM-dd"));
      setToDate(format(now, "yyyy-MM-dd"));
    } else if (preset === "month") {
      setFromDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  };

  // Format Date Range string for Button
  const dateRangeDisplay = useMemo(() => {
    if (dateRangePreset === "all") return "All Time";
    if (!fromDate && !toDate) return "All Time";
    try {
      const f = fromDate ? format(new Date(fromDate), "MMM dd, yyyy") : "Start";
      const t = toDate ? format(new Date(toDate), "MMM dd, yyyy") : "Now";
      return `${f} - ${t}`;
    } catch {
      return "Select Date Range";
    }
  }, [dateRangePreset, fromDate, toDate]);



  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Download point-in-time XLSX exports across the platform. Pick a report, apply filters, then export.
          </p>
        </div>

        {/* Recently Exported Button */}
        <button
          type="button"
          onClick={() => setIsRecentModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/70 bg-card hover:bg-secondary/70 text-xs font-semibold text-foreground shadow-xs transition-all shrink-0 hover:border-blue-400/50"
        >
          <History className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Recently Exported</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT GRID (9 CARDS ON LEFT + EXPORT SETTINGS ON RIGHT)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: 9 Report Cards (3x3 grid) - 8 cols */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {REPORT_CARDS.map((card) => {
            const isSelected = selectedKey === card.key;
            const Icon = card.Icon;

            return (
              <div
                key={card.key}
                onClick={() => setSelectedKey(card.key)}
                className={`group relative overflow-hidden rounded-2xl border p-4 bg-card transition-all cursor-pointer shadow-xs hover:shadow-md h-[134px] flex flex-col justify-between ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/25 shadow-md bg-blue-50/15 dark:bg-blue-950/20"
                    : "border-border/60 hover:border-blue-300 dark:hover:border-blue-800/60"
                }`}
              >
                {/* Top Section: Icon on Left, Text & Arrow on Right */}
                <div className="flex items-start gap-3 z-10">
                  <div className={`w-11 h-11 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center border border-border/20 shadow-xs shrink-0 mt-0.5`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-[13px] font-bold tracking-tight text-foreground truncate pr-1">
                        {card.label}
                      </h3>
                      <span className="text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 text-xs transition-all shrink-0">
                        →
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                      {card.subtitle}
                    </p>
                    <p className="text-[11px] font-semibold text-foreground/80 mt-1">
                      {card.recordsCount}
                    </p>
                  </div>
                </div>

                {/* Bottom Flowing Wave Sparkline (Clean in the bottom, never touches the text) */}
                <SparklineWave color={card.accentColor} variant={card.waveVariant} />
              </div>
            );
          })}
        </div>

        {/* Right Column: Export Settings Card - 4 cols */}
        <div className="lg:col-span-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-sm font-bold text-foreground">Export Settings</h2>

            {/* Selected Report Banner */}
            <div className="mt-3 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <activeReport.Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 truncate">
                  {activeReport.label}
                </h4>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 truncate">
                  {activeReport.subtitle}
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="mt-4 space-y-3.5">
              {/* Date Range Picker */}
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                  Date Range
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border/70 bg-secondary/40 text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
                    >
                      <span className="truncate">{dateRangeDisplay}</span>
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground ml-2 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 space-y-2 rounded-xl" align="end">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Quick Presets
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        variant={dateRangePreset === "today" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7.5 justify-start"
                        onClick={() => handleApplyPreset("today")}
                      >
                        Today
                      </Button>
                      <Button
                        variant={dateRangePreset === "7d" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7.5 justify-start"
                        onClick={() => handleApplyPreset("7d")}
                      >
                        Last 7 Days
                      </Button>
                      <Button
                        variant={dateRangePreset === "30d" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7.5 justify-start"
                        onClick={() => handleApplyPreset("30d")}
                      >
                        Last 30 Days
                      </Button>
                      <Button
                        variant={dateRangePreset === "month" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7.5 justify-start"
                        onClick={() => handleApplyPreset("month")}
                      >
                        This Month
                      </Button>
                      <Button
                        variant={dateRangePreset === "all" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7.5 col-span-2 justify-start"
                        onClick={() => handleApplyPreset("all")}
                      >
                        All Time (No Date Filter)
                      </Button>
                    </div>

                    <div className="pt-2 border-t border-border/50 space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Custom Range
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground">From</span>
                          <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => {
                              setDateRangePreset("custom");
                              setFromDate(e.target.value);
                            }}
                            className="w-full text-[11px] p-1.5 rounded-lg border border-border bg-card"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">To</span>
                          <input
                            type="date"
                            value={toDate}
                            onChange={(e) => {
                              setDateRangePreset("custom");
                              setToDate(e.target.value);
                            }}
                            className="w-full text-[11px] p-1.5 rounded-lg border border-border bg-card"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status Dropdown */}
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-xl bg-secondary/40 border-border/70">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    {activeReport.key === "deposits" && (
                      <>
                        <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                      </>
                    )}
                    {activeReport.key === "withdrawals" && (
                      <>
                        <SelectItem value="paid" className="text-xs">Paid</SelectItem>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="processing" className="text-xs">Processing</SelectItem>
                        <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                      </>
                    )}
                    {activeReport.key === "customers" && (
                      <>
                        <SelectItem value="active" className="text-xs">Active Users</SelectItem>
                        <SelectItem value="blocked" className="text-xs">Blocked Users</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Special Filter: User ID for Customer Ledger */}
              {activeReport.key === "customer-ledger" && (
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                    User ID (Required)
                  </label>
                  <input
                    type="text"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    placeholder="Enter User ID or Serial ID..."
                    className="w-full h-9 px-3 rounded-xl border border-border/70 bg-secondary/40 text-xs focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                </div>
              )}

              {/* Special Filter: Tag for Tier Users */}
              {activeReport.key === "tier-users" && (
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                    Tier Tag
                  </label>
                  <input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="e.g. Diamond, VIP, Gold"
                    className="w-full h-9 px-3 rounded-xl border border-border/70 bg-secondary/40 text-xs focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                </div>
              )}

              {/* Special Filter: Days for Active Customers */}
              {activeReport.key === "active-customers" && (
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                    Activity Window (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={daysFilter}
                    onChange={(e) => setDaysFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border/70 bg-secondary/40 text-xs focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                </div>
              )}

              {/* Special Filter: Inactive Customers Window */}
              {activeReport.key === "inactive-customers" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                      Period
                    </label>
                    <Select value={inactivePeriod} onValueChange={(v) => setInactivePeriod(v)}>
                      <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/40 border-border/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day" className="text-xs">Days</SelectItem>
                        <SelectItem value="week" className="text-xs">Weeks</SelectItem>
                        <SelectItem value="month" className="text-xs">Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1.5">
                      Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={inactiveCount}
                      onChange={(e) => setInactiveCount(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-border/70 bg-secondary/40 text-xs focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Toggles */}
              <div className="pt-2 border-t border-border/50 space-y-3">


                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-blue-500/60 flex items-center justify-center text-[10px] text-blue-600 font-bold shrink-0">
                      +
                    </span>
                    <span className="text-xs text-foreground font-medium">Include wallet balance</span>
                  </div>
                  <Switch
                    checked={includeWalletBalance}
                    onCheckedChange={setIncludeWalletBalance}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button: Export XLSX */}
          <div className="pt-2">
            <button
              type="button"
              disabled={downloading}
              onClick={handleExport}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating XLSX...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export XLSX</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RECENTLY EXPORTED MODAL
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={isRecentModalOpen} onOpenChange={setIsRecentModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Recently Exported Reports</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Previous point-in-time spreadsheet exports saved in this browser.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {recentExports.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No exports found yet. Pick any report and click "Export XLSX".
              </div>
            ) : (
              recentExports.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-border/60 bg-secondary/30 flex items-center justify-between gap-3 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate">
                        {item.reportLabel}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {item.filename} • {item.timestamp}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKey(item.reportKey as any);
                      setIsRecentModalOpen(false);
                      toast.info(`Switched to ${item.reportLabel}`);
                    }}
                    className="p-1.5 rounded-lg border border-border/70 hover:bg-card text-muted-foreground hover:text-foreground shrink-0"
                    title="Load this report"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
