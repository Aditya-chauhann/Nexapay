import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

/**
 * Permission keys we actually show in the role-permissions checklist,
 * in this display order. Any backend-catalog key not listed here is hidden.
 */
const VISIBLE_PERMISSION_KEYS = [
  "dashboard",
  "users",
  "tags",
  "deposits",
  "withdrawals",
  "wallets",
  "roles",
  "settings",
  "export",
  "tickets",
  "distribution",
  "ip_activities",
] as const;

/**
 * Frontend fallback labels for permission keys the backend catalog may not yet
 * expose (currently: `tags`, `roles`, `export`, `tickets`). Once those land in
 * backend permissions.constants.ts the fetched entries take precedence.
 */
const PERMISSION_FALLBACKS: Record<string, { label: string; description: string }> = {
  tags: { label: "Tags", description: "Manage user tier tags" },
  roles: { label: "Roles", description: "Manage staff roles and accounts" },
  export: { label: "Export", description: "Download data as CSV" },
  tickets: { label: "Tickets", description: "Triage and resolve support tickets" },
  distribution: { label: "Distribution", description: "Access distribution portal & referral network" },
  ip_activities: { label: "IP Activities", description: "Audit user logins, failed attempts, and IPs" },
};

interface PermissionEntry {
  key: string;
  label: string;
  description: string;
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
}

interface StaffUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface RoleFormState {
  id: string | null;
  name: string;
  description: string;
  permissions: Set<string>;
  isActive: boolean;
}

const EMPTY_ROLE_FORM: RoleFormState = {
  id: null,
  name: "",
  description: "",
  permissions: new Set<string>(),
  isActive: true,
};

interface StaffFormState {
  id: string | null;
  roleId: string;
  isSuperAdmin: boolean;
  username: string;
  email: string;
  fullName: string;
  password: string;
}

const EMPTY_STAFF_FORM: StaffFormState = {
  id: null,
  roleId: "",
  isSuperAdmin: false,
  username: "",
  email: "",
  fullName: "",
  password: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string") return m;
  }
  return `Request failed (HTTP ${status})`;
}

function normalizeRole(raw: unknown): CustomRole | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const name = (r.name as string | undefined)?.trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    description: (r.description as string | undefined) ?? "",
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    isActive: r.isActive === undefined ? true : Boolean(r.isActive),
  };
}

function normalizeStaff(raw: unknown): StaffUser | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const username = (r.username as string | undefined)?.trim();
  if (!id || !username) return null;
  const roleField = r.roleId ?? r.role;
  const roleId =
    typeof roleField === "string"
      ? roleField
      : typeof roleField === "object" && roleField
      ? ((roleField as Record<string, unknown>).id as string | undefined) ??
        ((roleField as Record<string, unknown>)._id as string | undefined) ??
        ""
      : "";
  return {
    id,
    username,
    email: (r.email as string | undefined) ?? "",
    fullName: (r.fullName as string | undefined) ?? "",
    roleId: roleId ?? "",
    isSuperAdmin: Boolean(r.isSuperAdmin),
    isActive: r.isActive === undefined ? true : Boolean(r.isActive),
    mustChangePassword: Boolean(r.mustChangePassword),
    lastLoginAt: (r.lastLoginAt as string | null | undefined) ?? null,
    createdAt: (r.createdAt as string | undefined) ?? undefined,
  };
}

