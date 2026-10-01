import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Zap,
  CheckCircle2,
  QrCode,
  ArrowRight,
  Wallet,
  Ban,
  ArrowDownToLine,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TotpLoginStep } from "@/components/auth/TotpLoginStep";
import { PuzzleCaptcha } from "@/components/auth/PuzzleCaptcha";
import { useAuth } from "@/contexts/AuthContext";
import { canUserAccessPath, defaultRedirectForUser } from "@/lib/admin-access";
import { fetchNewCaptcha } from "@/lib/api-captcha";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const PHONE_REGEX = /^\+[1-9]\d{6,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email or phone number")
    .refine(
      (v) => (v.startsWith("+") ? PHONE_REGEX.test(v) : EMAIL_REGEX.test(v)),
      "Enter a valid email or phone (with country code, e.g. +919876543210)",
    ),
  password: z.string().min(1, "Password is required"),
  captchaAnswer: z.string().trim().min(1, "Please drag the puzzle piece into the matching slot"),
});

type FormValues = z.infer<typeof schema>;

interface TotpChallengeState {
  loginChallenge: string;
  accountLabel: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setApiSession } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [ipBlockedModalOpen, setIpBlockedModalOpen] = useState(false);
  const [ipBlockedUntil, setIpBlockedUntil] = useState<string | null>(null);
  const [totpChallenge, setTotpChallenge] = useState<TotpChallengeState | null>(null);
  const [isCaptchaSolved, setIsCaptchaSolved] = useState(false);
  const [backendCaptcha, setBackendCaptcha] = useState<{ captchaId: string; svg: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "", captchaAnswer: "" },
  });

  const loadBackendCaptcha = useCallback(() => {
    fetchNewCaptcha()
      .then(setBackendCaptcha)
      .catch(() => {
        setBackendCaptcha({
          captchaId: "user-puzzle-" + Math.random().toString(36).substring(2, 10),
          svg: "",
        });
      });
  }, []);

  useEffect(() => {
    document.title = "Sign In | NexaPay";
    loadBackendCaptcha();
  }, [loadBackendCaptcha]);

  const handleCaptchaSolved = () => {
    setIsCaptchaSolved(true);
    setValue("captchaAnswer", "PUZZLE_VERIFIED", { shouldValidate: true });
    toast.success("Puzzle verified securely!");
  };

  const handleCaptchaRefresh = () => {
    setIsCaptchaSolved(false);
    setValue("captchaAnswer", "");
    loadBackendCaptcha();
  };

  const completeLogin = useCallback(
    (body: Record<string, unknown>) => {
      const user = body.user as Record<string, unknown> | undefined;
      if (!body.accessToken || !user) {
        toast.error("Malformed sign in response");
        return;
      }
      setApiSession(user as Parameters<typeof setApiSession>[0], body.accessToken as string);
      toast.success("Welcome back to NexaPay");
      const authUser = {
        id: user.id as string,
        type: "user" as const,
        email: user.email as string,
        name: user.name as string,
        role: "user" as const,
        isSuperAdmin: false,
        permissions: [] as [],
        mustChangePassword: Boolean((user as Record<string, unknown>).mustChangePassword),
        emailVerified: (user.emailVerified as boolean | undefined) ?? true,
      };
      const from = (location.state as { from?: string } | null)?.from;
      const target =
        from && from.startsWith("/") && canUserAccessPath(authUser, from)
          ? from
          : defaultRedirectForUser(authUser);
      navigate(target, { replace: true });
    },
    [location.state, navigate, setApiSession],
  );

  const onSubmit = async (data: FormValues) => {
    if (!isCaptchaSolved) {
      toast.error("Please drag the puzzle piece into the matching slot");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: data.identifier.trim(),
          password: data.password,
          captchaId: backendCaptcha?.captchaId || "puzzle-verified",
          captchaAnswer: "PUZZLE_VERIFIED",
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        const messageText = typeof rawMessage === "string" ? rawMessage : "";
        const code =
          typeof body?.errorCode === "string"
            ? body.errorCode
            : typeof body?.code === "string"
              ? body.code
              : "";

        handleCaptchaRefresh();

        if (response.status === 429) {
          setIpBlockedUntil(body?.blockedUntil || null);
          setIpBlockedModalOpen(true);
          return;
        }

        if (code === "CAPTCHA_INVALID") {
          toast.error(messageText || "Security verification expired. Please solve the puzzle again.");
          return;
        }

        if (response.status === 403) {
          if (code === "ACCOUNT_BLOCKED" || /blocked/i.test(messageText)) {
            setBlockedMessage(messageText || "Your account has been blocked. Please contact support.");
            return;
          }
          setBlockedMessage(messageText || "Sign in unavailable.");
          return;
        }
        toast.error(messageText || "Sign in failed. Check your credentials.");
        return;
      }

      if (body.requiresTotp && body.loginChallenge) {
        const accountLabel =
          (body.user as { email?: string } | undefined)?.email ?? "your account";
        setTotpChallenge({
          loginChallenge: body.loginChallenge as string,
          accountLabel,
        });
        return;
      }

      completeLogin(body as Record<string, unknown>);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network connection error");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#020b1e] text-slate-900 selection:bg-blue-500 selection:text-white relative overflow-x-hidden font-sans">
      {/* ═════════════════════════════════════════════════════════════
          LEFT SPLIT PANEL (48% width): Dark-to-Electric-Blue Customer Hero
      ═════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[48%] relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden bg-gradient-to-br from-[#020b1e] via-[#051c4a] to-[#0a3582] text-white">
        {/* Glow Orbs & Ambient Background */}
        <div className="absolute top-[-10%] left-[-15%] w-[420px] h-[420px] rounded-full bg-blue-600/25 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[5%] right-[-10%] w-[380px] h-[380px] rounded-full bg-sky-500/20 blur-[110px] pointer-events-none" />
        <div className="absolute top-[40%] left-[30%] w-[250px] h-[250px] rounded-full bg-indigo-500/15 blur-[90px] pointer-events-none" />

        {/* Cyber Grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* ── TOP SECTION: NexaPay Brand & Customer Portal Badge ── */}
        <div className="relative z-10 space-y-3">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 p-0.5 shadow-lg shadow-blue-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#05183d] rounded-[14px] flex items-center justify-center group-hover:bg-[#072152] transition-colors">
                <Wallet className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Nexa<span className="text-sky-400">Pay</span>
            </span>
          </Link>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-400/30 text-blue-300 backdrop-blur-md">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>Customer Portal</span>
            </span>
          </div>
        </div>

        {/* ── MIDDLE SECTION: Customer Headline & Highlights ── */}
        <div className="relative z-10 my-8 lg:my-10 space-y-7">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black tracking-tight leading-[1.08] text-white">
              Instant Payouts.
              <br />
              Automated
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-300">
                USDT to INR.
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-blue-100/70 max-w-md leading-relaxed">
              Deposit TRC-20 USDT into your dedicated wallet and receive Indian Rupees directly to your bank account or UPI address instantly. Fully automated.
            </p>
          </div>

          {/* 3 Customer Feature Highlights */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Direct INR Settlement</h4>
                <p className="text-[11px] text-blue-200/60">Automated payout to any Indian bank or UPI within 60s</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Zero Hidden Fees</h4>
                <p className="text-[11px] text-blue-200/60">100% transparent live bank & UPI conversion rates</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Bank-Grade Encryption</h4>
                <p className="text-[11px] text-blue-200/60">Two-factor protection & cold-storage wallet rails</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM SECTION: 3 Translucent Stats ── */}
        <div className="relative z-10 pt-6 border-t border-blue-400/15 grid grid-cols-3 gap-3">
          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-sky-400 flex items-center justify-center text-xs font-bold mb-1">
              ₹
            </div>
            <div className="text-base sm:text-lg font-black text-white">Best Rates</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Live Bank & UPI
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold mb-1">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">&lt; 60s</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Avg. Payout Time
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">100%</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Automated Flow
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          RIGHT SPLIT PANEL (52% width): White / Frosted-Glass Login Card
      ═════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[52%] flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-gradient-to-br from-[#f2f6fe] via-[#edf3fc] to-[#f9fbff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[490px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[28px] p-7 sm:p-9 shadow-2xl shadow-blue-900/10 border border-white/80 dark:border-slate-800"
        >
          {totpChallenge ? (
            <TotpLoginStep
              loginChallenge={totpChallenge.loginChallenge}
              accountLabel={totpChallenge.accountLabel}
              onBack={() => setTotpChallenge(null)}
              onSuccess={(body) => {
                setTotpChallenge(null);
                completeLogin(body);
              }}
            />
          ) : (
            <>
              {/* Card Header: Logo & Titles */}
              <div className="text-center space-y-1.5 pb-6">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white mb-2">
                  <Wallet className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Nexa<span className="text-blue-600">Pay</span>
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white pt-1">
                  Sign in
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Use your email or phone with your password. New users can create an account below.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email or Phone Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="identifier" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email or phone
                  </Label>
                  <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <User className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                    <Input
                      id="identifier"
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="you@example.com or +919876543210"
                      className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-3 py-2.5 h-11 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...register("identifier")}
                    />
                  </div>
                  {errors.identifier ? (
                    <p className="text-[11px] font-medium text-destructive mt-1">
                      {errors.identifier.message}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Phone numbers need a country code (e.g. +91 for India).
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </Label>
                    <Link
                      to="/auth/forgot-password"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <Lock className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-10 py-2.5 h-11 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] font-medium text-destructive mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Visual Sliding Puzzle CAPTCHA */}
                <div className="pt-1">
                  <PuzzleCaptcha
                    isSolved={isCaptchaSolved}
                    onSuccess={handleCaptchaSolved}
                    onRefresh={handleCaptchaRefresh}
                  />
                  {errors.captchaAnswer && (
                    <p className="text-[11px] font-medium text-destructive mt-1">
                      {errors.captchaAnswer.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Verifying session...</span>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </Button>
              </form>

              {/* Navigation Footer */}
              <div className="text-center mt-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  No account?{" "}
                  <Link to="/auth/register" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                    Register
                  </Link>
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── BLOCKED ACCOUNT MODAL ── */}
      <Dialog open={blockedMessage !== null} onOpenChange={(open) => !open && setBlockedMessage(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl border-border bg-background shadow-xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
              <Ban className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Sign in unavailable</DialogTitle>
            <DialogDescription className="text-center">
              {blockedMessage}
              <br />
              <span className="text-xs">If you think this is a mistake, please contact customer support.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="secondary" onClick={() => setBlockedMessage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IP SUSPENDED MODAL ── */}
      <Dialog open={ipBlockedModalOpen} onOpenChange={setIpBlockedModalOpen}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl border-rose-500/20 bg-background text-foreground shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center space-y-3 pt-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 ring-8 ring-rose-500/5 animate-pulse">
              <Ban className="h-7 w-7" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Access Suspended
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-sm mx-auto space-y-3">
              <p>Your IP address has been frozen/blocked for security reasons.</p>
              {ipBlockedUntil && (
                <div className="text-xs text-rose-400 font-semibold bg-rose-500/5 py-1.5 px-3 rounded-lg inline-block border border-rose-500/10 font-mono">
                  Blocked Until: {new Date(ipBlockedUntil).toLocaleString()}
                </div>
              )}
              <p className="text-xs text-muted-foreground/80">
                If you believe this is an error or need immediate assistance, please contact our customer support team.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center flex flex-col gap-2 pt-4">
            <Button
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-md flex items-center justify-center gap-2"
              onClick={() => window.open("https://t.me/trusto_exchange_support", "_blank")}
            >
              Contact Customer Support
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs border-border"
              onClick={() => setIpBlockedModalOpen(false)}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
