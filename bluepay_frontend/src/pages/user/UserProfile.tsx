import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import {
  PasswordRequirements,
  checkPasswordRequirements,
} from "@/components/shared/PasswordRequirements";
import { AlertTriangle, Bell, Check, Key, KeyRound, Landmark, LifeBuoy, Lock, Mail, Plus, Shield, Smartphone, User, X } from "lucide-react";
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
import { useTwoFactor } from "@/contexts/TwoFactorContext";
import { TotpSettingsCard } from "@/components/auth/TotpSettingsCard";
import {
  changePin,
  confirmPinReset,
  getPinStatus,
  PinError,
  requestPinResetOtp,
  setupPin,
  type PinStatus,
} from "@/lib/api-pin";
import {
  createUserTicket,
  listUserTickets,
  type Ticket,
} from "@/lib/api-tickets";
import {
  listUserDisputes,
  type DisputeReason,
  type WithdrawalDispute,
} from "@/lib/api-withdrawal-disputes";
import {
  getNotificationPreference,
  patchNotificationPreference,
  type NotificationChannel,
} from "@/lib/api-notifications";
import {
  decideUpiPendingApproval,
  listUpiPendingApprovals,
  type SharedUpiRequest,
} from "@/lib/api-upi";
import { formatIst } from "@/lib/format-date";

interface AssignedAgent {
  id: string;
  fullName: string;
  email?: string | null;
}

interface ProfilePayload {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  referralCode: string;
  createdAt?: string;
  assignedAgent?: AssignedAgent | null;
  assignedAgentSource?: "signup" | "admin" | null;
}

interface SharedAccountRequest {
  id: string;
  requesterName: string | null;
  requesterEmail: string | null;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string | null;
  createdAt: string | null;
}

function maskAccountNumber(account: string) {
  const v = (account ?? "").replace(/\s/g, "");
  if (v.length <= 4) return `****${v}`;
  return `****${v.slice(-4)}`;
}

function pickSharedAccountRequest(raw: unknown): SharedAccountRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const accountNumber = (r.accountNumber as string | undefined) ?? "";
  const ifscCode = (r.ifscCode as string | undefined) ?? "";
  if (!id || !accountNumber || !ifscCode) return null;
  const requesterObj =
    (r.requester as Record<string, unknown> | undefined) ??
    (r.requestedBy as Record<string, unknown> | undefined) ??
    null;
  const nameFromObj = (requesterObj?.fullName as string | undefined)?.trim()
    ?? (requesterObj?.name as string | undefined)?.trim()
    ?? null;
  const emailFromObj = (requesterObj?.email as string | undefined)?.trim() ?? null;
  const flatName = (r.requesterName as string | undefined)?.trim() ?? null;
  const flatEmail = (r.requesterEmail as string | undefined)?.trim() ?? null;
  return {
    id,
    requesterName: nameFromObj || flatName || null,
    requesterEmail: emailFromObj || flatEmail || null,
    accountHolderName: (r.accountHolderName as string | undefined) ?? "",
    accountNumber,
    ifscCode,
    bankName: (r.bankName as string | null | undefined) ?? null,
    createdAt: (r.createdAt as string | null | undefined) ?? null,
  };
}

function pickAssignedAgent(raw: unknown): AssignedAgent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const fullName = (r.fullName as string | undefined)?.trim();
  if (!id || !fullName) return null;
  return { id, fullName, email: (r.email as string | null | undefined) ?? null };
}

