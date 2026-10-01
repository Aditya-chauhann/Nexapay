import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { defaultRedirectForUser } from "@/lib/admin-access";
import { readPendingVerificationUserId, readSessionUserId, readAccounts } from "@/lib/auth-storage";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const { user, verifyEmail, resendVerificationEmail, logout } = useAuth();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const email =
    user?.email ??
    (() => {
      const id = readPendingVerificationUserId() ?? readSessionUserId();
      if (!id) return "";
      return readAccounts().find((a) => a.id === id)?.email ?? "";
    })();

  useEffect(() => {
    const id = readPendingVerificationUserId() ?? readSessionUserId();
    if (!id && !user) {
      navigate("/auth/login", { replace: true });
      return;
    }
    if (user?.emailVerified) {
      navigate(defaultRedirectForUser(user), { replace: true });
    }
  }, [user, navigate]);

  const handleComplete = async (code: string) => {
    setSubmitting(true);
    const res = await verifyEmail(code);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Verification failed");
      setValue("");
      return;
    }
    toast.success("Email verified");
    navigate("/user", { replace: true });
  };

  return (
    <AuthLayout
      title="Verify your email"
      description={email ? `Enter the 6-digit code sent to ${email}` : "Enter the code we sent to your email."}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card space-y-6 p-6">
        <div className="flex flex-col items-center gap-4">
          <InputOTP
            maxLength={6}
            value={value}
            onChange={(v) => setValue(v)}
            onComplete={handleComplete}
            disabled={submitting}
            containerClassName="gap-2"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-12 w-10 sm:h-14 sm:w-11" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={submitting || value.length !== 6}
            onClick={() => handleComplete(value)}
          >
            {submitting ? "Checking…" : "Verify"}
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 text-center text-sm">
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={async () => {
              const res = await resendVerificationEmail();
              if (!res.ok) toast.error(res.message ?? "Could not resend");
            }}
          >
            Resend code
          </button>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => logout()}>
            Sign out and use a different email
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Demo: the code appears in an on-screen toast after registration. Codes expire after 15 minutes.
        </p>
      </motion.div>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/auth/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default VerifyEmail;
