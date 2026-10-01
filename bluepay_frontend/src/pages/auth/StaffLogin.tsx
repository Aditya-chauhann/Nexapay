import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const schema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const StaffLogin = () => {
  /*
  const navigate = useNavigate();
  const location = useLocation();
  const { setStaffSession } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const response = await fetch(`${API_BASE}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username, password: data.password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        toast.error(typeof rawMessage === "string" ? rawMessage : "Sign in failed");
        return;
      }
      if (!body?.accessToken || !body?.user) {
        toast.error("Malformed sign in response");
        return;
      }
      setStaffSession(body.user, body.accessToken);
      if (body.user.mustChangePassword) {
        toast.message("Set a new password to continue.");
        navigate("/auth/change-password", { replace: true });
        return;
      }
      toast.success("Signed in");
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith("/admin") ? from : "/admin", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  };
  */

  return (
    <AuthLayout
      title="Staff sign in"
      description="Staff sign in is disabled." children={""}    >
      {/* 
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card space-y-5 p-6">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="e.g. support_jane"
              className="bg-secondary/80 font-mono"
              {...register("username")}
            />
            {errors.username ? <p className="text-xs text-destructive">{errors.username.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-secondary/80 pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Not staff?{" "}
          <Link to="/auth/login" className="font-medium text-primary hover:underline">
            Customer sign in
          </Link>
        </p>
      </motion.div>
      */}
    </AuthLayout>
  );
};

export default StaffLogin;
