/**
 * Typed client for the withdrawal-dispute endpoints.
 *
 * A dispute is raised by a user when an approved UPI payout didn't arrive (or
 * arrived wrong). It lives in its own `withdrawaldisputes` collection but shares
 * the staff assignment/resolution lifecycle with support tickets, so the same
 * ticket-management screen can work and close them.
 *
 * User-side (JWT):
 *   POST   /user/withdrawal-disputes      — raise a dispute
 *   GET    /user/withdrawal-disputes      — list own disputes
 *   GET    /user/withdrawal-disputes/:id  — fetch one own dispute
 *
 * Staff-side (require the `tickets` permission, scoped by role.team):
 *   GET    /admin/withdrawal-disputes                   — list queue with filters
 *   GET    /admin/withdrawal-disputes/:id               — fetch one
 *   POST   /admin/withdrawal-disputes/:id/assign-to-me  — claim
 *   POST   /admin/withdrawal-disputes/:id/transfer      — hand off to the other team
 *   POST   /admin/withdrawal-disputes/:id/resolve       — close (assigned first)
 *
 * Resolving is terminal and must be done by the assignee (claim before close).
 */

import {
  type TicketTeam,
  type TicketAssignmentStatus,
  type TicketResolutionStatus,
  type TicketAssignee,
} from "@/lib/api-tickets";

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

export type DisputeReason = "not_received" | "wrong_amount" | "other";
/** Direction a super-admin adjustment moves the user's balance on approve. */
export type DisputeDirection = "credit" | "debit";
/** Set once a super admin resolves the dispute; null while still pending. */
export type DisputeDecision = "approved" | "declined";

export interface WithdrawalDispute {
  id: string;
  withdrawalId: string;
  userId: string;
  /** Hydrated by the backend on the admin list (may be empty for now). */
  userName?: string;
  userEmail?: string;
  reason: DisputeReason;
  description: string;
  /** Snapshots captured from the withdrawal when the dispute was raised. */
  amount: number | null;
  /** INR the user was due to receive on the disputed payout. */
  netInr: number | null;
  upiId: string | null;
  utr: string | null;
  /** User-attached bank statement PDF (proof), if any. */
  bankStatementUrl: string | null;
  team: TicketTeam;
  assignmentStatus: TicketAssignmentStatus;
  assignee: TicketAssignee | null;
  assignedAt: string | null;
  resolutionStatus: TicketResolutionStatus;
  /** Super-admin verdict once resolved: approved / declined (null while pending). */
  resolutionDecision: DisputeDecision | null;
  /** Signed USDT applied to the user on approve (+credit / −debit; 0 on decline). */
  resolutionAdjustmentUsd: number | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDisputeListResponse {
  items: WithdrawalDispute[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminDisputeFilters {
  team?: TicketTeam;
  assignmentStatus?: TicketAssignmentStatus;
  resolutionStatus?: TicketResolutionStatus;
  assigneeId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

/** Thrown so callers can branch on the backend's machine-readable code. */
export class WithdrawalDisputeError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "WithdrawalDisputeError";
    this.code = code;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  let message = `Request failed (HTTP ${res.status})`;
  let code = "";
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) message = m.filter((x) => typeof x === "string").join(", ");
    else if (typeof m === "string") message = m;
    const c = (body as { code?: unknown }).code;
    if (typeof c === "string") code = c;
  }
  throw new WithdrawalDisputeError(message, code);
}

function pickStr(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  return typeof v === "string" ? v : "";
}

function pickNullableStr(r: Record<string, unknown>, key: string): string | null {
  const v = r[key];
  return typeof v === "string" ? v : null;
}

function normalizeAssignee(raw: unknown): TicketAssignee | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const fullName = ((r.fullName as string | undefined) ?? "").trim();
  if (!id || !fullName) return null;
  return { id, fullName, email: ((r.email as string | undefined) ?? "").trim() };
}

export function normalizeDispute(raw: unknown): WithdrawalDispute | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  if (!id) return null;
  const reason =
    r.reason === "not_received" || r.reason === "wrong_amount" ? r.reason : "other";
  const team = r.team === "tech" ? "tech" : "support";
  const assignmentStatus = r.assignmentStatus === "assigned" ? "assigned" : "unassigned";
  const resolutionStatus = r.resolutionStatus === "resolved" ? "resolved" : "pending";
  const userObj = (r.user as Record<string, unknown> | undefined) ?? undefined;
  const amountNum = Number(r.amount);
  const netInrNum = Number(r.netInr);
  const adjustmentNum = Number(r.resolutionAdjustmentUsd);
  const decision =
    r.resolutionDecision === "approved" || r.resolutionDecision === "declined"
      ? r.resolutionDecision
      : null;
  return {
    id,
    withdrawalId:
      pickStr(r, "withdrawalId") || (r.withdrawal ? String(r.withdrawal) : ""),
    userId: pickStr(r, "userId") || (userObj ? pickStr(userObj, "id") : ""),
    userName: pickStr(r, "userName") || (userObj ? pickStr(userObj, "name") : "") || undefined,
    userEmail: pickStr(r, "userEmail") || (userObj ? pickStr(userObj, "email") : "") || undefined,
    reason,
    description: pickStr(r, "description"),
    amount: Number.isFinite(amountNum) && r.amount != null ? amountNum : null,
    netInr: Number.isFinite(netInrNum) && r.netInr != null ? netInrNum : null,
    upiId: pickNullableStr(r, "upiId"),
    utr: pickNullableStr(r, "utr"),
    bankStatementUrl: pickNullableStr(r, "bankStatementUrl"),
    team,
    assignmentStatus,
    assignee: normalizeAssignee(r.assignee),
    assignedAt: pickNullableStr(r, "assignedAt"),
    resolutionStatus,
    resolutionDecision: decision,
    resolutionAdjustmentUsd:
      Number.isFinite(adjustmentNum) && r.resolutionAdjustmentUsd != null ? adjustmentNum : null,
    resolutionNotes: pickNullableStr(r, "resolutionNotes"),
    resolvedAt: pickNullableStr(r, "resolvedAt"),
    resolvedBy: pickNullableStr(r, "resolvedBy"),
    createdAt: pickStr(r, "createdAt"),
    updatedAt: pickStr(r, "updatedAt"),
  };
}

