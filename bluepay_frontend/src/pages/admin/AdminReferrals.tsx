import { Users, Gift, TrendingUp, AlertTriangle, Search } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/shared/StatCard";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";

const topReferrers = [
  { userId: "U-1042", name: "Karan J.", email: "karan.j@gmail.com", mobile: "+91 98765 43210", referrals: 42, deposits: "85,000 USDT", commission: "850 USDT", fraud: false },
  { userId: "U-1078", name: "Sneha D.", email: "sneha.d@yahoo.com", mobile: "+91 98123 45678", referrals: 28, deposits: "45,200 USDT", commission: "452 USDT", fraud: false },
  { userId: "U-1089", name: "Amit S.", email: "amit.s@gmail.com", mobile: "+91 99887 76655", referrals: 15, deposits: "22,000 USDT", commission: "220 USDT", fraud: false },
  { userId: "U-0221", name: "Unknown #221", email: "—", mobile: "—", referrals: 89, deposits: "2,000 USDT", commission: "20 USDT", fraud: true },
  { userId: "U-1102", name: "Priya K.", email: "priya.k@outlook.com", mobile: "+91 90909 80808", referrals: 8, deposits: "12,500 USDT", commission: "125 USDT", fraud: false },
];

const AdminReferrals = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Management</h1>
        <p className="text-muted-foreground mt-1">Monitor referral chains, commissions, and fraud detection</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Referrals" value="312" change="+45 this month" changeType="positive" icon={Users} />
        <StatCard title="Total Commissions Paid" value="2,850 USDT" icon={Gift} iconColor="text-warning" />
        <StatCard title="Suspected Fraud" value="3" change="Needs review" changeType="negative" icon={AlertTriangle} iconColor="text-destructive" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Top Referrers</h2>
          <ExportButton
            filename="top-referrers"
            rows={topReferrers}
            columns={[
              { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
              { header: "User ID", value: (r) => r.userId },
              { header: "Name", value: (r) => r.name },
              { header: "Email", value: (r) => r.email },
              { header: "Mobile", value: (r) => r.mobile },
              { header: "Referrals", value: (r) => r.referrals },
              { header: "Referral Deposits", value: (r) => r.deposits },
              { header: "Commission", value: (r) => r.commission },
              { header: "Flag", value: (r) => (r.fraud ? "Suspicious" : "Clean") },
            ] as CsvColumn<(typeof topReferrers)[number]>[]}
          />
        </div>
        <div className="table-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">User ID</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Name</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Email</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Mobile</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Referrals</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Referral Deposits</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Commission</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Flag</th>
            </tr>
          </thead>
          <tbody>
            {topReferrers.map((r, i) => (
              <tr key={i} className="table-row-hover border-b border-border/50">
                <td className="py-3 text-xs font-mono text-muted-foreground">{r.userId}</td>
                <td className="py-3 text-sm font-medium">{r.name}</td>
                <td className="py-3 text-sm text-muted-foreground">{r.email}</td>
                <td className="py-3 text-sm font-mono text-muted-foreground">{r.mobile}</td>
                <td className="py-3 text-sm font-mono">{r.referrals}</td>
                <td className="py-3 text-sm font-mono">{r.deposits}</td>
                <td className="py-3 text-sm font-mono text-primary">{r.commission}</td>
                <td className="py-3">
                  {r.fraud ? (
                    <span className="badge-destructive text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 w-fit">
                      <AlertTriangle className="w-3 h-3" /> Suspicious
                    </span>
                  ) : (
                    <span className="badge-success text-xs px-2.5 py-1 rounded-full font-medium">Clean</span>
                  )}
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

export default AdminReferrals;
