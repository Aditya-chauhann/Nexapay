import { useState } from "react";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { completeLoginWithTotp } from "@/lib/api-totp";

interface Props {
  loginChallenge: string;
  accountLabel: string;
  onBack: () => void;
  onSuccess: (body: Record<string, unknown>) => void;
}

export function TotpLoginStep({ loginChallenge, accountLabel, onBack, onSuccess }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setSubmitting(true);
    try {
      const body = await completeLoginWithTotp(loginChallenge, code);
      onSuccess(body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Authenticator verification</p>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code for {accountLabel}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode} disabled={submitting}>
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

        <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify and sign in"
          )}
        </Button>
      </form>

      <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={submitting}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to sign in
      </Button>
    </div>
  );
}
