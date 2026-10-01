import type { AdminPermissionKey, AuthUser } from "./auth-types";

/**
 * Mapping from admin route prefix → backend permission key. The longest
 * matching prefix wins.
 */
const PATH_PERMISSION: Array<readonly [string, AdminPermissionKey]> = [
  ["/admin/users", "users"],
  ["/admin/tags", "users"],
  ["/admin/deposits", "deposits"],
  ["/admin/bank-activity", "withdrawals"],
  ["/admin/bank-withdrawals", "withdrawals"],
  ["/admin/withdrawals", "withdrawals"],
  ["/admin/referrals", "referrals"],
  ["/admin/wallets", "wallets"],
  ["/admin/security", "security"],
  ["/admin/logs", "logs"],
  ["/admin/alerts", "alerts"],
  ["/admin/announcements", "announcements"],
  ["/admin/tickets", "tickets"],
  ["/admin/distribution", "distribution"],
  ["/admin/ip-activities", "ip_activities"],
  ["/admin/settings", "settings"],
  ["/admin", "dashboard"],

  // Alias support for /core-control/dashboard paths
  ["/core-control/dashboard/users", "users"],
  ["/core-control/dashboard/tags", "users"],
  ["/core-control/dashboard/deposits", "deposits"],
  ["/core-control/dashboard/bank-activity", "withdrawals"],
  ["/core-control/dashboard/bank-withdrawals", "withdrawals"],
  ["/core-control/dashboard/withdrawals", "withdrawals"],
  ["/core-control/dashboard/referrals", "referrals"],
  ["/core-control/dashboard/wallets", "wallets"],
  ["/core-control/dashboard/security", "security"],
  ["/core-control/dashboard/logs", "logs"],
  ["/core-control/dashboard/alerts", "alerts"],
  ["/core-control/dashboard/announcements", "announcements"],
  ["/core-control/dashboard/tickets", "tickets"],
  ["/core-control/dashboard/distribution", "distribution"],
  ["/core-control/dashboard/ip-activities", "ip_activities"],
  ["/core-control/dashboard/settings", "settings"],
  ["/core-control/dashboard", "dashboard"],
];

const SUPER_ADMIN_ONLY_PREFIXES = [
  "/admin/roles",
  "/admin/reports",
  "/admin/blogs",
  "/core-control/dashboard/roles",
  "/core-control/dashboard/reports",
  "/core-control/dashboard/blogs",
] as const;

export function hasPermission(user: AuthUser, key: AdminPermissionKey): boolean {
  if (user.isSuperAdmin) return true;
  if (user.permissions[0] === "*") return true;
  return (user.permissions as AdminPermissionKey[]).includes(key);
}

export function requiredPermissionForPath(pathname: string): AdminPermissionKey | null {
  for (const [prefix, key] of PATH_PERMISSION) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

export function isAdminConsoleUser(user: AuthUser): boolean {
  return user.type === "staff" || user.isSuperAdmin;
}

export function canAccessAdminPath(user: AuthUser | null, pathname: string): boolean {
  if (!user) return false;
  if (!isAdminConsoleUser(user)) return false;
  if (user.isSuperAdmin) return true;
  if (SUPER_ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  const required = requiredPermissionForPath(pathname);
  if (!required) return false;
  return hasPermission(user, required);
}

export function defaultRedirectForUser(user: AuthUser): string {
  if (isAdminConsoleUser(user)) return "/admin";
  return "/user";
}

export function canUserAccessPath(user: AuthUser, path: string): boolean {
  if (path.startsWith("/user")) return user.type === "user" && !user.isSuperAdmin;
  if (path.startsWith("/admin") || path.startsWith("/core-control/dashboard")) return canAccessAdminPath(user, path);
  return false;
}
