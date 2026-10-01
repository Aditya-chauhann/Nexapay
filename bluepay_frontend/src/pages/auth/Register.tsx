import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Wallet,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Gift,
  CheckCircle2,
  Zap,
  TrendingUp,
  Ban,
  Clock,
  Coins,
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
import { PuzzleCaptcha } from "@/components/auth/PuzzleCaptcha";
import { fetchNewCaptcha } from "@/lib/api-captcha";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";
import {
  PasswordRequirements,
  checkPasswordRequirements,
} from "@/components/shared/PasswordRequirements";

const PHONE_REGEX = /^\+91[6-9]\d{9}$/;

const schema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    email: z.string().email("Enter a valid email address"),
    phone: z
      .string()
      .min(1, "Mobile number is required")
      .regex(
        PHONE_REGEX,
        "Enter a valid Indian mobile in +91XXXXXXXXXX format (starts with 6–9)",
      ),
    password: z.string().min(1, "Password is required"),
    confirm: z.string().min(1, "Confirm your password"),
    captchaAnswer: z.string().trim().min(1, "Please drag the puzzle piece into the matching slot"),
    referralCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const res = checkPasswordRequirements(data.password, {
      name: data.name,
      email: data.email,
    });
    if (!res.isValid) {
      if (!res.hasLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 8 characters",
          path: ["password"],
        });
      } else if (!res.hasCapital) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must contain at least one capital letter (A-Z)",
          path: ["password"],
        });
      } else if (!res.hasNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must contain at least one number (0-9)",
          path: ["password"],
        });
      } else if (!res.hasSpecial) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must contain at least one special character",
          path: ["password"],
        });
      } else if (!res.hasNoNameOrUsername) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Password cannot contain your name or username ("${res.matchedForbiddenTerm}")`,
          path: ["password"],
        });
      }
    }
    if (data.password !== data.confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirm"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCaptchaSolved, setIsCaptchaSolved] = useState(false);
  const [backendCaptcha, setBackendCaptcha] = useState<{ captchaId: string; svg: string } | null>(null);
  const [ipBlockedModalOpen, setIpBlockedModalOpen] = useState(false);
  const [ipBlockedUntil, setIpBlockedUntil] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
      captchaAnswer: "",
      referralCode: searchParams.get("ref") || "",
    },
  });

  const passwordValue = watch("password") || "";
  const nameValue = watch("name") || "";
  const emailValue = watch("email") || "";

  const loadBackendCaptcha = useCallback(() => {
    fetchNewCaptcha()
      .then(setBackendCaptcha)
      .catch(() => {
        setBackendCaptcha({
          captchaId: "reg-puzzle-" + Math.random().toString(36).substring(2, 10),
          svg: "",
        });
      });
  }, []);

  useEffect(() => {
    document.title = "Create Account | NexaPay";
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

  const onSubmit = async (data: FormValues) => {
    if (!isCaptchaSolved) {
      toast.error("Please drag the puzzle piece into the matching slot");
      return;
    }

    try {
      const payload: Record<string, string> = {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        password: data.password,
        confirmPassword: data.confirm,
        captchaId: backendCaptcha?.captchaId || "puzzle-verified",
        captchaAnswer: "PUZZLE_VERIFIED",
      };
      if (data.referralCode?.trim()) payload.referralCode = data.referralCode.trim();

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        handleCaptchaRefresh();
        if (response.status === 429) {
          setIpBlockedUntil(body?.blockedUntil || null);
          setIpBlockedModalOpen(true);
          return;
        }
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        toast.error(typeof rawMessage === "string" ? rawMessage : "Registration failed");
        return;
      }

      toast.success("Account created successfully!", {
        description: "Please sign in to access your wallet.",
      });
      navigate("/auth/login", { replace: true });
    } catch (err) {
      handleCaptchaRefresh();
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#020b1e] text-slate-900 selection:bg-blue-500 selection:text-white relative overflow-x-hidden font-sans">
      {/* ═════════════════════════════════════════════════════════════
          LEFT SPLIT PANEL (48% width): Dark-to-Electric-Blue Hero
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

        {/* ── TOP SECTION: NexaPay Brand & Badge ── */}
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
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Create Free Account</span>
            </span>
          </div>
        </div>

        {/* ── MIDDLE SECTION: Headline & Key Advantages ── */}
        <div className="relative z-10 my-8 lg:my-10 space-y-7">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black tracking-tight leading-[1.08] text-white">
              Join Thousands
              <br />
              Exchanging
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-300">
                Crypto to Fiat.
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-blue-100/70 max-w-md leading-relaxed">
              Open your NexaPay account in 60 seconds. Get your dedicated TRC-20 wallet address and enjoy instant automated payouts to Indian Rupees.
            </p>
          </div>

          {/* 3 Registration Highlights */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Instant Wallet Generation</h4>
                <p className="text-[11px] text-blue-200/60">Dedicated TRC-20 address generated automatically on sign up</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Bank & UPI Settlement</h4>
                <p className="text-[11px] text-blue-200/60">Seamless withdrawals to all major Indian banks and UPI handles</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Referral Commissions</h4>
                <p className="text-[11px] text-blue-200/60">Invite friends and earn passive tier rewards on every exchange</p>
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
            <div className="text-base sm:text-lg font-black text-white">₹0 Fee</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Account Opening
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold mb-1">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">&lt; 60s</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Fast Setup
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">24/7</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Live Support
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          RIGHT SPLIT PANEL (52% width): White / Frosted-Glass Registration Card
      ═════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[52%] flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-gradient-to-br from-[#f2f6fe] via-[#edf3fc] to-[#f9fbff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[500px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[28px] p-7 sm:p-9 shadow-2xl shadow-blue-900/10 border border-white/80 dark:border-slate-800 my-4"
        >
          {/* Card Header */}
          <div className="text-center space-y-1.5 pb-5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white mb-2">
              <Wallet className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Nexa<span className="text-blue-600">Pay</span>
              </span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white pt-1">
              Create an account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Sign up to receive your personal wallet and exchange USDT to INR instantly.
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full name
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <User className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-3 py-2 h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.name.message}</p>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email address
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Mail className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-3 py-2 h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.email.message}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mobile number (+91)
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Phone className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+919876543210"
                  className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-3 py-2 h-10 font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
                  {...register("phone")}
                />
              </div>
              {errors.phone ? (
                <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.phone.message}</p>
              ) : (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Must start with <span className="font-mono font-semibold">+91</span> followed by 10 digits.
                </p>
              )}
            </div>

            {/* Password & Confirm Password (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <Lock className="w-4 h-4 text-slate-400 ml-3 shrink-0 pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="border-0 bg-transparent text-xs pl-2 pr-8 py-2 h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm password
                </Label>
                <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <Lock className="w-4 h-4 text-slate-400 ml-3 shrink-0 pointer-events-none" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="border-0 bg-transparent text-xs pl-2 pr-8 py-2 h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...register("confirm")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="text-[11px] font-medium text-destructive mt-0.5">{errors.confirm.message}</p>
                )}
              </div>
            </div>

            {/* Password Requirements Checklist */}
            <PasswordRequirements
              password={passwordValue}
              name={nameValue}
              email={emailValue}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800"
            />

            {/* Referral Code (Optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="referralCode" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Referral code (Optional)
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Gift className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="e.g. REF123"
                  className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-3 py-2 h-10 uppercase font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
                  {...register("referralCode")}
                />
              </div>
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
                <span>Creating your account...</span>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </Button>
          </form>

          {/* Navigation Footer */}
          <div className="text-center mt-6">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Already have an account?{" "}
              <Link to="/auth/login" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

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
