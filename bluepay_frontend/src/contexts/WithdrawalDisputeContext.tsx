import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Clock, FileText, Loader2, ShieldAlert, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-base";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createWithdrawalDispute,
  WithdrawalDisputeError,
  type DisputeReason,
} from "@/lib/api-withdrawal-disputes";
import { confirmWithdrawalReceived, WithdrawalError } from "@/lib/api-withdrawals";
import { useAuth } from "@/contexts/AuthContext";
import { connectSocket, disconnectSocket } from "@/lib/socket";

const STORAGE_KEY = "trusto_pending_disputes_v2";
const STORAGE_DISMISSED_KEY = "trusto_dismissed_dispute_modals_v1";
const API_TOKEN_KEY = "TrustO_api_token_v1";
const PAYMENT_INITIATED_EVENT = "withdrawal:payment_initiated";
const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;

interface PaymentInitiatedPayload {
  withdrawalId: string;
  amount: number;
  netInr: number | null;
  method: "upi";
  upiId: string | null;
  utr: string | null;
  paymentProofUrl: string | null;
  disputeWindowExpiresAt: string;
}

export interface PendingDispute {
  withdrawalId: string;
  amount: number;
  netInr: number | null;
  upiId: string | null;
  utr: string | null;
  paymentProofUrl: string | null;
  expiresAt: number;
  hasPastDispute?: boolean;
}

function isValidPending(v: unknown): v is PendingDispute {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.withdrawalId === "string" &&
    typeof r.amount === "number" &&
    (r.netInr === null || typeof r.netInr === "number") &&
    (r.upiId === null || typeof r.upiId === "string") &&
    (r.utr === null || typeof r.utr === "string") &&
    (r.paymentProofUrl === null || typeof r.paymentProofUrl === "string") &&
    typeof r.expiresAt === "number"
  );
}

function loadPending(): PendingDispute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(isValidPending) : [];
  } catch {
    return [];
  }
}

function loadDismissedModalIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DISMISSED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function toPending(raw: unknown): PendingDispute | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.withdrawalId === "string" && !p.withdrawalId) return null;
  const expiresAt = typeof p.disputeWindowExpiresAt === "string"
    ? Date.parse(p.disputeWindowExpiresAt)
    : NaN;
  if (!Number.isFinite(expiresAt)) return null;

  const rawInr = p.netInr ?? p.paidInr ?? p.requestedInr ?? p.inrAmount ?? p.grossInr;
  const netInr = typeof rawInr === "number" ? rawInr : null;

  return {
    withdrawalId: p.withdrawalId as string,
    amount: typeof p.amount === "number" ? p.amount : 0,
    netInr,
    upiId: typeof p.upiId === "string" ? p.upiId : null,
    utr: typeof p.utr === "string" ? p.utr : null,
    paymentProofUrl: typeof p.paymentProofUrl === "string" ? p.paymentProofUrl : null,
    expiresAt,
  };
}

const fmtInr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface WithdrawalDisputeContextType {
  pendingDisputes: PendingDispute[];
  openDisputeModal: (withdrawalId: string, details?: Partial<PendingDispute>) => void;
  getPendingDispute: (withdrawalId: string) => PendingDispute | undefined;
}

export const WithdrawalDisputeContext = createContext<WithdrawalDisputeContextType>({
  pendingDisputes: [],
  openDisputeModal: () => { },
  getPendingDispute: () => undefined,
});

export function useWithdrawalDispute() {
  return useContext(WithdrawalDisputeContext);
}

