import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const API_TOKEN_KEY = "TrustO_api_token_v1";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "New password must differ from current",
  });

type FormValues = z.infer<typeof schema>;

export function MandatoryChangePasswordModal() {
  const navigate = useNavigate();
  const { user, clearMustChangePassword, logout } = useAuth();
  const open = Boolean(user && user.mustChangePassword === true);
  const isStaff = user?.type === "staff";

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: FormValues) => {
    const token = localStorage.getItem(API_TOKEN_KEY);
    if (!token) {
      toast.error("Session expired. Please sign in again.");
      logout();
      navigate(isStaff ? "/core-control/signin" : "/auth/login", { replace: true });
      return;
    }
    try {
      const endpoint = isStaff
        ? `${API_BASE}/admin/auth/change-password`
        : `${API_BASE}/auth/change-password`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const rawMessage = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
        toast.error(typeof rawMessage === "string" ? rawMessage : "Password change failed");
        return;
      }
      clearMustChangePassword();
      toast.success(isStaff ? "Password updated. Welcome to the admin console." : "Password updated successfully! Welcome back.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Set a new password</DialogTitle>
          <DialogDescription className="text-center">
            {isStaff
              ? "First-time sign-in. You must set a new password before you can use the admin console."
              : "Temporary password detected. Please enter your temporary password and set a new password to continue."}
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <p className="text-center text-xs text-muted-foreground">
            Signed in as <span className="font-mono text-foreground font-semibold">{user.email || user.username || user.name}</span>
          </p>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mandatory-current">
              {isStaff ? "Current password" : "Temporary password"}
            </Label>
            <div className="relative">
              <Input
                id="mandatory-current"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                placeholder={isStaff ? "The temporary password you were given" : "Enter temporary password received via email"}
                className="bg-secondary/80 pr-10"
                {...register("currentPassword")}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword ? (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mandatory-new">New password</Label>
            <div className="relative">
              <Input
                id="mandatory-new"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="bg-secondary/80 pr-10"
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword ? (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mandatory-confirm">Confirm new password</Label>
            <Input
              id="mandatory-confirm"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat the new password"
              className="bg-secondary/80"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate(isStaff ? "/core-control/signin" : "/auth/login", { replace: true });
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out and use a different account
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
