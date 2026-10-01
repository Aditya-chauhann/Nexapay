/**
 * Auth model after the backend role overhaul:
 * - Customers are 'user' or 'super_admin'.
 * - Staff are a separate identity (StaffUser) with permissions resolved live
 *   from their assigned StaffRole on every request.
 *
 * On the client we collapse both into a single AuthUser so route guards and
 * UI gating can branch on `type`, `isSuperAdmin`, and `permissions`.
 */

export type UserRole = "user" | "super_admin";

export type SessionType = "user" | "staff";

/** Permission keys mirror backend src/modules/staff/permissions.constants.ts */
export type AdminPermissionKey =
  | "dashboard"
  | "users"
  | "deposits"
  | "withdrawals"
  | "referrals"
  | "wallets"
  | "security"
  | "logs"
  | "alerts"
  | "announcements"
  | "settings"
  | "export"
  | "export_users"
  | "export_deposits"
  | "export_withdrawals"
  | "tickets"
  | "distribution"
  | "ip_activities";

export interface AuthUser {
  id: string;
  type: SessionType;
  /** Display name — full name, username, or email depending on session type */
  name: string;
  /** Present for customer sessions, and for staff when the backend returns it on /auth/login */
  email?: string;
  /** Only present for staff sessions */
  username?: string;
  fullName?: string;
  /** Customer role; staff sessions default to 'user' for typing convenience */
  role: UserRole;
  /** True for the platform SuperAdmin. Backend returns this on staff sessions too. */
  isSuperAdmin: boolean;
  /** Effective permission keys. SuperAdmin always has ["*"]. Staff get their role's keys. */
  permissions: AdminPermissionKey[] | ["*"];
  /** Staff first-login flag; blocks app access until /admin/auth/change-password is called */
  mustChangePassword: boolean;
  /** Only meaningful for customer sessions */
  emailVerified: boolean;
  /** Name of the staff role (e.g. Support Agent) */
  roleName?: string | null;
}

export interface StoredAccount extends AuthUser {
  /** Demo/local only — replace with server-side auth in production */
  password: string;
  emailOtp: string | null;
  emailOtpExpiresAt: number | null;
}
