import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  WalletCards,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Ban,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Headphones,
  History,
  KeyRound,
  Landmark,
  Lock,
  Mail,
  Percent,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Star,
  Sun,
  Tag,
  Unlock,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ExportButton from "@/components/shared/ExportButton";
import { PricingHistoryDialog } from "@/components/shared/PricingHistoryDialog";
import type { CsvColumn } from "@/lib/export-csv";
import { tagBadgeStyle, tagEmoji } from "@/lib/tag-colors";
import { formatIst } from "@/lib/format-date";
import { copyText } from "@/lib/copy";
import { tronscanAddressUrl } from "@/lib/tronscan";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/shared/TablePagination";
import { TronLink } from "@/components/shared/TronLink";
import {
  PRICING_FIELD_LABEL,
  deleteUserPricing,
  feeDecimalToPercentInput,
  feePercentInputToDecimal,
  formatPricingValue,
  getUserPricing,
  putUserPricing,
  type UserPricingResponse,
} from "@/lib/api-pricing";

import { API_BASE_URL as API_BASE } from "@/lib/api-base";
const PAGE_LIMIT = 200;

interface PublicAgent {
  id: string;
  fullName: string;
  role: string;
}

interface AgentAssignment {
  id: string;
  fullName: string;
  email?: string | null;
  assignedAt?: string | null;
  source?: "signup" | "admin" | null;
}

function normalizeAssignedAgent(raw: unknown): AgentAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const fullName = (r.fullName as string | undefined)?.trim();
  if (!id || !fullName) return null;
  return {
    id,
    fullName,
    email: (r.email as string | null | undefined) ?? null,
  };
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: "user" | "operator" | "admin" | "super_admin";
  walletAddress: string;
  phone?: string | null;
  phoneUpdatedAt?: string | null;
  phoneUpdatedBy?: string | null;
  phoneUpdatedByName?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  twoFactorVerified?: boolean;
  twoFactorMethod?: "phone" | "email" | null;
  totpEnabled?: boolean;
  totpEnabledAt?: string | null;
  isBlocked: boolean;
  blockedReason?: string | null;
  blockedAt?: string | null;
  loginLockedUntil?: string | null;
  isFrozen: boolean;
  frozenReason?: string | null;
  frozenAt?: string | null;
  createdAt: string;
  customUsdtCap?: number | null;
  customInrRate?: number | null;
  assignedAgent?: AgentAssignment | null;
  assignedAgentAt?: string | null;
  assignedAgentSource?: "signup" | "admin" | null;
  invitedByDetails?: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
  isSubscribed?: boolean;
  subscriptionStatus?: string;
  subscriptionError?: string | null;
}

interface AdminDeposit {
  id: string;
  transactionId: string;
  userId: string | null;
  walletAddress: string;
  amount: number;
  currency: string;
  timestamp: string;
  createdAt: string;
}

interface AdminWithdrawal {
  id: string;
  userId: string;
  method: "bank" | "crypto";
  amount: number;
  netInr?: number | null;
  status: "pending" | "processing" | "paid" | "failed";
  txHash?: string | null;
  destinationAddress?: string | null;
  accountNumber?: string | null;
  createdAt: string;
}

interface UserTagSummary {
  id: string;
  name: string;
  rank: number;
  color?: string | null;
}

interface AvailableTag {
  id: string;
  name: string;
  rank: number;
  color: string | null;
  thresholdAmount: number;
  thresholdPeriod: "day" | "week" | "month";
  isActive: boolean;
}

interface TagAssignment {
  userId: string;
  tag: UserTagSummary | null;
  assignedAt: string | null;
  assignedBy: string | null;
  source: "auto" | "manual" | null;
}

interface TagHistoryEntry {
  id: string;
  userId: string;
  fromTagId: string | null;
  toTagId: string | null;
  source: "auto" | "manual";
  actorId: string | null;
  reason: string | null;
  createdAt: string;
}

type BankApprovalStatus = "approved" | "pending" | "rejected";

interface AdminBankAccount {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string | null;
  isDefault: boolean;
  createdAt?: string;
  approvalStatus: BankApprovalStatus;
  approvalRequiredFrom: string | null;
}

interface AdminUpiAccount {
  id: string;
  accountHolderName: string;
  upiId: string;
  isDefault: boolean;
  createdAt?: string;
  approvalStatus: BankApprovalStatus;
  approvalRequiredFrom: string | null;
}

interface UnifiedTxn {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  currency: string;
  status: string;
  inrAmount: number | null;
  reference: string;
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  remark?: string;
}

type StatusFilter = "all" | "completed" | "pending" | "failed";
type TimeFilter = "all" | "24h" | "7d" | "30d";

type TxnSortKey = "date" | "amount" | "inr";
type SortDir = "asc" | "desc";

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function normalizeUser(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object") return null;
  let r = raw as Record<string, unknown>;
  // Unwrap common envelope shapes: { data: {...} } or { user: {...} }
  for (const key of ["data", "user", "result"]) {
    if (r[key] && typeof r[key] === "object" && !Array.isArray(r[key])) {
      const inner = r[key] as Record<string, unknown>;
      if ("profile" in inner || "id" in inner || "_id" in inner) {
        r = inner;
        break;
      }
    }
  }
  const profile = (r.profile as Record<string, unknown> | undefined) ?? undefined;
  const pick = <T,>(key: string): T | undefined =>
    (r[key] as T | undefined) ?? (profile?.[key] as T | undefined);
  const id = (pick<string>("id")) ?? (pick<string>("_id")) ?? "";
  if (!id) return null;
  return {
    id,
    name: pick<string | null>("name") ?? null,
    email: pick<string | null>("email") ?? null,
    role: (pick<AdminUser["role"]>("role") as AdminUser["role"]) ?? "user",
    walletAddress: (r.walletAddress as string | undefined) ?? "",
    phone: pick<string | null>("phone") ?? null,
    phoneUpdatedAt: pick<string | null>("phoneUpdatedAt") ?? null,
    phoneUpdatedBy: pick<string | null>("phoneUpdatedBy") ?? null,
    phoneUpdatedByName: pick<string | null>("phoneUpdatedByName") ?? null,
    emailVerified: pick<boolean>("emailVerified"),
    phoneVerified: pick<boolean>("phoneVerified"),
    twoFactorVerified: (r.twoFactorVerified as boolean | undefined) ?? pick<boolean>("twoFactorVerified"),
    twoFactorMethod:
      ((r.twoFactorMethod as AdminUser["twoFactorMethod"] | undefined) ??
        (pick<AdminUser["twoFactorMethod"]>("twoFactorMethod"))) ?? null,
    totpEnabled: (r.totpEnabled as boolean | undefined) ?? pick<boolean>("totpEnabled") ?? false,
    totpEnabledAt: pick<string | null>("totpEnabledAt") ?? null,
    isBlocked: ((r.isBlocked as boolean | undefined) ?? pick<boolean>("isBlocked")) ?? false,
    blockedReason: pick<string | null>("blockedReason") ?? null,
    blockedAt: pick<string | null>("blockedAt") ?? null,
    isFrozen: ((r.isFrozen as boolean | undefined) ?? pick<boolean>("isFrozen")) ?? false,
    frozenReason: pick<string | null>("frozenReason") ?? null,
    frozenAt: pick<string | null>("frozenAt") ?? null,
    createdAt: pick<string>("createdAt") ?? "",
    customUsdtCap: pick<number | null>("customUsdtCap") ?? null,
    customInrRate: pick<number | null>("customInrRate") ?? null,
    assignedAgent: normalizeAssignedAgent(pick<unknown>("assignedAgent")),
    assignedAgentAt: pick<string | null>("assignedAgentAt") ?? null,
    assignedAgentSource:
      (pick<"signup" | "admin" | null>("assignedAgentSource") as
        | "signup"
        | "admin"
        | null
        | undefined) ?? null,
    invitedByDetails: pick<{id: string; name: string; referralCode: string; } | null>("invitedByDetails") ?? null,
    isSubscribed: pick<boolean>("isSubscribed") ?? false,
    subscriptionStatus: pick<string>("subscriptionStatus") ?? "not_found",
    subscriptionError: pick<string | null>("subscriptionError") ?? null,
  };
}

function normalizeAvailableTag(raw: unknown): AvailableTag | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const name = (r.name as string | undefined)?.trim();
  if (!id || !name) return null;
  const period = (r.thresholdPeriod as string | undefined) ?? "month";
  return {
    id,
    name,
    rank: Number.isFinite(Number(r.rank)) ? Number(r.rank) : 1,
    color: (r.color as string | null | undefined) ?? null,
    thresholdAmount: Number.isFinite(Number(r.thresholdAmount)) ? Number(r.thresholdAmount) : 0,
    thresholdPeriod: (["day", "week", "month"] as const).includes(period as AvailableTag["thresholdPeriod"])
      ? (period as AvailableTag["thresholdPeriod"])
      : "month",
    isActive: r.isActive === undefined ? true : Boolean(r.isActive),
  };
}

