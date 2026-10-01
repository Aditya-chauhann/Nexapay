import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Send,
  Zap,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowRightLeft,
  X,
  Radio,
  Clock,
} from "lucide-react";
import QRCode from "react-qr-code";
import { TronLink } from "@/components/shared/TronLink";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { copyText } from "@/lib/copy";
import {
  getGasMaintenanceInfo,
  triggerGasBalanceCheck,
  sendTestGasAlert,
  patchGlobalPricing,
  triggerManualSweep,
  type GasMaintenanceInfo,
} from "@/lib/api-pricing";

const AdminWallets = () => {
  const [gasInfo, setGasInfo] = useState<GasMaintenanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [togglingSweep, setTogglingSweep] = useState(false);
  const [updatingDelay, setUpdatingDelay] = useState(false);
  const [sweepingNow, setSweepingNow] = useState(false);
  const [showGasQr, setShowGasQr] = useState(false);

  const fetchGasInfo = useCallback(async (signal?: AbortSignal, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await getGasMaintenanceInfo(signal);
      setGasInfo(data);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      if (!isSilent) {
        toast.error(err instanceof Error ? err.message : "Failed to load gas wallet info");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchGasInfo(controller.signal);
    return () => controller.abort();
  }, [fetchGasInfo]);

  // Periodic background refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchGasInfo(undefined, true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchGasInfo]);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const updated = await triggerGasBalanceCheck();
      setGasInfo(updated);
      toast.success("Live blockchain balances updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh balances");
    } finally {
      setRefreshing(false);
    }
  };

  const handleTestAlert = async () => {
    if (testingAlert) return;
    setTestingAlert(true);
    try {
      await sendTestGasAlert();
      toast.success("Test alert dispatched to Telegram Security Bot!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test alert");
    } finally {
      setTestingAlert(false);
    }
  };

  const handleToggleSweep = async () => {
    if (!gasInfo || togglingSweep) return;
    const nextState = !gasInfo.sweepEnabled;
    setTogglingSweep(true);
    try {
      await patchGlobalPricing({ enableSweep: nextState } as any);
      setGasInfo((prev) => (prev ? { ...prev, sweepEnabled: nextState } : null));
      toast.success(`Auto-Sweep Engine ${nextState ? "Enabled" : "Paused"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update sweep state");
    } finally {
      setTogglingSweep(false);
    }
  };

  const handleChangeSweepDelay = async (minutes: number) => {
    if (updatingDelay) return;
    setUpdatingDelay(true);
    try {
      await patchGlobalPricing({ sweepDelayMinutes: minutes });
      setGasInfo((prev) => (prev ? { ...prev, sweepDelayMinutes: minutes } : null));
      toast.success(
        minutes === 0
          ? "Deposit sweep aggregation set to Instant (0m)"
          : `Deposit sweep aggregation window set to ${minutes} min${minutes === 1 ? "" : "s"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update sweep delay");
    } finally {
      setUpdatingDelay(false);
    }
  };

  const handleSweepNow = async () => {
    if (sweepingNow) return;
    setSweepingNow(true);
    try {
      const res = await triggerManualSweep();
      toast.success(res.message || "Immediate sweep triggered successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger immediate sweep");
    } finally {
      setSweepingNow(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) {
      toast.success(`${label} copied to clipboard`);
    } else {
      toast.error("Failed to copy");
    }
  };

  const trxBal = gasInfo?.trxBalance ?? 0;
  const isCritical = trxBal <= 10;
  const isUrgent = trxBal > 10 && trxBal <= 20;
  const isWarning = trxBal > 20 && trxBal <= 30;
  const isAlertMode = trxBal < 30;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Gas &amp; Wallet Management</h1>
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
              Live On-Chain
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Super Admin real-time gas monitoring, Telegram bot threshold alerts, and auto-sweep controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestAlert}
            disabled={testingAlert || loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
            title="Test sending notification to Security Bot"
          >
            <Send className={`h-3.5 w-3.5 ${testingAlert ? "animate-pulse" : ""}`} />
            {testingAlert ? "Sending…" : "Test Bot Alert"}
          </button>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Querying Tron…" : "Refresh Balances"}
          </button>
        </div>
      </div>

      {/* Low Balance Alert Banner */}
      <AnimatePresence>
        {isAlertMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`glass-card p-4 sm:p-5 border ${
              isCritical
                ? "border-destructive/60 bg-destructive/10 text-destructive"
                : isUrgent
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-warning/50 bg-warning/10 text-warning"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isCritical
                    ? "bg-destructive/20 text-destructive animate-pulse"
                    : isUrgent
                    ? "bg-amber-500/20 text-amber-400 animate-pulse"
                    : "bg-warning/20 text-warning"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    {isCritical
                      ? "🚨 Critical Gas Exhaustion Alert (< 10 TRX)"
                      : isUrgent
                      ? "⚠️ Urgent Gas Balance Alert (< 20 TRX)"
                      : "⚡ Low Gas Balance Advisory (< 30 TRX)"}
                  </h3>
                  <span className="rounded-full bg-black/40 px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                    Current: {trxBal.toFixed(4)} TRX
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/80 leading-relaxed">
                  The Gas Fee Dispenser wallet balance is below recommended operating levels. Automatic user deposit sweeps and contract fee delegations may fail if TRX is completely depleted.
                  <strong> Please send at least 50–100 TRX to the Gas Wallet address below.</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGasQr(true)}
                className="shrink-0 rounded-lg bg-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/20 transition"
              >
                Scan QR to Fund
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Gas & Sweeper Command Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gas Fee Dispenser Wallet (Hero Card) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`lg:col-span-7 glass-card p-6 flex flex-col justify-between space-y-6 relative overflow-hidden transition-all duration-300 ${
            isAlertMode
              ? "ring-2 ring-warning/60 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
              : "border-border"
          }`}
        >
          {/* Subtle background glow */}
          {isAlertMode && (
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-warning/15 blur-3xl pointer-events-none" />
          )}

          <div>
            {/* Header / Status Badge */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    isAlertMode ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"
                  }`}
                >
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">Gas Fee Dispenser</h2>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono">
                      TRC-20 Fee Payer
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Funds on-chain bandwidth &amp; energy for user sweeps
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center">
                {isCritical ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive animate-pulse">
                    <AlertCircle className="h-3.5 w-3.5" /> Critical (&lt; 10 TRX)
                  </span>
                ) : isUrgent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5" /> Urgent (&lt; 20 TRX)
                  </span>
                ) : isWarning ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> Low Gas (&lt; 30 TRX)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Healthy &amp; Active
                  </span>
                )}
              </div>
            </div>

            {/* Live Balances Display */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* TRX Balance */}
              <div
                className={`rounded-2xl border p-4 transition-colors ${
                  isAlertMode
                    ? "border-warning/40 bg-warning/5"
                    : "border-border/80 bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-warning" /> Live TRX Gas Balance
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">TRON</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`font-mono text-3xl font-extrabold tracking-tight ${
                      isCritical
                        ? "text-destructive"
                        : isUrgent
                        ? "text-amber-400"
                        : isWarning
                        ? "text-warning"
                        : "text-foreground"
                    }`}
                  >
                    {loading ? "…" : trxBal.toFixed(4)}
                  </span>
                  <span className="font-mono text-sm font-semibold text-muted-foreground">TRX</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isAlertMode
                    ? "⚠️ Below 30 TRX threshold — refill required"
                    : "✓ Sufficient gas for automated sweeps"}
                </p>
              </div>

              {/* USDT Balance */}
              <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-primary" /> Dispenser USDT (Buffer)
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">TRC-20</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
                    {loading ? "…" : (gasInfo?.usdtBalance ?? 0).toFixed(2)}
                  </span>
                  <span className="font-mono text-sm font-semibold text-muted-foreground">USDT</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Secondary token balance on gas dispenser
                </p>
              </div>
            </div>

            {/* Address bar with Copy & QR */}
            <div className="mt-5 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Gas Wallet Address
              </label>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-secondary/70 p-3">
                <code className="flex-1 break-all font-mono text-xs sm:text-sm font-semibold text-foreground">
                  {gasInfo?.gasFeeWalletAddress || "Loading…"}
                </code>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      gasInfo?.gasFeeWalletAddress &&
                      handleCopy(gasInfo.gasFeeWalletAddress, "Gas Wallet Address")
                    }
                    className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                    title="Copy Address"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGasQr(!showGasQr)}
                    className="rounded-lg p-2 text-primary hover:bg-primary/10 transition"
                    title="Toggle QR Code"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                  {gasInfo?.gasFeeWalletAddress && (
                    <a
                      href={`https://tronscan.org/#/address/${gasInfo.gasFeeWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                      title="View on TronScan"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Inline QR Code Expandable View */}
            <AnimatePresence>
              {showGasQr && gasInfo?.gasFeeWalletAddress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden rounded-2xl border border-border bg-secondary/50 p-4 text-center"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Scan with TronLink / Mobile Wallet to Deposit TRX
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGasQr(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mx-auto w-44 h-44 rounded-xl bg-white p-2.5 shadow-md flex items-center justify-center">
                    <QRCode
                      value={gasInfo.gasFeeWalletAddress}
                      size={160}
                      level="M"
                      className="h-full w-full"
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Send native <strong className="text-foreground">TRX</strong> to fund fee reservations
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-4">
            <span>
              Last verified:{" "}
              <span className="font-mono text-foreground">
                {gasInfo?.lastCheckedAt ? new Date(gasInfo.lastCheckedAt).toLocaleTimeString() : "—"}
              </span>
            </span>
            <span>Auto-monitored every 2 mins</span>
          </div>
        </motion.div>

        {/* Auto-Sweep Engine & Telegram Bot Hub (Right Column) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          {/* Auto-Sweep Engine Toggle Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Auto Sweep Engine</h3>
                  <p className="text-xs text-muted-foreground">USDT Auto-Consolidation Worker</p>
                </div>
              </div>

              {/* Dynamic Sweep Switch */}
              <button
                type="button"
                onClick={handleToggleSweep}
                disabled={togglingSweep || loading}
                className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 ${
                  gasInfo?.sweepEnabled ? "bg-primary" : "bg-secondary border border-border"
                }`}
                title={gasInfo?.sweepEnabled ? "Click to Pause Sweeps" : "Click to Enable Sweeps"}
              >
                <div
                  className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                    gasInfo?.sweepEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/40 p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Engine Status:</span>
                <span
                  className={`font-semibold ${
                    gasInfo?.sweepEnabled ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {gasInfo?.sweepEnabled ? "● Running (Every 30s)" : "○ Paused by Super Admin"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Min Sweep Amount:</span>
                <span className="font-mono font-semibold text-foreground">1.00 USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fund Amount / Sweep:</span>
                <span className="font-mono font-semibold text-foreground">15 TRX</span>
              </div>
            </div>

            {/* Batch Aggregation Timer & Sweep Control */}
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>Deposit Sweep Delay (Aggregation Window)</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                  {gasInfo?.sweepDelayMinutes && gasInfo.sweepDelayMinutes > 0
                    ? `${gasInfo.sweepDelayMinutes}m window`
                    : "Instant (0m)"}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: "0m", val: 0, title: "Instant sweep (no delay)" },
                  { label: "15m", val: 15, title: "15 minutes batch delay" },
                  { label: "30m", val: 30, title: "30 minutes batch delay" },
                  { label: "1h", val: 60, title: "1 hour batch delay" },
                  { label: "2h", val: 120, title: "2 hours batch delay" },
                ].map((opt) => {
                  const isCurrent = (gasInfo?.sweepDelayMinutes ?? 0) === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      disabled={updatingDelay || loading}
                      onClick={() => handleChangeSweepDelay(opt.val)}
                      title={opt.title}
                      className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                        isCurrent
                          ? "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/30 ring-1 ring-primary"
                          : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/40"
                      } disabled:opacity-50`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Aggregates multiple user deposits into a single on-chain sweep transaction to save TRX gas fees.
                Timer counts from the 1st deposit.
              </p>

              {/* Instant Manual Flush / Sweep Now */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">Bypass timer &amp; flush queue:</span>
                <button
                  type="button"
                  onClick={handleSweepNow}
                  disabled={sweepingNow || !gasInfo?.sweepEnabled || loading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  title="Immediately fast-track and sweep all pending deposits"
                >
                  <Zap className={`h-3.5 w-3.5 ${sweepingNow ? "animate-spin text-emerald-300" : "fill-current"}`} />
                  <span>{sweepingNow ? "Sweeping..." : "Sweep Now"}</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Telegram Bot Notification Tiers Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Telegram Bot Alert Thresholds
                </h3>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Connected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-2.5">
                <div className="font-bold text-warning">30 TRX</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Low Alert</div>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <div className="font-bold text-amber-400">20 TRX</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Urgent Alert</div>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5">
                <div className="font-bold text-destructive">10 TRX</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Critical Alert</div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-tight">
              Instant alerts sent to your Security Bot with smart anti-spam deduplication &amp; top-up confirmation.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminWallets;