function formatMember(iso?: string) {
  if (!iso) return "Member";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Member";
  return `Member since ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

const UserProfile = () => {
  const { state: twoFa, requestReverify } = useTwoFactor();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [sharedRequests, setSharedRequests] = useState<SharedAccountRequest[]>([]);
  const [sharedRequestsLoading, setSharedRequestsLoading] = useState(true);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  const [sharedUpiRequests, setSharedUpiRequests] = useState<SharedUpiRequest[]>([]);
  const [sharedUpiRequestsLoading, setSharedUpiRequestsLoading] = useState(true);
  const [actingUpiRequestId, setActingUpiRequestId] = useState<string | null>(null);

  // Withdrawal PIN state
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [pinStatusLoading, setPinStatusLoading] = useState(true);
  const [pinDialog, setPinDialog] = useState<null | "setup" | "change" | "reset">(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinFields, setPinFields] = useState({
    pin: "",
    confirmPin: "",
    currentPin: "",
    newPin: "",
    confirmNewPin: "",
    otp: "",
  });
  const [resetStage, setResetStage] = useState<"request" | "verify">("request");
  const resetPinFields = () =>
    setPinFields({ pin: "", confirmPin: "", currentPin: "", newPin: "", confirmNewPin: "", otp: "" });

  const refreshPinStatus = async (signal?: AbortSignal) => {
    try {
      const status = await getPinStatus(signal);
      setPinStatus(status);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      // Soft-fail — we'll re-fetch on next dialog action.
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await refreshPinStatus(controller.signal);
      setPinStatusLoading(false);
    })();
    return () => controller.abort();
  }, []);

  const closePinDialog = () => {
    if (pinSubmitting) return;
    setPinDialog(null);
    setResetStage("request");
    resetPinFields();
  };

  const validatePin = (value: string) => /^\d{6}$/.test(value);

  const handleSetupPin = async () => {
    if (!validatePin(pinFields.pin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    if (pinFields.pin !== pinFields.confirmPin) {
      toast.error("PINs don't match");
      return;
    }
    setPinSubmitting(true);
    try {
      await setupPin(pinFields.pin, pinFields.confirmPin);
      toast.success("Withdrawal PIN set", {
        description: "Save it somewhere safe — we never store it in a recoverable form.",
      });
      setPinStatus({ pinSet: true, locked: false, lockedUntil: null });
      setPinDialog(null);
      resetPinFields();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set PIN");
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleChangePin = async () => {
    if (!validatePin(pinFields.currentPin)) {
      toast.error("Current PIN must be 6 digits");
      return;
    }
    if (!validatePin(pinFields.newPin)) {
      toast.error("New PIN must be exactly 6 digits");
      return;
    }
    if (pinFields.newPin !== pinFields.confirmNewPin) {
      toast.error("New PINs don't match");
      return;
    }
    setPinSubmitting(true);
    try {
      await changePin(pinFields.currentPin, pinFields.newPin, pinFields.confirmNewPin);
      toast.success("Withdrawal PIN changed");
      setPinDialog(null);
      resetPinFields();
    } catch (err) {
      if (err instanceof PinError && err.code === "WITHDRAWAL_PIN_LOCKED") {
        toast.error("PIN locked — use Forgot PIN to reset.");
        setPinStatus((prev) => (prev ? { ...prev, locked: true } : prev));
        setPinDialog("reset");
        setResetStage("request");
        resetPinFields();
        return;
      }
      if (err instanceof PinError && err.code === "WITHDRAWAL_PIN_INVALID") {
        const tail =
          typeof err.attemptsRemaining === "number"
            ? ` — ${err.attemptsRemaining} attempt${err.attemptsRemaining === 1 ? "" : "s"} left`
            : "";
        toast.error(`Wrong current PIN${tail}`);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not change PIN");
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleRequestResetOtp = async () => {
    setPinSubmitting(true);
    try {
      await requestPinResetOtp();
      toast.success("OTP sent — check your registered SMS or email.");
      setResetStage("verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (pinFields.otp.trim() === "") {
      toast.error("Enter the OTP");
      return;
    }
    if (!validatePin(pinFields.newPin)) {
      toast.error("New PIN must be exactly 6 digits");
      return;
    }
    if (pinFields.newPin !== pinFields.confirmNewPin) {
      toast.error("New PINs don't match");
      return;
    }
    setPinSubmitting(true);
    try {
      await confirmPinReset(pinFields.otp.trim(), pinFields.newPin, pinFields.confirmNewPin);
      toast.success("PIN reset — your account is unlocked.");
      setPinStatus({ pinSet: true, locked: false, lockedUntil: null });
      setPinDialog(null);
      setResetStage("request");
      resetPinFields();
    } catch (err) {
      if (err instanceof PinError && err.code === "PIN_RESET_OTP_EXHAUSTED") {
        toast.error("Too many wrong OTP attempts — request a fresh OTP.");
        setResetStage("request");
        setPinFields((f) => ({ ...f, otp: "" }));
        return;
      }
      if (err instanceof PinError && err.code === "PIN_RESET_OTP_INVALID") {
        toast.error("Wrong OTP — try again");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not reset PIN");
    } finally {
      setPinSubmitting(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) {
        setSharedRequestsLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}/user/bank-accounts/pending-approvals`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
        );
        if (res.status === 404) {
          setSharedRequests([]);
          return;
        }
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          // Soft-fail — empty state covers it.
          return;
        }
        const list = Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
          ? body.items
          : [];
        const parsed = list
          .map(pickSharedAccountRequest)
          .filter((x: SharedAccountRequest | null): x is SharedAccountRequest => x !== null);
        setSharedRequests(parsed);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
      } finally {
        setSharedRequestsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const decideSharedRequest = async (req: SharedAccountRequest, action: "approve" | "reject") => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setActingRequestId(req.id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/bank-accounts/pending-approvals/${encodeURIComponent(req.id)}/${action}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(json?.message)
          ? json.message.join(", ")
          : json?.message ?? `Request failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      setSharedRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success(
        action === "approve"
          ? "Approved — they can now withdraw to this account."
          : "Rejected — the account stays blocked.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setActingRequestId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const requests = await listUpiPendingApprovals(controller.signal);
        setSharedUpiRequests(requests);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        // Soft-fail — empty state covers it.
      } finally {
        setSharedUpiRequestsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const decideSharedUpiRequest = async (req: SharedUpiRequest, action: "approve" | "reject") => {
    setActingUpiRequestId(req.id);
    try {
      await decideUpiPendingApproval(req.id, action);
      setSharedUpiRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success(
        action === "approve"
          ? "Approved — they can now withdraw to this UPI ID."
          : "Rejected — the UPI ID stays blocked.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setActingUpiRequestId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const token = localStorage.getItem("TrustO_api_token_v1");
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      try {
        // /user is authoritative for the editable profile fields; /auth/me is
        // authoritative for assignedAgent (the JWT principal carries it directly
        // so we don't need a separate agent lookup).
        const [profileRes, meRes] = await Promise.all([
          fetch(`${API_BASE_URL}/user`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/auth/me`, { headers, signal: controller.signal }),
        ]);
        const body = await profileRes.json().catch(() => null);
        if (!profileRes.ok) {
          toast.error(body?.message ?? "Could not load profile");
          return;
        }
        const me = meRes.ok ? await meRes.json().catch(() => null) : null;
        const p: ProfilePayload = {
          id: body?.profile?.id ?? "",
          name: body?.profile?.name ?? "",
          email: body?.profile?.email ?? "",
          walletAddress: body?.walletAddress ?? "",
          referralCode: body?.profile?.referralCode ?? "",
          createdAt: body?.profile?.createdAt,
          assignedAgent:
            pickAssignedAgent(me?.assignedAgent) ??
            pickAssignedAgent(body?.profile?.assignedAgent) ??
            pickAssignedAgent(body?.assignedAgent) ??
            null,
          assignedAgentSource:
            me?.assignedAgentSource ??
            body?.profile?.assignedAgentSource ??
            body?.assignedAgentSource ??
            null,
        };
        setProfile(p);
        setName(p.name);
        setEmail(p.email);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const profileDirty =
    profile != null && (name.trim() !== profile.name || email.trim().toLowerCase() !== profile.email.toLowerCase());

  const patchUser = async (body: Record<string, string>) => {
    const token = localStorage.getItem("TrustO_api_token_v1");
    if (!token) {
      toast.error("Not authenticated");
      return null;
    }
    const res = await fetch(`${API_BASE_URL}/user`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = Array.isArray(json?.message) ? json.message.join(", ") : json?.message ?? `Request failed (HTTP ${res.status})`;
      toast.error(msg);
      return null;
    }
    return json as ProfilePayload;
  };

  const saveProfile = async () => {
    if (!profile || !profileDirty) return;
    const body: Record<string, string> = {};
    if (name.trim() !== profile.name) body.name = name.trim();
    const emailChanged = email.trim().toLowerCase() !== profile.email.toLowerCase();
    if (emailChanged) body.email = email.trim();
    if (Object.keys(body).length === 0) return;

    setSavingProfile(true);
    try {
      const updated = await patchUser(body);
      if (!updated) return;
      const next: ProfilePayload = {
        ...profile,
        name: updated.name,
        email: updated.email,
        walletAddress: updated.walletAddress ?? profile.walletAddress,
        referralCode: updated.referralCode ?? profile.referralCode,
      };
      setProfile(next);
      setName(next.name);
      setEmail(next.email);
      toast.success("Profile updated");
      if (emailChanged) {
        toast.info("Verify your new email to continue", {
          description: "We'll send a fresh 2FA code to your new address.",
        });
        requestReverify();
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    const check = checkPasswordRequirements(newPassword, {
      name: name || profile?.name,
      email: email || profile?.email,
    });
    if (!check.isValid) {
      if (!check.hasLength) {
        toast.error("Password must be at least 8 characters");
      } else if (!check.hasCapital) {
        toast.error("Password must contain at least one capital letter (A-Z)");
      } else if (!check.hasNumber) {
        toast.error("Password must contain at least one number (0-9)");
      } else if (!check.hasSpecial) {
        toast.error("Password must contain at least one special character");
      } else if (!check.hasNoNameOrUsername) {
        toast.error(`Password cannot contain your name or username ("${check.matchedForbiddenTerm}")`);
      } else {
        toast.error("Password does not meet the security requirements");
      }
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPassword(true);
    try {
      const updated = await patchUser({ currentPassword, newPassword });
      if (!updated) return;
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } finally {
      setSavingPassword(false);
    }
  };

  const initial = (profile?.name?.trim()?.[0] ?? "U").toUpperCase();

  // --- Notification preference (SMS vs email) ---
  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel | null>(
    null,
  );
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [savingNotification, setSavingNotification] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const pref = await getNotificationPreference(controller.signal);
        setNotificationChannel(pref.channel);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        // Soft-fail — leave the toggle disabled with a fallback message.
      } finally {
        setNotificationLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const changeNotificationChannel = async (next: NotificationChannel) => {
    if (next === notificationChannel || savingNotification) return;
    const previous = notificationChannel;
    // Optimistic update — revert on failure.
    setNotificationChannel(next);
    setSavingNotification(true);
    try {
      const updated = await patchNotificationPreference(next);
      setNotificationChannel(updated.channel);
      toast.success(
        updated.channel === "email"
          ? "We'll email you for account events."
          : "We'll text you for account events.",
      );
    } catch (err) {
      setNotificationChannel(previous);
      toast.error(err instanceof Error ? err.message : "Could not update preference");
    } finally {
      setSavingNotification(false);
    }
  };

  // --- Support tickets (live via /user/tickets) ---
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // --- Withdrawal disputes (live via /user/withdrawal-disputes) ---
  const [myDisputes, setMyDisputes] = useState<WithdrawalDispute[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const items = await listUserTickets(controller.signal);
        setMyTickets(items);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        // Soft-fail — the empty state will show and the user can still raise a ticket.
      } finally {
        setTicketsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const items = await listUserDisputes(controller.signal);
        setMyDisputes(items);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        // Soft-fail — disputes are raised from the withdrawal flow, not here.
      } finally {
        setDisputesLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const DISPUTE_REASON_LABEL: Record<DisputeReason, string> = {
    not_received: "Payout not received",
    wrong_amount: "Wrong amount received",
    other: "Withdrawal issue",
  };

  const ticketStatusLabel = (t: Ticket) => {
    if (t.resolutionStatus === "resolved") return { label: "Resolved", cls: "badge-success" };
    return { label: "Pending", cls: "badge-pending" };
  };

  const resetTicketForm = () => {
    setTicketTitle("");
    setTicketDescription("");
    setShowTicketForm(false);
  };

  const submitTicket = async () => {
    const title = ticketTitle.trim();
    const description = ticketDescription.trim();
    if (title.length < 3 || title.length > 140) {
      toast.error("Title must be 3–140 characters");
      return;
    }
    if (description.length < 10 || description.length > 4000) {
      toast.error("Description must be 10–4000 characters");
      return;
    }
    setSubmittingTicket(true);
    try {
      const created = await createUserTicket({ title, description });
      setMyTickets((prev) => [created, ...prev]);
      toast.success("Ticket raised — our support team will be in touch.");
      resetTicketForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not raise ticket");
    } finally {
      setSubmittingTicket(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account details and security</p>
      </div>

      {/* Profile Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">{initial}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{profile?.name ?? "Loading…"}</h2>
            <p className="text-sm text-muted-foreground">{formatMember(profile?.createdAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground flex items-center gap-2"><User className="w-3.5 h-3.5" /> Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Wallet Address</label>
            <input
              value={profile?.walletAddress ?? ""}
              readOnly
              className="mt-2 w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-muted-foreground font-mono text-sm cursor-not-allowed"
            />
          </div>
          {/* Referral Code hidden for now
          <div>
            <label className="text-sm text-muted-foreground">Referral Code</label>
            <input
              value={profile?.referralCode ?? ""}
              readOnly
              className="mt-2 w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-muted-foreground font-mono text-sm cursor-not-allowed"
            />
          </div>
          */}
        </div>

        <button
          onClick={saveProfile}
          disabled={!profileDirty || savingProfile || name.trim() === ""}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingProfile ? "Saving…" : "Save Changes"}
        </button>
      </motion.div>

      {/* Account sharing requests */}
      {(sharedRequestsLoading ||
        sharedUpiRequestsLoading ||
        sharedRequests.length > 0 ||
        sharedUpiRequests.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="glass-card space-y-4 p-4 sm:p-6"
        >
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Landmark className="h-5 w-5 text-primary" /> Account sharing requests
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Another user added a bank account or UPI ID that's already linked to you. They can't
              withdraw to it until you approve. Reject if you don't recognize the request.
            </p>
          </div>

          {(sharedRequestsLoading || sharedUpiRequestsLoading) &&
          sharedRequests.length === 0 &&
          sharedUpiRequests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-secondary/10 px-4 py-6 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : (
            <ul className="space-y-2">
              {sharedRequests.map((req) => {
                const inFlight = actingRequestId === req.id;
                return (
                  <li
                    key={req.id}
                    className="rounded-xl border border-warning/30 bg-warning/5 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {req.requesterName ?? "Another user"}
                        </p>
                        {req.requesterEmail && (
                          <p className="font-mono text-[11px] text-muted-foreground truncate">
                            {req.requesterEmail}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Wants to withdraw to{" "}
                          <span className="font-mono text-foreground">
                            {req.bankName ? `${req.bankName} · ` : ""}
                            {maskAccountNumber(req.accountNumber)} · {req.ifscCode}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void decideSharedRequest(req, "reject")}
                          disabled={inFlight}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/70 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void decideSharedRequest(req, "approve")}
                          disabled={inFlight}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {sharedUpiRequests.map((req) => {
                const inFlight = actingUpiRequestId === req.id;
                return (
                  <li
                    key={req.id}
                    className="rounded-xl border border-warning/30 bg-warning/5 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {req.requesterName ?? "Another user"}
                        </p>
                        {req.requesterEmail && (
                          <p className="font-mono text-[11px] text-muted-foreground truncate">
                            {req.requesterEmail}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Wants to withdraw to{" "}
                          <span className="font-mono text-foreground break-all">{req.upiId}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void decideSharedUpiRequest(req, "reject")}
                          disabled={inFlight}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/70 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void decideSharedUpiRequest(req, "approve")}
                          disabled={inFlight}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}

      {/* Withdrawal PIN */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        className="glass-card space-y-4 p-4 sm:p-6"
      >
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-primary" /> Withdrawal PIN
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Required to confirm every withdrawal request. We don't store this PIN in any
            recoverable form — write it down or save it in a password manager.
          </p>
        </div>

        {pinStatusLoading ? (
          <p className="rounded-xl border border-dashed border-border bg-secondary/10 px-4 py-4 text-center text-xs text-muted-foreground">
            Checking PIN status…
          </p>
        ) : !pinStatus?.pinSet ? (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">No PIN set yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Set up a 6-digit PIN to enable withdrawals.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                resetPinFields();
                setPinDialog("setup");
              }}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <KeyRound className="h-4 w-4" /> Set up PIN
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              {pinStatus.locked ? (
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              ) : (
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {pinStatus.locked ? "PIN locked" : "PIN is set"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pinStatus.locked
                    ? "Too many wrong attempts. Reset it to keep withdrawing."
                    : "You'll be asked for it each time you submit a withdrawal."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!pinStatus.locked && (
                <button
                  type="button"
                  onClick={() => {
                    resetPinFields();
                    setPinDialog("change");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/70"
                >
                  <KeyRound className="h-4 w-4" /> Change PIN
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  resetPinFields();
                  setResetStage("request");
                  setPinDialog("reset");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/70"
              >
                Forgot PIN
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Setup PIN dialog */}
      <Dialog open={pinDialog === "setup"} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up your withdrawal PIN</DialogTitle>
            <DialogDescription>
              Pick a 6-digit number you'll remember. Save it somewhere safe — we never store this
              PIN in a recoverable form, so we can't tell you what it was if you forget.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <PinInput
              label="New PIN"
              value={pinFields.pin}
              onChange={(v) => setPinFields((f) => ({ ...f, pin: v }))}
            />
            <PinInput
              label="Confirm new PIN"
              value={pinFields.confirmPin}
              onChange={(v) => setPinFields((f) => ({ ...f, confirmPin: v }))}
            />
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                We store only a one-way hash of this PIN. If you forget it, you'll need to reset
                via OTP — there's no recovery copy on our side.
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closePinDialog}
              disabled={pinSubmitting}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSetupPin}
              disabled={pinSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pinSubmitting ? "Setting…" : "Set PIN"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change PIN dialog */}
      <Dialog open={pinDialog === "change"} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change withdrawal PIN</DialogTitle>
            <DialogDescription>
              Enter your current PIN and choose a new one. If you've forgotten the current PIN,
              use Forgot PIN instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <PinInput
              label="Current PIN"
              value={pinFields.currentPin}
              onChange={(v) => setPinFields((f) => ({ ...f, currentPin: v }))}
            />
            <PinInput
              label="New PIN"
              value={pinFields.newPin}
              onChange={(v) => setPinFields((f) => ({ ...f, newPin: v }))}
            />
            <PinInput
              label="Confirm new PIN"
              value={pinFields.confirmNewPin}
              onChange={(v) => setPinFields((f) => ({ ...f, confirmNewPin: v }))}
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closePinDialog}
              disabled={pinSubmitting}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleChangePin}
              disabled={pinSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pinSubmitting ? "Updating…" : "Change PIN"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forgot / Reset PIN dialog */}
      <Dialog open={pinDialog === "reset"} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset withdrawal PIN</DialogTitle>
            <DialogDescription>
              {resetStage === "request"
                ? "We'll send a one-time code to your registered SMS or email. Use it to set a fresh PIN."
                : "Enter the OTP we sent and choose a new 6-digit PIN."}
            </DialogDescription>
          </DialogHeader>
          {resetStage === "request" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tap "Send OTP" to receive the code on whichever channel your notification
                preference uses.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">One-time code</span>
                <input
                  inputMode="numeric"
                  value={pinFields.otp}
                  onChange={(e) =>
                    setPinFields((f) => ({ ...f, otp: e.target.value.replace(/\s/g, "") }))
                  }
                  placeholder="Enter the OTP"
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
              <PinInput
                label="New PIN"
                value={pinFields.newPin}
                onChange={(v) => setPinFields((f) => ({ ...f, newPin: v }))}
              />
              <PinInput
                label="Confirm new PIN"
                value={pinFields.confirmNewPin}
                onChange={(v) => setPinFields((f) => ({ ...f, confirmNewPin: v }))}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closePinDialog}
              disabled={pinSubmitting}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            {resetStage === "request" ? (
              <button
                type="button"
                onClick={handleRequestResetOtp}
                disabled={pinSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {pinSubmitting ? "Sending…" : "Send OTP"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={pinSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {pinSubmitting ? "Resetting…" : "Reset PIN"}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support tickets */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-card space-y-4 p-4 sm:p-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" /> Support tickets
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Hit a problem? Raise a ticket and our support team will pick it up.
            </p>
          </div>
          {!showTicketForm && (
            <button
              type="button"
              onClick={() => setShowTicketForm(true)}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Raise a ticket
            </button>
          )}
        </div>

        {showTicketForm && (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="e.g. Withdrawal stuck"
                maxLength={140}
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ticketTitle.trim().length}/140 — 3 characters minimum
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Describe the issue</label>
              <textarea
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="Steps to reproduce, what you expected vs what happened, transaction IDs, etc."
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ticketDescription.trim().length}/4000 — 10 characters minimum
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetTicketForm}
                disabled={submittingTicket}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm hover:bg-secondary/70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTicket}
                disabled={submittingTicket}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submittingTicket ? "Submitting…" : "Submit ticket"}
              </button>
            </div>
          </div>
        )}

        {ticketsLoading ? (
          <p className="rounded-xl border border-dashed border-border bg-secondary/10 px-4 py-6 text-center text-xs text-muted-foreground">
            Loading…
          </p>
        ) : myTickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/10 px-4 py-6 text-center">
            <p className="text-sm font-medium">No tickets yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When you raise one, it'll appear here so you can track its progress.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {myTickets.map((t) => {
              const status = ticketStatusLabel(t);
              return (
                <li
                  key={t.id}
                  className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" title={t.title}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Raised {formatIst(t.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {t.assignee && t.resolutionStatus === "pending" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Being looked at by{" "}
                      <span className="text-foreground">{t.assignee.fullName}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Withdrawal disputes — raised from the withdrawal flow; surfaced here
            so the user can track them alongside support tickets. */}
        {!disputesLoading && myDisputes.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Withdrawal disputes
            </p>
            <ul className="space-y-2">
              {myDisputes.map((d) => {
                const resolved = d.resolutionStatus === "resolved";
                return (
                  <li
                    key={d.id}
                    className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{DISPUTE_REASON_LABEL[d.reason]}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {d.amount != null
                            ? `₹${d.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · `
                            : ""}
                          Raised {formatIst(d.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          resolved ? "badge-success" : "badge-pending"
                        }`}
                      >
                        {resolved ? "Resolved" : "Pending"}
                      </span>
                    </div>
                    {d.assignee && !resolved && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Being looked at by{" "}
                        <span className="text-foreground">{d.assignee.fullName}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="glass-card space-y-4 p-4 sm:p-6"
      >
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Notifications
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            We'll let you know when a deposit is credited, a withdrawal is submitted, approved or
            rejected, and when your support tickets are received or resolved. Choose where to
            receive these alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: "sms" as const,
                label: "Text message (SMS)",
                description: "Sent to your registered mobile number.",
                Icon: Smartphone,
              },
              {
                value: "email" as const,
                label: "Email",
                description: "Sent to your registered email address.",
                Icon: Mail,
              },
            ]
          ).map(({ value, label, description, Icon }) => {
            const selected = notificationChannel === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => changeNotificationChannel(value)}
                disabled={notificationLoading || savingNotification}
                aria-pressed={selected}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-secondary/40 hover:bg-secondary/60"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    selected ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    {selected && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {notificationLoading ? (
          <p className="text-[11px] text-muted-foreground">Loading your preference…</p>
        ) : savingNotification ? (
          <p className="text-[11px] text-muted-foreground">Saving…</p>
        ) : null}
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card space-y-4 p-4 sm:p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Security</h3>
        <div className="border-b border-border py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">Use at least 8 characters</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordForm((v) => !v)}
              className="self-start text-sm text-primary hover:underline sm:self-auto"
            >
              {showPasswordForm ? "Cancel" : "Change"}
            </button>
          </div>
          {showPasswordForm && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-2 w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-2 w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-2 w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <PasswordRequirements
                password={newPassword}
                name={name || profile?.name}
                email={email || profile?.email}
                className="mt-2"
              />

              <button
                onClick={savePassword}
                disabled={
                  savingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword ||
                  !checkPasswordRequirements(newPassword, {
                    name: name || profile?.name,
                    email: email || profile?.email,
                  }).isValid
                }
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </button>
            </div>
          )}
        </div>
        <div className="py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Shield className={`h-4 w-4 ${twoFa?.twoFactorVerified ? "text-success" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Account verification (SMS/email)</p>
                <p className="text-xs text-muted-foreground">
                  {twoFa?.twoFactorVerified
                    ? twoFa.twoFactorMethod === "phone"
                      ? `Verified via mobile ${twoFa.phone || ""}`.trim()
                      : twoFa.twoFactorMethod === "email"
                      ? `Verified via email ${twoFa.email || ""}`.trim()
                      : "Verified"
                    : "Verify via mobile (SMS) to secure your account"}
                </p>
              </div>
            </div>
            {twoFa?.twoFactorVerified ? (
              <span className="badge-success w-fit rounded-full px-2.5 py-1 text-xs font-medium">Enabled</span>
            ) : (
              <button
                type="button"
                onClick={() => requestReverify()}
                className="self-start rounded-md border border-border bg-secondary px-3 py-2 text-sm transition-colors hover:bg-secondary/80 sm:self-auto sm:py-1"
              >
                Verify now
              </button>
            )}
          </div>
        </div>
        <TotpSettingsCard />
      </motion.div>
    </div>
  );
};

interface PinInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function PinInput({ label, value, onChange }: PinInputProps) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </label>
  );
}

export default UserProfile;
