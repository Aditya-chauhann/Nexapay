import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PinField } from "@/components/auth/PinField";
import { useAuth } from "@/contexts/AuthContext";
import { weakPinReason } from "@/lib/admin-pin-rules";
import {
  AdminPinError,
  changeAdminPin,
  confirmAdminPinReset,
  getAdminPinStatus,
  requestAdminPinReset,
  storeUnlockedToken,
  type AdminPinStatus,
} from "@/lib/api-admin-pin";

/**
 * Manage the super admin console login PIN from Settings → Account Security.
 *
 * Two paths: change it (needs the current PIN) or, if it has been forgotten,
 * reset it with a code emailed to the account. The reset path returns a fresh
 * token, which is stored so the current session stays unlocked afterwards.
 *
 * Renders nothing for non-super-admin staff — they have no console PIN.
 */
export function AdminPinSettingsCard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin === true;

  const [status, setStatus] = useState<AdminPinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"idle" | "change" | "reset">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otp, setOtp] = useState("");

  const resetFields = useCallback(() => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setOtp("");
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getAdminPinStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [isSuperAdmin, refresh]);

  const handleApiError = (err: unknown, fallback: string) => {
    if (err instanceof AdminPinError) {
      setError(err.message);
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  };

  const validateNewPin = (): boolean => {
    if (newPin.length !== 6 || confirmPin.length !== 6) {
      setError("Enter and confirm all 6 digits of your new PIN.");
      return false;
    }
    if (newPin !== confirmPin) {
      setError("The two PINs do not match.");
      return false;
    }
    const weak = weakPinReason(newPin);
    if (weak) {
      setError(weak);
      return false;
    }
    return true;
  };

  const submitChange = async () => {
    setError(null);
    if (currentPin.length !== 6) {
      setError("Enter your current 6-digit PIN.");
      return;
    }
    if (!validateNewPin()) return;

    setSubmitting(true);
    try {
      await changeAdminPin(currentPin, newPin, confirmPin);
      resetFields();
      setMode("idle");
      await refresh();
      toast.success("Admin login PIN updated");
    } catch (err) {
      handleApiError(err, "Could not change your PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  const startReset = async () => {
    setRequestingOtp(true);
    setError(null);
    try {
      const res = await requestAdminPinReset();
      resetFields();
      setResetSentTo(res.email);
      setMode("reset");
      toast.success(`Reset code sent to ${res.email}`);
    } catch (err) {
      handleApiError(err, "Could not send a reset code.");
    } finally {
      setRequestingOtp(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (!validateNewPin()) return;

    setSubmitting(true);
    try {
      // Returns a replacement token — the reset rotates the unlocked session.
      storeUnlockedToken(await confirmAdminPinReset(otp, newPin, confirmPin));
      resetFields();
      setResetSentTo(null);
      setMode("idle");
      await refresh();
      toast.success("Admin login PIN reset");
    } catch (err) {
      handleApiError(err, "Could not reset your PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuperAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading login PIN…
      </div>
    );
  }

  return (
    <div className="border-t border-border py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <KeyRound
            className={`mt-0.5 h-4 w-4 ${status?.pinSet ? "text-success" : "text-muted-foreground"}`}
          />
          <div>
            <p className="text-sm font-medium">Admin login PIN</p>
            <p className="text-xs text-muted-foreground">
              {status?.pinSet
                ? `A 6-digit PIN unlocks the console at sign-in, and again after ${status.idleTimeoutMinutes} minutes of inactivity.`
                : "No PIN set yet — you'll be asked to create one the next time you sign in."}
            </p>
          </div>
        </div>
        {status?.pinSet && mode === "idle" ? (
          <span className="badge-success w-fit rounded-full px-2.5 py-1 text-xs font-medium">
            Active
          </span>
        ) : null}
      </div>

      {mode === "idle" && status?.pinSet ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              resetFields();
              setMode("change");
            }}
          >
            Change PIN
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void startReset()}
            disabled={requestingOtp}
          >
            {requestingOtp ? "Sending code…" : "Forgot PIN? Email a reset code"}
          </Button>
        </div>
      ) : null}

      {mode === "change" ? (
        <div className="mt-4 max-w-sm space-y-3">
          <PinField
            label="Current PIN"
            value={currentPin}
            onChange={(v) => {
              setCurrentPin(v);
              if (error) setError(null);
            }}
            onEnter={() => void submitChange()}
            invalid={Boolean(error)}
            disabled={submitting}
            autoFocus
          />
          <PinField
            label="New PIN"
            value={newPin}
            onChange={(v) => {
              setNewPin(v);
              if (error) setError(null);
            }}
            onEnter={() => void submitChange()}
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
            onEnter={() => void submitChange()}
            invalid={Boolean(error)}
            disabled={submitting}
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Avoid repeated or sequential digits.{" "}
              <button
                type="button"
                onClick={() => void startReset()}
                disabled={requestingOtp}
                className="text-primary hover:underline disabled:opacity-60"
              >
                {requestingOtp ? "Sending…" : "Forgot your current PIN?"}
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                resetFields();
                setMode("idle");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitChange()}
              disabled={
                submitting ||
                currentPin.length !== 6 ||
                newPin.length !== 6 ||
                confirmPin.length !== 6
              }
            >
              {submitting ? "Updating…" : "Update PIN"}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reset" ? (
        <div className="mt-4 max-w-sm space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-mono text-foreground">{resetSentTo ?? "your email"}</span>,
            then choose a new PIN. The code expires in 10 minutes.
          </p>
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
            value={newPin}
            onChange={(v) => {
              setNewPin(v);
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
              Didn't get it?{" "}
              <button
                type="button"
                onClick={() => void startReset()}
                disabled={requestingOtp}
                className="text-primary hover:underline disabled:opacity-60"
              >
                {requestingOtp ? "Sending…" : "Resend code"}
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                resetFields();
                setResetSentTo(null);
                setMode("idle");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitReset()}
              disabled={
                submitting ||
                otp.length !== 6 ||
                newPin.length !== 6 ||
                confirmPin.length !== 6
              }
            >
              {submitting ? "Resetting…" : "Set new PIN"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
