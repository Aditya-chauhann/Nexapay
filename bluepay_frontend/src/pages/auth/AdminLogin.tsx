import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  BarChart3,
  Users,
  QrCode,
  ArrowRight,
  RefreshCw,
  Wallet,
  Sparkles,
  Ban,
  Activity,
  Layers,
  Globe2,
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
import { fetchNewCaptcha } from "@/lib/api-captcha";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email or username"),
  password: z.string().min(1, "Password is required"),
  captchaAnswer: z.string().trim().min(1, "Please drag the puzzle piece into the matching slot"),
});

type FormValues = z.infer<typeof schema>;

interface TotpChallengeState {
  loginChallenge: string;
  accountLabel: string;
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setStaffSession, setApiSession } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [totpChallenge, setTotpChallenge] = useState<TotpChallengeState | null>(null);
  const [isCaptchaSolved, setIsCaptchaSolved] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);

  // Mandatory Change Password state for temp passwords
  const [tempPasswordState, setTempPasswordState] = useState<{
    token: string;
    staff: Record<string, unknown>;
    currentPassword: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Captcha token state from backend
  const [backendCaptcha, setBackendCaptcha] = useState<{ captchaId: string; svg: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", captchaAnswer: "" },
  });

  // Fetch backend captcha ID for session verification
  const loadBackendCaptcha = useCallback(() => {
    fetchNewCaptcha()
      .then(setBackendCaptcha)
      .catch(() => {
        // Fallback random ID if network delay
        setBackendCaptcha({
          captchaId: "puzzle-" + Math.random().toString(36).substring(2, 10),
          svg: "",
        });
      });
  }, []);

  useEffect(() => {
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
    (body: Record<string, unknown>, enteredPassword?: string) => {
      const staff = body.staff as Record<string, unknown> | undefined;
      const user = body.user as Record<string, unknown> | undefined;

      if (body.accessToken && staff) {
        setStaffSession(staff as Parameters<typeof setStaffSession>[0], body.accessToken as string);

        if (staff.mustChangePassword) {
          setTempPasswordState({
            token: body.accessToken as string,
            staff,
            currentPassword: enteredPassword || getValues("password") || "",
          });
          return;
        }

        toast.success("Welcome back to NexaPay Admin");
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from && (from.startsWith("/core-control") || from.startsWith("/admin")) ? from : "/core-control/dashboard", { replace: true });
        return;
      }

      if (body.accessToken && user) {
        setApiSession(user as Parameters<typeof setApiSession>[0], body.accessToken as string);
        toast.success("Welcome back to NexaPay Admin");
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from && (from.startsWith("/core-control") || from.startsWith("/admin")) ? from : "/core-control/dashboard", { replace: true });
        return;
      }

      toast.error("Malformed sign in response");
    },
    [getValues, location.state, navigate, setApiSession, setStaffSession]
  );

  const onSubmit = async (data: FormValues) => {
    if (!isCaptchaSolved) {
      toast.error("Please drag the puzzle piece into the matching slot");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          captchaId: backendCaptcha?.captchaId || "puzzle-verified",
          captchaAnswer: "PUZZLE_VERIFIED",
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        const messageText = typeof rawMessage === "string" ? rawMessage : "";
        const code = typeof body?.errorCode === "string" ? body.errorCode : "";

        handleCaptchaRefresh();

        if (code === "CAPTCHA_INVALID") {
          toast.error(messageText || "Security verification expired. Please solve the puzzle again.");
          return;
        }

        if (response.status === 403) {
          if (code === "STAFF_INACTIVE" || /inactive/i.test(messageText)) {
            setBlockedMessage(
              "Your staff account has been deactivated. Please contact a super administrator."
            );
            return;
          }
          setBlockedMessage(messageText || "Sign in unavailable.");
          return;
        }

        toast.error(messageText || "Sign in failed. Check your credentials.");
        return;
      }

      if (body?.requiresTotp && body?.loginChallenge) {
        const accountLabel =
          (body.staff as { email?: string } | undefined)?.email ??
          (body.user as { email?: string } | undefined)?.email ??
          "your account";
        setTotpChallenge({
          loginChallenge: body.loginChallenge as string,
          accountLabel,
        });
        return;
      }

      completeLogin(body as Record<string, unknown>, data.password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network connection error");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      toast.error("Please enter your email or username");
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || "Failed to process request");
        return;
      }
      setForgotSuccessMessage(
        data?.message || "Admin has been notified. He will revert your request soon."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPasswordState) return;
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/admin/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempPasswordState.token}`,
        },
        body: JSON.stringify({
          currentPassword: tempPasswordState.currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully! Welcome to NexaPay.");
      const updatedStaff = { ...tempPasswordState.staff, mustChangePassword: false };
      setStaffSession(updatedStaff as Parameters<typeof setStaffSession>[0], tempPasswordState.token);
      setTempPasswordState(null);

      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && (from.startsWith("/core-control") || from.startsWith("/admin")) ? from : "/core-control/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#020b1e] text-slate-900 selection:bg-blue-500 selection:text-white relative overflow-x-hidden font-sans">
      {/* ═════════════════════════════════════════════════════════════
          LEFT SPLIT PANEL (48% width): Dark-to-Electric-Blue Hero
      ═════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[48%] relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden bg-gradient-to-br from-[#020b1e] via-[#051c4a] to-[#0a3582] text-white">
        {/* Futuristic Background Glows & Ambient Orbs */}
        <div className="absolute top-[-10%] left-[-15%] w-[420px] h-[420px] rounded-full bg-blue-600/25 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[5%] right-[-10%] w-[380px] h-[380px] rounded-full bg-sky-500/20 blur-[110px] pointer-events-none" />
        <div className="absolute top-[40%] left-[30%] w-[250px] h-[250px] rounded-full bg-indigo-500/15 blur-[90px] pointer-events-none" />

        {/* Subtle Cyber Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* ── TOP SECTION: NexaPay Brand & Admin Console Badge ── */}
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 p-0.5 shadow-lg shadow-blue-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#05183d] rounded-[14px] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Nexa<span className="text-sky-400">Pay</span>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-400/30 text-blue-300 backdrop-blur-md">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Admin Console</span>
          </div>
        </div>

        {/* ── MIDDLE SECTION: Headline, Highlights & 3D Composition ── */}
        <div className="relative z-10 my-8 lg:my-10 space-y-7">
          {/* Main Headline */}
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black tracking-tight leading-[1.08] text-white">
              Secure
              <br />
              Operations
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-300">
                Powering Payments
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-blue-100/70 max-w-md leading-relaxed">
              Manage deposits, withdrawals, users, and platform settings all in one place.
            </p>
          </div>

          {/* 3 Security / Feature Highlights */}
          <div className="space-y-3.5 pt-2">
            {/* Highlight 1 */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Enterprise Grade Security</h4>
                <p className="text-[11px] text-blue-200/60">Your platform, always protected</p>
              </div>
            </div>

            {/* Highlight 2 */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Real-time Monitoring</h4>
                <p className="text-[11px] text-blue-200/60">Stay in control 24/7</p>
              </div>
            </div>

            {/* Highlight 3 */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-sky-400 shrink-0 shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Trusted by Teams</h4>
                <p className="text-[11px] text-blue-200/60">Built for secure collaboration</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3D FINTECH VISUAL OVERLAY (Behind right edge of left panel) ── */}
        <div className="absolute right-[-40px] top-[26%] w-[320px] h-[340px] pointer-events-none hidden xl:block select-none opacity-85">
          {/* Angled Glass Payment Card */}
          <div
            className="absolute top-0 right-4 w-[210px] h-[130px] rounded-2xl p-3 border border-white/20 bg-gradient-to-br from-white/10 to-blue-600/20 backdrop-blur-md shadow-2xl shadow-blue-950/60 -rotate-12 transition-transform"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold tracking-wider text-white">NexaPay</span>
              <div className="w-4 h-3 rounded bg-amber-400/80" />
            </div>
            <div className="mt-6 flex items-center gap-1.5">
              <div className="h-1.5 w-6 bg-white/40 rounded-full" />
              <div className="h-1.5 w-6 bg-white/40 rounded-full" />
              <div className="h-1.5 w-6 bg-white/40 rounded-full" />
              <div className="h-1.5 w-8 bg-sky-400 rounded-full" />
            </div>
            <div className="mt-4 flex justify-between items-center text-[9px] text-blue-200/70 font-mono">
              <span>**** 8842</span>
              <span>EXP 09/28</span>
            </div>
          </div>

          {/* Central Glass Security Lock Shield with Jigsaw Cutout */}
          <div className="absolute top-[80px] left-6 w-[170px] h-[210px] rounded-3xl p-1 bg-gradient-to-br from-sky-400/40 via-blue-500/20 to-transparent border border-sky-400/40 backdrop-blur-xl shadow-2xl shadow-sky-500/20 flex items-center justify-center">
            <div className="w-full h-full rounded-[22px] bg-[#041940]/80 border border-white/10 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              {/* Lock Shackle */}
              <div className="w-16 h-12 rounded-t-full border-4 border-sky-400/80 border-b-0 -mt-6 mb-2" />
              {/* Jigsaw cutout shape in lock */}
              <div className="w-14 h-14 relative flex items-center justify-center">
                <svg width="55" height="55" viewBox="0 0 55 55" className="filter drop-shadow-md">
                  <path
                    d="M 10 0 H 20 C 20 6 23 8 25 8 C 27 8 30 6 30 0 H 40 C 45 0 50 5 50 10 V 20 C 56 20 58 23 58 25 C 58 27 56 30 50 30 V 40 C 50 45 45 50 40 50 H 30 C 30 44 27 42 25 42 C 23 42 20 44 20 50 H 10 C 5 50 0 45 0 40 V 30 C 6 30 8 27 8 25 C 8 23 6 20 0 20 V 10 C 0 5 5 0 10 0 Z"
                    fill="rgba(2, 11, 30, 0.85)"
                    stroke="#38bdf8"
                    strokeWidth="1.75"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Floating puzzle piece hovering out with curved dashed line */}
          <div className="absolute top-[140px] right-2 w-[65px] h-[65px] rotate-6 animate-pulse">
            <svg width="65" height="65" viewBox="0 0 55 55" className="filter drop-shadow-xl">
              <defs>
                <clipPath id="floaterClip">
                  <path d="M 10 0 H 20 C 20 6 23 8 25 8 C 27 8 30 6 30 0 H 40 C 45 0 50 5 50 10 V 20 C 56 20 58 23 58 25 C 58 27 56 30 50 30 V 40 C 50 45 45 50 40 50 H 30 C 30 44 27 42 25 42 C 23 42 20 44 20 50 H 10 C 5 50 0 45 0 40 V 30 C 6 30 8 27 8 25 C 8 23 6 20 0 20 V 10 C 0 5 5 0 10 0 Z" />
                </clipPath>
              </defs>
              <g clipPath="url(#floaterClip)">
                <rect width="55" height="55" fill="#0a1d47" />
                <polygon points="5,55 28,14 55,55" fill="#e2e8f0" />
                <polygon points="28,14 55,55 45,55 28,26" fill="#091024" opacity="0.65" />
                <rect x="0" y="44" width="55" height="12" fill="#0f2656" />
              </g>
              <path
                d="M 10 0 H 20 C 20 6 23 8 25 8 C 27 8 30 6 30 0 H 40 C 45 0 50 5 50 10 V 20 C 56 20 58 23 58 25 C 58 27 56 30 50 30 V 40 C 50 45 45 50 40 50 H 30 C 30 44 27 42 25 42 C 23 42 20 44 20 50 H 10 C 5 50 0 45 0 40 V 30 C 6 30 8 27 8 25 C 8 23 6 20 0 20 V 10 C 0 5 5 0 10 0 Z"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* 3D Glass Cross / Plus Accents */}
          <div className="absolute bottom-2 left-2 w-10 h-10 rounded-xl bg-blue-400/20 border border-blue-300/40 backdrop-blur-md flex items-center justify-center text-sky-300 font-black text-xl shadow-lg">
            +
          </div>
          <div className="absolute top-[-10px] left-[110px] w-8 h-8 rounded-lg bg-blue-400/20 border border-blue-300/30 backdrop-blur-md flex items-center justify-center text-sky-300 font-black text-sm shadow-md">
            +
          </div>
        </div>

        {/* ── BOTTOM SECTION: 3 Translucent Stats ── */}
        <div className="relative z-10 pt-6 border-t border-blue-400/15 grid grid-cols-3 gap-3">
          {/* Stat 1 */}
          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-sky-400 flex items-center justify-center text-xs font-bold mb-1">
              ₹
            </div>
            <div className="text-base sm:text-lg font-black text-white">12.4K+</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Transactions/day
            </div>
          </div>

          {/* Stat 2 */}
          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">99.9%</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Uptime
            </div>
          </div>

          {/* Stat 3 */}
          <div className="p-3 sm:p-4 rounded-2xl bg-[#061c47]/70 border border-blue-400/20 backdrop-blur-md shadow-xs">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold mb-1">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">256+</div>
            <div className="text-[10px] sm:text-[11px] text-blue-200/60 font-medium truncate">
              Global Users
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          RIGHT SPLIT PANEL (52% width): White / Frosted-Glass Card
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
                  Admin sign in
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  For staff, agents, and super admins. Use your email or username and password.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email or Username Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email or username
                  </Label>
                  <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <User className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
                    <Input
                      id="email"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="admin@trust-o.com"
                      className="border-0 bg-transparent text-xs sm:text-sm pl-2.5 pr-3 py-2.5 h-11 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[11px] font-medium text-destructive mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(getValues("email") || "");
                        setForgotSuccessMessage(null);
                        setShowForgotModal(true);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
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

                {/* VISUAL DRAG-AND-DROP PUZZLE CAPTCHA (Creative Core Element) */}
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

                {/* Primary Submit Button: Full-width Electric Blue */}
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

              {/* Customer / User Sign In Footer */}
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 font-medium">
                Customer?{" "}
                <Link to="/auth/login" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  User sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      <Dialog
        open={showForgotModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowForgotModal(false);
            setForgotSuccessMessage(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Admin / Staff Password Reset</DialogTitle>
            <DialogDescription>
              Enter your registered email address or username. A super administrator will be notified to grant a temporary password.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccessMessage ? (
            <div className="space-y-4 py-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">{forgotSuccessMessage}</p>
              <DialogFooter className="sm:justify-center">
                <Button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSuccessMessage(null);
                  }}
                >
                  Back to Sign In
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email or username</Label>
                <Input
                  id="forgot-email"
                  type="text"
                  placeholder="e.g. admin@trust-o.com"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  className="bg-secondary/80 rounded-xl"
                  required
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotModal(false)}
                  disabled={forgotSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={forgotSubmitting}>
                  {forgotSubmitting ? "Sending Request..." : "Send Request"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MANDATORY CHANGE PASSWORD MODAL (Temp Password) ── */}
      <Dialog open={tempPasswordState !== null} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
            <DialogDescription>
              You signed in using a temporary password. Please set a new permanent password to secure your account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary/80 pr-10 rounded-xl"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-secondary/80 rounded-xl"
                required
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl" disabled={changingPassword}>
                {changingPassword ? "Updating Password..." : "Update Password & Continue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── INACTIVE / BLOCKED MODAL ── */}
      <Dialog open={blockedMessage !== null} onOpenChange={(open) => !open && setBlockedMessage(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
              <Ban className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Sign in unavailable</DialogTitle>
            <DialogDescription className="text-center">{blockedMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="secondary" onClick={() => setBlockedMessage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
