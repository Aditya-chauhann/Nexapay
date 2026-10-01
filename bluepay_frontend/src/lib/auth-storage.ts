import type { StoredAccount } from "./auth-types";

const USERS_KEY = "TrustO_accounts_v1";
const SESSION_KEY = "TrustO_session_v1";
const VERIFY_KEY = "TrustO_pending_verify_v1";

const DEMO_PASSWORD = "TrustO123!";

function demoAccounts(): StoredAccount[] {
  const now = Date.now();
  const base = (email: string, name: string, isSuperAdmin: boolean): StoredAccount => ({
    id: `demo-${email}`,
    type: "user",
    email,
    name,
    role: isSuperAdmin ? "super_admin" : "user",
    isSuperAdmin,
    permissions: isSuperAdmin ? ["*"] : [],
    mustChangePassword: false,
    emailVerified: true,
    password: DEMO_PASSWORD,
    emailOtp: null,
    emailOtpExpiresAt: null,
  });
  return [
    base("user@TrustO.io", "Demo User", false),
    base("superadmin@TrustO.io", "Demo Super Admin", true),
  ];
}

export function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const seeded = demoAccounts();
      localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as StoredAccount[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = demoAccounts();
      localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = demoAccounts();
    localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
}

export function readSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { userId } = JSON.parse(raw) as { userId: string };
    return userId ?? null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSessionUserId(userId: string | null) {
  if (!userId) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
}

export function setPendingVerificationUserId(userId: string | null) {
  if (!userId) sessionStorage.removeItem(VERIFY_KEY);
  else sessionStorage.setItem(VERIFY_KEY, userId);
}

export function readPendingVerificationUserId(): string | null {
  return sessionStorage.getItem(VERIFY_KEY);
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export { DEMO_PASSWORD };