function normalizeAssignment(raw: unknown): TagAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const userId = (r.userId as string | undefined) ?? "";
  if (!userId) return null;
  const tagRaw = r.tag as Record<string, unknown> | null | undefined;
  let tag: UserTagSummary | null = null;
  if (tagRaw && typeof tagRaw === "object") {
    const tid = (tagRaw.id as string | undefined) ?? (tagRaw._id as string | undefined);
    const tname = (tagRaw.name as string | undefined)?.trim();
    if (tid && tname) {
      tag = {
        id: tid,
        name: tname,
        rank: Number.isFinite(Number(tagRaw.rank)) ? Number(tagRaw.rank) : 1,
        color: (tagRaw.color as string | null | undefined) ?? null,
      };
    }
  }
  const source = r.source as string | null | undefined;
  return {
    userId,
    tag,
    assignedAt: (r.assignedAt as string | null | undefined) ?? null,
    assignedBy: (r.assignedBy as string | null | undefined) ?? null,
    source: source === "auto" || source === "manual" ? source : null,
  };
}

function normalizeHistory(raw: unknown): TagHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const userId = (r.userId as string | undefined) ?? "";
  const createdAt = (r.createdAt as string | undefined) ?? "";
  const source = r.source === "auto" ? "auto" : "manual";
  if (!id || !userId || !createdAt) return null;
  return {
    id,
    userId,
    fromTagId: (r.fromTagId as string | null | undefined) ?? null,
    toTagId: (r.toTagId as string | null | undefined) ?? null,
    source,
    actorId: (r.actorId as string | null | undefined) ?? null,
    reason: (r.reason as string | null | undefined) ?? null,
    createdAt,
  };
}

function normalizeBankAccount(raw: unknown): AdminBankAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const accountNumber = r.accountNumber as string | undefined;
  const ifscCode = r.ifscCode as string | undefined;
  if (!id || !accountNumber || !ifscCode) return null;
  const rawStatus = (r.approvalStatus as string | undefined)?.toLowerCase();
  const approvalStatus: BankApprovalStatus =
    rawStatus === "pending" || rawStatus === "rejected" ? rawStatus : "approved";
  return {
    id,
    accountHolderName: (r.accountHolderName as string) ?? "",
    accountNumber,
    ifscCode,
    bankName: (r.bankName as string | null | undefined) ?? null,
    isDefault: Boolean(r.isDefault),
    createdAt: (r.createdAt as string | undefined) ?? undefined,
    approvalStatus,
    approvalRequiredFrom: (r.approvalRequiredFrom as string | null | undefined) ?? null,
  };
}

function normalizeUpiAccount(raw: unknown): AdminUpiAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const upiId = (r.upiId as string | undefined) ?? (r.vpa as string | undefined);
  if (!id || !upiId) return null;
  const rawStatus = (r.approvalStatus as string | undefined)?.toLowerCase();
  const approvalStatus: BankApprovalStatus =
    rawStatus === "pending" || rawStatus === "rejected" ? rawStatus : "approved";
  return {
    id,
    accountHolderName: (r.accountHolderName as string) ?? "",
    upiId,
    isDefault: Boolean(r.isDefault),
    createdAt: (r.createdAt as string | undefined) ?? undefined,
    approvalStatus,
    approvalRequiredFrom: (r.approvalRequiredFrom as string | null | undefined) ?? null,
  };
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso ?? "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function formatIST(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " IST";
}

function statusGroup(status: string): "completed" | "pending" | "failed" {
  const s = status.toLowerCase();
  if (["completed", "confirmed", "credited", "success", "paid"].includes(s)) return "completed";
  if (["processing", "pending"].includes(s)) return "pending";
  return "failed";
}

function statusBadge(status: string) {
  const g = statusGroup(status);
  if (g === "completed") return "badge-success";
  if (g === "pending") return "badge-pending";
  return "badge-destructive";
}

