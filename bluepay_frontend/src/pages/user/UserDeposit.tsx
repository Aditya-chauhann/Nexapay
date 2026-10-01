import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowLeft,
  Send,
  Clock,
  Shield,
  Percent,
  Zap,
  ExternalLink,
  Download,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { copyText } from "@/lib/copy";
import { API_BASE_URL } from "@/lib/api-base";
import { exportToCsv } from "@/lib/export-csv";
import { getSystemControlSettings } from "@/lib/api-pricing";

interface DepositRow {
  id: string;
  transactionId: string;
  userId: string;
  walletAddress: string;
  amount: number;
  currency: string;
  timestamp: string;
  createdAt: string;
  txHash?: string | null;
  status?: string;
  confirmations?: number;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function truncateHash(hash?: string | null) {
  if (!hash) return "—";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 4)}......${hash.slice(-4)}`;
}

export default function UserDeposit() {
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [activeTab, setActiveTab] = useState<"qr" | "address">("qr");
  const [hashSearch, setHashSearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "pending" | "failed">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [minDepositUsdt, setMinDepositUsdt] = useState<number>(10);

  // Fetch Wallet Address & Min Deposit
  useEffect(() => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) return;

    fetch(`${API_BASE_URL}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.walletAddress) setWalletAddress(d.walletAddress);
      })
      .catch(() => {});

    try {
      const settings = getSystemControlSettings();
      if ((settings as any)?.minDepositUsdt && Number((settings as any).minDepositUsdt) > 0) {
        setMinDepositUsdt(Number((settings as any).minDepositUsdt));
      }
    } catch {}
  }, []);

  // Fetch Deposits History
  const fetchDeposits = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/user/deposits`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const body = await response.json().catch(() => null);
      if (response.ok && Array.isArray(body)) {
        setDeposits(body as DepositRow[]);
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchDeposits(controller.signal);
    return () => controller.abort();
  }, [fetchDeposits]);

  // Real-time socket
  useEffect(() => {
    const s = io(API_BASE_URL, { transports: ["websocket"] });
    s.on("deposit_update", () => {
      fetchDeposits();
    });
    return () => {
      s.disconnect();
    };
  }, [fetchDeposits]);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    const ok = await copyText(text);
    if (ok) toast.success(`${label} copied to clipboard`);
    else toast.error("Copy failed");
  };

  const filteredDeposits = useMemo(() => {
    const min = minAmount === "" ? null : parseFloat(minAmount);
    const max = maxAmount === "" ? null : parseFloat(maxAmount);
    const now = Date.now();
    const cutoff =
      timeFilter === "24h"
        ? now - 24 * 60 * 60 * 1000
        : timeFilter === "7d"
        ? now - 7 * 24 * 60 * 60 * 1000
        : timeFilter === "30d"
        ? now - 30 * 24 * 60 * 60 * 1000
        : null;

    return deposits.filter((d) => {
      const tx = (d.txHash || d.transactionId || "").toLowerCase();
      if (hashSearch && !tx.includes(hashSearch.toLowerCase())) return false;
      if (min != null && Number.isFinite(min) && d.amount < min) return false;
      if (max != null && Number.isFinite(max) && d.amount > max) return false;
      if (cutoff != null) {
        const ts = new Date(d.createdAt || d.timestamp).getTime();
        if (Number.isNaN(ts) || ts < cutoff) return false;
      }
      return true;
    });
  }, [deposits, hashSearch, minAmount, maxAmount, statusFilter, timeFilter]);

  const handleExportCsv = () => {
    exportToCsv("recent-deposits.csv", filteredDeposits, [
      { key: "txHash", label: "Tx Hash" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "createdAt", label: "Date" },
    ]);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
        <Link to="/user" className="hover:text-slate-900 transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>Deposit</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">USDT</span>
      </div>

      {/* Main Row: Instructions (Left) & QR Code Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Card: Steps & Quick Specs */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-lg hover:border-blue-200/80 transition-all duration-300">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Deposit USDT (TRC-20)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Follow the steps below to deposit to your wallet
            </p>

            {/* Stepper with connecting line */}
            <div className="mt-8 space-y-6 relative">
              {/* Vertical line connecting steps */}
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-slate-200" />

              {/* Step 1 */}
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 z-10 shadow-sm shadow-blue-500/20">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Copy your wallet address</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Use the address on the right or scan the QR code</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(walletAddress, "Wallet address")}
                  className="text-blue-500 hover:text-blue-700 p-2"
                  aria-label="Copy wallet address"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Step 2 */}
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0 z-10">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Send USDT (TRC-20)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Transfer from any exchange or wallet</p>
                  </div>
                </div>
                <div className="p-2 text-blue-500">
                  <Send className="w-4 h-4" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0 z-10">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Wait for confirmation</h3>
                    <p className="text-xs text-slate-500 mt-0.5">41 network confirmations required (~2 min)</p>
                  </div>
                </div>
                <div className="p-2 text-blue-500">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0 z-10">
                    4
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Balance updated</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Your platform balance reflects automatically</p>
                  </div>
                </div>
                <div className="p-2 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 4 Spec Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            {/* Network */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 text-rose-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M2.14 3.75L29.86 16 2.14 28.25 7.6 16z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Network</div>
                <div className="text-xs font-bold text-slate-900 truncate">TRC-20 (Tron)</div>
              </div>
            </div>

            {/* Min Deposit */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Minimum Deposit</div>
                <div className="text-xs font-bold text-slate-900 truncate">{minDepositUsdt} USDT</div>
              </div>
            </div>

            {/* Deposit Fee */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Deposit Fee</div>
                <div className="text-xs font-bold text-slate-900 truncate">0%</div>
              </div>
            </div>

            {/* Confirmations */}
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Confirmations</div>
                <div className="text-xs font-bold text-slate-900 truncate">41 (~2 min)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: QR Code & Wallet Address Display */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-lg hover:border-blue-200/80 transition-all duration-300">
          <div>
            {/* Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === "qr"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Code
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("address")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === "address"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                Wallet Address
              </button>
            </div>

            {/* QR Code Container */}
            <div className="my-6 flex justify-center">
              <div className="p-4 rounded-3xl border border-slate-100 bg-white shadow-sm inline-block hover:shadow-md transition-shadow">
                {walletAddress ? (
                  <QRCode
                    value={walletAddress}
                    size={180}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox="0 0 256 256"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-300">
                    <QrCode className="w-16 h-16 animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Address Display Box with Copy Button */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-2.5 pl-4 flex items-center justify-between gap-2">
              <span className="font-mono text-xs sm:text-sm text-slate-800 break-all select-all font-semibold">
                {walletAddress || "Loading wallet address..."}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(walletAddress, "Wallet address")}
                disabled={!walletAddress}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Only send USDT (TRC-20) to this address.</span>{" "}
              Sending other tokens may result in permanent loss.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Deposits Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5 hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Recent Deposits</h2>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Export CSV
            </button>
            <button
              onClick={() => navigate("/user/transactions?type=Deposit")}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View all
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Tx Hash..."
              value={hashSearch}
              onChange={(e) => setHashSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
          </div>
          <input
            type="number"
            placeholder="Min amount"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
          />
          <input
            type="number"
            placeholder="Max amount"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 text-slate-700"
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 text-slate-700"
          >
            <option value="all">All time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-medium">
                <th className="py-3 px-3">Tx Hash</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Currency</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Time</th>
                <th className="py-3 px-3">Confirmations</th>
                <th className="py-3 px-3 text-right">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No deposits recorded yet.
                  </td>
                </tr>
              ) : (
                filteredDeposits.slice(0, 10).map((d) => {
                  const tx = d.txHash || d.transactionId;
                  const explorerUrl = tx ? `https://tronscan.org/#/transaction/${tx}` : null;

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-mono text-blue-600 font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          {truncateHash(tx)}
                          {tx ? (
                            <button
                              onClick={() => handleCopy(tx, "Transaction hash")}
                              className="text-slate-400 hover:text-blue-600 p-0.5"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {d.amount.toFixed(2)} USDT
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {d.currency || "USDT"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3" />
                          Confirmed
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {relativeTime(d.createdAt || d.timestamp)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 w-28">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                            <span>41 / 41</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full w-full" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {explorerUrl ? (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex p-1 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          "—"
                        )}
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
