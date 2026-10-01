import { ArrowDownToLine, ArrowUpFromLine, Bell, DollarSign, TrendingUp, Users } from "lucide-react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import StatCard from "@/components/shared/StatCard";

/**
 * The console as it sits behind the PIN lock.
 *
 * This is the real chrome — the actual `AdminSidebar` (real logo, real nav
 * items, real signed-in account) inside the real `AdminLayout` shell, with the
 * real `StatCard`s and the dashboard's own headings — so the blurred backdrop
 * IS the admin console rather than a lookalike.
 *
 * The figures are representative, not live. They cannot be live: until the PIN
 * is verified the backend answers every admin endpoint with 403 PIN_REQUIRED
 * (that is the whole point of the gate), so there is no data to show, and
 * fetching it here would both defeat the lock and bury the modal in error
 * toasts. Nothing in this tree performs a request.
 */

const CHART_BARS = [38, 62, 45, 78, 55, 88, 42, 70, 58, 92, 48, 66, 74, 51];

const ACTIVITY_ROWS = [
  ["0x7f3a…c21b", "Deposit", "1,250.00 USDT", "Completed"],
  ["0x91de…4a07", "Withdrawal", "480.50 USDT", "Pending"],
  ["0x2b6c…9f14", "Deposit", "3,900.00 USDT", "Completed"],
  ["0xa48f…07d3", "Withdrawal", "1,120.75 USDT", "Approved"],
  ["0xd15b…6e82", "Deposit", "760.00 USDT", "Completed"],
  ["0x5c90…b3a6", "Withdrawal", "2,340.00 USDT", "Pending"],
  ["0xe72d…18f5", "Deposit", "540.25 USDT", "Completed"],
];

export function LockedConsolePreview() {
  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-background">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3" />
          <div className="ml-auto flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-md">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 flex-1 space-y-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Platform overview and activity
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="font-medium text-success">System Online</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              value="12,480"
              change="from observed deposits"
              changeType="neutral"
              icon={Users}
            />
            <StatCard
              title="Total Deposits"
              value="$4.62M"
              change="+8.4% vs last month"
              changeType="positive"
              icon={ArrowDownToLine}
              iconColor="text-success"
            />
            <StatCard
              title="Pending Withdrawals"
              value="37"
              change="1,904 total requests"
              changeType="neutral"
              icon={ArrowUpFromLine}
              iconColor="text-warning"
            />
            <StatCard
              title="Platform Revenue"
              value="18,240.00 USDT"
              change="≈ ₹15,32,160 from 1,867 withdrawals"
              changeType="positive"
              icon={DollarSign}
              iconColor="text-primary"
            />
          </div>

          <div className="glass-card p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Daily Volume (USDT)</h2>
                <p className="text-sm text-muted-foreground">
                  Transaction volume over time
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-sm font-medium text-success">
                <TrendingUp className="h-4 w-4" /> +8.4%
              </div>
            </div>
            <div className="flex h-48 items-end gap-2">
              {CHART_BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/40"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold">Recent Transactions</h2>
              <span className="rounded-lg bg-secondary px-3 py-1.5 text-sm text-muted-foreground">
                View all
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium sm:px-6">Wallet</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Type</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Amount</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITY_ROWS.map(([wallet, type, amount, status], i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3.5 font-mono text-xs sm:px-6">{wallet}</td>
                    <td className="px-4 py-3.5 text-muted-foreground sm:px-6">{type}</td>
                    <td className="px-4 py-3.5 font-medium sm:px-6">{amount}</td>
                    <td className="px-4 py-3.5 sm:px-6">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          status === "Pending"
                            ? "bg-warning/15 text-warning"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
