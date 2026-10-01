/**
 * Typed client for the user UPI-account endpoints under `/user/upi-accounts/*`.
 *
 * Mirrors the bank-account flow used on the Withdraw page, including the
 * duplicate-owner approval workflow: if you add a UPI ID already linked to
 * another user, it lands in `pending` until that user approves it, and can't be
 * withdrawn to until then. UPI IDs (VPAs) can't be verified against any API, so
 * the UI also asks the user to confirm the VPA in a modal before saving.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

/** Loose VPA check: `handle@psp` (e.g. name@oksbi, 9876543210@ybl). */
export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

export type UpiApprovalStatus = "approved" | "pending" | "rejected";

export interface UpiAccount {
  id: string;
  upiId: string;
  accountHolderName: string;
  isDefault: boolean;
  isActive: boolean;
  approvalStatus: UpiApprovalStatus;
  approvalRequiredFrom: string | null;
}

/** A UPI another user added that duplicates one of mine — awaiting my decision. */
export interface SharedUpiRequest {
  id: string;
  requesterName: string | null;
  requesterEmail: string | null;
  accountHolderName: string;
  upiId: string;
  createdAt: string | null;
}

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

async function messageFromResponse(res: Response, fallbackConflict?: string): Promise<string> {
  const json = await res.json().catch(() => null);
  if (res.status === 409 && fallbackConflict) return fallbackConflict;
  return Array.isArray(json?.message)
    ? json.message.join(", ")
    : json?.message ?? `Request failed (HTTP ${res.status})`;
}

export function normalizeUpiAccount(raw: unknown): UpiAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id ?? r._id) as string | undefined;
  const upiId = (r.upiId ?? r.vpa) as string | undefined;
  if (!id || !upiId) return null;
  const rawStatus = (r.approvalStatus as string | undefined)?.toLowerCase();
  const approvalStatus: UpiApprovalStatus =
    rawStatus === "pending" || rawStatus === "rejected" ? rawStatus : "approved";
  return {
    id,
    upiId,
    accountHolderName: (r.accountHolderName as string) ?? "",
    isDefault: Boolean(r.isDefault),
    // Legacy UPIs created before the active/inactive feature omit the field and
    // are treated as active.
    isActive: r.isActive === undefined ? true : Boolean(r.isActive),
    approvalStatus,
    approvalRequiredFrom: (r.approvalRequiredFrom as string | null | undefined) ?? null,
  };
}

export function normalizeSharedUpiRequest(raw: unknown): SharedUpiRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id ?? r._id) as string | undefined;
  const upiId = (r.upiId ?? r.vpa) as string | undefined;
  if (!id || !upiId) return null;
  const requesterObj =
    (r.requester as Record<string, unknown> | undefined) ??
    (r.requestedBy as Record<string, unknown> | undefined) ??
    null;
  const nameFromObj =
    (requesterObj?.fullName as string | undefined)?.trim() ??
    (requesterObj?.name as string | undefined)?.trim() ??
    null;
  const emailFromObj = (requesterObj?.email as string | undefined)?.trim() ?? null;
  const flatName = (r.requesterName as string | undefined)?.trim() ?? null;
  const flatEmail = (r.requesterEmail as string | undefined)?.trim() ?? null;
  return {
    id,
    requesterName: nameFromObj || flatName || null,
    requesterEmail: emailFromObj || flatEmail || null,
    accountHolderName: (r.accountHolderName as string | undefined) ?? "",
    upiId,
    createdAt: (r.createdAt as string | null | undefined) ?? null,
  };
}

export class UpiAccountError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UpiAccountError";
    this.status = status;
  }
}

export async function listUpiAccounts(signal?: AbortSignal): Promise<UpiAccount[]> {
  const headers = authHeaders();
  if (!headers) return [];
  const res = await fetch(`${API_BASE}/user/upi-accounts`, { headers, signal });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new UpiAccountError(await messageFromResponse(res), res.status);
  }
  const body = await res.json().catch(() => null);
  const list = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
  return list
    .map(normalizeUpiAccount)
    .filter((x: UpiAccount | null): x is UpiAccount => x !== null);
}

