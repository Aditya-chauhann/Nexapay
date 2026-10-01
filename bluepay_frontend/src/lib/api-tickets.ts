/**
 * Typed client for the support-ticket endpoints.
 *
 * User-side:
 *   POST   /user/tickets          — raise a ticket
 *   GET    /user/tickets          — list own tickets
 *   GET    /user/tickets/:id      — fetch one own ticket
 *
 * Staff-side (require the `tickets` permission, scoped by role.team):
 *   GET    /admin/tickets                   — list queue with filters
 *   POST   /admin/tickets/:id/assign-to-me  — claim
 *   POST   /admin/tickets/:id/transfer      — hand off to the other team
 *   POST   /admin/tickets/:id/resolve       — close
 *
 * Backend filters list responses to the caller's role team (super admin sees
 * everything). Tickets cannot be reopened — resolved is terminal.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

export type TicketTeam = "support" | "tech";
export type TicketAssignmentStatus = "unassigned" | "assigned";
export type TicketResolutionStatus = "pending" | "resolved";

export interface TicketAssignee {
  id: string;
  fullName: string;
  email: string;
}

export interface Ticket {
  id: string;
  userId: string;
  /** Hydrated by the backend on the admin list (may be empty for now). */
  userName?: string;
  userEmail?: string;
  title: string;
  description: string;
  team: TicketTeam;
  assignmentStatus: TicketAssignmentStatus;
  assignee: TicketAssignee | null;
  assignedAt: string | null;
  resolutionStatus: TicketResolutionStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminTicketFilters {
  team?: TicketTeam;
  assignmentStatus?: TicketAssignmentStatus;
  resolutionStatus?: TicketResolutionStatus;
  assigneeId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
    if (typeof m === "string") return m;
  }
  return `Request failed (HTTP ${res.status})`;
}

function normalizeAssignee(raw: unknown): TicketAssignee | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const fullName = ((r.fullName as string | undefined) ?? "").trim();
  if (!id || !fullName) return null;
  return { id, fullName, email: ((r.email as string | undefined) ?? "").trim() };
}

function pickStr(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  return typeof v === "string" ? v : "";
}

function pickNullableStr(r: Record<string, unknown>, key: string): string | null {
  const v = r[key];
  return typeof v === "string" ? v : null;
}

export function normalizeTicket(raw: unknown): Ticket | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  if (!id) return null;
  const team = r.team === "tech" ? "tech" : "support";
  const assignmentStatus = r.assignmentStatus === "assigned" ? "assigned" : "unassigned";
  const resolutionStatus = r.resolutionStatus === "resolved" ? "resolved" : "pending";
  // Some endpoints may surface the requesting user's display info denormalized.
  const userObj = (r.user as Record<string, unknown> | undefined) ?? undefined;
  return {
    id,
    userId: pickStr(r, "userId") || (userObj ? pickStr(userObj, "id") : ""),
    userName:
      pickStr(r, "userName") || (userObj ? pickStr(userObj, "name") : "") || undefined,
    userEmail:
      pickStr(r, "userEmail") || (userObj ? pickStr(userObj, "email") : "") || undefined,
    title: pickStr(r, "title"),
    description: pickStr(r, "description"),
    team,
    assignmentStatus,
    assignee: normalizeAssignee(r.assignee),
    assignedAt: pickNullableStr(r, "assignedAt"),
    resolutionStatus,
    resolvedAt: pickNullableStr(r, "resolvedAt"),
    resolvedBy: pickNullableStr(r, "resolvedBy"),
    createdAt: pickStr(r, "createdAt"),
    updatedAt: pickStr(r, "updatedAt"),
  };
}

function normalizeList(body: unknown): Ticket[] {
  const items = Array.isArray((body as { items?: unknown })?.items)
    ? ((body as { items: unknown[] }).items)
    : Array.isArray(body)
    ? (body as unknown[])
    : [];
  return items.map(normalizeTicket).filter((t): t is Ticket => t !== null);
}

// ---------- USER ----------

export async function createUserTicket(
  input: { title: string; description: string },
  signal?: AbortSignal,
): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/user/tickets`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  const ticket = normalizeTicket(body);
  if (!ticket) throw new Error("Malformed ticket response");
  return ticket;
}

export async function listUserTickets(signal?: AbortSignal): Promise<Ticket[]> {
  const res = await fetch(`${API_BASE}/user/tickets`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return normalizeList(await res.json());
}

export async function getUserTicket(id: string, signal?: AbortSignal): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/user/tickets/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const ticket = normalizeTicket(await res.json());
  if (!ticket) throw new Error("Malformed ticket response");
  return ticket;
}

// ---------- ADMIN ----------

export async function createAdminTicket(
  input: { title: string; description: string; team: TicketTeam },
  signal?: AbortSignal,
): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/admin/tickets`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const ticket = normalizeTicket(await res.json());
  if (!ticket) throw new Error("Malformed ticket response");
  return ticket;
}

export async function listAdminTickets(
  filters: AdminTicketFilters = {},
  signal?: AbortSignal,
): Promise<AdminTicketListResponse> {
  const url = new URL(`${API_BASE}/admin/tickets`);
  if (filters.team) url.searchParams.set("team", filters.team);
  if (filters.assignmentStatus)
    url.searchParams.set("assignmentStatus", filters.assignmentStatus);
  if (filters.resolutionStatus)
    url.searchParams.set("resolutionStatus", filters.resolutionStatus);
  if (filters.assigneeId) url.searchParams.set("assigneeId", filters.assigneeId);
  if (filters.userId) url.searchParams.set("userId", filters.userId);
  if (filters.page) url.searchParams.set("page", String(filters.page));
  if (filters.limit) url.searchParams.set("limit", String(filters.limit));
  const res = await fetch(url.toString(), { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return {
    items: normalizeList(body),
    total: typeof body?.total === "number" ? body.total : 0,
    page: typeof body?.page === "number" ? body.page : 1,
    limit: typeof body?.limit === "number" ? body.limit : 25,
  };
}

export async function assignTicketToMe(id: string): Promise<Ticket> {
  const res = await fetch(
    `${API_BASE}/admin/tickets/${encodeURIComponent(id)}/assign-to-me`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const ticket = normalizeTicket(await res.json());
  if (!ticket) throw new Error("Malformed ticket response");
  return ticket;
}

export async function transferTicket(id: string, team: TicketTeam): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/admin/tickets/${encodeURIComponent(id)}/transfer`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ team }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const ticket = normalizeTicket(await res.json());
  if (!ticket) throw new Error("Malformed ticket response");
  return ticket;
}

export async function resolveTicket(id: string): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/admin/tickets/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const ticket = normalizeTicket(await res.json());
  if (!ticket) throw new Error("Malformed ticket response");
  return ticket;
}
