import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  PasswordRequirements,
  checkPasswordRequirements,
} from "@/components/shared/PasswordRequirements";

const schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
    password: z.string().min(1, "Password is required"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .superRefine((data, ctx) => {
    const res = checkPasswordRequirements(data.password, {
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
          message: `Password cannot contain your email/username ("${res.matchedForbiddenTerm}")`,
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

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword, requestPasswordReset } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resending, setResending] = useState(false);

  const initialEmail =
    (location.state as { email?: string } | null)?.email?.trim().toLowerCase() ?? "";

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialEmail,
      otp: "",
      password: "",
      confirm: "",
    },
  });

  const passwordValue = watch("password") || "";
  const emailValue = watch("email") || "";

  const onSubmit = async (data: FormValues) => {
    const result = await resetPassword(data.email, data.otp, data.password);
    if (result.ok) {
      navigate("/auth/login", { replace: true });
    }
  };

  const handleResend = async () => {
    const email = getValues("email").trim();
    if (!email) return;
    setResending(true);
    try {
      await requestPasswordReset(email);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Enter reset code"
      description="Use the 6-digit code from your email and choose a new password."
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card space-y-5 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="bg-secondary/80"
              {...register("email")}
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">Reset code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              maxLength={6}
              className="bg-secondary/80 font-mono tracking-widest"
              {...register("otp")}
            />
            {errors.otp ? <p className="text-xs text-destructive">{errors.otp.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="bg-secondary/80 pr-10"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
            <PasswordRequirements
              password={passwordValue}
              email={emailValue}
              className="mt-2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                className="bg-secondary/80 pr-10"
                {...register("confirm")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirm ? <p className="text-xs text-destructive">{errors.confirm.message}</p> : null}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
          <Link to="/auth/forgot-password" className="text-primary hover:underline">
            Use a different email
          </Link>
          <Link to="/auth/login" className="hover:underline">
            Back to sign in
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
};

export default ResetPassword;
