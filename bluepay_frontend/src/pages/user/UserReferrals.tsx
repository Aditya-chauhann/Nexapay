import { Copy, Users, Gift, TrendingUp, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/shared/StatCard";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";

const referrals = [
  { userId: "U-1089", name: "Amit S.", email: "amit.s@gmail.com", mobile: "+91 99887 76655", joined: "Mar 28, 2026", deposits: "2,500 USDT", commission: "25 USDT", status: "Active" },
  { userId: "U-1102", name: "Priya K.", email: "priya.k@outlook.com", mobile: "+91 90909 80808", joined: "Mar 20, 2026", deposits: "1,200 USDT", commission: "12 USDT", status: "Active" },
  { userId: "U-1118", name: "Rahul M.", email: "rahul.m@gmail.com", mobile: "+91 91234 56789", joined: "Mar 15, 2026", deposits: "800 USDT", commission: "8 USDT", status: "Active" },
  { userId: "U-1078", name: "Sneha D.", email: "sneha.d@yahoo.com", mobile: "+91 98123 45678", joined: "Mar 10, 2026", deposits: "0 USDT", commission: "0 USDT", status: "Pending" },
  { userId: "U-1042", name: "Karan J.", email: "karan.j@gmail.com", mobile: "+91 98765 43210", joined: "Mar 5, 2026", deposits: "5,000 USDT", commission: "50 USDT", status: "Active" },
];

const UserReferrals = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-muted-foreground mt-1">Invite friends and earn commissions on their deposits</p>
      </div>

      {/* Referral Link */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card glow-border p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Referral Link</p>
              <p className="font-mono text-sm mt-0.5">NexaPay.io/ref/<span className="text-primary">NIKHIL2026</span></p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
              <Copy className="w-4 h-4" /> Copy Link
            </button>
          </div>
        </div>
        <div className="mt-4 bg-secondary rounded-lg p-3 text-xs text-muted-foreground">
          Earn <span className="text-primary font-semibold">1%</span> commission on every deposit made by your referrals. No limits!
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Referrals" value="5" change="+2 this month" changeType="positive" icon={Users} />
        <StatCard title="Total Commissions" value="95 USDT" change="₹7,838 equivalent" changeType="neutral" icon={Gift} iconColor="text-warning" />
        <StatCard title="Active Referrals" value="4" change="80% active rate" changeType="positive" icon={TrendingUp} iconColor="text-success" />
      </div>

      {/* Referral Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Your Referrals</h2>
          <ExportButton
            filename="my-referrals"
            rows={referrals}
            columns={[
              { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
              { header: "User ID", value: (r) => r.userId },
              { header: "Name", value: (r) => r.name },
              { header: "Email", value: (r) => r.email },
              { header: "Mobile", value: (r) => r.mobile },
              { header: "Joined", value: (r) => r.joined },
              { header: "Total Deposits", value: (r) => r.deposits },
              { header: "Your Commission", value: (r) => r.commission },
              { header: "Status", value: (r) => r.status },
            ] as CsvColumn<(typeof referrals)[number]>[]}
          />
        </div>
        <div className="table-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">User ID</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Name</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Email</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Mobile</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Joined</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Total Deposits</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Your Commission</th>
              <th className="text-left text-xs text-muted-foreground font-medium pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r, i) => (
              <tr key={i} className="table-row-hover border-b border-border/50">
                <td className="py-3 text-xs font-mono text-muted-foreground">{r.userId}</td>
                <td className="py-3 text-sm font-medium">{r.name}</td>
                <td className="py-3 text-sm text-muted-foreground">{r.email}</td>
                <td className="py-3 text-sm font-mono text-muted-foreground">{r.mobile}</td>
                <td className="py-3 text-sm text-muted-foreground">{r.joined}</td>
                <td className="py-3 text-sm font-mono">{r.deposits}</td>
                <td className="py-3 text-sm font-mono text-primary">{r.commission}</td>
                <td className="py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.status === "Active" ? "badge-success" : "badge-warning"}`}>
                    {r.status}
                  </span>
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

export default UserReferrals;
