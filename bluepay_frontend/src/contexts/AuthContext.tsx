import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import type { AdminPermissionKey, AuthUser, StoredAccount, UserRole } from "@/lib/auth-types";
import {
  generateOtp,
  readAccounts,
  readPendingVerificationUserId,
  readSessionUserId,
  setPendingVerificationUserId,
  writeAccounts,
  writeSessionUserId,
} from "@/lib/auth-storage";
import { API_BASE_URL } from "@/lib/api-base";
import { lockAdminPin } from "@/lib/api-admin-pin";
import { onSessionExpired } from "@/lib/admin-pin-lock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const parseMinutesEnv = (val: unknown, fallback: number): number => {
  const parsed = parseInt(String(val ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const OTP_TTL_MS = 15 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS =
  parseMinutesEnv(
    import.meta.env.VITE_SESSION_EXPIRES_IN_MINUTES ??
      import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES,
    10,
  ) *
  60 *
  1000;

const INTENTIONAL_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "click",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
];

interface ApiCustomerUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
}

interface ApiStaffUser {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  mustChangePassword?: boolean;
  roleName?: string | null;
  role?: {
    id: string;
    name: string;
    permissions: string[];
  } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  inactivitySeconds: number | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string; role?: UserRole }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  verifyEmail: (code: string) => Promise<{ ok: boolean; message?: string }>;
  resendVerificationEmail: () => Promise<{ ok: boolean; message?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  setApiSession: (apiUser: ApiCustomerUser, accessToken: string) => void;
  setStaffSession: (staffUser: ApiStaffUser, accessToken: string) => void;
  clearMustChangePassword: () => void;
}

const API_TOKEN_KEY = "TrustO_api_token_v1";
const API_USER_KEY = "TrustO_api_user_v1";

const AuthContext = createContext<AuthContextValue | null>(null);

function parseApiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const raw = (body as { message?: unknown }).message;
  if (Array.isArray(raw)) {
    const parts = raw.filter((x) => typeof x === "string");
    if (parts.length > 0) return parts.join(", ");
  }
  if (typeof raw === "string" && raw.trim()) return raw;
  return fallback;
}

function normalizePermissions(raw: unknown): AdminPermissionKey[] | ["*"] {
  if (!Array.isArray(raw)) return [];
  if (raw.includes("*")) return ["*"];
  const valid: AdminPermissionKey[] = [
    "dashboard",
    "users",
    "deposits",
    "withdrawals",
    "referrals",
    "wallets",
    "security",
    "logs",
    "alerts",
    "announcements",
    "settings",
    "export",
    "export_users",
    "export_deposits",
    "export_withdrawals",
    "tickets",
    "distribution",
    "ip_activities",
  ];
  return raw.filter((p): p is AdminPermissionKey =>
    typeof p === "string" && (valid as string[]).includes(p),
  );
}

function customerToAuthUser(apiUser: ApiCustomerUser): AuthUser {
  const isSuperAdmin = apiUser.role === "super_admin" || apiUser.role === "superadmin";
  return {
    id: apiUser.id,
    type: "user",
    email: apiUser.email,
    name: apiUser.name,
    role: isSuperAdmin ? "super_admin" : "user",
    isSuperAdmin,
    permissions: isSuperAdmin ? ["*"] : [],
    mustChangePassword: Boolean(apiUser.mustChangePassword),
    emailVerified: apiUser.emailVerified ?? true,
  };
}

function staffToAuthUser(staff: ApiStaffUser): AuthUser {
  const isSuperAdmin = Boolean(staff.isSuperAdmin);
  return {
    id: staff.id,
    type: "staff",
    username: staff.username,
    email: staff.email,
    fullName: staff.fullName,
    name: staff.fullName || staff.username,
    role: isSuperAdmin ? "super_admin" : "user",
    isSuperAdmin,
    permissions: isSuperAdmin ? ["*"] : normalizePermissions(staff.permissions),
    mustChangePassword: Boolean(staff.mustChangePassword),
    emailVerified: true,
    roleName: staff.roleName || staff.role?.name || null,
  };
}

function storedToPublic(u: StoredAccount): AuthUser {
  return {
    id: u.id,
    type: "user",
    email: u.email,
    name: u.name,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin,
    permissions: u.isSuperAdmin ? ["*"] : [],
    mustChangePassword: Boolean(u.mustChangePassword),
    emailVerified: u.emailVerified,
  };
}