function normalizeList(body: unknown): WithdrawalDispute[] {
  const items = Array.isArray((body as { items?: unknown })?.items)
    ? (body as { items: unknown[] }).items
    : Array.isArray(body)
    ? (body as unknown[])
    : [];
  return items.map(normalizeDispute).filter((d): d is WithdrawalDispute => d !== null);
}

// ---------- USER ----------

export async function createWithdrawalDispute(
  input: {
    withdrawalId: string;
    reason?: DisputeReason;
    description: string;
    /** Optional bank-statement PDF the user attaches as proof. */
    bankStatement?: File | null;
  },
  signal?: AbortSignal,
): Promise<WithdrawalDispute> {
  // Sent as multipart/form-data so the optional bank-statement PDF can ride
  // along. Don't set Content-Type — the browser adds the multipart boundary.
  const form = new FormData();
  form.append("withdrawalId", input.withdrawalId);
  form.append("description", input.description);
  if (input.reason) form.append("reason", input.reason);
  if (input.bankStatement) form.append("bankStatement", input.bankStatement);
  const res = await fetch(`${API_BASE}/user/withdrawal-disputes`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
    signal,
  });
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

export async function listUserDisputes(signal?: AbortSignal): Promise<WithdrawalDispute[]> {
  const res = await fetch(`${API_BASE}/user/withdrawal-disputes`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) await throwError(res);
  return normalizeList(await res.json());
}

export async function getUserDispute(
  id: string,
  signal?: AbortSignal,
): Promise<WithdrawalDispute> {
  const res = await fetch(`${API_BASE}/user/withdrawal-disputes/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

// ---------- ADMIN ----------

export async function listAdminDisputes(
  filters: AdminDisputeFilters = {},
  signal?: AbortSignal,
): Promise<AdminDisputeListResponse> {
  const url = new URL(`${API_BASE}/admin/withdrawal-disputes`);
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
  if (!res.ok) await throwError(res);
  const body = await res.json();
  return {
    items: normalizeList(body),
    total: typeof body?.total === "number" ? body.total : 0,
    page: typeof body?.page === "number" ? body.page : 1,
    limit: typeof body?.limit === "number" ? body.limit : 25,
  };
}

export async function getAdminDispute(
  id: string,
  signal?: AbortSignal,
): Promise<WithdrawalDispute> {
  const res = await fetch(`${API_BASE}/admin/withdrawal-disputes/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

export async function assignDisputeToMe(id: string): Promise<WithdrawalDispute> {
  const res = await fetch(
    `${API_BASE}/admin/withdrawal-disputes/${encodeURIComponent(id)}/assign-to-me`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

export async function transferDispute(
  id: string,
  team: TicketTeam,
): Promise<WithdrawalDispute> {
  const res = await fetch(
    `${API_BASE}/admin/withdrawal-disputes/${encodeURIComponent(id)}/transfer`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    },
  );
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

export async function resolveDispute(
  id: string,
  resolutionNotes?: string,
): Promise<WithdrawalDispute> {
  const res = await fetch(
    `${API_BASE}/admin/withdrawal-disputes/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(resolutionNotes ? { resolutionNotes } : {}),
    },
  );
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

/**
 * Super-admin only. Approve a dispute (the user was right): credit or debit the
 * user's balance by `amountUsdt` and mark the linked withdrawal `resolved`.
 */
export async function approveDispute(
  id: string,
  input: { amountUsdt: number; direction: DisputeDirection; resolutionNotes?: string },
): Promise<WithdrawalDispute> {
  const res = await fetch(
    `${API_BASE}/admin/withdrawal-disputes/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amountUsdt: input.amountUsdt,
        direction: input.direction,
        ...(input.resolutionNotes ? { resolutionNotes: input.resolutionNotes } : {}),
      }),
    },
  );
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}

/**
 * Super-admin only. Decline a dispute (it was false): no balance change, the
 * linked withdrawal goes back to `paid`.
 */
export async function declineDispute(
  id: string,
  resolutionNotes?: string,
): Promise<WithdrawalDispute> {
  const res = await fetch(
    `${API_BASE}/admin/withdrawal-disputes/${encodeURIComponent(id)}/decline`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(resolutionNotes ? { resolutionNotes } : {}),
    },
  );
  if (!res.ok) await throwError(res);
  const dispute = normalizeDispute(await res.json());
  if (!dispute) throw new WithdrawalDisputeError("Malformed dispute response", "");
  return dispute;
}
