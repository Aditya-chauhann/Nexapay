import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (data: FormValues) => {
    const result = await requestPasswordReset(data.email);
    if (result.ok) {
      navigate("/auth/reset-password", { state: { email: data.email.trim().toLowerCase() } });
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      description="Enter your account email and we'll send a 6-digit reset code (valid for 10 minutes)."
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset code"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/auth/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
};

export default ForgotPassword;
