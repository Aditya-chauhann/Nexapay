import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Key,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  XCircle,
  Ban,
  Globe,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIst } from "@/lib/format-date";

import { API_BASE_URL as API_BASE } from "@/lib/api-base";
const PAGE_LIMIT = 25;

type AlertSeverity = "critical" | "high" | "medium" | "low";
type AlertType =
  | "bank_account_reuse"
  | "bank_account_shared"
  | "upi_account_reuse"
  | "upi_account_shared";
type ResolvedFilter = "unresolved" | "resolved" | "all";
type ResolutionAction = "cleared" | "confirmed";

interface AdminAlert {
  id: string;
  type: AlertType | string;
  severity: AlertSeverity | string;
  title: string;
  message: string;
  primaryUserId: string | null;
  secondaryUserId: string | null;
  metadata: Record<string, unknown> | null;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string;
  resolution: ResolutionAction | null;
  createdAt: string;
  updatedAt: string;
}

interface AlertsResponse {
  items: AdminAlert[];
  total: number;
  unresolvedCount: number;
  page: number;
  limit: number;
}

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function extractMessage(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const m = (json as { message?: unknown }).message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
    if (typeof m === "string") return m;
  }
  return `Request failed (HTTP ${status})`;
}

function relativeTime(iso: string) {
  if (!iso) return "—";
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

const SEVERITY_BADGE: Record<string, string> = {
  critical: "badge-destructive",
  high: "badge-warning",
  medium: "badge-pending",
  low: "badge-success",
};

const SEVERITY_RING: Record<string, string> = {
  critical: "bg-destructive/20",
  high: "bg-warning/20",
  medium: "bg-primary/20",
  low: "bg-success/20",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <XCircle className="h-5 w-5 text-destructive" />;
  if (severity === "high") return <AlertTriangle className="h-5 w-5 text-warning" />;
  if (severity === "medium") return <Bell className="h-5 w-5 text-primary" />;
  return <Bell className="h-5 w-5 text-success" />;
}

const AdminAlerts = () => {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Block IP Modal states
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockIpTarget, setBlockIpTarget] = useState("");
  const [blockReason, setBlockReason] = useState("5 failed login attempts");
  const [blockIsFreeze, setBlockIsFreeze] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const handleBlockIp = async () => {
    if (!blockIpTarget) return;
    setBlocking(true);
    try {
      const token = localStorage.getItem("TrustO_api_token_v1");
      const durationHours = blockIsFreeze ? 1 : 99 * 365 * 24;
      const res = await fetch(`${API_BASE}/admin/ip-activities/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ip: blockIpTarget, reason: blockReason.trim(), durationHours }),
      });
      if (res.ok) {
        toast.success(`IP ${blockIpTarget} has been ${blockIsFreeze ? "frozen (1 hr)" : "permanently blocked"}`);
        setBlockModalOpen(false);
      } else {
        toast.error("Failed to block IP");
      }
    } catch {
      toast.error("Network error while blocking IP");
    } finally {
      setBlocking(false);
    }
  };
  const [total, setTotal] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [page, setPage] = useState(1);

  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>("unresolved");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertSeverity>("all");

  const [resolveTarget, setResolveTarget] = useState<AdminAlert | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveAction, setResolveAction] = useState<ResolutionAction | null>(null);
  const [resolving, setResolving] = useState(false);

  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let res = "";
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(res);
    setShowTempPassword(true);
  };

  const load = useCallback(
    async (signal?: AbortSignal, pageArg = page) => {
      const headers = authHeaders();
      if (!headers) {
        setLoading(false);
        toast.error("Not authenticated");
        return;
      }
      setLoading(true);
      try {
        const url = new URL(`${API_BASE}/admin/alerts`);
        url.searchParams.set("page", String(pageArg));
        url.searchParams.set("limit", String(PAGE_LIMIT));
        if (resolvedFilter === "unresolved") url.searchParams.set("resolved", "false");
        if (resolvedFilter === "resolved") url.searchParams.set("resolved", "true");
        if (severityFilter !== "all") url.searchParams.set("severity", severityFilter);

        const res = await fetch(url.toString(), { headers, signal });
        const body = (await res.json().catch(() => null)) as AlertsResponse | null;
        if (!res.ok) {
          toast.error(extractMessage(body, res.status));
          return;
        }
        setAlerts(Array.isArray(body?.items) ? body!.items : []);
        setTotal(body?.total ?? 0);
        setUnresolvedCount(body?.unresolvedCount ?? 0);
        setPage(body?.page ?? pageArg);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    },
    [resolvedFilter, severityFilter, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal, 1);
    return () => controller.abort();
    // load is intentionally not in deps — we want to refetch only when filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedFilter, severityFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total]);

  const openResolve = (alert: AdminAlert) => {
    setResolveTarget(alert);
    setResolveNotes("");
    setResolveAction(null);
    setTempPassword("");
    setShowTempPassword(false);
  };

  const closeResolve = () => {
    setResolveTarget(null);
    setResolveNotes("");
    setResolveAction(null);
    setTempPassword("");
    setShowTempPassword(false);
  };

  const submitGrantTempPassword = async () => {
    if (!resolveTarget) return;
    if (!tempPassword || tempPassword.length < 6) {
      toast.error("Temporary password must be at least 6 characters");
      return;
    }
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/alerts/${encodeURIComponent(resolveTarget.id)}/grant-temp-password`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            temporaryPassword: tempPassword,
            notes: resolveNotes.trim() || undefined,
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractMessage(body, res.status));
        return;
      }
      toast.success("Temporary password granted & notification email sent to agent!");
      closeResolve();
      void load(undefined, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setResolving(false);
    }
  };

  const submitResolve = async () => {
    if (!resolveTarget || !resolveAction) return;
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setResolving(true);
    try {
      const payload: Record<string, string> = { action: resolveAction };
      const notes = resolveNotes.trim();
      if (notes) payload.notes = notes;
      const res = await fetch(
        `${API_BASE}/admin/alerts/${encodeURIComponent(resolveTarget.id)}/resolve`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractMessage(body, res.status));
        return;
      }
      toast.success(
        resolveAction === "cleared"
          ? "Alert cleared — user unfrozen and bank account restored"
          : "Alert marked confirmed — user remains frozen",
      );
      closeResolve();
      void load(undefined, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Alerts</h1>
          <p className="mt-1 text-muted-foreground">
            {loading
              ? "Loading…"
              : `${unresolvedCount.toLocaleString()} unresolved · ${total.toLocaleString()} matching filters`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            { label: "All", value: "all" },
            { label: "Unresolved", value: "unresolved" },
            { label: "Resolved", value: "resolved" },
          ] as const
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setResolvedFilter(f.value)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
              resolvedFilter === f.value
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            <p>{f.label}</p>
            {f.value === "unresolved" && unresolvedCount > 0 && (
              <span className="mt-1 inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                {unresolvedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="table-scroll flex flex-wrap items-center gap-1.5">
        <Filter className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
        {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
          <button
            key={sev}
            type="button"
            onClick={() => setSeverityFilter(sev)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:py-1.5 ${
              severityFilter === sev
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-10 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : alerts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-10 text-center text-sm text-muted-foreground">
            No alerts match the current filters.
          </p>
        ) : (
          alerts.map((alert, i) => {
            const meta = alert.metadata ?? {};
            const accountNumber = (meta as { accountNumber?: string }).accountNumber ?? "";
            const ifscCode = (meta as { ifscCode?: string }).ifscCode ?? "";
            const originalDeleted = Boolean(
              (meta as { originalAccountWasDeleted?: boolean }).originalAccountWasDeleted,
            );
            const originalDeletedAt = (meta as { originalAccountDeletedAt?: string })
              .originalAccountDeletedAt;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`glass-card flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-start sm:gap-4 ${
                  alert.isResolved ? "opacity-70" : "border-l-2 border-l-primary"
                }`}
              >
                <div className="flex min-w-0 flex-1 gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      SEVERITY_RING[alert.severity] ?? "bg-primary/20"
                    }`}
                  >
                    <SeverityIcon severity={alert.severity} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] capitalize ${
                          SEVERITY_BADGE[alert.severity] ?? "badge-pending"
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {alert.type}
                      </span>
                      {alert.isResolved &&
                        (alert.resolution === "cleared" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            <ShieldCheck className="h-3 w-3" /> Cleared
                          </span>
                        ) : alert.resolution === "confirmed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            <ShieldAlert className="h-3 w-3" /> Confirmed fraud
                          </span>
                        ) : (
                          <span className="badge-success rounded-full px-1.5 py-0.5 text-[10px]">
                            Resolved
                          </span>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>

                    {(alert.primaryUserId || alert.secondaryUserId) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        {alert.primaryUserId && (
                          <Link
                            to={`/admin/users/${encodeURIComponent(alert.primaryUserId)}`}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-foreground hover:bg-secondary/70"
                          >
                            <UserIcon className="h-3 w-3" /> Primary ·{" "}
                            {alert.primaryUserId.slice(-6).toUpperCase()}
                          </Link>
                        )}
                        {alert.secondaryUserId && (
                          <Link
                            to={`/admin/users/${encodeURIComponent(alert.secondaryUserId)}`}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-foreground hover:bg-secondary/70"
                          >
                            <UserIcon className="h-3 w-3" /> Secondary ·{" "}
                            {alert.secondaryUserId.slice(-6).toUpperCase()}
                          </Link>
                        )}
                      </div>
                    )}

                    {(accountNumber || ifscCode) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-muted-foreground">
                        {accountNumber && <span>A/C · {accountNumber}</span>}
                        {ifscCode && <span>IFSC · {ifscCode}</span>}
                        {originalDeleted && (
                          <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px]">
                            Original was deleted
                            {originalDeletedAt ? ` on ${formatIst(originalDeletedAt)}` : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {(meta as any)?.ip && (
                      <div className="flex flex-wrap items-center gap-2 pt-1.5 text-[11px]">
                        <span className="font-mono text-xs bg-secondary border border-border px-2 py-0.5 rounded text-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3 text-primary" /> IP: {(meta as any).ip}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBlockIpTarget((meta as any).ip);
                            setBlockIsFreeze(true);
                            setBlockReason("5 failed login attempts");
                            setBlockModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-xs font-medium transition-colors"
                        >
                          <Lock className="h-3 w-3" /> Freeze 1h
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBlockIpTarget((meta as any).ip);
                            setBlockIsFreeze(false);
                            setBlockReason("5 failed login attempts");
                            setBlockModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 px-2 py-0.5 text-xs font-semibold transition-colors"
                        >
                          <Ban className="h-3 w-3" /> Block IP
                        </button>
                      </div>
                    )}

                    {alert.isResolved && alert.resolutionNotes && (
                      <p className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">Resolution: </span>
                        {alert.resolutionNotes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 text-xs text-muted-foreground sm:items-end">
                  <div className="flex items-center gap-1" title={alert.createdAt}>
                    <Clock className="h-3 w-3" />
                    {relativeTime(alert.createdAt)}
                  </div>
                  {!alert.isResolved ? (
                    <button
                      type="button"
                      onClick={() => openResolve(alert)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] hover:bg-secondary/70"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Resolve
                    </button>
                  ) : (
                    alert.resolvedAt && (
                      <span className="text-[11px]" title={alert.resolvedAt}>
                        Resolved {relativeTime(alert.resolvedAt)}
                      </span>
                    )
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {total.toLocaleString()} alert(s)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load(undefined, page - 1)}
              disabled={loading || page <= 1}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 hover:bg-secondary/70 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => void load(undefined, page + 1)}
              disabled={loading || page >= totalPages}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 hover:bg-secondary/70 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={resolveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !resolving) closeResolve();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {resolveTarget && resolveTarget.type === "staff_password_reset_request" ? (
            <>
              <DialogHeader>
                <DialogTitle>Agent Password Reset</DialogTitle>
                <DialogDescription>
                  Grant a temporary password for{" "}
                  <span className="font-semibold text-foreground">
                    {(resolveTarget.metadata?.fullName as string) || resolveTarget.title}
                  </span>
                  . They will be required to change the password on first sign-in.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Full name</label>
                  <input
                    value={(resolveTarget.metadata?.fullName as string) || "—"}
                    disabled
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Username</label>
                  <input
                    value={(resolveTarget.metadata?.username as string) || "—"}
                    disabled
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    value={(resolveTarget.metadata?.email as string) || "—"}
                    disabled
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Temporary password</label>
                    <button
                      type="button"
                      onClick={generateTempPassword}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Auto-generate
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      type={showTempPassword ? "text" : "password"}
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTempPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    An email will automatically be sent to the agent with this temporary password.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  type="button"
                  onClick={closeResolve}
                  disabled={resolving}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitGrantTempPassword}
                  disabled={resolving || !tempPassword}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {resolving ? "Granting Password..." : "Grant Temporary Password"}
                </button>
              </DialogFooter>
            </>
          ) : resolveTarget ? (
            <>
              <DialogHeader>
                <DialogTitle>Resolve alert</DialogTitle>
                <DialogDescription>
                  Pick the outcome for "
                  <span className="font-semibold">{resolveTarget.title}</span>". This is a one-way
                  action.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Decision <span className="text-destructive">*</span>
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setResolveAction("cleared")}
                      disabled={resolving}
                      className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        resolveAction === "cleared"
                          ? "border-success/60 bg-success/10"
                          : "border-border bg-secondary/40 hover:bg-secondary/60"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <ShieldCheck
                          className={`h-4 w-4 ${
                            resolveAction === "cleared" ? "text-success" : "text-muted-foreground"
                          }`}
                        />
                        Clear (false alarm)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Unfreezes the user and restores the bank account they tried to add.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolveAction("confirmed")}
                      disabled={resolving}
                      className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        resolveAction === "confirmed"
                          ? "border-destructive/60 bg-destructive/10"
                          : "border-border bg-secondary/40 hover:bg-secondary/60"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <ShieldAlert
                          className={`h-4 w-4 ${
                            resolveAction === "confirmed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        />
                        Confirm fraud
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        User stays frozen. Bank account is not created. Escalate to a full block
                        separately if needed.
                      </span>
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="resolution-notes"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Notes <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="resolution-notes"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder={
                      resolveAction === "cleared"
                        ? "e.g. Confirmed family member sharing account."
                        : resolveAction === "confirmed"
                        ? "e.g. Account number matches a chargeback case from last month."
                        : "Add context for the audit trail."
                    }
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {resolveNotes.trim().length}/500 characters
                  </p>
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={closeResolve}
                  disabled={resolving}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitResolve}
                  disabled={resolving || !resolveAction}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                    resolveAction === "confirmed" ? "bg-destructive" : "bg-success"
                  }`}
                >
                  {resolving
                    ? "Resolving…"
                    : resolveAction === "cleared"
                    ? "Clear alert"
                    : resolveAction === "confirmed"
                    ? "Confirm fraud"
                    : "Pick a decision"}
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Block IP Dialog Modal */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="sm:max-w-md border-border bg-background shadow-2xl">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 ring-8 ring-rose-500/5 mb-2">
              <Ban className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              {blockIsFreeze ? "Freeze IP Address" : "Block IP Address"}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              {blockIsFreeze
                ? `Temporarily freeze IP ${blockIpTarget} for 1 hour.`
                : `Permanently restrict all requests and sign-in attempts from IP ${blockIpTarget}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Target IP</Label>
              <Input
                value={blockIpTarget}
                readOnly
                className="bg-secondary/40 font-mono text-xs border-border/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Reason / Justification</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. 5 failed login attempts"
                className="bg-secondary/40 text-xs border-border/80"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={blocking}
              onClick={handleBlockIp}
              className={blockIsFreeze ? "bg-amber-600 hover:bg-amber-700 text-white text-xs" : "bg-rose-600 hover:bg-rose-700 text-white text-xs"}
            >
              {blocking ? "Processing…" : blockIsFreeze ? "Confirm Freeze (1h)" : "Confirm Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAlerts;
