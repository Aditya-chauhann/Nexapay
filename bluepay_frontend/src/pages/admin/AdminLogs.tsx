import { Search, Filter, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";

const logs = [
  { id: "LOG-001", timestamp: "2025-03-30 14:32:01", action: "user.login", actor: "admin@TrustO.io", details: "Admin login from 182.73.12.xx", level: "info" },
  { id: "LOG-002", timestamp: "2025-03-30 14:28:45", action: "withdrawal.approved", actor: "admin@TrustO.io", details: "Approved ₹41,250 withdrawal for user #1089", level: "info" },
  { id: "LOG-003", timestamp: "2025-03-30 14:15:22", action: "security.block_ip", actor: "system", details: "Auto-blocked IP 103.21.58.134 after 5 failed attempts", level: "warning" },
  { id: "LOG-004", timestamp: "2025-03-30 13:58:10", action: "deposit.confirmed", actor: "system", details: "Confirmed 500 USDT deposit - TxID: abc...xyz", level: "info" },
  { id: "LOG-006", timestamp: "2025-03-30 13:30:05", action: "settings.updated", actor: "admin@TrustO.io", details: "Updated withdrawal fee from 1.0% to 1.5%", level: "warning" },
  { id: "LOG-007", timestamp: "2025-03-30 12:55:18", action: "withdrawal.rejected", actor: "admin@TrustO.io", details: "Rejected withdrawal #W-2045 - account frozen", level: "warning" },
  { id: "LOG-008", timestamp: "2025-03-30 12:10:44", action: "security.2fa_disabled", actor: "user#1078", details: "User disabled 2FA authentication", level: "error" },
  { id: "LOG-009", timestamp: "2025-03-30 11:45:00", action: "system.backup", actor: "system", details: "Daily database backup completed successfully", level: "info" },
  { id: "LOG-010", timestamp: "2025-03-30 10:20:33", action: "user.registered", actor: "system", details: "New user registered via referral code REF-AMT01", level: "info" },
];

const AdminLogs = () => {
  const [filterLevel, setFilterLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = logs.filter(l => {
    if (filterLevel !== "all" && l.level !== filterLevel) return false;
    if (searchQuery && !l.action.includes(searchQuery) && !l.details.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">System Logs</h1>
          <p className="mt-1 text-muted-foreground">Audit trail of all platform actions</p>
        </div>
        <ExportButton
          filename="system-logs"
          rows={filtered}
          label="Export Logs"
          columns={[
            { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
            { header: "ID", value: (l) => l.id },
            { header: "Timestamp", value: (l) => l.timestamp },
            { header: "Action", value: (l) => l.action },
            { header: "Actor", value: (l) => l.actor },
            { header: "Details", value: (l) => l.details },
            { header: "Level", value: (l) => l.level },
          ] as CsvColumn<(typeof logs)[number]>[]}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative max-w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="table-scroll flex flex-wrap items-center gap-1.5">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          {["all", "info", "warning", "error"].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFilterLevel(level)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:py-1.5 ${
                filterLevel === level ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden p-1 sm:p-0">
        <div className="table-scroll sm:rounded-xl">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border bg-secondary/30">
                <th className="px-5 py-3 font-medium">Timestamp</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Details</th>
                <th className="px-5 py-3 font-medium">Level</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="table-row-hover border-b border-border/50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {log.timestamp}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-medium">{log.action}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{log.actor}</td>
                  <td className="max-w-[12rem] px-5 py-3 text-xs sm:max-w-xs">
                    <span className="line-clamp-2 sm:line-clamp-none">{log.details}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      log.level === "error" ? "badge-destructive" : log.level === "warning" ? "badge-warning" : "badge-success"
                    }`}>{log.level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogs;
