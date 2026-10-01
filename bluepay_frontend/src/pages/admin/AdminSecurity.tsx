import { Shield, Lock, Eye, AlertTriangle, Ban, Globe, Clock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/shared/StatCard";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";

const securityEvents = [
  { event: "Failed login attempt (5x)", ip: "103.21.58.xx", userId: "—", name: "Unknown", email: "—", mobile: "—", time: "3 min ago", severity: "high" },
  { event: "Password changed", ip: "182.73.12.xx", userId: "U-1089", name: "Amit S.", email: "amit.s@gmail.com", mobile: "+91 99887 76655", time: "15 min ago", severity: "low" },
  { event: "Suspicious withdrawal pattern", ip: "45.33.91.xx", userId: "U-1156", name: "Raj K.", email: "raj.k@yahoo.com", mobile: "+91 90011 22334", time: "28 min ago", severity: "high" },
  { event: "New device login", ip: "157.48.22.xx", userId: "U-1102", name: "Priya M.", email: "priya.m@outlook.com", mobile: "+91 90909 80808", time: "1 hour ago", severity: "medium" },
  { event: "2FA disabled", ip: "203.12.45.xx", userId: "U-1042", name: "Karan J.", email: "karan.j@gmail.com", mobile: "+91 98765 43210", time: "2 hours ago", severity: "medium" },
];

const blockedIPs = [
  { ip: "103.21.58.134", reason: "Brute force attack", blockedAt: "Today 14:32", attempts: 47 },
  { ip: "45.33.91.201", reason: "Suspicious activity", blockedAt: "Today 11:05", attempts: 12 },
  { ip: "91.108.4.88", reason: "Bot detected", blockedAt: "Yesterday", attempts: 230 },
];

const AdminSecurity = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Security Center</h1>
        <p className="text-muted-foreground mt-1">Monitor threats, manage access, and review security events</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Security Score" value="87/100" change="Good standing" changeType="positive" icon={Shield} />
        <StatCard title="Blocked IPs" value="23" change="+3 today" changeType="neutral" icon={Ban} iconColor="text-destructive" />
        <StatCard title="Failed Logins (24h)" value="142" change="-18% vs yesterday" changeType="positive" icon={Lock} iconColor="text-warning" />
        <StatCard title="Active Sessions" value="89" change="Online users" changeType="neutral" icon={Globe} iconColor="text-primary" />
      </div>

      {/* Security Events */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Eye className="h-5 w-5 text-primary" /> Security Events
          </h2>
          <ExportButton
            filename="security-events"
            rows={securityEvents}
            columns={[
              { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
              { header: "Event", value: (e) => e.event },
              { header: "User ID", value: (e) => e.userId },
              { header: "Name", value: (e) => e.name },
              { header: "Email", value: (e) => e.email },
              { header: "Mobile", value: (e) => e.mobile },
              { header: "IP Address", value: (e) => e.ip },
              { header: "Time", value: (e) => e.time },
              { header: "Severity", value: (e) => e.severity },
            ] as CsvColumn<(typeof securityEvents)[number]>[]}
          />
        </div>
        <div className="table-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">Event</th>
                <th className="pb-3 font-medium">User ID</th>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Mobile</th>
                <th className="pb-3 font-medium">IP Address</th>
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {securityEvents.map((e, i) => (
                <tr key={i} className="table-row-hover border-b border-border/50 last:border-0">
                  <td className="py-3 font-medium">{e.event}</td>
                  <td className="py-3 text-muted-foreground font-mono text-xs">{e.userId}</td>
                  <td className="py-3 text-sm">{e.name}</td>
                  <td className="py-3 text-muted-foreground text-xs">{e.email}</td>
                  <td className="py-3 text-muted-foreground font-mono text-xs">{e.mobile}</td>
                  <td className="py-3 font-mono text-xs">{e.ip}</td>
                  <td className="py-3 text-muted-foreground">{e.time}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      e.severity === "high" ? "badge-destructive" : e.severity === "medium" ? "badge-warning" : "badge-success"
                    }`}>{e.severity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocked IPs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Ban className="w-5 h-5 text-destructive" /> Blocked IPs
          </h2>
          <div className="space-y-3">
            {blockedIPs.map((b, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border border-border/50 bg-secondary/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{b.ip}</p>
                  <p className="text-xs text-muted-foreground">{b.reason} · {b.attempts} attempts</p>
                </div>
                <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:text-right">
                  <p className="text-xs text-muted-foreground">{b.blockedAt}</p>
                  <button type="button" className="text-xs text-primary hover:underline">Unblock</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Security Controls */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Security Controls
          </h2>
          {[
            { label: "Force 2FA for Admins", desc: "Require two-factor auth for all admin accounts", enabled: true, icon: Shield },
            { label: "Rate Limiting", desc: "Limit API requests per IP (100/min)", enabled: true, icon: Clock },
            { label: "Auto-block Suspicious IPs", desc: "Block IPs after 5 failed attempts", enabled: true, icon: Ban },
            { label: "Withdrawal Confirmation", desc: "Require email verification for large withdrawals", enabled: true, icon: CheckCircle2 },
          ].map((ctrl, i) => (
            <div key={i} className="flex flex-col gap-3 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <ctrl.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ctrl.label}</p>
                  <p className="text-xs text-muted-foreground">{ctrl.desc}</p>
                </div>
              </div>
              <div className={`flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors ${ctrl.enabled ? "bg-primary" : "bg-secondary"}`}>
                <div className={`h-5 w-5 rounded-full bg-foreground transition-transform ${ctrl.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminSecurity;