const AdminRoles = () => {
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionEntry[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [savingRole, setSavingRole] = useState(false);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<CustomRole | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffForm, setStaffForm] = useState<StaffFormState>(EMPTY_STAFF_FORM);
  const [savingStaff, setSavingStaff] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState<StaffUser | null>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);

  const [resetPwdTarget, setResetPwdTarget] = useState<StaffUser | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [resetPwdShow, setResetPwdShow] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    const headers = authHeaders();
    if (!headers) {
      setLoading(false);
      toast.error("Not authenticated");
      return;
    }
    setLoading(true);
    try {
      const [permsRes, rolesRes, staffRes] = await Promise.all([
        fetch(`${API_BASE}/admin/permissions`, { headers, signal }),
        fetch(`${API_BASE}/admin/roles`, { headers, signal }),
        fetch(`${API_BASE}/admin/staff`, { headers, signal }),
      ]);
      const [permsBody, rolesBody, staffBody] = await Promise.all([
        permsRes.json().catch(() => null),
        rolesRes.json().catch(() => null),
        staffRes.json().catch(() => null),
      ]);
      if (!permsRes.ok) {
        toast.error(extractErrorMessage(permsBody, permsRes.status));
      } else {
        const list: unknown[] = Array.isArray(permsBody?.items)
          ? permsBody.items
          : Array.isArray(permsBody)
          ? permsBody
          : [];
        setPermissionCatalog(
          list
            .map((p) => {
              if (!p || typeof p !== "object") return null;
              const r = p as Record<string, unknown>;
              const key = (r.key as string | undefined)?.trim();
              if (!key) return null;
              return {
                key,
                label: (r.label as string | undefined) ?? key,
                description: (r.description as string | undefined) ?? "",
              };
            })
            .filter((p): p is PermissionEntry => p !== null),
        );
      }
      if (!rolesRes.ok) {
        toast.error(extractErrorMessage(rolesBody, rolesRes.status));
      } else {
        const list: unknown[] = Array.isArray(rolesBody?.items)
          ? rolesBody.items
          : Array.isArray(rolesBody)
          ? rolesBody
          : [];
        setRoles(list.map(normalizeRole).filter((r): r is CustomRole => r !== null));
      }
      if (!staffRes.ok) {
        toast.error(extractErrorMessage(staffBody, staffRes.status));
      } else {
        const list: unknown[] = Array.isArray(staffBody?.items)
          ? staffBody.items
          : Array.isArray(staffBody)
          ? staffBody
          : [];
        setStaff(list.map(normalizeStaff).filter((s): s is StaffUser => s !== null));
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll]);

  const visibleCatalog = useMemo<PermissionEntry[]>(() => {
    return VISIBLE_PERMISSION_KEYS
      .map((k) => {
        const fromBackend = permissionCatalog.find((p) => p.key === k);
        if (fromBackend) return fromBackend;
        const fb = PERMISSION_FALLBACKS[k];
        return fb ? { key: k, label: fb.label, description: fb.description } : undefined;
      })
      .filter((p): p is PermissionEntry => p !== undefined);
  }, [permissionCatalog]);

  const staffByRole = useMemo(() => {
    const map = new Map<string, StaffUser[]>();
    for (const s of staff) {
      const arr = map.get(s.roleId) ?? [];
      arr.push(s);
      map.set(s.roleId, arr);
    }
    return map;
  }, [staff]);

  const totalStaff = staff.length;
  const superAdmins = useMemo(() => staff.filter(s => s.isSuperAdmin), [staff]);
  const isSuperAdminExpanded = expandedRoleId === "superadmin";

  const openCreateRole = () => {
    setRoleForm({ ...EMPTY_ROLE_FORM, permissions: new Set() });
    setRoleFormOpen(true);
  };

  const openEditRole = (r: CustomRole) => {
    setRoleForm({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: new Set(r.permissions),
      isActive: r.isActive,
    });
    setRoleFormOpen(true);
  };

  const toggleRolePermission = (key: string) => {
    setRoleForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(key)) {
        next.delete(key);
        if (key === "export") {
          next.delete("export_withdrawals");
          next.delete("export_deposits");
          next.delete("export_users");
        }
      } else {
        next.add(key);
      }
      return { ...f, permissions: next };
    });
  };

  const saveRole = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    const name = roleForm.name.trim();
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    if (roleForm.permissions.size === 0) {
      toast.error("Select at least one permission");
      return;
    }
    setSavingRole(true);
    try {
      const url = roleForm.id
        ? `${API_BASE}/admin/roles/${encodeURIComponent(roleForm.id)}`
        : `${API_BASE}/admin/roles`;
      const res = await fetch(url, {
        method: roleForm.id ? "PATCH" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: roleForm.description.trim(),
          permissions: Array.from(roleForm.permissions),
          isActive: roleForm.isActive,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const saved = normalizeRole(body);
      if (saved) {
        setRoles((prev) => {
          const exists = prev.some((r) => r.id === saved.id);
          return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
        });
      } else {
        await loadAll();
      }
      toast.success(roleForm.id ? "Role updated" : "Role created");
      setRoleFormOpen(false);
      setRoleForm(EMPTY_ROLE_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingRole(false);
    }
  };

  const deleteRole = async () => {
    if (!confirmDeleteRole) return;
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setDeletingRoleId(confirmDeleteRole.id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/roles/${encodeURIComponent(confirmDeleteRole.id)}`,
        { method: "DELETE", headers },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== confirmDeleteRole.id));
      toast.success(`Deleted role "${confirmDeleteRole.name}"`);
      if (expandedRoleId === confirmDeleteRole.id) setExpandedRoleId(null);
      setConfirmDeleteRole(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingRoleId(null);
    }
  };

  const openCreateStaff = (roleId: string | null = null) => {
    setStaffForm({ ...EMPTY_STAFF_FORM, roleId: roleId ?? "", isSuperAdmin: roleId === null });
    setShowStaffPassword(false);
    setStaffFormOpen(true);
  };

  const openEditStaff = (s: StaffUser) => {
    setStaffForm({
      id: s.id,
      roleId: s.roleId,
      isSuperAdmin: s.isSuperAdmin,
      username: s.username,
      email: s.email,
      fullName: s.fullName,
      password: "",
    });
    setShowStaffPassword(false);
    setStaffFormOpen(true);
  };

  const saveStaff = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    const username = staffForm.username.trim().toLowerCase();
    const email = staffForm.email.trim().toLowerCase();
    const fullName = staffForm.fullName.trim();
    const isEdit = staffForm.id !== null;

    if (!isEdit) {
      if (!username || username.length < 3) {
        toast.error("Username must be at least 3 characters");
        return;
      }
      if (!/^[a-z0-9_.-]+$/.test(username)) {
        toast.error("Username can only contain letters, numbers, dot, underscore, hyphen");
        return;
      }
      if (!EMAIL_RE.test(email)) {
        toast.error("Enter a valid email address");
        return;
      }
      if (staffForm.password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
    }
    if (!fullName) {
      toast.error("Full name is required");
      return;
    }
    setSavingStaff(true);
    try {
      const url = isEdit
        ? `${API_BASE}/admin/staff/${encodeURIComponent(staffForm.id!)}`
        : `${API_BASE}/admin/staff`;
      const payload: Record<string, unknown> = isEdit
        ? { fullName, ...(staffForm.isSuperAdmin ? { isSuperAdmin: true } : { roleId: staffForm.roleId }) }
        : {
            username,
            email,
            password: staffForm.password,
            fullName,
            ...(staffForm.isSuperAdmin ? { isSuperAdmin: true } : { roleId: staffForm.roleId }),
          };
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const saved = normalizeStaff(body);
      if (saved) {
        setStaff((prev) => {
          const exists = prev.some((s) => s.id === saved.id);
          return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
        });
      } else {
        await loadAll();
      }
      toast.success(isEdit ? "Staff account updated" : "Staff account created");
      setStaffFormOpen(false);
      setStaffForm(EMPTY_STAFF_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingStaff(false);
    }
  };

  const toggleStaffActive = async (s: StaffUser) => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    const action = s.isActive ? "deactivate" : "activate";
    setTogglingStaffId(s.id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/staff/${encodeURIComponent(s.id)}/${action}`,
        { method: "POST", headers },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const saved = normalizeStaff(body);
      setStaff((prev) =>
        prev.map((x) => {
          if (x.id !== s.id) return x;
          return saved ?? { ...x, isActive: !x.isActive };
        }),
      );
      toast.success(s.isActive ? `Deactivated "${s.username}"` : `Activated "${s.username}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setTogglingStaffId(null);
    }
  };

  const deleteStaff = async () => {
    if (!confirmDeleteStaff) return;
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setDeletingStaffId(confirmDeleteStaff.id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/staff/${encodeURIComponent(confirmDeleteStaff.id)}`,
        { method: "DELETE", headers },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== confirmDeleteStaff.id));
      toast.success(`Deleted "${confirmDeleteStaff.username}"`);
      setConfirmDeleteStaff(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingStaffId(null);
    }
  };

  const openResetPassword = (s: StaffUser) => {
    setResetPwdTarget(s);
    setResetPwdValue("");
    setResetPwdShow(false);
  };

  const submitResetPassword = async () => {
    if (!resetPwdTarget) return;
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    if (resetPwdValue.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setResettingPwd(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/staff/${encodeURIComponent(resetPwdTarget.id)}/reset-password`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: resetPwdValue }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const saved = normalizeStaff(body);
      if (saved) {
        setStaff((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      }
      toast.success(`Reset password for "${resetPwdTarget.username}". They'll be asked to change it on next sign-in.`);
      setResetPwdTarget(null);
      setResetPwdValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setResettingPwd(false);
    }
  };

  const activeRoleName = staffForm.isSuperAdmin ? "Super Admin" : (roles.find((r) => r.id === staffForm.roleId)?.name ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Roles & Access</h1>
          <p className="text-muted-foreground mt-1">
            Create custom staff roles with page-level permissions, and manage the username
            and password credentials for the people working under each role.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateRole}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add role
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="glass-card p-4 sm:p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total roles</p>
          <p className="mt-1 font-mono text-2xl font-bold">
            {loading ? "—" : roles.length.toLocaleString()}
          </p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Staff accounts</p>
          <p className="mt-1 font-mono text-2xl font-bold">
            {loading ? "—" : totalStaff.toLocaleString()}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-4 p-4 sm:p-6"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> Roles
        </h2>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : roles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No custom roles yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first role to start onboarding staff under it.
            </p>
            <button
              type="button"
              onClick={openCreateRole}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add role
            </button>
          </div>
        ) : (
          
  
          <div className="space-y-3">
            {/* SUPER ADMIN BLOCK */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4 mb-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                          <ShieldCheck className="h-3 w-3" />
                          Super Administrators
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Users className="h-3 w-3" /> {superAdmins.length} {superAdmins.length === 1 ? "member" : "members"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">System administrators with unrestricted access to all features.</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                          <span className="rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            All Permissions
                          </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedRoleId(isSuperAdminExpanded ? null : "superadmin")}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/70"
                        aria-expanded={isSuperAdminExpanded}
                      >
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${isSuperAdminExpanded ? "rotate-180" : ""}`}
                        />
                        {isSuperAdminExpanded ? "Hide members" : "Manage members"}
                      </button>
                    </div>
                  </div>
                  
                  {isSuperAdminExpanded && (

                    <div className="mt-4 space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Staff accounts
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreateStaff(null)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <UserPlus className="h-3 w-3" /> Add Admin
                        </button>
                      </div>
                      {superAdmins.length === 0 ? (
                        <p className="rounded-lg bg-background/40 px-3 py-3 text-center text-xs text-muted-foreground">
                          No super admins yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {superAdmins.map((m) => (
                            <li
                              key={m.id}
                              className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="truncate text-sm font-medium font-mono">
                                    {m.username}
                                  </p>
                                  {!m.isActive && (
                                    <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      Inactive
                                    </span>
                                  )}
                                  {m.mustChangePassword && (
                                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">
                                      Pending password change
                                    </span>
                                  )}
                                </div>
                                {m.fullName && (
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {m.fullName}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleStaffActive(m)}
                                  disabled={togglingStaffId === m.id}
                                  title={m.isActive ? "Deactivate" : "Activate"}
                                  aria-pressed={m.isActive}
                                  aria-label={m.isActive ? "Deactivate staff" : "Activate staff"}
                                  className={`flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    m.isActive ? "bg-primary" : "bg-secondary"
                                  }`}
                                >
                                  <div
                                    className={`h-5 w-5 rounded-full bg-foreground transition-transform ${
                                      m.isActive ? "translate-x-5" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditStaff(m)}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] hover:bg-secondary/70"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openResetPassword(m)}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] hover:bg-secondary/70"
                                >
                                  <KeyRound className="h-3 w-3" /> Reset Pwd
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteStaff(m)}
                                  disabled={deletingStaffId === m.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                  )}
            </div>

            {roles.map((r) => {

              const members = staffByRole.get(r.id) ?? [];
              const isExpanded = expandedRoleId === r.id;
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-secondary/40 p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          <ShieldCheck className="h-3 w-3" />
                          {r.name}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Users className="h-3 w-3" /> {members.length}{" "}
                          {members.length === 1 ? "member" : "members"}
                        </span>
                        {!r.isActive && (
                          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {r.permissions.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">No permissions</span>
                        ) : (
                          r.permissions.map((key) => {
                            const p = permissionCatalog.find((x) => x.key === key);
                            return (
                              <span
                                key={key}
                                className="rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {p?.label ?? key}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedRoleId(isExpanded ? null : r.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/70"
                        aria-expanded={isExpanded}
                      >
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                        {isExpanded ? "Hide members" : "Manage members"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditRole(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/70"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRole(r)}
                        disabled={deletingRoleId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Staff accounts
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreateStaff(r.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <UserPlus className="h-3 w-3" /> Add staff
                        </button>
                      </div>
                      {members.length === 0 ? (
                        <p className="rounded-lg bg-background/40 px-3 py-3 text-center text-xs text-muted-foreground">
                          No staff accounts under this role yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {members.map((m) => (
                            <li
                              key={m.id}
                              className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="truncate text-sm font-medium font-mono">
                                    {m.username}
                                  </p>
                                  {!m.isActive && (
                                    <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      Inactive
                                    </span>
                                  )}
                                  {m.mustChangePassword && (
                                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">
                                      Pending password change
                                    </span>
                                  )}
                                </div>
                                {m.fullName && (
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {m.fullName}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleStaffActive(m)}
                                  disabled={togglingStaffId === m.id}
                                  title={m.isActive ? "Deactivate" : "Activate"}
                                  aria-pressed={m.isActive}
                                  aria-label={m.isActive ? "Deactivate staff" : "Activate staff"}
                                  className={`flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    m.isActive ? "bg-primary" : "bg-secondary"
                                  }`}
                                >
                                  <div
                                    className={`h-5 w-5 rounded-full bg-foreground transition-transform ${
                                      m.isActive ? "translate-x-5" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditStaff(m)}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] hover:bg-secondary/70"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openResetPassword(m)}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] hover:bg-secondary/70"
                                >
                                  <KeyRound className="h-3 w-3" /> Reset password
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteStaff(m)}
                                  disabled={deletingStaffId === m.id}
                                  title="Delete staff"
                                  aria-label="Delete staff"
                                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Role form dialog */}
      <Dialog
        open={roleFormOpen}
        onOpenChange={(open) => {
          if (!open && !savingRole) {
            setRoleFormOpen(false);
            setRoleForm(EMPTY_ROLE_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0 text-left">
            <DialogTitle>{roleForm.id ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>
              Define the role and which admin pages its staff can access.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label htmlFor="role-name" className="text-xs font-medium text-muted-foreground">
                Role name
              </label>
              <input
                id="role-name"
                value={roleForm.name}
                onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Support, IT, Sales"
                maxLength={40}
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label
                htmlFor="role-description"
                className="text-xs font-medium text-muted-foreground"
              >
                Description
              </label>
              <textarea
                id="role-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this role do?"
                rows={2}
                maxLength={200}
                className="mt-1.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Page permissions
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {roleForm.permissions.size} of {visibleCatalog.length} selected
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 rounded-xl border border-border bg-secondary/30 p-2 sm:grid-cols-2">
                {visibleCatalog.length === 0 ? (
                  <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    Loading permissions…
                  </p>
                ) : (
                  visibleCatalog.map((p) => {
                    const checked = roleForm.permissions.has(p.key);
                    if (p.key === "export") {
                      return (
                        <div
                          key={p.key}
                          className={`flex flex-col gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                            checked
                              ? "border-primary/50 bg-primary/10"
                              : "border-transparent hover:bg-secondary/60"
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRolePermission(p.key)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50"
                            />
                            <span className="min-w-0">
                              <span className="block font-medium text-foreground">{p.label}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {p.description}
                              </span>
                            </span>
                          </label>
                          {checked && (
                            <div className="ml-6 mt-1.5 space-y-2 border-l border-border/60 pl-3">
                              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground/80 hover:text-foreground">
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions.has("export_withdrawals")}
                                  onChange={() => toggleRolePermission("export_withdrawals")}
                                  className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50"
                                />
                                <span>Withdrawals</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground/80 hover:text-foreground">
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions.has("export_deposits")}
                                  onChange={() => toggleRolePermission("export_deposits")}
                                  className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50"
                                />
                                <span>Deposits</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground/80 hover:text-foreground">
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions.has("export_users")}
                                  onChange={() => toggleRolePermission("export_users")}
                                  className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50"
                                />
                                <span>Users</span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <label
                        key={p.key}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                          checked
                            ? "border-primary/50 bg-primary/10"
                            : "border-transparent hover:bg-secondary/60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRolePermission(p.key)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{p.label}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {p.description}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive roles block staff under them from signing in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleForm((f) => ({ ...f, isActive: !f.isActive }))}
                aria-pressed={roleForm.isActive}
                className={`flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors ${
                  roleForm.isActive ? "bg-primary" : "bg-secondary"
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-foreground transition-transform ${
                    roleForm.isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
          <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-secondary/20 shrink-0 flex flex-row items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRoleFormOpen(false);
                setRoleForm(EMPTY_ROLE_FORM);
              }}
              disabled={savingRole}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveRole}
              disabled={savingRole}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingRole ? "Saving…" : roleForm.id ? "Save changes" : "Create role"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff form dialog */}
      <Dialog
        open={staffFormOpen}
        onOpenChange={(open) => {
          if (!open && !savingStaff) {
            setStaffFormOpen(false);
            setStaffForm(EMPTY_STAFF_FORM);
            setShowStaffPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0 text-left">
            <DialogTitle>
              {staffForm.id ? "Edit staff account" : "New staff account"}
            </DialogTitle>
            <DialogDescription>
              {staffForm.id
                ? "Update the staff member's name or role. Use 'Reset password' to issue a new password."
                : activeRoleName
                ? `Create login credentials for someone in the "${activeRoleName}" role. They will be required to change the password on first sign-in.`
                : "Create login credentials. They will be required to change the password on first sign-in."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label htmlFor="staff-fullname" className="text-xs font-medium text-muted-foreground">
                Full name
              </label>
              <input
                id="staff-fullname"
                value={staffForm.fullName}
                onChange={(e) =>
                  setStaffForm((f) => ({ ...f, fullName: e.target.value }))
                }
                placeholder="e.g. Jane Doe"
                maxLength={120}
                className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {staffForm.id ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <select
                  value={staffForm.roleId}
                  onChange={(e) => setStaffForm((f) => ({ ...f, roleId: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="staff-username"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Username
                  </label>
                  <input
                    id="staff-username"
                    value={staffForm.username}
                    onChange={(e) =>
                      setStaffForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="e.g. support_jane"
                    autoComplete="off"
                    maxLength={32}
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Lowercase letters, numbers, dot, underscore, or hyphen. Min 3 characters.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="staff-email"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Email
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    value={staffForm.email}
                    onChange={(e) =>
                      setStaffForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="e.g. jane@example.com"
                    autoComplete="off"
                    maxLength={120}
                    className="mt-1.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label
                    htmlFor="staff-password"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Temporary password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="staff-password"
                      type={showStaffPassword ? "text" : "password"}
                      value={staffForm.password}
                      onChange={(e) =>
                        setStaffForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showStaffPassword ? "Hide password" : "Show password"}
                    >
                      {showStaffPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Share with them privately. They'll be forced to change it on first sign-in.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-secondary/20 shrink-0 flex flex-row items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setStaffFormOpen(false);
                setStaffForm(EMPTY_STAFF_FORM);
                setShowStaffPassword(false);
              }}
              disabled={savingStaff}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveStaff}
              disabled={savingStaff}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingStaff ? "Saving…" : staffForm.id ? "Save changes" : "Create account"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog
        open={resetPwdTarget !== null}
        onOpenChange={(open) => {
          if (!open && !resettingPwd) {
            setResetPwdTarget(null);
            setResetPwdValue("");
            setResetPwdShow(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {resetPwdTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Reset password</DialogTitle>
                <DialogDescription>
                  Issue a new temporary password for{" "}
                  <span className="font-mono font-semibold">{resetPwdTarget.username}</span>.
                  They will be required to change it on next sign-in.
                </DialogDescription>
              </DialogHeader>
              <div>
                <label className="text-xs font-medium text-muted-foreground">New password</label>
                <div className="relative mt-1.5">
                  <input
                    type={resetPwdShow ? "text" : "password"}
                    value={resetPwdValue}
                    onChange={(e) => setResetPwdValue(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setResetPwdShow((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={resetPwdShow ? "Hide password" : "Show password"}
                  >
                    {resetPwdShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => {
                    setResetPwdTarget(null);
                    setResetPwdValue("");
                    setResetPwdShow(false);
                  }}
                  disabled={resettingPwd}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitResetPassword}
                  disabled={resettingPwd}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {resettingPwd ? "Resetting…" : "Reset password"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete staff confirmation */}
      <Dialog
        open={confirmDeleteStaff !== null}
        onOpenChange={(open) => {
          if (!open && deletingStaffId === null) setConfirmDeleteStaff(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {confirmDeleteStaff && (
            <>
              <DialogHeader>
                <DialogTitle>Delete staff account</DialogTitle>
                <DialogDescription>
                  Permanently delete{" "}
                  <span className="font-mono font-semibold">{confirmDeleteStaff.username}</span>?
                  This cannot be undone. Super admins and your own account cannot be deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteStaff(null)}
                  disabled={deletingStaffId !== null}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteStaff}
                  disabled={deletingStaffId !== null}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {deletingStaffId !== null ? "Deleting…" : "Delete"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete role confirmation */}
      <Dialog
        open={confirmDeleteRole !== null}
        onOpenChange={(open) => {
          if (!open && deletingRoleId === null) setConfirmDeleteRole(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {confirmDeleteRole && (
            <>
              <DialogHeader>
                <DialogTitle>Delete role</DialogTitle>
                <DialogDescription>
                  Delete <span className="font-semibold">{confirmDeleteRole.name}</span>? This is
                  only allowed if no staff are currently assigned to it.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRole(null)}
                  disabled={deletingRoleId !== null}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteRole}
                  disabled={deletingRoleId !== null}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {deletingRoleId !== null ? "Deleting…" : "Delete"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRoles;
