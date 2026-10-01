import { API_BASE_URL } from "@/lib/api-base";
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { 
  LineChart, 
  Line, 
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { format, subDays, subMonths, subWeeks, subYears, isAfter } from "date-fns";
import { ArrowLeft, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAW";
  amount: number;
  date: string;
  status: string;
}

interface InviteeData {
  invitee: {
    id: string;
    name: string;
    email: string;
    joinedAt: string;
  };
  transactions: Transaction[];
}

const COLORS = {
  DEPOSIT: "#3b82f6", // blue-500
  WITHDRAW: "#22c55e", // green-500
  PENDING: "#eab308", // yellow-500
  REJECTED: "#ef4444" // red-500
};

const ITEMS_PER_PAGE = 10;

const InviteeTimeline = () => {
  const { inviteeId } = useParams<{ inviteeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/core-control") || location.pathname.startsWith("/admin");
  const token = localStorage.getItem("TrustO_api_token_v1");
  
  const [data, setData] = useState<InviteeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "DEPOSIT" | "WITHDRAW" | "PENDING" | "REJECTED">("ALL");
  const [chartFilter, setChartFilter] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const endpoint = isAdmin
          ? `${API_BASE_URL}/admin/distribution/${inviteeId}`
          : `${API_BASE_URL}/user/distribution/${inviteeId}`;

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          throw new Error("Failed to load timeline data");
        }
        
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        toast.error(err.message || "Error loading timeline");
        navigate(isAdmin ? "/admin/distribution" : "/user/distribution");
      } finally {
        setLoading(false);
      }
    };
    
    if (token && inviteeId) {
      fetchTimeline();
    }
  }, [token, inviteeId, navigate, isAdmin]);

  // Derived state for the table
  const filteredTransactions = useMemo(() => {
    if (!data) return [];
    if (activeTab === "ALL") return data.transactions;
    if (activeTab === "DEPOSIT") return data.transactions.filter(t => t.type === "DEPOSIT" && (t.status === "SUCCESS" || t.status === "PAID"));
    if (activeTab === "WITHDRAW") return data.transactions.filter(t => t.type === "WITHDRAW" && (t.status === "SUCCESS" || t.status === "PAID"));
    if (activeTab === "PENDING") return data.transactions.filter(t => t.status === "PENDING" || t.status === "PROCESSING");
    if (activeTab === "REJECTED") return data.transactions.filter(t => t.status === "REJECTED" || t.status === "FAILED");
    return data.transactions;
  }, [data, activeTab]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Line Chart Data
  const lineChartData = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    let startDate: Date;
    let formatStr: string;
    let points: number;
    let step = (d: Date, i: number) => d;

    switch (chartFilter) {
      case "daily":
        startDate = subDays(now, 7);
        formatStr = "dd MMM";
        points = 7;
        step = (d, i) => subDays(d, points - i - 1);
        break;
      case "weekly":
        startDate = subWeeks(now, 4);
        formatStr = "wo 'Week'";
        points = 4;
        step = (d, i) => subWeeks(d, points - i - 1);
        break;
      case "monthly":
        startDate = subMonths(now, 6);
        formatStr = "MMM yyyy";
        points = 6;
        step = (d, i) => subMonths(d, points - i - 1);
        break;
      case "yearly":
        startDate = subYears(now, 3);
        formatStr = "yyyy";
        points = 3;
        step = (d, i) => subYears(d, points - i - 1);
        break;
    }

    const dataMap = new Map<string, number>();
    for (let i = 0; i < points; i++) {
      const date = step(now, i);
      dataMap.set(format(date, formatStr), 0);
    }

    data.transactions.forEach(t => {
      const d = new Date(t.date);
      if (isAfter(d, startDate)) {
        const key = format(d, formatStr);
        if (dataMap.has(key)) {
          dataMap.set(key, (dataMap.get(key) || 0) + t.amount);
        }
      }
    });

    return Array.from(dataMap.entries()).map(([date, amount]) => ({ date, amount }));
  }, [data, chartFilter]);

  // Donut Chart Data
  const donutData = useMemo(() => {
    if (!data) return [];
    
    let deposits = 0;
    let withdraws = 0;
    let pending = 0;
    let rejected = 0;
    
    data.transactions.forEach(t => {
      if (t.type === "DEPOSIT") deposits++;
      else {
        if (t.status === "SUCCESS" || t.status === "PAID") withdraws++;
        else if (t.status === "PENDING" || t.status === "PROCESSING") pending++;
        else if (t.status === "REJECTED" || t.status === "FAILED") rejected++;
      }
    });
    
    const total = deposits + withdraws + pending + rejected;
    if (total === 0) return [];
    
    return [
      { name: "Deposit", value: deposits, color: COLORS.DEPOSIT, percent: Math.round((deposits/total)*100) },
      { name: "Withdraw", value: withdraws, color: COLORS.WITHDRAW, percent: Math.round((withdraws/total)*100) },
      { name: "Pending", value: pending, color: COLORS.PENDING, percent: Math.round((pending/total)*100) },
      { name: "Rejected", value: rejected, color: COLORS.REJECTED, percent: Math.round((rejected/total)*100) },
    ].filter(d => d.value > 0);
  }, [data]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const getStatusColor = (status: string, type: string) => {
    if (type === "DEPOSIT") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (status === "SUCCESS" || status === "PAID") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (status === "PENDING" || status === "PROCESSING") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    if (status === "REJECTED" || status === "FAILED") return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-secondary text-muted-foreground";
  };
  
  const getStatusText = (status: string, type: string) => {
    if (status === "PENDING" || status === "PROCESSING") return `PENDING ${type}`;
    if (status === "REJECTED" || status === "FAILED") return `REJECTED ${type}`;
    if (type === "DEPOSIT") return "DEPOSIT";
    if (status === "SUCCESS" || status === "PAID") return "WITHDRAW";
    return status;
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      const base = isAdmin ? "/admin/distribution" : "/user/distribution";
      navigate(`${base}${location.search}`);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-12 text-muted-foreground">Loading...</div>;
  }

  if (!data) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto text-sm">
      <div className="flex items-center gap-3 mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack} 
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-md transition-all"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-primary">{data.invitee.name}</span> Timeline
        </h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Pane: Table (takes 2 cols on xl) */}
        <div className="xl:col-span-2 flex flex-col space-y-4">
          <div className="flex space-x-1 border-b border-border/50 overflow-x-auto pb-px">
            {["ALL", "DEPOSIT", "WITHDRAW", "PENDING", "REJECTED"].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-background/40 backdrop-blur rounded-lg border border-border/50">
            <div className="p-4 border-b border-border/50 text-muted-foreground flex items-center gap-2">
              <Square className="w-4 h-4 opacity-50" /> 
              <span>{selectedIds.size} selected</span>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="w-12 text-center"></TableHead>
                    <TableHead>TRANSACTION ID</TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>AMOUNT</TableHead>
                    <TableHead className="text-right pr-6">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-secondary/30 transition-colors border-border/20">
                        <TableCell className="text-center">
                          <button onClick={() => toggleSelect(tx.id)} className="text-muted-foreground hover:text-primary transition-colors">
                            {selectedIds.has(tx.id) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {tx.id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(tx.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.type === "WITHDRAW" ? "₹" : "$"}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getStatusColor(tx.status, tx.type)}`}>
                            {getStatusText(tx.status, tx.type)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-border/50 flex items-center justify-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-8 px-2 bg-transparent"
                >
                  &lt;
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={currentPage === i + 1 ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(i + 1)}
                    className={`h-8 w-8 p-0 ${currentPage === i + 1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-transparent'}`}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-8 px-2 bg-transparent"
                >
                  &gt;
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Charts */}
        <div className="flex flex-col gap-6">
          <Card className="bg-background/40 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Transaction Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(val) => `$${val >= 1000 ? (val/1000) + 'K' : val}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px" 
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#3b82f6", stroke: "hsl(var(--background))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/40 backdrop-blur border-border/50">
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-medium">Transaction Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center">
              <div className="h-[200px] w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => [`${props.payload.percent}% (${value})`, name]}
                      contentStyle={{ backgroundColor: "hsl(var(--background))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 pl-4 flex flex-col gap-3">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-mono">{d.percent}% ({d.value})</span>
                  </div>
                ))}
                {donutData.length === 0 && (
                  <div className="text-muted-foreground text-xs italic">No transactions</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/40 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-4 gap-2">
                {["daily", "weekly", "monthly", "yearly"].map(f => (
                  <Button 
                    key={f}
                    variant={chartFilter === f ? "default" : "ghost"} 
                    className={`text-xs h-9 ${chartFilter !== f ? 'text-muted-foreground hover:text-foreground bg-transparent' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    onClick={() => setChartFilter(f as any)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InviteeTimeline;
