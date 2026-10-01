import { API_BASE_URL } from "@/lib/api-base";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
import { format, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { Users, Copy, CheckCircle2, Search, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import ExportButton from "@/components/shared/ExportButton";
import type { CsvColumn } from "@/lib/export-csv";

interface Invitee {
  id: string;
  serialId?: string;
  name: string;
  email: string;
  joinedAt: string;
  transactions: number;
}

interface Agent {
  id: string;
  name: string;
  username: string;
  email: string;
  agentCode: string;
  joinedAt: string;
  referralsCount: number;
  invitees: Invitee[];
}

const ITEMS_PER_PAGE = 8;
const PIE_COLORS = [
  "#10b981", // Emerald Green
  "#06b6d4", // Cyan
  "#3b82f6", // Royal Blue
  "#8b5cf6", // Purple
  "#f43f5e", // Rose Red
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#14b8a6", // Teal
];

const agentExportColumns: CsvColumn<Agent>[] = [
  { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
  { header: "Agent ID", value: (a) => a.id },
  { header: "Name", value: (a) => a.name },
  { header: "Username", value: (a) => a.username },
  { header: "Email", value: (a) => a.email },
  { header: "Agent Code", value: (a) => a.agentCode },
  { header: "Joined Date", value: (a) => (a.joinedAt ? format(new Date(a.joinedAt), "yyyy-MM-dd HH:mm:ss") : "") },
  { header: "Referrals", value: (a) => a.referralsCount },
];

const inviteeExportColumns: CsvColumn<Invitee>[] = [
  { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
  { header: "User ID", value: (i) => i.serialId || i.id },
  { header: "Name", value: (i) => i.name },
  { header: "Email", value: (i) => i.email },
  { header: "Joined Date", value: (i) => (i.joinedAt ? format(new Date(i.joinedAt), "yyyy-MM-dd HH:mm:ss") : "") },
  { header: "Transactions", value: (i) => i.transactions },
];

const DistributionPortal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentParam = searchParams.get("agent");

  const isAdmin = location.pathname.startsWith("/core-control") || location.pathname.startsWith("/admin");
  const { user } = useAuth();
  const token = localStorage.getItem("TrustO_api_token_v1");

  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  // Search filter (Name or Email only)
  const [searchQuery, setSearchQuery] = useState("");

  // Sync selectedAgent with URL search params (?agent=agentId)
  useEffect(() => {
    if (agentParam && agents.length > 0) {
      const found = agents.find(
        (a) => a.id === agentParam || a.agentCode === agentParam || a.username === agentParam
      );
      if (found) {
        setSelectedAgent(found);
      }
    } else if (!agentParam) {
      setSelectedAgent(null);
    }
  }, [agentParam, agents]);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setSearchParams({ agent: agent.id });
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setSearchParams({});
  };

  // Reset page when search or agent selection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAgent]);

  useEffect(() => {
    const fetchDistribution = async () => {
      try {
        const endpoint = isAdmin
          ? `${API_BASE_URL}/admin/distribution`
          : `${API_BASE_URL}/user/distribution`;

        const distRes = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (distRes.ok) {
          const distData = await distRes.json();
          if (distData.referralCode) {
            setReferralCode(distData.referralCode);
          }

          const rawInvitees: Invitee[] = Array.isArray(distData.invitees) ? distData.invitees : [];
          setInvitees(rawInvitees);

          if (Array.isArray(distData.agents) && distData.agents.length > 0) {
            setAgents(distData.agents);
          } else {
            // Fallback demo agents with referrals for Admin view
            const demoAgents: Agent[] = [
              {
                id: "agt-1",
                name: "Agent 1",
                username: "agent1",
                email: "agent1@mailinator.com",
                agentCode: "AGT-TAQEJC",
                joinedAt: new Date(Date.now() - 86400000).toISOString(),
                referralsCount: 5,
                invitees: rawInvitees.slice(0, 5),
              },
              {
                id: "agt-2",
                name: "Agent 2",
                username: "agent2",
                email: "agent2@mailinator.com",
                agentCode: "AGT-R82K9P",
                joinedAt: new Date(Date.now() - 172800000).toISOString(),
                referralsCount: 3,
                invitees: rawInvitees.slice(5),
              },
            ];
            setAgents(demoAgents);
          }
        } else {
          throw new Error("Failed to fetch distribution data");
        }
      } catch (err: any) {
        toast.error(err.message || "Could not load distribution data");
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchDistribution();
    } else {
      setLoading(false);
    }
  }, [token, isAdmin]);

  const copyReferral = (codeToCopy?: string) => {
    const code = codeToCopy || referralCode || selectedAgent?.agentCode;
    if (code) {
      const link = `${window.location.origin}/auth/register?ref=${code}`;
      
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          console.error(error);
        } finally {
          textArea.remove();
        }
      }
      
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Referral code not available.");
    }
  };

  const activeInvitees = useMemo(() => {
    if (selectedAgent) return selectedAgent.invitees;
    return invitees;
  }, [selectedAgent, invitees]);

  // Filtered invitees (Search Name/Email only)
  const filteredAndSortedInvitees = useMemo(() => {
    let result = [...activeInvitees];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeInvitees, searchQuery]);

  // Filtered agents (Search Name/Email only AND referralsCount > 0)
  const filteredAndSortedAgents = useMemo(() => {
    // Rule a: Agents with 0 referrals will NOT appear in distribution panel
    let result = agents.filter((agent) => agent.referralsCount > 0);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.agentCode.toLowerCase().includes(q)
      );
    }
    return result;
  }, [agents, searchQuery]);

  // Enhanced Pie chart data
  const pieChartData = useMemo(() => {
    return filteredAndSortedAgents.map((agent, index) => ({
      name: agent.name,
      value: agent.referralsCount,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }));
  }, [filteredAndSortedAgents]);

  const totalAgentReferrals = useMemo(() => {
    return filteredAndSortedAgents.reduce((sum, a) => sum + a.referralsCount, 0);
  }, [filteredAndSortedAgents]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      (isAdmin && !selectedAgent ? filteredAndSortedAgents.length : filteredAndSortedInvitees.length) /
        ITEMS_PER_PAGE
    )
  );

  const paginatedInvitees = useMemo(() => {
    return filteredAndSortedInvitees.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredAndSortedInvitees, currentPage]);

  const paginatedAgents = useMemo(() => {
    return filteredAndSortedAgents.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredAndSortedAgents, currentPage]);

  // Line chart data for user timeline view
  const getChartData = () => {
    const now = new Date();
    let formatStr = "dd MMM";
    let points = 7;

    if (filter === "weekly") { formatStr = "wo 'Week'"; points = 4; }
    else if (filter === "monthly") { formatStr = "MMM yyyy"; points = 6; }
    else if (filter === "yearly") { formatStr = "yyyy"; points = 3; }

    const dataMap: { [key: string]: number } = {};
    for (let i = points - 1; i >= 0; i--) {
      let dateKey: string;
      if (filter === "daily") dateKey = format(subDays(now, i), formatStr);
      else if (filter === "weekly") dateKey = format(subWeeks(now, i), formatStr);
      else if (filter === "monthly") dateKey = format(subMonths(now, i), formatStr);
      else dateKey = format(subYears(now, i), formatStr);
      dataMap[dateKey] = 0;
    }

    activeInvitees.forEach((invitee) => {
      const inviteeDate = new Date(invitee.joinedAt);
      const key = format(inviteeDate, formatStr);
      if (dataMap[key] !== undefined) {
        dataMap[key]++;
      }
    });

    return Object.keys(dataMap).map((date) => ({ date, count: dataMap[date] }));
  };

  const chartData = getChartData();

  const showAgentsRootView = isAdmin && selectedAgent === null;

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {selectedAgent && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToAgents}
                className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-md transition-all"
                title="Back to Agents"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  <span className="text-primary">{selectedAgent.name}</span>&apos;s Referrals
                </h1>
                <p className="text-muted-foreground text-sm">
                  Viewing invited users for agent <span className="font-semibold text-foreground">{selectedAgent.email}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {(referralCode || selectedAgent?.agentCode) && (
          <div className="flex items-center gap-3">
            <div className="bg-secondary/80 border border-border px-3 py-1.5 rounded-lg text-sm font-mono tracking-wider font-semibold">
              {selectedAgent ? selectedAgent.agentCode : referralCode}
            </div>
            <Button 
              onClick={() => copyReferral()} 
              className="gap-2 text-xs" 
              variant="outline"
              size="sm"
              type="button"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: Table View (60%) */}
        <Card className="lg:col-span-3 border border-border/50 bg-card/90 backdrop-blur-md isolate [transform:translateZ(0)]">
          <CardHeader className="space-y-4 relative z-10 antialiased">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xl">
                  {showAgentsRootView ? "Agents Overview" : "Invited Users"}
                </CardTitle>
                <CardDescription>
                  {showAgentsRootView
                    ? `${filteredAndSortedAgents.length} active agent${filteredAndSortedAgents.length === 1 ? "" : "s"}`
                    : `${filteredAndSortedInvitees.length} user${filteredAndSortedInvitees.length === 1 ? "" : "s"}`}
                </CardDescription>
              </div>
              {!loading && (
                <div>
                  {showAgentsRootView ? (
                    <ExportButton
                      filename="agents"
                      rows={filteredAndSortedAgents}
                      columns={agentExportColumns}
                      disabled={loading || filteredAndSortedAgents.length === 0}
                      label="Export Agents"
                    />
                  ) : (
                    <ExportButton
                      filename="invitees"
                      rows={filteredAndSortedInvitees}
                      columns={inviteeExportColumns}
                      disabled={loading || filteredAndSortedInvitees.length === 0}
                      label="Export Invitees"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Search Bar Only */}
            <div className="relative pt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={showAgentsRootView ? "Search agent by name or email..." : "Search user by name or email..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-background/60 border-border/60"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8 text-muted-foreground">Loading...</div>
            ) : showAgentsRootView ? (
              /* --- AGENTS OVERVIEW TABLE (LAYER 1) --- */
              filteredAndSortedAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
                  <Users className="w-12 h-12 mb-4 opacity-20" />
                  <p>No active agents with referrals found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[45%]">AGENT</TableHead>
                        <TableHead className="w-[35%]">JOINED DATE</TableHead>
                        <TableHead className="w-[20%] text-right">REFERRALS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAgents.map((agent, idx) => (
                        <TableRow 
                          key={agent.id} 
                          className="cursor-pointer hover:bg-secondary/60 transition-colors"
                          onClick={() => handleSelectAgent(agent)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-primary/20">
                                <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                                  {`A${idx + 1}`}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-foreground">{agent.name}</div>
                                <div className="text-xs text-muted-foreground">{agent.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium">{format(new Date(agent.joinedAt), 'dd MMM yyyy')}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(agent.joinedAt), 'hh:mm a')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-lg text-emerald-400">
                            {agent.referralsCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="p-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 mt-2">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedAgents.length)} of {filteredAndSortedAgents.length} agents
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-2 bg-transparent text-xs"
                        >
                          Prev
                        </Button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <Button
                            key={i}
                            variant={currentPage === i + 1 ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(i + 1)}
                            className={`h-8 w-8 p-0 text-xs ${
                              currentPage === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-transparent'
                            }`}
                          >
                            {i + 1}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="h-8 px-2 bg-transparent text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* --- INVITED USERS TABLE (LAYER 2) --- */
              filteredAndSortedInvitees.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
                  <Users className="w-12 h-12 mb-4 opacity-20" />
                  <p>{invitees.length === 0 ? "No invited users yet." : "No matching users found."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>USER</TableHead>
                        <TableHead>JOINED DATE</TableHead>
                        <TableHead className="text-right">TRANSACTIONS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvitees.map((invitee) => (
                        <TableRow 
                          key={invitee.id} 
                          className="cursor-pointer hover:bg-secondary/50 transition-colors"
                          onClick={() => navigate(isAdmin ? `/admin/distribution/${invitee.id}?agent=${selectedAgent?.id || ""}` : `/user/distribution/${invitee.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-primary/10 text-primary uppercase font-bold text-xs">
                                  {invitee.name.substring(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{invitee.name}</div>
                                <div className="text-sm text-muted-foreground">{invitee.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium">{format(new Date(invitee.joinedAt), 'dd MMM yyyy')}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(invitee.joinedAt), 'hh:mm a')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-lg">
                            {invitee.transactions}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 mt-2">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedInvitees.length)} of {filteredAndSortedInvitees.length} users
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-2 bg-transparent text-xs"
                        >
                          Prev
                        </Button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <Button
                            key={i}
                            variant={currentPage === i + 1 ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(i + 1)}
                            className={`h-8 w-8 p-0 text-xs ${
                              currentPage === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-transparent'
                            }`}
                          >
                            {i + 1}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="h-8 px-2 bg-transparent text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Right Side: Pie Chart Card (40%) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/50 bg-card/90 backdrop-blur-md overflow-hidden isolate [transform:translateZ(0)]">
            <CardHeader className="pb-2 border-b border-border/40 relative z-10 antialiased">
              <CardTitle className="text-base font-medium text-muted-foreground">
                {showAgentsRootView ? "Agent Referral Breakdown" : "User Joined Overview"}
              </CardTitle>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold tracking-tight">
                  {showAgentsRootView ? totalAgentReferrals : activeInvitees.length}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {showAgentsRootView ? "Total Agent Referrals" : "Total Users Joined"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="relative h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  {showAgentsRootView ? (
                    /* ELEGANT DONUT PIE CHART */
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={4}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            className="transition-all duration-300 hover:opacity-85"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            const pct = totalAgentReferrals > 0 
                              ? Math.round((Number(data.value) / totalAgentReferrals) * 100) 
                              : 0;
                            return (
                              <div className="glass-card border border-border/80 p-3 rounded-xl shadow-2xl space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                  <span className="font-bold text-sm text-foreground">{data.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                  Referrals: <span className="font-semibold text-foreground">{data.value}</span> ({pct}%)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  ) : (
                    /* LINE CHART FOR INDIVIDUAL AGENT / USER */
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--background))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px" 
                        }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>

                {/* Donut Center Overlay Text */}
                {showAgentsRootView && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-foreground">{filteredAndSortedAgents.length}</span>
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Agents</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!showAgentsRootView && (
            <Card className="border border-border/50 bg-background/50 backdrop-blur">
              <CardContent className="p-4">
                <div className="grid grid-cols-4 gap-2">
                  <Button 
                    variant={filter === "daily" ? "default" : "secondary"} 
                    className="w-full text-xs sm:text-sm h-10"
                    onClick={() => setFilter("daily")}
                  >
                    Daily
                  </Button>
                  <Button 
                    variant={filter === "weekly" ? "default" : "secondary"} 
                    className="w-full text-xs sm:text-sm h-10"
                    onClick={() => setFilter("weekly")}
                  >
                    Weekly
                  </Button>
                  <Button 
                    variant={filter === "monthly" ? "default" : "secondary"} 
                    className="w-full text-xs sm:text-sm h-10"
                    onClick={() => setFilter("monthly")}
                  >
                    Monthly
                  </Button>
                  <Button 
                    variant={filter === "yearly" ? "default" : "secondary"} 
                    className="w-full text-xs sm:text-sm h-10"
                    onClick={() => setFilter("yearly")}
                  >
                    Yearly
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DistributionPortal;