function isTokenExpired(token: string): boolean {
  if (!token || typeof token !== "string") return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    const json = atob(base64);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === "number") {
      return Date.now() >= payload.exp * 1000;
    }
  } catch (err) {
    console.error("Error decoding JWT expiration:", err);
    return true;
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const userRef = useRef(user);
  userRef.current = user;

  // Track intentional user interaction (clicks, keypresses, scroll, touch) to reset inactivity timer
  useEffect(() => {
    if (!user) return;
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };
    resetTimer();

    INTENTIONAL_ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, resetTimer, { passive: true, capture: true });
    });

    return () => {
      INTENTIONAL_ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, resetTimer, { capture: true });
      });
    };
  }, [user]);

  const refreshUserFromSession = useCallback(() => {
    try {
      const rawApiUser = localStorage.getItem(API_USER_KEY);
      const apiToken = localStorage.getItem(API_TOKEN_KEY);
      if (rawApiUser && apiToken) {
        const parsed = JSON.parse(rawApiUser) as AuthUser;
        setUser(parsed);
        return;
      }
    } catch {
      // fall through to local session
    }
    const id = readSessionUserId();
    if (!id) {
      setUser(null);
      return;
    }
    const accounts = readAccounts();
    const acc = accounts.find((a) => a.id === id);
    if (!acc) {
      writeSessionUserId(null);
      setUser(null);
      return;
    }
    setUser(storedToPublic(acc));
  }, []);

  useEffect(() => {
    refreshUserFromSession();
    setIsLoading(false);
  }, [refreshUserFromSession]);

  const login = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    const accounts = readAccounts();
    const acc = accounts.find((a) => a.email?.toLowerCase() === normalized);
    if (!acc || acc.password !== password) {
      return { ok: false, message: "Invalid email or password." };
    }
    if (!acc.emailVerified) {
      setPendingVerificationUserId(acc.id);
      writeSessionUserId(acc.id);
      setUser(storedToPublic(acc));
      return { ok: false, message: "VERIFY_REQUIRED" };
    }
    writeSessionUserId(acc.id);
    setPendingVerificationUserId(null);
    lastActivityRef.current = Date.now();
    setUser(storedToPublic(acc));
    return { ok: true, role: acc.role };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    if (password.length < 8) {
      return { ok: false, message: "Password must be at least 8 characters." };
    }
    const accounts = readAccounts();
    if (accounts.some((a) => a.email?.toLowerCase() === normalized)) {
      return { ok: false, message: "An account with this email already exists." };
    }
    const otp = generateOtp();
    const now = Date.now();
    const newAcc: StoredAccount = {
      id: `usr_${now}_${Math.random().toString(36).slice(2, 9)}`,
      type: "user",
      email: normalized,
      name: name.trim() || "User",
      role: "user",
      isSuperAdmin: false,
      permissions: [],
      mustChangePassword: false,
      emailVerified: false,
      password,
      emailOtp: otp,
      emailOtpExpiresAt: now + OTP_TTL_MS,
    };
    writeAccounts([...accounts, newAcc]);
    writeSessionUserId(newAcc.id);
    setPendingVerificationUserId(newAcc.id);
    lastActivityRef.current = Date.now();
    setUser(storedToPublic(newAcc));
    toast.message("Verification code sent", {
      description: `Demo: your code is ${otp} (valid 15 min).`,
    });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    // Drop the super admin's unlocked PIN session too, so a leaked token from
    // this session can't keep the console unlocked after sign-out.
    if (user?.isSuperAdmin) {
      void lockAdminPin();
    }
    writeSessionUserId(null);
    setPendingVerificationUserId(null);
    localStorage.removeItem(API_TOKEN_KEY);
    localStorage.removeItem(API_USER_KEY);
    setUser(null);
  }, [user]);

  const [inactivitySeconds, setInactivitySeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setInactivitySeconds(null);
      return;
    }

    const checkInactivity = () => {
      if (!userRef.current) {
        setInactivitySeconds(null);
        return;
      }
      const inactiveMs = Date.now() - lastActivityRef.current;
      const remainingSec = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - inactiveMs) / 1000));
      setInactivitySeconds(remainingSec);

      if (remainingSec <= 0) {
        logout();
        setShowSessionExpiredModal(true);
      }
    };

    const unbind = onSessionExpired(() => {
      checkInactivity();
    });

    checkInactivity();
    const interval = setInterval(checkInactivity, 1000);
    window.addEventListener("visibilitychange", checkInactivity);
    window.addEventListener("focus", checkInactivity);

    return () => {
      unbind();
      clearInterval(interval);
      window.removeEventListener("visibilitychange", checkInactivity);
      window.removeEventListener("focus", checkInactivity);
    };
  }, [user, logout]);

  const setApiSession = useCallback((apiUser: ApiCustomerUser, accessToken: string) => {
    const authUser = customerToAuthUser(apiUser);
    localStorage.setItem(API_TOKEN_KEY, accessToken);
    localStorage.setItem(API_USER_KEY, JSON.stringify(authUser));
    writeSessionUserId(null);
    setPendingVerificationUserId(null);
    lastActivityRef.current = Date.now();
    setUser(authUser);
  }, []);

  const setStaffSession = useCallback((staff: ApiStaffUser, accessToken: string) => {
    const authUser = staffToAuthUser(staff);
    localStorage.setItem(API_TOKEN_KEY, accessToken);
    localStorage.setItem(API_USER_KEY, JSON.stringify(authUser));
    writeSessionUserId(null);
    setPendingVerificationUserId(null);
    lastActivityRef.current = Date.now();
    setUser(authUser);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mustChangePassword: false };
      localStorage.setItem(API_USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const verifyEmail = useCallback(async (code: string) => {
    const id = readPendingVerificationUserId() ?? readSessionUserId();
    if (!id) return { ok: false, message: "Session expired. Please sign in again." };
    const accounts = readAccounts();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) return { ok: false, message: "Account not found." };
    if (accounts[idx].emailOtp !== code.trim()) {
      return { ok: false, message: "Invalid verification code." };
    }
    if (accounts[idx].emailOtpExpiresAt && Date.now() > accounts[idx].emailOtpExpiresAt!) {
      return { ok: false, message: "Verification code has expired." };
    }
    accounts[idx].emailVerified = true;
    accounts[idx].emailOtp = null;
    accounts[idx].emailOtpExpiresAt = null;
    writeAccounts(accounts);
    setPendingVerificationUserId(null);
    writeSessionUserId(id);
    setUser(storedToPublic(accounts[idx]));
    return { ok: true };
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const id = readPendingVerificationUserId() ?? readSessionUserId();
    if (!id) return { ok: false, message: "Session expired. Please sign in again." };
    const accounts = readAccounts();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) return { ok: false, message: "Account not found." };
    const otp = generateOtp();
    accounts[idx].emailOtp = otp;
    accounts[idx].emailOtpExpiresAt = Date.now() + OTP_TTL_MS;
    writeAccounts(accounts);
    toast.message("Verification code sent", {
      description: `Demo: your code is ${otp} (valid 15 min).`,
    });
    return { ok: true };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return { ok: false, message: "Enter your email address" };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiMessage(body, "Could not send reset code");
        toast.error(message);
        return { ok: false, message };
      }
      const message =
        typeof body?.message === "string"
          ? body.message
          : "If an account exists for that email, a reset code has been sent.";
      toast.success(message, {
        description: "Check your email for a 6-digit code (expires in 10 minutes).",
      });
      return { ok: true, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      toast.error(message);
      return { ok: false, message };
    }
  }, []);

  const resetPassword = useCallback(async (email: string, otp: string, newPassword: string) => {
    const normalized = email.trim().toLowerCase();
    const code = otp.trim();
    if (!normalized || !code || !newPassword) {
      return { ok: false, message: "All fields are required" };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, otp: code, newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = parseApiMessage(body, "Could not reset password");
        toast.error(message);
        return { ok: false, message };
      }
      const message =
        typeof body?.message === "string" ? body.message : "Password updated successfully";
      toast.success(message);
      return { ok: true, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      toast.error(message);
      return { ok: false, message };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      inactivitySeconds,
      login,
      register,
      logout,
      verifyEmail,
      resendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      setApiSession,
      setStaffSession,
      clearMustChangePassword,
    }),
    [
      user,
      isLoading,
      inactivitySeconds,
      login,
      register,
      logout,
      verifyEmail,
      resendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      setApiSession,
      setStaffSession,
      clearMustChangePassword,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Dialog open={showSessionExpiredModal} onOpenChange={setShowSessionExpiredModal}>
        <DialogContent className="sm:max-w-md border-amber-500/20 bg-background text-foreground shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center space-y-3 pt-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
              <Clock className="h-7 w-7" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Session Expired
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-xs mx-auto">
              Your session has expired due to {Math.round(INACTIVITY_TIMEOUT_MS / 60000)} minutes of inactivity. Please log in again to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pt-3">
            <Button
              className="w-full sm:w-auto px-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-md"
              onClick={() => {
                setShowSessionExpiredModal(false);
                const isStaffPath = window.location.pathname.startsWith("/core-control") || window.location.pathname.startsWith("/admin");
                window.location.href = isStaffPath ? "/core-control/signin" : "/auth/login";
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
