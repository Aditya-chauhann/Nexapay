import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  AdminPinError,
  confirmAdminPinReset,
  getAdminPinStatus,
  lockAdminPin,
  requestAdminPinReset,
  setAdminPin,
  storeUnlockedToken,
  verifyAdminPin,
  type AdminPinStatus,
  type AdminPinUnlock,
} from "@/lib/api-admin-pin";
import { installPinLockInterceptor, onPinRequired } from "@/lib/admin-pin-lock";
import { LockedConsolePreview } from "@/components/auth/LockedConsolePreview";
import { PinField } from "@/components/auth/PinField";
import { weakPinReason } from "@/lib/admin-pin-rules";

/**
 * Blocks the entire admin console for super admins until they enter their
 * 6-digit login PIN — or generate one, if they never have.
 *
 * The gate does not merely overlay the console: while locked it refuses to
 * render `children` at all, so no admin page mounts and no admin data is
 * fetched behind it. The backend enforces the same rule independently
 * (PermissionsGuard → PIN_REQUIRED), so this is UX, not the security boundary.
 */

type Phase = "loading" | "error" | "setup" | "enter" | "reset" | "unlocked";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
];

function formatLockCountdown(lockedUntil: string | null): string | null {
  if (!lockedUntil) return null;
  const remainingMs = new Date(lockedUntil).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  const minutes = Math.ceil(remainingMs / 60000);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * The locked screen: a blurred, inert preview of the console with the PIN
 * dialog on top, so it reads as "your console, behind glass" rather than a
 * blank page. The preview is decorative only — see LockedConsolePreview.
 */
function LockedBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background">
      {/* `isolate` traps the sidebar's z-40 in its own stacking context, so the
          scrim below still paints over it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 isolate select-none">
        <LockedConsolePreview />
      </div>
      {/* Frosted scrim — same treatment the app's modals use over the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-background/55 backdrop-blur-sm"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function SuperAdminPinGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // Super admins come in two flavours — a staff account with `isSuperAdmin`,
  // and a customer account with role `super_admin`; /admin/auth/login signs in
  // both, so both are gated. A first-login temp password is settled first
  // (MandatoryChangePasswordModal), matching the backend's check order.
  const gateApplies =
    user?.isSuperAdmin === true && user.mustChangePassword !== true;

  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<AdminPinStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Entry / setup fields
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  // Reset-by-email fields
  const [otp, setOtp] = useState("");
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const idleMinutes = status?.idleTimeoutMinutes ?? 15;
  const lockCountdown = formatLockCountdown(status?.lockedUntil ?? null);

  const clearFields = useCallback(() => {
    setPin("");
    setConfirmPin("");
    setOtp("");
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const next = await getAdminPinStatus();
      setStatus(next);
      if (next.verified) setPhase("unlocked");
      else setPhase(next.pinSet ? "enter" : "setup");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not check your PIN status.",
      );
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    installPinLockInterceptor();
  }, []);

  useEffect(() => {
    if (!gateApplies) return;
    void refresh();
  }, [gateApplies, refresh]);

  const applyUnlock = useCallback(
    (unlock: AdminPinUnlock, message: string) => {
      storeUnlockedToken(unlock);
      setStatus((prev) =>
        prev
          ? { ...prev, pinSet: true, verified: true, locked: false, lockedUntil: null }
          : {
              pinSet: true,
              verified: true,
              locked: false,
              lockedUntil: null,
              attemptsRemaining: 5,
              idleTimeoutMinutes: unlock.idleTimeoutMinutes,
            },
      );
      clearFields();
      setResetSentTo(null);
      setPhase("unlocked");
      toast.success(message);
    },
    [clearFields],
  );

  const relock = useCallback(
    (reason: "idle" | "server") => {
      clearFields();
      setResetSentTo(null);
      setStatus((prev) => (prev ? { ...prev, verified: false } : prev));
      setPhase((prev) => (prev === "unlocked" ? "enter" : prev));
      if (reason === "idle") {
        toast.message("Console locked", {
          description: `You were inactive for ${idleMinutes} minutes. Enter your PIN to continue.`,
        });
      }
    },
    [clearFields, idleMinutes],
  );

  // The backend re-locks on its own (idle timeout, lock from another tab); any
  // admin request that comes back PIN_REQUIRED drops us back to the gate.
  useEffect(() => {
    if (!gateApplies) return;
    return onPinRequired((reason) => {
      setPhase((prev) => {
        if (prev === "reset") return prev;
        return reason === "PIN_SETUP_REQUIRED" ? "setup" : "enter";
      });
      setStatus((prev) => (prev ? { ...prev, verified: false } : prev));
    });
  }, [gateApplies]);

  // Client-side idle timer, mirroring the server's window so the modal appears
  // the moment the session goes stale rather than on the next API call.
  const lastActivityRef = useRef(Date.now());
  useEffect(() => {
    if (phase !== "unlocked") return;

    lastActivityRef.current = Date.now();
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const idleMs = idleMinutes * 60 * 1000;
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current < idleMs) return;
      void lockAdminPin();
      relock("idle");
    }, 15_000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      window.clearInterval(interval);
    };
  }, [phase, idleMinutes, relock]);

  // Clear the lockout banner (and re-enable the keypad) once it expires,
  // without the super admin having to reload.
  useEffect(() => {
    if (!status?.locked || !status.lockedUntil) return;
    const remainingMs = new Date(status.lockedUntil).getTime() - Date.now();
    const timer = window.setTimeout(
      () =>
        setStatus((prev) =>
          prev ? { ...prev, locked: false, lockedUntil: null, attemptsRemaining: 5 } : prev,
        ),
      Math.min(Math.max(remainingMs + 1000, 0), 60_000),
    );
    return () => window.clearTimeout(timer);
  }, [status?.locked, status?.lockedUntil]);

  const handleApiError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof AdminPinError) {
      setError(err.message);
      if (err.code === "PIN_LOCKED") {
        setStatus((prev) =>
          prev
            ? { ...prev, locked: true, lockedUntil: err.lockedUntil, attemptsRemaining: 0 }
            : prev,
        );
      } else if (typeof err.attemptsRemaining === "number") {
        setStatus((prev) =>
          prev ? { ...prev, attemptsRemaining: err.attemptsRemaining! } : prev,
        );
      }
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }, []);

  const submitSetup = useCallback(async () => {
    setError(null);
    if (pin.length !== 6 || confirmPin.length !== 6) {
      setError("Enter and confirm all 6 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("The two PINs do not match.");
      return;
    }
    const weak = weakPinReason(pin);
    if (weak) {
      setError(weak);
      return;
    }
    setSubmitting(true);
    try {
      const unlock = await setAdminPin(pin, confirmPin);
      applyUnlock(unlock, "PIN created. Admin console unlocked.");
    } catch (err) {
      handleApiError(err, "Could not create your PIN.");
    } finally {
      setSubmitting(false);
    }
  }, [pin, confirmPin, applyUnlock, handleApiError]);

  const submitVerify = useCallback(async () => {
    setError(null);
    if (pin.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setSubmitting(true);
    try {
      const unlock = await verifyAdminPin(pin);
      applyUnlock(unlock, "Admin console unlocked.");
    } catch (err) {
      setPin("");
      handleApiError(err, "Could not verify your PIN.");
    } finally {
      setSubmitting(false);
    }
  }, [pin, applyUnlock, handleApiError]);

  const startReset = useCallback(async () => {
    setRequestingOtp(true);
    setError(null);
    try {
      const res = await requestAdminPinReset();
      setResetSentTo(res.email);
      clearFields();
      setPhase("reset");
      toast.success(`Reset code sent to ${res.email}`);
    } catch (err) {
      handleApiError(err, "Could not send a reset code.");
    } finally {
      setRequestingOtp(false);
    }
  }, [clearFields, handleApiError]);

  const submitReset = useCallback(async () => {
    setError(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (pin.length !== 6 || confirmPin.length !== 6) {
      setError("Enter and confirm all 6 digits of your new PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setError("The two PINs do not match.");
      return;
    }
    const weak = weakPinReason(pin);
    if (weak) {
      setError(weak);
      return;
    }
    setSubmitting(true);
    try {
      const unlock = await confirmAdminPinReset(otp, pin, confirmPin);
      applyUnlock(unlock, "PIN reset. Admin console unlocked.");
    } catch (err) {
      handleApiError(err, "Could not reset your PIN.");
    } finally {
      setSubmitting(false);
    }
  }, [otp, pin, confirmPin, applyUnlock, handleApiError]);

  const signOut = useCallback(() => {
    void lockAdminPin();
    logout();
    navigate("/core-control/signin", { replace: true });
  }, [logout, navigate]);

  const copy = useMemo(() => {
    switch (phase) {
      case "setup":
        return {
          title: "Create your admin PIN",
          description:
            "Super admin accounts are protected by a 6-digit PIN. Create one now — the console stays locked until you do.",
        };
      case "reset":
        return {
          title: "Reset your admin PIN",
          description: resetSentTo
            ? `Enter the 6-digit code sent to ${resetSentTo}, then choose a new PIN.`
            : "Enter the code from your email, then choose a new PIN.",
        };
      case "error":
        return {
          title: "Couldn't check your PIN",
          description: "We couldn't reach the server to check your admin PIN.",
        };
      default:
        return {
          title: "Enter your admin PIN",
          description:
            "Unlock the admin console with the 6-digit PIN you set up earlier.",
        };
    }
  }, [phase, resetSentTo]);

  if (!gateApplies) return <>{children}</>;
  if (phase === "unlocked") return <>{children}</>;

  if (phase === "loading") {
    return (
      <LockedBackdrop>
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
        </div>
      </LockedBackdrop>
    );
  }

  const secondaryBtn =
    "rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50";
  const primaryBtn =
    "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

  return (
    <LockedBackdrop>
      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-sm [&>button]:hidden"
          // The frosted scrim below already dims the page; the default
          // bg-black/80 overlay on top would hide the console preview entirely.
          overlayClassName="bg-transparent"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {phase === "error" ? (
            <>
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
              <DialogFooter className="gap-2">
                <button type="button" onClick={signOut} className={secondaryBtn}>
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className={primaryBtn}
                >
                  Try again
                </button>
              </DialogFooter>
            </>
          ) : null}

          {phase === "setup" ? (
            <>
              <div className="space-y-3">
                <PinField
                  label="New PIN"
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    if (error) setError(null);
                  }}
                  onEnter={() => void submitSetup()}
                  invalid={Boolean(error)}
                  disabled={submitting}
                  autoFocus
                />
                <PinField
                  label="Confirm PIN"
                  value={confirmPin}
                  onChange={(v) => {
                    setConfirmPin(v);
                    if (error) setError(null);
                  }}
                  onEnter={() => void submitSetup()}
                  invalid={Boolean(error)}
                  disabled={submitting}
                />
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Avoid repeated or sequential digits. You'll enter this PIN every time
                    you sign in, and again after {idleMinutes} minutes of inactivity.
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={signOut}
                  disabled={submitting}
                  className={secondaryBtn}
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => void submitSetup()}
                  disabled={submitting || pin.length !== 6 || confirmPin.length !== 6}
                  className={primaryBtn}
                >
                  {submitting ? "Creating…" : "Create PIN and unlock"}
                </button>
              </DialogFooter>
            </>
          ) : null}

          {phase === "enter" ? (
            <>
              <div className="space-y-3">
                <PinField
                  label="PIN"
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    if (error) setError(null);
                  }}
                  onEnter={() => void submitVerify()}
                  invalid={Boolean(error) || status?.locked === true}
                  disabled={submitting || status?.locked === true}
                  autoFocus
                />
                {status?.locked ? (
                  <p className="text-xs text-destructive">
                    Too many incorrect PINs.{" "}
                    {lockCountdown
                      ? `Try again in ${lockCountdown}, or reset your PIN by email.`
                      : "Reset your PIN by email to regain access."}
                  </p>
                ) : error ? (
                  <p className="text-xs text-destructive">
                    {error}
                    {typeof status?.attemptsRemaining === "number" &&
                    status.attemptsRemaining > 0 ? (
                      <>
                        {" "}
                        {status.attemptsRemaining} attempt
                        {status.attemptsRemaining === 1 ? "" : "s"} left.
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    The console locks again after {idleMinutes} minutes of inactivity.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Forgot it?{" "}
                  <button
                    type="button"
                    onClick={() => void startReset()}
                    disabled={requestingOtp}
                    className="text-primary hover:underline disabled:opacity-60"
                  >
                    {requestingOtp ? "Sending code…" : "Email me a reset code"}
                  </button>
                  .
                </p>
              </div>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={signOut}
                  disabled={submitting}
                  className={secondaryBtn}
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => void submitVerify()}
                  disabled={submitting || pin.length !== 6 || status?.locked === true}
                  className={primaryBtn}
                >
                  {submitting ? "Unlocking…" : "Unlock console"}
                </button>
              </DialogFooter>
            </>
          ) : null}

          {phase === "reset" ? (
            <>
              <div className="space-y-3">
                <PinField
                  label="Email code"
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    if (error) setError(null);
                  }}
                  onEnter={() => void submitReset()}
                  invalid={Boolean(error)}
                  disabled={submitting}
                  masked={false}
                  autoFocus
                />
                <PinField
                  label="New PIN"
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    if (error) setError(null);
                  }}
                  onEnter={() => void submitReset()}
                  invalid={Boolean(error)}
                  disabled={submitting}
                />
                <PinField
                  label="Confirm new PIN"
                  value={confirmPin}
                  onChange={(v) => {
                    setConfirmPin(v);
                    if (error) setError(null);
                  }}
                  onEnter={() => void submitReset()}
                  invalid={Boolean(error)}
                  disabled={submitting}
                />
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    The code expires in 10 minutes.{" "}
                    <button
                      type="button"
                      onClick={() => void startReset()}
                      disabled={requestingOtp}
                      className="text-primary hover:underline disabled:opacity-60"
                    >
                      {requestingOtp ? "Sending…" : "Resend code"}
                    </button>
                    .
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearFields();
                    setPhase("enter");
                  }}
                  disabled={submitting}
                  className={secondaryBtn}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void submitReset()}
                  disabled={
                    submitting ||
                    otp.length !== 6 ||
                    pin.length !== 6 ||
                    confirmPin.length !== 6
                  }
                  className={primaryBtn}
                >
                  {submitting ? "Resetting…" : "Set new PIN and unlock"}
                </button>
              </DialogFooter>
            </>
          ) : null}

          {user?.email || user?.username ? (
            <p className="text-[11px] text-muted-foreground">
              Signed in as{" "}
              <span className="font-mono text-foreground">
                {user.email ?? user.username}
              </span>
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </LockedBackdrop>
  );
}