export function WithdrawalDisputeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingDispute[]>(() => loadPending());
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [reason, setReason] = useState<DisputeReason>("not_received");
  const [description, setDescription] = useState("");
  const [bankStatement, setBankStatement] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState<number>(0);
  const [disputeSuccess, setDisputeSuccess] = useState<boolean>(false);
  const [confirming, setConfirming] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);

  const [dismissedModalIds, setDismissedModalIds] = useState<string[]>(() => loadDismissedModalIds());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify(dismissedModalIds));
    } catch {
      // ignore
    }
  }, [dismissedModalIds]);

  const enqueue = useCallback((raw: unknown) => {
    const next = toPending(raw);
    if (!next || next.expiresAt <= Date.now()) return;
    setPending((prev) => {
      if (prev.some((p) => p.withdrawalId === next.withdrawalId)) return prev;
      return [...prev, next];
    });
  }, []);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    const token = localStorage.getItem(API_TOKEN_KEY);
    if (!token) return;
    const socket = connectSocket(token);
    socket.on(PAYMENT_INITIATED_EVENT, enqueue);
    return () => {
      socket.off(PAYMENT_INITIATED_EVENT, enqueue);
    };
  }, [user, enqueue]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem(API_TOKEN_KEY);
    if (!token) return;

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/user/transactions?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!Array.isArray(data)) return;
        const now = Date.now();
        for (const t of data) {
          if (
            t.type === "withdrawal" &&
            t.disputeWindowExpiresAt &&
            !t.userConfirmedAt &&
            !t.disputeRaised &&
            !t.secondDisputeAttempted
          ) {
            const expiresAt = Date.parse(t.disputeWindowExpiresAt);
            if (Number.isFinite(expiresAt) && expiresAt > now) {
              enqueue({
                withdrawalId: t.id,
                amount: typeof t.amount === "number" ? t.amount : 0,
                netInr: typeof t.inrAmount === "number" ? t.inrAmount : null,
                upiId: typeof t.upiId === "string" ? t.upiId : null,
                utr: typeof t.utr === "string" ? t.utr : null,
                paymentProofUrl: typeof t.paymentProofUrl === "string" ? t.paymentProofUrl : null,
                expiresAt,
              });
            }
          }
        }
      })
      .catch(() => { });

    return () => controller.abort();
  }, [user, enqueue]);

  const openDisputeModal = useCallback((withdrawalId: string, details?: Partial<PendingDispute>) => {
    // Re-enable modal if previously closed via X
    setDismissedModalIds((prev) => prev.filter((id) => id !== withdrawalId));

    setPending((prev) => {
      const idx = prev.findIndex((p) => p.withdrawalId === withdrawalId);

      if (idx >= 0) {
        const copy = [...prev];
        const existingExpires = copy[idx].expiresAt;
        const targetExpires =
          existingExpires && existingExpires > Date.now()
            ? existingExpires
            : details?.expiresAt && details.expiresAt > Date.now()
            ? details.expiresAt
            : Date.now() + 600000;

        copy[idx] = {
          ...copy[idx],
          ...details,
          expiresAt: targetExpires,
        };
        const target = copy[idx];
        const rest = copy.filter((_, i) => i !== idx);
        return [target, ...rest];
      }

      if (details) {
        const targetExpires =
          details.expiresAt && details.expiresAt > Date.now()
            ? details.expiresAt
            : Date.now() + 600000;

        const newDispute: PendingDispute = {
          withdrawalId,
          amount: details.amount ?? 0,
          netInr: details.netInr ?? null,
          upiId: details.upiId ?? null,
          utr: details.utr ?? null,
          paymentProofUrl: details.paymentProofUrl ?? null,
          expiresAt: targetExpires,
          hasPastDispute: details.hasPastDispute ?? false,
        };
        return [newDispute, ...prev];
      }
      return prev;
    });
    setIsDisputing(false);
  }, []);

  const getPendingDispute = useCallback(
    (withdrawalId: string) => {
      const now = Date.now();
      return pending.find((p) => p.withdrawalId === withdrawalId && p.expiresAt > now);
    },
    [pending],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch {
      // ignore
    }
  }, [pending]);

  useEffect(() => {
    if (pending.length === 0) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pending.length]);

  useEffect(() => {
    setPending((prev) => {
      const next = prev.filter((p) => p.expiresAt > nowTick || p.hasPastDispute);
      return next.length === prev.length ? prev : next;
    });
  }, [nowTick]);

  const active = useMemo(
    () => pending.find((p) => (p.expiresAt > nowTick || p.hasPastDispute) && !dismissedModalIds.includes(p.withdrawalId)) ?? null,
    [pending, nowTick, dismissedModalIds],
  );

  useEffect(() => {
    const id = active?.withdrawalId ?? null;
    if (id !== shownId) {
      setShownId(id);
      setReason("not_received");
      setDescription("");
      setBankStatement(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSubmitting(false);
      setSubmittingStep(0);
      setDisputeSuccess(false);
      setIsDisputing(false);
    }
  }, [active, shownId]);

  const onPickStatement = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setBankStatement(null);
      return;
    }
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Please upload a PDF file");
      e.target.value = "";
      setBankStatement(null);
      return;
    }
    if (file.size > MAX_STATEMENT_BYTES) {
      toast.error("The PDF must be 10 MB or smaller");
      e.target.value = "";
      setBankStatement(null);
      return;
    }
    setBankStatement(file);
  }, []);

  const dismissActive = useCallback(() => {
    if (!active) return;
    setDismissedModalIds((prev) => [...prev, active.withdrawalId]);
  }, [active]);

  const handleDisputeClick = useCallback(async () => {
    if (!active) return;
    if (active.hasPastDispute) {
      const wId = active.withdrawalId;
      setSubmitting(true);
      try {
        await createWithdrawalDispute({
          withdrawalId: wId,
          reason: "other",
          description: "Second dispute attempt",
        });
      } catch {
        // Backend flags disputeRaised = true in DB
      } finally {
        setSubmitting(false);
      }
      window.dispatchEvent(
        new CustomEvent("withdrawal:disputed", { detail: { withdrawalId: wId } })
      );
      toast.info(
        "Please raise a ticket from the Profile section and support team will contact you shortly.",
        { duration: 6000 }
      );
      dismissActive();
      return;
    }
    // Restart clock to fresh 10 minutes (600,000 ms) for submitting dispute form
    const freshExpires = Date.now() + 600000;
    setPending((prev) =>
      prev.map((p) =>
        p.withdrawalId === active.withdrawalId
          ? { ...p, expiresAt: freshExpires }
          : p
      )
    );
    setIsDisputing(true);
  }, [active, dismissActive]);

  const confirmActive = useCallback(async () => {
    if (!active || confirming || submitting) return;
    setConfirming(true);
    try {
      await confirmWithdrawalReceived(active.withdrawalId);
      toast.success("Thank you for confirming!");
      window.dispatchEvent(
        new CustomEvent("withdrawal:confirmed", { detail: { withdrawalId: active.withdrawalId } })
      );
      setPending((prev) => prev.filter((p) => p.withdrawalId !== active.withdrawalId));
    } catch (err) {
      if (err instanceof WithdrawalError) {
        if (err.code === "DISPUTE_WINDOW_CLOSED") {
          toast.error("The dispute window has closed.");
          setPending((prev) => prev.filter((p) => p.withdrawalId !== active.withdrawalId));
        } else if (err.code === "ALREADY_CONFIRMED") {
          toast.info("You've already confirmed this withdrawal.");
          setPending((prev) => prev.filter((p) => p.withdrawalId !== active.withdrawalId));
        } else {
          toast.error(err.message);
        }
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not confirm payment");
    } finally {
      setConfirming(false);
    }
  }, [active, confirming, submitting]);

  const submitDispute = useCallback(async () => {
    if (!active) return;
    const desc = description.trim();
    if (desc.length < 10 || desc.length > 4000) {
      toast.error("Description must be 10–4000 characters");
      return;
    }
    setSubmitting(true);
    setSubmittingStep(1);

    // Step 1 animation delay
    await new Promise((r) => setTimeout(r, 600));
    setSubmittingStep(2);

    try {
      await createWithdrawalDispute({
        withdrawalId: active.withdrawalId,
        reason,
        description: desc,
        bankStatement,
      });

      setSubmittingStep(3);
      await new Promise((r) => setTimeout(r, 600));

      setDisputeSuccess(true);
      window.dispatchEvent(
        new CustomEvent("withdrawal:disputed", { detail: { withdrawalId: active.withdrawalId } })
      );
    } catch (err) {
      setSubmitting(false);
      setSubmittingStep(0);
      if (err instanceof WithdrawalDisputeError) {
        if (err.code === "WITHDRAWAL_NOT_APPROVED") {
          toast.error("Your withdrawal is still being processed. Please try again once it's approved.");
        } else if (err.code === "DISPUTE_WINDOW_CLOSED") {
          toast.error("The dispute window has closed. Please raise a support ticket from your Profile instead.");
          setPending((prev) => prev.filter((p) => p.withdrawalId !== active.withdrawalId));
        } else if (
          err.code === "DISPUTE_ALREADY_RAISED" ||
          err.code === "RAISE_SUPPORT_TICKET" ||
          err.code === "DISPUTE_LIMIT_REACHED"
        ) {
          toast.info("Please raise a ticket from the Profile section and support team will contact you shortly.", {
            duration: 6000,
          });
          setPending((prev) => prev.filter((p) => p.withdrawalId !== active.withdrawalId));
        } else {
          toast.info(
            err.message || "Please raise a ticket from the Profile section and support team will contact you shortly.",
            { duration: 6000 }
          );
        }
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not raise dispute");
    }
  }, [active, description, reason, bankStatement]);

  const secondsLeft = active ? Math.max(0, Math.ceil((active.expiresAt - nowTick) / 1000)) : 0;
  const mmSs = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const destination = active?.upiId ?? "your UPI ID";

  const contextValue = useMemo(
    () => ({
      pendingDisputes: pending,
      openDisputeModal,
      getPendingDispute,
    }),
    [pending, openDisputeModal, getPendingDispute],
  );

  return (
    <WithdrawalDisputeContext.Provider value={contextValue}>
      {children}

      <Dialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) dismissActive();
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-background text-foreground shadow-2xl overflow-hidden">
          {active && (
            <>
              {disputeSuccess ? (
                /* STUNNING SUCCESS SCREEN */
                <div className="py-6 px-2 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Dispute Complaint Registered!</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Your dispute ticket has been assigned to senior support staff for urgent investigation.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Complaint Status:</span>
                      <span className="font-bold text-emerald-400">Under Review</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Withdrawal Amount:</span>
                      <span className="font-bold text-foreground">
                        ₹{fmtInr(active.netInr && active.netInr > 0 ? active.netInr : active.amount * 95)} ({active.amount} USDT)
                      </span>
                    </div>
                    {active.utr && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reference UTR:</span>
                        <span className="font-bold text-foreground">{active.utr}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDisputeSuccess(false);
                      setSubmitting(false);
                      setPending((prev) => prev.filter((p) => p.withdrawalId !== active.withdrawalId));
                    }}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-semibold text-white transition-all shadow-lg hover:shadow-emerald-600/25"
                  >
                    Got it, Close &amp; Track Ticket
                  </button>
                </div>
              ) : submitting ? (
                /* STUNNING ANIMATED COMPLAINT REGISTRATION LOADER */
                <div className="py-8 px-4 text-center space-y-6 animate-in fade-in duration-300">
                  <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin" />
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                      <ShieldAlert className="h-6 w-6 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground">Registering Dispute Complaint...</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please wait while your complaint and proof documents are securely transmitted.
                    </p>
                  </div>

                  <div className="space-y-3 max-w-xs mx-auto text-left text-xs font-medium border border-border/50 rounded-xl p-3.5 bg-secondary/30">
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${submittingStep >= 1 ? "opacity-100" : "opacity-40"}`}>
                      {submittingStep > 1 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-red-400 animate-spin shrink-0" />
                      )}
                      <span>Uploading bank statement PDF proof...</span>
                    </div>

                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${submittingStep >= 2 ? "opacity-100" : "opacity-40"}`}>
                      {submittingStep > 2 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-red-400 animate-spin shrink-0" />
                      )}
                      <span>Encrypting dispute details &amp; UTR...</span>
                    </div>

                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${submittingStep >= 3 ? "opacity-100" : "opacity-40"}`}>
                      <Loader2 className="h-4 w-4 text-red-400 animate-spin shrink-0" />
                      <span>Filing ticket into support queue...</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* NORMAL DISPUTE FORM */
                <>
                  <DialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                      <ShieldCheck className="h-6 w-6 text-success" />
                    </div>
                    <DialogTitle className="text-center">
                      Withdrawal approved &amp; transferred
                    </DialogTitle>
                    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                        <span className="font-mono text-xl sm:text-2xl font-extrabold text-primary">
                          ₹{fmtInr(active.netInr && active.netInr > 0 ? active.netInr : active.amount * 95)}
                        </span>
                        <span className="text-sm font-semibold text-muted-foreground">•</span>
                        <span className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-400">
                          {active.amount} USDT
                        </span>
                      </div>
                    </div>
                    <DialogDescription className="text-center text-xs sm:text-sm mt-1">
                      Transferred to <span className="font-mono font-semibold text-foreground">{destination}</span>. It should reach you within a few minutes.
                    </DialogDescription>
                  </DialogHeader>

                  {!active.hasPastDispute && !active.secondDisputeAttempted && (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Raise an issue within</span>
                      <span className="font-mono font-semibold text-foreground">{mmSs}</span>
                    </div>
                  )}

                  {isDisputing && (
                    <div className="space-y-3 mt-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">What's the issue?</label>
                        <select
                          value={reason}
                          onChange={(e) => setReason(e.target.value as DisputeReason)}
                          className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="not_received">I didn't receive the money in my bank account</option>
                          <option value="wrong_amount">The amount I received is lower than requested</option>
                          <option value="other">Other issue (e.g., payment proof or UTR issue)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Details / description <span className="text-destructive">*</span>
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          maxLength={4000}
                          placeholder="Explain what happened (e.g., checked bank statement at 3:15 PM, no deposit received for UTR...)"
                          className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {description.trim().length}/4000 characters (min 10)
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Bank statement (PDF, max 10 MB)
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={onPickStatement}
                            className="hidden"
                            id="bank-statement-pdf-input"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {bankStatement ? "Change PDF" : "Upload PDF statement"}
                          </button>
                          {bankStatement && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                              <FileText className="h-3.5 w-3.5 text-primary" />
                              <span className="max-w-[140px] truncate">{bankStatement.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setBankStatement(null);
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="text-muted-foreground hover:text-foreground ml-1"
                                title="Remove attachment"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <DialogFooter className="gap-2 mt-4">
                    {!isDisputing ? (
                      <>
                        <button
                          type="button"
                          onClick={handleDisputeClick}
                          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          Dispute
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirmActive()}
                          disabled={confirming}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {confirming ? "Confirming…" : "Confirm"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsDisputing(false)}
                          className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={submitDispute}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Raise dispute
                        </button>
                      </>
                    )}
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </WithdrawalDisputeContext.Provider>
  );
}