const AdminUserDetail = () => {
  const { userId = "" } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [bankAccounts, setBankAccounts] = useState<AdminBankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true);
  const [upiAccounts, setUpiAccounts] = useState<AdminUpiAccount[]>([]);
  const [upiAccountsLoading, setUpiAccountsLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Settings
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [assignment, setAssignment] = useState<TagAssignment | null>(null);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagToApply, setTagToApply] = useState<string>("");
  const [applyReason, setApplyReason] = useState("");
  const [applyingTag, setApplyingTag] = useState(false);
  const [removingTag, setRemovingTag] = useState(false);
  const [removeReasonOpen, setRemoveReasonOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TagHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [userPricing, setUserPricing] = useState<UserPricingResponse | null>(null);
  const [pricingForm, setPricingForm] = useState<{
    usdtPrice: string;
    inrPrice: string;
    feePercent: string;
  }>({ usdtPrice: "", inrPrice: "", feePercent: "" });
  const [pricingLoading, setPricingLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);
  const [clearingPricing, setClearingPricing] = useState(false);
  const [confirmClearPricing, setConfirmClearPricing] = useState(false);
  const [pricingHistoryOpen, setPricingHistoryOpen] = useState(false);
  const [adjustBalanceOpen, setAdjustBalanceOpen] = useState(false);
  const [adjustBalanceForm, setAdjustBalanceForm] = useState<{ type: "credit" | "debit"; amount: string; remark: string }>({ type: "credit", amount: "", remark: "" });
  const [adjustingBalance, setAdjustingBalance] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);
  const [confirmFlag, setConfirmFlag] = useState<{ action: "block" | "freeze"; reason: string } | null>(
    null,
  );

  // Agent assignment — sourced from GET /agents (public) and persisted via
  // PATCH /admin/users/:id/assigned-agent. Hydrated from the user response.
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentAssignment, setAgentAssignment] = useState<AgentAssignment | null>(null);
  const [agentToAssign, setAgentToAssign] = useState<string>("");
  const [savingAgent, setSavingAgent] = useState(false);

  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin);

  // Temporary password management
  const [tempPasswordModalOpen, setTempPasswordModalOpen] = useState(false);
  const [tempPasswordMode, setTempPasswordMode] = useState<"auto" | "custom">("auto");
  const [customTempPassword, setCustomTempPassword] = useState("");
  const generateRandomTempPassword = () => `Temp#${Math.floor(100000 + Math.random() * 900000)}`;
  const [autoGeneratedTempPassword, setAutoGeneratedTempPassword] = useState(generateRandomTempPassword);
  const [sendingTempPassword, setSendingTempPassword] = useState(false);
  const [sentTempPasswordResult, setSentTempPasswordResult] = useState<{ password: string; email: string } | null>(null);

  const handleSetTemporaryPassword = async () => {
    if (!userId) return;
    const passwordToSend = tempPasswordMode === "custom" ? customTempPassword.trim() : autoGeneratedTempPassword.trim();
    if (!passwordToSend || passwordToSend.length < 6) {
      toast.error("Temporary password must be at least 6 characters long");
      return;
    }

    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }

    setSendingTempPassword(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ temporaryPassword: passwordToSend }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || `Request failed (HTTP ${res.status})`);
      }

      toast.success(data?.message || "Temporary password set and sent to user's email");
      setSentTempPasswordResult({
        password: data?.temporaryPassword || passwordToSend,
        email: data?.email || user?.email || "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set temporary password");
    } finally {
      setSendingTempPassword(false);
    }
  };

  // Phone editing (Super Admin)
  const [editPhoneOpen, setEditPhoneOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  // Referral assignment
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [savingReferral, setSavingReferral] = useState(false);

  // Wallet subscription management
  const [submittingSubscription, setSubmittingSubscription] = useState(false);
  const handleSubscribeWallet = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setSubmittingSubscription(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/subscribe-wallet`, {
        method: "POST",
        headers,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.message ?? "Failed to subscribe wallet");
        return;
      }
      toast.success(body?.message ?? "Wallet subscription updated");
      const updatedUser = await loadUser();
      if (updatedUser) {
        setUser(updatedUser);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmittingSubscription(false);
    }
  };

  // Analytics filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "deposit" | "withdrawal">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [txnPageSize, setTxnPageSize] = useState(10);
  const [txnSortKey, setTxnSortKey] = useState<TxnSortKey>("date");
  const [txnSortDir, setTxnSortDir] = useState<SortDir>("desc");

  const loadUser = useCallback(
    async (signal?: AbortSignal) => {
      const headers = authHeaders();
      if (!headers) {
        toast.error("Not authenticated");
        return;
      }
      // Try the singular endpoint first; fall back to listing all and finding.
      try {
        const direct = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}`, {
          headers,
          signal,
        });
        if (direct.ok) {
          const body = await direct.json().catch(() => null);
          const normalized = normalizeUser(body);
          if (normalized) return normalized;
          console.warn("[AdminUserDetail] singular endpoint returned unrecognised shape", body);
        } else if (direct.status !== 404) {
          const body = await direct.json().catch(() => null);
          console.warn(
            `[AdminUserDetail] GET /admin/users/${userId} -> ${direct.status}`,
            body,
          );
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return null;
      }
      try {
        const res = await fetch(`${API_BASE}/admin/users?page=1&limit=${PAGE_LIMIT}`, {
          headers,
          signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(body?.message ?? "Could not load user");
          return null;
        }
        const items: unknown[] = Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body)
          ? body
          : [];
        for (const item of items) {
          const normalized = normalizeUser(item);
          if (normalized && normalized.id === userId) return normalized;
        }
        return null;
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return null;
        toast.error(err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true);
    setBankAccountsLoading(true);
    setUpiAccountsLoading(true);
    setTagsLoading(true);
    setAgentsLoading(true);
    void (async () => {
      const headers = authHeaders();
      if (!headers) {
        setLoading(false);
        setBankAccountsLoading(false);
        setUpiAccountsLoading(false);
        setTagsLoading(false);
        setAgentsLoading(false);
        return;
      }
      try {
        const [u, depRes, wdrRes, bankRes, upiRes, tagsRes, assignmentRes, staffRes] = await Promise.all([
          loadUser(controller.signal),
          fetch(`${API_BASE}/admin/deposits?userId=${encodeURIComponent(userId)}&limit=${PAGE_LIMIT}`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${API_BASE}/admin/withdrawals?userId=${encodeURIComponent(userId)}&limit=${PAGE_LIMIT}`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/bank-accounts`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/upi-accounts`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${API_BASE}/admin/user-tags`, { headers, signal: controller.signal }),
          fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/tag`, {
            headers,
            signal: controller.signal,
          }),
          // GET /agents is public; bypassing auth headers avoids edge-case
          // 401s if the admin's token is briefly invalid mid-session.
          fetch(`${API_BASE}/agents`, { signal: controller.signal }),
        ]);
        if (u) {
          setUser(u);
          if (u.assignedAgent) {
            setAgentAssignment({
              ...u.assignedAgent,
              assignedAt: u.assignedAgentAt ?? null,
              source: u.assignedAgentSource ?? null,
            });
          } else {
            setAgentAssignment(null);
          }
        }
        const depBody = await depRes.json().catch(() => null);
        const wdrBody = await wdrRes.json().catch(() => null);
        const bankBody = await bankRes.json().catch(() => null);
        const upiBody = await upiRes.json().catch(() => null);
        const tagsBody = await tagsRes.json().catch(() => null);
        const assignmentBody = await assignmentRes.json().catch(() => null);
        const depItems: AdminDeposit[] = Array.isArray(depBody?.items)
          ? depBody.items
          : Array.isArray(depBody)
          ? depBody
          : [];
        const wdrItems: AdminWithdrawal[] = Array.isArray(wdrBody?.items)
          ? wdrBody.items
          : Array.isArray(wdrBody)
          ? wdrBody
          : [];
        setDeposits(depItems.filter((d) => d.userId === userId));
        setWithdrawals(wdrItems.filter((w) => w.userId === userId));
        if (bankRes.ok) {
          const rawList: unknown[] = Array.isArray(bankBody?.items)
            ? bankBody.items
            : Array.isArray(bankBody)
            ? bankBody
            : [];
          const accounts: AdminBankAccount[] = rawList
            .map((raw) => normalizeBankAccount(raw))
            .filter((a): a is AdminBankAccount => a !== null);
          setBankAccounts(accounts);
        } else {
          console.warn(
            `[AdminUserDetail] GET /admin/users/${userId}/bank-accounts -> ${bankRes.status}`,
            bankBody,
          );
          setBankAccounts([]);
        }
        if (upiRes.ok) {
          const rawList: unknown[] = Array.isArray(upiBody?.items)
            ? upiBody.items
            : Array.isArray(upiBody)
            ? upiBody
            : [];
          const accounts: AdminUpiAccount[] = rawList
            .map((raw) => normalizeUpiAccount(raw))
            .filter((a): a is AdminUpiAccount => a !== null);
          setUpiAccounts(accounts);
        } else {
          console.warn(
            `[AdminUserDetail] GET /admin/users/${userId}/upi-accounts -> ${upiRes.status}`,
            upiBody,
          );
          setUpiAccounts([]);
        }
        if (tagsRes.ok) {
          const rawList: unknown[] = Array.isArray(tagsBody?.items)
            ? tagsBody.items
            : Array.isArray(tagsBody)
            ? tagsBody
            : [];
          const list = rawList
            .map(normalizeAvailableTag)
            .filter((t): t is AvailableTag => t !== null)
            .sort((a, b) => a.rank - b.rank);
          setAvailableTags(list);
        }
        if (assignmentRes.ok) {
          setAssignment(normalizeAssignment(assignmentBody));
        }
        if (staffRes.ok) {
          const staffBody = await staffRes.json().catch(() => null);
          const rawList: unknown[] = Array.isArray(staffBody?.items)
            ? staffBody.items
            : Array.isArray(staffBody)
            ? staffBody
            : [];
          const list: PublicAgent[] = rawList
            .map((raw) => {
              if (!raw || typeof raw !== "object") return null;
              const r = raw as Record<string, unknown>;
              const id = (r.id as string | undefined) ?? (r._id as string | undefined);
              const fullName = (r.fullName as string | undefined)?.trim();
              if (!id || !fullName) return null;
              return {
                id,
                fullName,
                role: ((r.role as string | undefined) ?? "").trim(),
              };
            })
            .filter((a): a is PublicAgent => a !== null)
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
          setAgents(list);
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
        setBankAccountsLoading(false);
        setUpiAccountsLoading(false);
        setTagsLoading(false);
        setAgentsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userId, loadUser]);

  const txns = useMemo<UnifiedTxn[]>(() => {
    const userMeta = {
      userId: user?.serialId || "",
      userName: user?.name ?? "—",
      userEmail: user?.email ?? "—",
      userPhone: user?.phone ?? "—",
    };
    const ds: UnifiedTxn[] = deposits.map((d) => ({
      id: d.id,
      type: "deposit",
      amount: typeof d.amount === "number" ? d.amount : 0,
      currency: d.currency ?? "USDT",
      status: "Confirmed",
      inrAmount: null,
      reference: d.transactionId ?? d.id,
      createdAt: d.createdAt ?? d.timestamp ?? "",
      remark: d.rawPayload?.remark,
      ...userMeta,
    }));
    const ws: UnifiedTxn[] = withdrawals.map((w) => ({
      id: w.id,
      type: "withdrawal",
      amount: typeof w.amount === "number" ? w.amount : 0,
      currency: "USDT",
      status: w.status,
      inrAmount: typeof w.netInr === "number" ? w.netInr : null,
      reference: w.txHash ?? w.destinationAddress ?? w.accountNumber ?? w.id,
      createdAt: w.createdAt,
      remark: w.notes,
      ...userMeta,
    }));
    return [...ds, ...ws].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
    });
  }, [deposits, withdrawals, user, userId]);

  const filteredTxns = useMemo(() => {
    const q = search.trim().toLowerCase();
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
    return txns.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && statusGroup(t.status) !== statusFilter) return false;
      if (min != null && Number.isFinite(min) && t.amount < min) return false;
      if (max != null && Number.isFinite(max) && t.amount > max) return false;
      if (cutoff != null) {
        const ts = new Date(t.createdAt).getTime();
        if (Number.isNaN(ts) || ts < cutoff) return false;
      }
      if (q !== "") {
        const matches =
          t.id.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    }).sort((a, b) => {
      if (txnSortKey === "inr") {
        // Deposits carry no INR value — keep them at the bottom either way
        // instead of letting a null masquerade as the smallest amount.
        if (a.inrAmount == null && b.inrAmount == null) return 0;
        if (a.inrAmount == null) return 1;
        if (b.inrAmount == null) return -1;
        const diff = a.inrAmount - b.inrAmount;
        return txnSortDir === "desc" ? -diff : diff;
      }
      const diff =
        txnSortKey === "amount"
          ? a.amount - b.amount
          : (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0);
      return txnSortDir === "desc" ? -diff : diff;
    });
  }, [txns, search, typeFilter, statusFilter, timeFilter, minAmount, maxAmount, txnSortKey, txnSortDir]);

  const {
    currentPage: txnPage,
    totalPages: txnTotalPages,
    paginatedData: paginatedTxns,
    setPage: setTxnPage,
    nextPage: nextTxnPage,
    prevPage: prevTxnPage,
  } = usePagination(filteredTxns, txnPageSize);

  const toggleTxnSort = (key: TxnSortKey) => {
    if (txnSortKey === key) {
      setTxnSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setTxnSortKey(key);
      setTxnSortDir("desc");
    }
  };

  const txnSortableHeader = (key: TxnSortKey, label: string) => {
    const active = txnSortKey === key;
    const Icon = active ? (txnSortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th
        className="text-left text-xs text-muted-foreground font-medium px-4 py-3"
        aria-sort={active ? (txnSortDir === "desc" ? "descending" : "ascending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleTxnSort(key)}
          title={`Sort by ${label}`}
          className={`inline-flex items-center gap-1.5 transition-colors hover:text-foreground ${
            active ? "text-foreground" : ""
          }`}
        >
          <span>{label}</span>
          <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "opacity-40"}`} />
        </button>
      </th>
    );
  };

  const txnExportColumns: CsvColumn<UnifiedTxn>[] = [
    { header: "S.No.", value: (_, idx) => (idx ?? 0) + 1 },
    { header: "User ID", value: (t) => user?.serialId || t.userId || "" },
    { header: "Name", value: (t) => t.userName },
    { header: "Email", value: (t) => t.userEmail },
    { header: "Mobile", value: (t) => t.userPhone },
    { header: "Transaction ID", value: (t) => t.id },
    { header: "Type", value: (t) => t.type },
    { header: "Amount (USDT)", value: (t) => Number(t.amount).toFixed(2) },
    { header: "Currency", value: (t) => t.currency },
    { header: "Net INR", value: (t) => (t.inrAmount != null ? Number(t.inrAmount).toFixed(2) : "") },
    { header: "Status", value: (t) => t.status },
    { header: "Date & Time", value: (t) => t.createdAt },
    { header: "Hash Key / Reference", value: (t) => t.reference },
  ];

  const isPaidStatus = (s?: string) => {
    const status = (s || "").toLowerCase();
    return status === "paid" || status === "resolved" || status === "completed";
  };
  const isOnHoldStatus = (s?: string) => {
    const status = (s || "").toLowerCase();
    return status === "pending" || status === "processing" || status === "awaiting_payment" || status === "reserved";
  };

  const totalDeposit = useMemo(
    () => deposits.reduce((sum, d) => sum + (Number.isFinite(d.amount) ? d.amount : 0), 0),
    [deposits],
  );
  const totalPaidWithdrawn = useMemo(
    () => withdrawals.filter((w) => isPaidStatus(w.status)).reduce((sum, w) => sum + (Number.isFinite(w.amount) ? w.amount : 0), 0),
    [withdrawals],
  );
  const totalOnHold = useMemo(
    () => withdrawals.filter((w) => isOnHoldStatus(w.status)).reduce((sum, w) => sum + (Number.isFinite(w.amount) ? w.amount : 0), 0),
    [withdrawals],
  );
  const totalWithdrawn = totalPaidWithdrawn;

  const callFlag = async (action: "block" | "unblock" | "freeze" | "unfreeze", reason?: string) => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setPendingFlag(action);
    try {
      const body = reason && reason.trim() !== "" ? JSON.stringify({ reason: reason.trim() }) : undefined;
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/${action}`, {
        method: "POST",
        headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(json?.message)
          ? json.message.join(", ")
          : json?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      setUser((prev) => {
        if (!prev) return prev;
        if (action === "block") return { ...prev, isBlocked: true, blockedReason: reason ?? null };
        if (action === "unblock") return { ...prev, isBlocked: false, blockedReason: null };
        if (action === "freeze") return { ...prev, isFrozen: true, frozenReason: reason ?? null };
        return { ...prev, isFrozen: false, frozenReason: null };
      });
      const verb = { block: "Blocked", unblock: "Unblocked", freeze: "Frozen", unfreeze: "Unfrozen" }[
        action
      ];
      toast.success(`${verb} user`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setPendingFlag(null);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustBalanceForm.amount || isNaN(Number(adjustBalanceForm.amount)) || Number(adjustBalanceForm.amount) <= 0) {
      toast.error("Enter a valid amount greater than 0");
      return;
    }
    if (!adjustBalanceForm.remark.trim()) {
      toast.error("A remark is mandatory for the audit trail");
      return;
    }
    
    const headers = authHeaders();
    if (!headers) return;
    
    setAdjustingBalance(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/adjust-balance`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: adjustBalanceForm.type,
          amount: Number(adjustBalanceForm.amount),
          remark: adjustBalanceForm.remark.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.message ?? "Adjustment failed");
        return;
      }
      
      toast.success(json?.message ?? "Balance adjusted successfully");
      setAdjustBalanceOpen(false);
      setAdjustBalanceForm({ type: "credit", amount: "", remark: "" });
      
      // Reload deposits/withdrawals to reflect the change
      const [depRes, wdrRes] = await Promise.all([
        fetch(`${API_BASE}/admin/deposits`, { headers }),
        fetch(`${API_BASE}/admin/withdrawals?page=1&limit=1000`, { headers })
      ]);
      const depBody = await depRes.json().catch(() => null);
      const wdrBody = await wdrRes.json().catch(() => null);
      const depItems = Array.isArray(depBody?.items) ? depBody.items : Array.isArray(depBody) ? depBody : [];
      const wdrItems = Array.isArray(wdrBody?.items) ? wdrBody.items : Array.isArray(wdrBody) ? wdrBody : [];
      setDeposits(depItems.filter((d: any) => d.userId === userId));
      setWithdrawals(wdrItems.filter((w: any) => w.userId === userId));
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setAdjustingBalance(false);
    }
  };

  const triggerFlag = (action: "block" | "freeze" | "unblock" | "unfreeze") => {
    if (action === "block" || action === "freeze") {
      setConfirmFlag({ action, reason: "" });
      return;
    }
    void callFlag(action);
  };

  const applyTag = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    if (!tagToApply) return;
    const tag = availableTags.find((t) => t.id === tagToApply);
    if (!tag) return;
    setApplyingTag(true);
    try {
      const body: Record<string, string> = { tagId: tag.id };
      const reason = applyReason.trim();
      if (reason) body.reason = reason;
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/tag`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(json?.message)
          ? json.message.join(", ")
          : json?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      const next = normalizeAssignment(json);
      if (next) setAssignment(next);
      setTagToApply("");
      setApplyReason("");
      toast.success(`Applied "${tag.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setApplyingTag(false);
    }
  };

  const removeTag = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setRemovingTag(true);
    try {
      const reason = removeReason.trim();
      const init: RequestInit = { method: "DELETE", headers };
      if (reason) {
        init.headers = { ...headers, "Content-Type": "application/json" };
        init.body = JSON.stringify({ reason });
      }
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/tag`,
        init,
      );
      const json = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok && res.status !== 204) {
        const msg = Array.isArray(json?.message)
          ? json.message.join(", ")
          : json?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      const next = json ? normalizeAssignment(json) : null;
      setAssignment(next ?? { userId, tag: null, assignedAt: null, assignedBy: null, source: null });
      setRemoveReason("");
      setRemoveReasonOpen(false);
      toast.success("Tag removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setRemovingTag(false);
    }
  };

  const loadHistory = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/tag-history`,
        { headers },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      const list: unknown[] = Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body)
        ? body
        : [];
      setHistory(
        list
          .map(normalizeHistory)
          .filter((h): h is TagHistoryEntry => h !== null)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    void loadHistory();
  };

  const patchAssignedAgent = async (agentId: string | null) => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setSavingAgent(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/assigned-agent`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        toast.error(typeof rawMessage === "string" ? rawMessage : "Could not update agent");
        return;
      }
      const updatedUser = normalizeUser(body);
      if (updatedUser) {
        setUser(updatedUser);
        if (updatedUser.assignedAgent) {
          setAgentAssignment({
            ...updatedUser.assignedAgent,
            assignedAt: updatedUser.assignedAgentAt ?? null,
            source: updatedUser.assignedAgentSource ?? null,
          });
        } else {
          setAgentAssignment(null);
        }
      } else {
        // Fall back to optimistic local state if response shape is unfamiliar.
        if (agentId) {
          const picked = agents.find((a) => a.id === agentId);
          setAgentAssignment(
            picked
              ? {
                  id: picked.id,
                  fullName: picked.fullName,
                  email: null,
                  assignedAt: new Date().toISOString(),
                  source: "admin",
                }
              : null,
          );
        } else {
          setAgentAssignment(null);
        }
      }
      setAgentToAssign("");
      toast.success(agentId ? "Agent assigned" : "Agent removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingAgent(false);
    }
  };

  const assignAgent = () => {
    if (!agentToAssign) return;
    void patchAssignedAgent(agentToAssign);
  };

  const removeAgent = () => {
    void patchAssignedAgent(null);
  };

  const patchReferral = async (code: string | null) => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setSavingReferral(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/referral`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode: code }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        toast.error(typeof rawMessage === "string" ? rawMessage : "Could not update referral");
        return;
      }
      const updatedUser = normalizeUser(body);
      if (updatedUser) {
        setUser(updatedUser);
      }
      setReferralOpen(false);
      setReferralCodeInput("");
      toast.success(code ? "Referral updated" : "Referral cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingReferral(false);
    }
  };

  const patchPhone = async (phone: string) => {
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error("Phone number cannot be empty");
      return;
    }
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setSavingPhone(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/phone`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ phone: trimmed }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        toast.error(typeof rawMessage === "string" ? rawMessage : "Could not update phone number");
        return;
      }
      const updatedUser = normalizeUser(body);
      if (updatedUser) {
        setUser(updatedUser);
      }
      setEditPhoneOpen(false);
      setPhoneInput("");
      toast.success("Phone number updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingPhone(false);
    }
  };

  const tagNameLookup = (id: string | null): string => {
    if (!id) return "—";
    const t = availableTags.find((x) => x.id === id);
    return t ? t.name : id.slice(-6).toUpperCase();
  };

  const applyUserPricing = useCallback((res: UserPricingResponse) => {
    setUserPricing(res);
    setPricingForm({
      usdtPrice: res.override?.usdtPrice != null ? String(res.override.usdtPrice) : "",
      inrPrice: res.override?.inrPrice != null ? String(res.override.inrPrice) : "",
      feePercent:
        res.override?.feePercent != null
          ? feeDecimalToPercentInput(res.override.feePercent)
          : "",
    });
  }, []);

  const loadUserPricing = useCallback(
    async (signal?: AbortSignal) => {
      setPricingLoading(true);
      try {
        const res = await getUserPricing(userId, signal);
        applyUserPricing(res);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load pricing");
      } finally {
        setPricingLoading(false);
      }
    },
    [userId, applyUserPricing],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadUserPricing(controller.signal);
    return () => controller.abort();
  }, [loadUserPricing]);

  const savePricing = async () => {
    const usdt =
      pricingForm.usdtPrice.trim() === "" ? null : Number(pricingForm.usdtPrice);
    const inr = pricingForm.inrPrice.trim() === "" ? null : Number(pricingForm.inrPrice);
    let fee: number | null = null;
    if (pricingForm.feePercent.trim() !== "") {
      const d = feePercentInputToDecimal(pricingForm.feePercent);
      if (d === null) {
        toast.error("Fee must be between 0% and 100% (exclusive)");
        return;
      }
      fee = d;
    }
    if (usdt !== null && (!Number.isFinite(usdt) || usdt <= 0)) {
      toast.error("USDT price must be a positive number");
      return;
    }
    if (inr !== null && (!Number.isFinite(inr) || inr <= 0)) {
      toast.error("USDT → INR rate must be a positive number");
      return;
    }
    setSavingPricing(true);
    try {
      const updated = await putUserPricing(userId, {
        usdtPrice: usdt,
        inrPrice: inr,
        feePercent: fee,
      });
      applyUserPricing(updated);
      toast.success("Pricing override saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save pricing");
    } finally {
      setSavingPricing(false);
    }
  };

  const clearAllPricing = async () => {
    setClearingPricing(true);
    try {
      await deleteUserPricing(userId);
      await loadUserPricing();
      toast.success("Custom pricing cleared");
      setConfirmClearPricing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear pricing");
    } finally {
      setClearingPricing(false);
    }
  };

  const status = user?.isBlocked
    ? { label: "Blocked", cls: "badge-destructive" }
    : user?.isFrozen
    ? { label: "Frozen", cls: "badge-pending" }
    : { label: "Active", cls: "badge-success" };

  const displayName =
    user?.name?.trim() || user?.email || (userId ? `User ${userId.slice(-6).toUpperCase()}` : "—");

    console.log("user", user);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <UserIcon className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{displayName}</h1>
            <p className="text-xs font-mono text-muted-foreground" title={user?.id ?? ""}>
              {user?.id ?? userId}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assignment?.tag && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={tagBadgeStyle(assignment.tag.color)}
              title={`Rank ${assignment.tag.rank}`}
            >
              {tagEmoji(assignment.tag.name) ? (
                <span className="text-sm leading-none" aria-hidden>
                  {tagEmoji(assignment.tag.name)}
                </span>
              ) : (
                <Tag className="h-3 w-3" />
              )}
              {assignment.tag.name}
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.cls}`}>
            {status.label}
          </span>
        </div>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-card space-y-3 p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Profile
              </h2>
              <Field icon={UserIcon} label="Name" value={user?.name ?? "—"} loading={loading} />
              <Field
                icon={Mail}
                label="Email"
                value={user?.email ?? "—"}
                badge={
                  user?.emailVerified
                    ? { text: "Verified", cls: "badge-success" }
                    : { text: "Unverified", cls: "badge-pending" }
                }
                loading={loading}
              />
              <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2">
                <div className="flex min-w-0 items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Mobile</p>
                    <div className="mt-0.5 flex flex-col">
                      <p className="text-sm font-mono break-all text-foreground">
                        {loading ? "…" : user?.phone ?? "—"}
                      </p>
                      {user?.phoneUpdatedAt && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3 inline text-primary/70 shrink-0" />
                          <span>
                            Last updated by Super Admin:{" "}
                            <strong className="text-foreground font-medium">{formatIST(user.phoneUpdatedAt)}</strong>
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!loading && user?.phone && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user?.phoneVerified ? "badge-success" : "badge-pending"
                      }`}
                    >
                      {user?.phoneVerified ? "Verified" : "Unverified"}
                    </span>
                  )}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneInput(user?.phone ?? "");
                        setEditPhoneOpen(true);
                      }}
                      className="text-xs text-primary hover:underline ml-1 font-medium flex-shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              <Field
                icon={Wallet}
                label="Wallet"
                value={user?.walletAddress ?? "—"}
                mono
                copyable
                href={user?.walletAddress ? tronscanAddressUrl(user.walletAddress) : undefined}
                loading={loading}
              />
              <div className="flex items-center justify-between">
                <Field
                  icon={ShieldCheck}
                  label="Crypto Subscription"
                  value={
                    user?.isSubscribed
                      ? "Subscribed (Active)"
                      : user?.subscriptionStatus === "failed"
                      ? `Failed: ${user?.subscriptionError || "Unknown error"}`
                      : "Not Subscribed"
                  }
                  badge={
                    user?.isSubscribed
                      ? { text: "Active", cls: "badge-success" }
                      : user?.subscriptionStatus === "failed"
                      ? { text: "Failed", cls: "badge-destructive" }
                      : { text: "No Subscription", cls: "badge-pending" }
                  }
                  loading={loading}
                />
                {!loading && user?.walletAddress && (
                  <button
                    disabled={submittingSubscription}
                    onClick={handleSubscribeWallet}
                    className="text-xs text-primary hover:underline ml-2 flex-shrink-0 disabled:opacity-50"
                  >
                    {submittingSubscription
                      ? "Subscribing..."
                      : user?.isSubscribed
                      ? "Resubscribe"
                      : "Subscribe"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 border-b border-border/50 py-1">
                <Field
                  icon={CalendarIcon}
                  label="Joining Date"
                  value={user?.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "—"}
                  loading={loading}
                />
                <Field
                  icon={Clock}
                  label="Joining Time"
                  value={user?.createdAt ? format(new Date(user.createdAt), "hh:mm:ss a") : "—"}
                  loading={loading}
                />
              </div>
              <div className="flex items-center justify-between">
                <Field
                  icon={UserIcon}
                  label="Referred By"
                  value={
                    user?.invitedByDetails 
                      ? `${user.invitedByDetails.name} (${user.invitedByDetails.referralCode})` 
                      : "No referral"
                  }
                  loading={loading}
                />
                <button
                  onClick={() => {
                    setReferralCodeInput(user?.invitedByDetails?.referralCode ?? "");
                    setReferralOpen(true);
                  }}
                  className="text-xs text-primary hover:underline ml-2 flex-shrink-0"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="glass-card space-y-3 p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Security
              </h2>
              <Field
                icon={ShieldCheck}
                label="Account verification"
                value={
                  user?.twoFactorVerified
                    ? `Enabled${
                        user.twoFactorMethod ? ` (${user.twoFactorMethod === "phone" ? "mobile" : "email"})` : ""
                      }`
                    : "Not enabled"
                }
                badge={
                  user?.twoFactorVerified
                    ? { text: "On", cls: "badge-success" }
                    : { text: "Off", cls: "badge-pending" }
                }
                loading={loading}
              />
              <Field
                icon={ShieldCheck}
                label="Google Authenticator (login)"
                value={
                  user?.totpEnabled
                    ? `Enabled${
                        user.totpEnabledAt
                          ? ` since ${new Date(user.totpEnabledAt).toLocaleDateString()}`
                          : ""
                      }`
                    : "Not enabled"
                }
                badge={
                  user?.totpEnabled
                    ? { text: "On", cls: "badge-success" }
                    : { text: "Off", cls: "badge-pending" }
                }
                loading={loading}
              />
              <Field
                icon={Lock}
                label="Status"
                value={
                  user?.isBlocked
                    ? `Blocked${user.blockedReason ? ` — ${user.blockedReason}` : ""}`
                    : user?.isFrozen
                    ? `Frozen${user.frozenReason ? ` — ${user.frozenReason}` : ""}`
                    : "Active"
                }
                loading={loading}
              />
              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-4">
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">Total Deposits</p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {totalDeposit.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                  </p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {totalPaidWithdrawn.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                  </p>
                </div>
                <div 
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 cursor-pointer hover:bg-amber-500/20 hover:border-amber-500/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => {
                    const searchVal = user?.serialId || user?.email || user?.id || userId;
                    navigate(`/admin/withdrawals?search=${encodeURIComponent(searchVal)}&statusFilter=pending&dateFilter=all`);
                  }}
                  title="Click to view pending withdrawals for this user"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-500 font-medium flex items-center gap-1">
                      On Hold
                      <ExternalLink className="h-3 w-3 text-amber-400 opacity-70" />
                    </p>
                    {totalOnHold > 0 && (
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold text-amber-400">
                    {totalOnHold.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                  </p>
                </div>
                <div 
                  className="rounded-lg border border-primary/30 bg-primary/10 p-3 cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => setAdjustBalanceOpen(true)}
                  title="Click to manually adjust balance"
                >
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="mt-1 font-mono text-lg font-bold text-primary">
                    {(totalDeposit - totalPaidWithdrawn - totalOnHold).toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    USDT
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ACCOUNTS */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="glass-card space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Bank Accounts
              </h2>
              <span className="text-xs text-muted-foreground">
                {bankAccountsLoading
                  ? "Loading…"
                  : `${bankAccounts.length} account${bankAccounts.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {bankAccountsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : bankAccounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No bank accounts added.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {bankAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-xl border border-border bg-secondary/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                          <Landmark className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {acc.accountHolderName || "—"}
                          </p>
                          {acc.bankName && (
                            <p className="truncate text-xs text-muted-foreground">
                              {acc.bankName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {acc.isDefault && acc.approvalStatus === "approved" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Star className="h-3 w-3" /> Default
                          </span>
                        )}
                        {acc.approvalStatus === "pending" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                            <Clock className="h-3 w-3" /> Pending approval
                          </span>
                        )}
                        {acc.approvalStatus === "rejected" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            <X className="h-3 w-3" /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Account number</p>
                        <p className="mt-0.5 font-mono break-all">{acc.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">IFSC</p>
                        <p className="mt-0.5 font-mono break-all">{acc.ifscCode}</p>
                      </div>
                    </div>
                    {acc.createdAt && (
                      <p className="mt-3 text-[11px] text-muted-foreground" title={acc.createdAt}>
                        Added {formatIST(acc.createdAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                UPI IDs
              </h2>
              <span className="text-xs text-muted-foreground">
                {upiAccountsLoading
                  ? "Loading…"
                  : `${upiAccounts.length} UPI ID${upiAccounts.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {upiAccountsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : upiAccounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No UPI IDs added.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {upiAccounts.map((acc) => (
                  <div key={acc.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                          <Smartphone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {acc.accountHolderName || "—"}
                          </p>
                          <p className="break-all text-xs text-muted-foreground font-mono">
                            {acc.upiId}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {acc.isDefault && acc.approvalStatus === "approved" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Star className="h-3 w-3" /> Default
                          </span>
                        )}
                        {acc.approvalStatus === "pending" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                            <Clock className="h-3 w-3" /> Pending approval
                          </span>
                        )}
                        {acc.approvalStatus === "rejected" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            <X className="h-3 w-3" /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                    {acc.createdAt && (
                      <p className="mt-3 text-[11px] text-muted-foreground" title={acc.createdAt}>
                        Added {formatIST(acc.createdAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="glass-card space-y-3 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Transactions
              </h2>
              <ExportButton
                filename={`user-${userId.slice(-6)}-transactions`}
                rows={filteredTxns}
                columns={txnExportColumns}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, hash, status…"
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 lg:col-span-2"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All time</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  value={minAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setMinAmount(v);
                  }}
                  placeholder="Min"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  inputMode="decimal"
                  value={maxAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setMaxAmount(v);
                  }}
                  placeholder="Max"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="table-scroll sm:rounded-xl">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">User ID</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Name</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Email</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Mobile</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Type</th>
                    {txnSortableHeader("amount", "Amount")}
                    {txnSortableHeader("inr", "INR")}
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Status</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Reference</th>
                    {txnSortableHeader("date", "Date")}
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredTxns.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {txns.length === 0 ? "No transactions yet" : "No transactions match the filters"}
                      </td>
                    </tr>
                  ) : (
                    paginatedTxns.map((t) => (
                      <tr key={`${t.type}-${t.id}`} className="table-row-hover border-b border-border/50">
                        <td
                          className="px-4 py-3 text-xs font-mono text-muted-foreground"
                          title={t.userId}
                        >
                          {t.userId.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-sm">{t.userName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{t.userEmail}</td>
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{t.userPhone}</td>
                        <td className="px-4 py-3 text-sm capitalize">{t.type}</td>
                        <td className="px-4 py-3 text-sm font-mono font-medium">
                          {t.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {t.currency}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                          {t.inrAmount != null
                            ? `₹${t.inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusBadge(t.status)}`}>
                            {t.status}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-sm font-mono text-primary max-w-[200px] truncate"
                          title={t.reference}
                        >
                          {t.reference.length === 64 ? (
                            <TronLink type="transaction" value={t.reference} truncate={false} />
                          ) : t.reference.startsWith("T") && t.reference.length === 34 ? (
                            <TronLink type="address" value={t.reference} truncate={false} />
                          ) : (
                            t.reference
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap" title={t.createdAt}>
                          {formatIst(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" title={t.remark}>
                          {t.remark || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={txnPage}
              totalPages={txnTotalPages}
              pageSize={txnPageSize}
              totalItems={filteredTxns.length}
              setPage={setTxnPage}
              nextPage={nextTxnPage}
              prevPage={prevTxnPage}
              onPageSizeChange={setTxnPageSize}
              label="transactions"
              id="txnPageSize"
            />
          </div>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-card space-y-4 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Tier tag
                </h2>
                <button
                  type="button"
                  onClick={openHistory}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-[11px] hover:bg-secondary/70"
                >
                  <Clock className="h-3 w-3" /> History
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                One tier per user. Auto-applies based on the rule configured for the tag; admins can
                override manually.
              </p>

              {tagsLoading ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>
              ) : assignment?.tag ? (
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={tagBadgeStyle(assignment.tag.color)}
                    >
                      {tagEmoji(assignment.tag.name) ? (
                        <span className="text-sm leading-none" aria-hidden>
                          {tagEmoji(assignment.tag.name)}
                        </span>
                      ) : (
                        <Tag className="h-3 w-3" />
                      )}
                      {assignment.tag.name}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      rank {assignment.tag.rank}
                    </span>
                    {assignment.source && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          assignment.source === "auto"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {assignment.source}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {assignment.assignedAt && (
                      <>Assigned {relativeTime(assignment.assignedAt)}</>
                    )}
                    {assignment.assignedBy && (
                      <>
                        {" "}
                        by{" "}
                        <span className="font-mono">
                          {assignment.assignedBy.slice(-6).toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveReason("");
                      setRemoveReasonOpen(true);
                    }}
                    disabled={removingTag}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Remove tag
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tag assigned.</p>
              )}

              {availableTags.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No tags configured yet — create some in Platform Settings.
                </p>
              ) : (
                <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                  <p className="text-xs font-medium">
                    {assignment?.tag ? "Change tag" : "Apply tag"}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={tagToApply}
                      onChange={(e) => setTagToApply(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Select a tag…</option>
                      {availableTags
                        .filter((t) => t.id !== assignment?.tag?.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (rank {t.rank})
                          </option>
                        ))}
                    </select>
                  </div>
                  <input
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    placeholder="Reason (optional)"
                    maxLength={200}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={applyTag}
                    disabled={!tagToApply || applyingTag}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                  >
                    {applyingTag ? "Applying…" : assignment?.tag ? "Replace tag" : "Apply tag"}
                  </button>
                </div>
              )}
            </div>

            <div className="glass-card space-y-4 p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Account access
              </h2>

              {user?.isBlocked && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-destructive text-sm">
                      <Ban className="h-4 w-4" /> Account is Blocked
                    </span>
                    <span className="rounded-full bg-destructive/20 border border-destructive/30 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase tracking-wide">
                      Blocked
                    </span>
                  </div>
                  {user.blockedReason && (
                    <p className="text-xs text-muted-foreground">
                      Reason: <strong className="text-foreground">{user.blockedReason}</strong>
                    </p>
                  )}
                  {user.blockedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Blocked on: {formatIst(user.blockedAt)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Block</p>
                  <p className="text-xs text-muted-foreground">Prevent sign-in and any transactions.</p>
                </div>
                {user?.isBlocked ? (
                  <button
                    type="button"
                    onClick={() => triggerFlag("unblock")}
                    disabled={pendingFlag === "unblock"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/70 disabled:opacity-50"
                  >
                    <Unlock className="h-3.5 w-3.5" /> {pendingFlag === "unblock" ? "Saving…" : "Unblock"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerFlag("block")}
                    disabled={pendingFlag === "block"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> {pendingFlag === "block" ? "Saving…" : "Block"}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Freeze withdrawals</p>
                  <p className="text-xs text-muted-foreground">
                    Disables withdrawals. Sign-in and deposits keep working.
                  </p>
                </div>
                {user?.isFrozen ? (
                  <button
                    type="button"
                    onClick={() => triggerFlag("unfreeze")}
                    disabled={pendingFlag === "unfreeze"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/70 disabled:opacity-50"
                  >
                    <Sun className="h-3.5 w-3.5" /> {pendingFlag === "unfreeze" ? "Saving…" : "Unfreeze"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerFlag("freeze")}
                    disabled={pendingFlag === "freeze"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-warning px-3 py-2 text-sm font-semibold text-warning-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Snowflake className="h-3.5 w-3.5" /> {pendingFlag === "freeze" ? "Saving…" : "Freeze"}
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-3">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    Temporary password
                    {!isSuperAdmin && (
                      <span className="rounded-full bg-secondary/80 border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Super Admin only
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Set a temporary password and email it to the user. On login, a window will prompt them to set their new password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAutoGeneratedTempPassword(generateRandomTempPassword());
                    setCustomTempPassword("");
                    setTempPasswordMode("auto");
                    setSentTempPasswordResult(null);
                    setTempPasswordModalOpen(true);
                  }}
                  disabled={!isSuperAdmin}
                  title={!isSuperAdmin ? "Super Admin access required" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Set temporary password
                </button>
              </div>
            </div>

            <div className="glass-card space-y-4 p-4 sm:p-6 lg:col-span-2">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-primary" /> Assigned agent
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. The staff member who handles this customer's account. Pick from active
                  staff users.
                </p>
              </div>

              {agentAssignment ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Headphones className="h-3 w-3" />
                        {agentAssignment.fullName}
                      </span>
                      {agentAssignment.email && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {agentAssignment.email}
                        </span>
                      )}
                      {agentAssignment.source && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            agentAssignment.source === "signup"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {agentAssignment.source}
                        </span>
                      )}
                    </div>
                    {agentAssignment.assignedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Assigned {formatIst(agentAssignment.assignedAt)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeAgent}
                    disabled={savingAgent}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Remove agent
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No agent assigned.</p>
              )}

              <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                <p className="text-xs font-medium">
                  {agentAssignment ? "Change agent" : "Assign agent"}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={agentToAssign}
                    onChange={(e) => setAgentToAssign(e.target.value)}
                    disabled={agentsLoading || agents.length === 0}
                    className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  >
                    <option value="">
                      {agentsLoading
                        ? "Loading agents…"
                        : agents.length === 0
                        ? "No active agents"
                        : "Select an agent…"}
                    </option>
                    {agents
                      .filter((a) => a.id !== agentAssignment?.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.role ? `${a.fullName} — ${a.role}` : a.fullName}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={assignAgent}
                    disabled={!agentToAssign || savingAgent}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingAgent
                      ? "Saving…"
                      : agentAssignment
                      ? "Replace agent"
                      : "Assign agent"}
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card space-y-4 p-4 sm:p-6 lg:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" /> Pricing override
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Override the global pricing for this user, field by field. Leave a field
                    blank to fall back to the global value. Changes apply to new withdrawals only —
                    pending withdrawals keep their snapshotted rate.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingHistoryOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/70"
                  >
                    <History className="h-3 w-3" /> History
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearPricing(true)}
                    disabled={pricingLoading || userPricing?.override === null}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Clear all
                  </button>
                </div>
              </div>

              {pricingLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {(
                      [
                        {
                          key: "usdtPrice",
                          field: "usdtPrice" as const,
                          label: "USDT price ($)",
                          icon: DollarSign,
                          placeholder: "e.g. 1",
                        },
                        {
                          key: "inrPrice",
                          field: "inrPrice" as const,
                          label: "USDT → INR rate (₹)",
                          icon: DollarSign,
                          placeholder: "e.g. 82.50",
                        },
                        {
                          key: "feePercent",
                          field: "feePercent" as const,
                          label: "Withdrawal fee (%)",
                          icon: Percent,
                          placeholder: "e.g. 1.5",
                        },
                      ] as const
                    ).map((f) => {
                      const value = pricingForm[f.field];
                      const effective = userPricing?.effective?.[f.field];
                      const overrideValue = userPricing?.override?.[f.field] ?? null;
                      const usingOverride = overrideValue !== null;
                      return (
                        <div key={f.key}>
                          <label
                            htmlFor={`pricing-${f.field}`}
                            className="text-xs font-medium text-muted-foreground flex items-center gap-1"
                          >
                            <f.icon className="h-3 w-3" /> {f.label}
                          </label>
                          <div className="relative mt-1.5">
                            <input
                              id={`pricing-${f.field}`}
                              inputMode="decimal"
                              value={value}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^\d*\.?\d*$/.test(v))
                                  setPricingForm((p) => ({ ...p, [f.field]: v }));
                              }}
                              placeholder={f.placeholder}
                              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            {value !== "" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPricingForm((p) => ({ ...p, [f.field]: "" }))
                                }
                                aria-label="Clear override"
                                title="Clear override (use global)"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {usingOverride ? (
                              <span className="text-primary">Overridden</span>
                            ) : (
                              <>Using global: </>
                            )}
                            {!usingOverride && (
                              <span className="font-mono">
                                {effective !== undefined
                                  ? formatPricingValue(f.field, effective)
                                  : "—"}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {userPricing?.override &&
                      (["usdtPrice", "inrPrice", "feePercent"] as const).some(
                        (f) => userPricing.override?.[f] !== null,
                      ) ? (
                        (["usdtPrice", "inrPrice", "feePercent"] as const)
                          .filter((f) => userPricing.override?.[f] !== null)
                          .map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                            >
                              {PRICING_FIELD_LABEL[f]}:{" "}
                              <span className="font-mono">
                                {formatPricingValue(f, userPricing.override![f])}
                              </span>
                            </span>
                          ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          No overrides — using global pricing.
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={savePricing}
                      disabled={savingPricing || pricingLoading}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPricing ? "Saving…" : "Save override"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={confirmFlag !== null}
        onOpenChange={(open) => {
          if (!open && pendingFlag === null) setConfirmFlag(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {confirmFlag && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirmFlag.action === "block" ? "Block user" : "Freeze user"}
                </DialogTitle>
                <DialogDescription>
                  {confirmFlag.action === "block"
                    ? "This will prevent the user from signing in or transacting."
                    : "This will prevent the user from withdrawing. Sign-in stays enabled."}
                </DialogDescription>
              </DialogHeader>
              <div>
                <label htmlFor="reason" className="text-xs font-medium text-muted-foreground">
                  Reason (optional)
                </label>
                <textarea
                  id="reason"
                  value={confirmFlag.reason}
                  onChange={(e) => setConfirmFlag((c) => (c ? { ...c, reason: e.target.value } : c))}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirmFlag(null)}
                  disabled={pendingFlag !== null}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirmFlag) return;
                    await callFlag(confirmFlag.action, confirmFlag.reason);
                    setConfirmFlag(null);
                  }}
                  disabled={pendingFlag !== null}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                    confirmFlag.action === "block" ? "bg-destructive" : "bg-warning"
                  }`}
                >
                  {pendingFlag !== null ? "Saving…" : confirmFlag.action === "block" ? "Block" : "Freeze"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove tag confirmation */}
      <Dialog
        open={removeReasonOpen}
        onOpenChange={(open) => {
          if (!open && !removingTag) {
            setRemoveReasonOpen(false);
            setRemoveReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove tag</DialogTitle>
            <DialogDescription>
              {assignment?.tag ? (
                <>Downgrade <span className="font-semibold">{assignment.tag.name}</span> to none.</>
              ) : (
                "Remove the user's current tag."
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="remove-reason" className="text-xs font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <textarea
              id="remove-reason"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="e.g. Suspicious activity"
              className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setRemoveReasonOpen(false);
                setRemoveReason("");
              }}
              disabled={removingTag}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={removeTag}
              disabled={removingTag}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {removingTag ? "Removing…" : "Remove"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag history */}
      <Dialog open={historyOpen} onOpenChange={(open) => !open && setHistoryOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tag history</DialogTitle>
            <DialogDescription>
              Chronological audit of all tag changes for this user (newest first).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <ol className="space-y-2">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg border border-border bg-secondary/30 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-muted-foreground">
                        {tagNameLookup(h.fromTagId)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono">{tagNameLookup(h.toTagId)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          h.source === "auto"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {h.source}
                      </span>
                    </div>
                    {h.reason && (
                      <p className="mt-1.5 text-muted-foreground">{h.reason}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground" title={h.createdAt}>
                      {relativeTime(h.createdAt)}
                      {h.actorId && (
                        <>
                          {" "}
                          · by{" "}
                          <span className="font-mono">
                            {h.actorId.slice(-6).toUpperCase()}
                          </span>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setHistoryOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Referral</DialogTitle>
            <DialogDescription>
              Assign or change the user who referred this account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">Referral Code</label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
              placeholder="Enter referral code (leave empty to clear)"
              value={referralCodeInput}
              onChange={(e) => setReferralCodeInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setReferralOpen(false);
                setReferralCodeInput("");
              }}
              disabled={savingReferral}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => patchReferral(referralCodeInput.trim() || null)}
              disabled={savingReferral}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingReferral ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Edit Phone Modal */}
      <Dialog open={editPhoneOpen} onOpenChange={setEditPhoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Edit User Phone Number</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Update mobile number for {user?.name || "this user"}. Super Admin access required.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Current Mobile Number</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {user?.phone || "No phone registered"}
              </p>
              {user?.phoneUpdatedAt && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 inline text-primary/70 shrink-0" />
                  <span>
                    Last updated by Super Admin:{" "}
                    <strong className="text-foreground font-medium">{formatIST(user.phoneUpdatedAt)}</strong>
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                New Mobile Number
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 9876543210 or +919876543210"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Enter a 10-digit Indian mobile number. "+91" prefix will be automatically added if omitted.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setEditPhoneOpen(false);
                setPhoneInput("");
              }}
              disabled={savingPhone}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => patchPhone(phoneInput)}
              disabled={savingPhone || !phoneInput.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {savingPhone ? "Saving…" : "Save Phone Number"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PricingHistoryDialog
        open={pricingHistoryOpen}
        onOpenChange={setPricingHistoryOpen}
        scope="user"
        userId={userId}
        title={user?.name ? `Pricing history — ${user.name}` : "Per-user pricing history"}
      />

      <Dialog
        open={confirmClearPricing}
        onOpenChange={(open) => {
          if (!open && !clearingPricing) setConfirmClearPricing(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear pricing override</DialogTitle>
            <DialogDescription>
              Remove this user's custom pricing? They'll fall back to the global rates for
              all three fields. Pending withdrawals are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmClearPricing(false)}
              disabled={clearingPricing}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={clearAllPricing}
              disabled={clearingPricing}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {clearingPricing ? "Clearing…" : "Clear override"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* MANUAL ADJUSTMENT MODAL */}
      <Dialog open={adjustBalanceOpen} onOpenChange={setAdjustBalanceOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
              <WalletCards className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">Manual Balance Adjustment</DialogTitle>
            <DialogDescription className="text-center">
              Credit or debit this user's balance. A transaction record will be created.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-3">
              <label className="text-sm font-semibold">Adjustment Type</label>
              <div 
                className={`relative flex items-center h-16 w-full rounded-full border border-border overflow-hidden transition-colors ${
                  adjustBalanceForm.type === "credit"
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-destructive/10 border-destructive/30"
                }`}
              >
                {/* Background sliding glow */}
                <div 
                  className={`absolute top-0 bottom-0 w-1/2 rounded-full transition-transform duration-300 ease-in-out ${
                    adjustBalanceForm.type === "credit"
                      ? "translate-x-0 bg-emerald-500/20"
                      : "translate-x-full bg-destructive/20"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setAdjustBalanceForm({ ...adjustBalanceForm, type: "credit" })}
                  className={`relative flex flex-col items-center justify-center w-1/2 h-full z-10 transition-colors ${
                    adjustBalanceForm.type === "credit" ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="font-bold">Credit (Add)</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-medium">Add balance to user account</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setAdjustBalanceForm({ ...adjustBalanceForm, type: "debit" })}
                  className={`relative flex flex-col items-center justify-center w-1/2 h-full z-10 transition-colors ${
                    adjustBalanceForm.type === "debit" ? "text-destructive" : "text-muted-foreground hover:text-destructive/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="h-4 w-4" />
                    <span className="font-bold">Debit (Remove)</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-medium">Remove balance from account</span>
                </button>

                {/* Center toggle switch */}
                <button
                  type="button"
                  onClick={() => setAdjustBalanceForm({ ...adjustBalanceForm, type: adjustBalanceForm.type === "credit" ? "debit" : "credit" })}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-muted-foreground shadow-md hover:bg-gray-50 z-20 transition-transform hover:scale-105 active:scale-95"
                >
                  <ArrowLeftRight className="h-4 w-4 text-gray-700" />
                </button>
              </div>
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-semibold">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  className="flex h-11 w-full rounded-md border border-input bg-secondary px-3 py-2 pr-12 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={adjustBalanceForm.amount}
                  onChange={(e) => setAdjustBalanceForm({ ...adjustBalanceForm, amount: e.target.value })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  USDT
                </span>
              </div>
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-semibold">Remark / Reason</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="e.g. Bank transaction reversal, manual top-up..."
                value={adjustBalanceForm.remark}
                onChange={(e) => setAdjustBalanceForm({ ...adjustBalanceForm, remark: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setAdjustBalanceOpen(false)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-4 py-2 w-full sm:w-auto"
              disabled={adjustingBalance}
            >
              Cancel
            </button>
            <button
              onClick={handleAdjustBalance}
              disabled={adjustingBalance || !adjustBalanceForm.amount || !adjustBalanceForm.remark}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6 py-2 w-full sm:w-auto font-semibold"
            >
              {adjustingBalance ? "Processing..." : "Confirm Adjustment"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Set Temporary Password Modal */}
      <Dialog
        open={tempPasswordModalOpen}
        onOpenChange={(open) => {
          if (!sendingTempPassword) {
            setTempPasswordModalOpen(open);
            if (!open) setSentTempPasswordResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  Set Temporary Password
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Issue a temporary password sent to user's email
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {sentTempPasswordResult ? (
            <div className="space-y-4 py-3">
              <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-success">
                    <Check className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-success">
                  Temporary Password Issued!
                </p>
                <p className="text-xs text-muted-foreground">
                  The temporary password was emailed to <strong className="text-foreground">{sentTempPasswordResult.email}</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2 text-center">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Temporary Password
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-xl font-black tracking-wider text-primary bg-background px-4 py-1.5 rounded-lg border border-border shadow-inner">
                    {sentTempPasswordResult.password}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      copyText(sentTempPasswordResult.password);
                      toast.success("Password copied to clipboard");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/70 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  When this user logs in with this temporary password, a window will immediately require them to enter their temporary password and set a new password.
                </p>
              </div>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => {
                    setTempPasswordModalOpen(false);
                    setSentTempPasswordResult(null);
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 w-full"
                >
                  Done
                </button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Target User</p>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{user?.name || "User"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{user?.email || "No email"}</span>
                </div>
              </div>

              {!user?.email && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  This user has no email address registered. The temporary password email cannot be delivered.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Temporary Password Setup
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTempPasswordMode("auto")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium text-center transition-all ${
                      tempPasswordMode === "auto"
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                        : "border-border bg-secondary text-muted-foreground hover:bg-secondary/70"
                    }`}
                  >
                    Auto-Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempPasswordMode("custom")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium text-center transition-all ${
                      tempPasswordMode === "custom"
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                        : "border-border bg-secondary text-muted-foreground hover:bg-secondary/70"
                    }`}
                  >
                    Custom Password
                  </button>
                </div>
              </div>

              {tempPasswordMode === "auto" ? (
                <div className="rounded-xl border border-border bg-secondary/40 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Generated Temporary Password</p>
                    <p className="font-mono text-lg font-bold tracking-wider text-primary mt-0.5">
                      {autoGeneratedTempPassword}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoGeneratedTempPassword(generateRandomTempPassword())}
                    title="Generate new password"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Custom Temporary Password
                  </label>
                  <input
                    type="text"
                    value={customTempPassword}
                    onChange={(e) => setCustomTempPassword(e.target.value)}
                    placeholder="e.g. TempPass@2026"
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enter at least 6 characters for the user's temporary password.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Clicking send will email the temporary password to <strong>{user?.email}</strong>. When the user logs in with this temporary password, a mandatory window will require them to set their permanent password.
              </p>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <button
                  type="button"
                  onClick={() => setTempPasswordModalOpen(false)}
                  disabled={sendingTempPassword}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSetTemporaryPassword}
                  disabled={
                    sendingTempPassword ||
                    !user?.email ||
                    (tempPasswordMode === "custom" && customTempPassword.trim().length < 6)
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {sendingTempPassword ? (
                    "Setting Temporary Password…"
                  ) : (
                    <>
                      <KeyRound className="h-3.5 w-3.5" /> Set & Email Temporary Password
                    </>
                  )}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: { text: string; cls: string };
  mono?: boolean;
  loading?: boolean;
  copyable?: boolean;
  /** Renders the value as an external link (opens in a new tab). */
  href?: string;
}

const Field = ({ icon: Icon, label, value, badge, mono, loading, copyable, href }: FieldProps) => {
  const [copied, setCopied] = useState(false);
  // Nothing to put on the clipboard for an empty / placeholder value.
  const hasValue = !loading && value !== "" && value !== "—";
  const canCopy = Boolean(copyable) && hasValue;
  const linkTo = hasValue ? href : undefined;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const ok = await copyText(value);
    if (!ok) {
      toast.error(`Could not copy ${label.toLowerCase()}`);
      return;
    }
    setCopied(true);
    toast.success(`${label} copied`);
  };

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-0.5 flex items-start gap-2">
            {linkTo ? (
              <a
                href={linkTo}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${label.toLowerCase()} on Tronscan`}
                className={`inline-flex items-start gap-1 text-sm break-all text-primary transition-colors hover:underline hover:text-primary/80 ${
                  mono ? "font-mono" : ""
                }`}
              >
                {value}
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              </a>
            ) : (
              <p className={`text-sm break-all ${mono ? "font-mono" : ""}`}>
                {loading ? "…" : value}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && !loading && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
            {badge.text}
          </span>
        )}
        {canCopy && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${label.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminUserDetail;