export async function createUpiAccount(input: {
  upiId: string;
  accountHolderName: string;
  isDefault?: boolean;
}): Promise<UpiAccount | null> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const body: Record<string, unknown> = {
    upiId: input.upiId,
    accountHolderName: input.accountHolderName,
  };
  if (input.isDefault) body.isDefault = true;
  const res = await fetch(`${API_BASE}/user/upi-accounts`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new UpiAccountError(
      await messageFromResponse(res, "This UPI ID is already saved"),
      res.status,
    );
  }
  return normalizeUpiAccount(await res.json().catch(() => null));
}

export async function updateUpiAccount(
  id: string,
  input: { upiId: string; accountHolderName: string; isDefault?: boolean },
): Promise<UpiAccount | null> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const body: Record<string, unknown> = {
    upiId: input.upiId,
    accountHolderName: input.accountHolderName,
  };
  if (input.isDefault) body.isDefault = true;
  const res = await fetch(`${API_BASE}/user/upi-accounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new UpiAccountError(
      await messageFromResponse(res, "This UPI ID is already saved"),
      res.status,
    );
  }
  return normalizeUpiAccount(await res.json().catch(() => null));
}

export async function deleteUpiAccount(id: string): Promise<void> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const res = await fetch(`${API_BASE}/user/upi-accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new UpiAccountError(await messageFromResponse(res), res.status);
}

export async function setDefaultUpiAccount(id: string): Promise<void> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const res = await fetch(`${API_BASE}/user/upi-accounts/${encodeURIComponent(id)}/default`, {
    method: "PATCH",
    headers,
  });
  if (!res.ok) throw new UpiAccountError(await messageFromResponse(res), res.status);
}

/**
 * Activate/deactivate a saved UPI. Inactive UPIs stay saved and visible but can't
 * be used for withdrawals. The backend rejects deactivating the default UPI and
 * toggling a not-yet-approved (shared) UPI — surface the message and revert.
 */
export async function setUpiAccountActive(
  id: string,
  isActive: boolean,
): Promise<UpiAccount | null> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const res = await fetch(`${API_BASE}/user/upi-accounts/${encodeURIComponent(id)}/active`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throw new UpiAccountError(await messageFromResponse(res), res.status);
  return normalizeUpiAccount(await res.json().catch(() => null));
}

/**
 * Smart UPI Selection: a per-user toggle. When enabled, a withdrawal submitted
 * without a UPI lets the backend pick a random active+approved UPI automatically.
 */
export async function getSmartUpiSelection(signal?: AbortSignal): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) return false;
  const res = await fetch(`${API_BASE}/user/upi-accounts/smart-selection`, { headers, signal });
  if (!res.ok) {
    if (res.status === 404) return false;
    throw new UpiAccountError(await messageFromResponse(res), res.status);
  }
  const body = await res.json().catch(() => null);
  return Boolean(body?.enabled);
}

export async function setSmartUpiSelection(enabled: boolean): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const res = await fetch(`${API_BASE}/user/upi-accounts/smart-selection`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new UpiAccountError(await messageFromResponse(res), res.status);
  const body = await res.json().catch(() => null);
  return Boolean(body?.enabled);
}

/** UPI IDs others added that duplicate mine — they need my approve/reject. */
export async function listUpiPendingApprovals(signal?: AbortSignal): Promise<SharedUpiRequest[]> {
  const headers = authHeaders();
  if (!headers) return [];
  const res = await fetch(`${API_BASE}/user/upi-accounts/pending-approvals`, { headers, signal });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new UpiAccountError(await messageFromResponse(res), res.status);
  }
  const body = await res.json().catch(() => null);
  const list = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
  return list
    .map(normalizeSharedUpiRequest)
    .filter((x: SharedUpiRequest | null): x is SharedUpiRequest => x !== null);
}

export async function decideUpiPendingApproval(
  id: string,
  action: "approve" | "reject",
): Promise<void> {
  const headers = authHeaders();
  if (!headers) throw new UpiAccountError("Not authenticated", 401);
  const res = await fetch(
    `${API_BASE}/user/upi-accounts/pending-approvals/${encodeURIComponent(id)}/${action}`,
    { method: "POST", headers },
  );
  if (!res.ok) throw new UpiAccountError(await messageFromResponse(res), res.status);
}
