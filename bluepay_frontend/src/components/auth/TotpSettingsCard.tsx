import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  disableTotp,
  enableTotp,
  getTotpStatus,
  setupTotp,
  type TotpSetupResult,
  type TotpStatus,
} from "@/lib/api-totp";

type Step = "idle" | "setup" | "disable";

export function TotpSettingsCard() {
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [setupData, setSetupData] = useState<TotpSetupResult | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getTotpStatus();
      setStatus(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load authenticator status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStartSetup = async () => {
    setSubmitting(true);
    try {
      const data = await setupTotp();
      setSetupData(data);
      setSetupCode("");
      setStep("setup");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start setup");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnable = async () => {
    if (!setupData || setupCode.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setSubmitting(true);
    try {
      const next = await enableTotp(setupData.secret, setupCode);
      setStatus(next);
      setStep("idle");
      setSetupData(null);
      setSetupCode("");
      toast.success("Google Authenticator enabled for login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enable authenticator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword.trim()) {
      toast.error("Enter your password");
      return;
    }
    if (disableCode.length !== 6) {
      toast.error("Enter the 6-digit authenticator code");
      return;
    }
    setSubmitting(true);
    try {
      const next = await disableTotp(disablePassword, disableCode);
      setStatus(next);
      setStep("idle");
      setDisablePassword("");
      setDisableCode("");
      toast.success("Google Authenticator disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable authenticator");
    } finally {
      setSubmitting(false);
    }
  };

  const copySecret = async () => {
    if (!setupData?.secret) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy secret");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading login security…
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className={`mt-0.5 h-4 w-4 ${status?.totpEnabled ? "text-success" : "text-muted-foreground"}`}
          />
          <div>
            <p className="text-sm font-medium">Google Authenticator (login)</p>
            <p className="text-xs text-muted-foreground">
              {status?.totpEnabled
                ? "A 6-digit code is required each time you sign in."
                : "Optional extra step at sign-in using Google Authenticator or any TOTP app."}
            </p>
          </div>
        </div>
        {status?.totpEnabled && step === "idle" ? (
          <span className="badge-success w-fit rounded-full px-2.5 py-1 text-xs font-medium">Enabled</span>
        ) : null}
      </div>

      {step === "idle" && !status?.totpEnabled ? (
        <div className="mt-4">
          <Button type="button" variant="secondary" size="sm" onClick={handleStartSetup} disabled={submitting}>
            {submitting ? "Starting…" : "Enable Google Authenticator"}
          </Button>
        </div>
      ) : null}

      {step === "idle" && status?.totpEnabled ? (
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => setStep("disable")}>
            Disable
          </Button>
        </div>
      ) : null}

      {step === "setup" && setupData ? (
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with Google Authenticator, then enter the 6-digit code to confirm.
          </p>
          <div className="flex justify-center">
            <img src={setupData.qrDataUrl} alt="Authenticator QR code" className="h-40 w-40 rounded-md bg-white p-2" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Manual entry key</Label>
            <div className="flex gap-2">
              <Input readOnly value={setupData.secret} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copySecret} aria-label="Copy secret">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={setupCode} onChange={setSetupCode} disabled={submitting}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleEnable} disabled={submitting || setupCode.length !== 6}>
              {submitting ? "Enabling…" : "Confirm and enable"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("idle");
                setSetupData(null);
                setSetupCode("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {step === "disable" ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground">
            Enter your password and a current authenticator code to disable login verification.
          </p>
          <div className="space-y-2">
            <Label htmlFor="totp-disable-password">Password</Label>
            <Input
              id="totp-disable-password"
              type="password"
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={disableCode} onChange={setDisableCode} disabled={submitting}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="destructive" onClick={handleDisable} disabled={submitting}>
              {submitting ? "Disabling…" : "Disable authenticator"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("idle");
                setDisablePassword("");
                setDisableCode("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
