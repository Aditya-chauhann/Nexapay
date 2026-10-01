/**
 * Typed client for the user's own withdrawal endpoints.
 *
 * Currently scoped to the "smart" auto-liquidation payouts surfaced on the
 * Transactions → Smart tab (only shown when Smart UPI Selection is enabled):
 *   GET  /user/withdrawals/smart        — own smart UPI payouts, newest first
 *   POST /user/withdrawals/:id/decline  — decline a payout inside its window
 *   POST /user/withdrawals/:id/confirm-received — confirm a paid payout was received
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

export type SmartWithdrawalStatus = "awaiting_payment" | "paid" | "failed";

export interface SmartWithdrawal {
  id: string;
  method: string; // "upi"
  isSmart: boolean;
  amount: number | null; // USDT
  netInr: number | null; // INR paid
  upiId: string | null;
  status: SmartWithdrawalStatus;
  /** Decline allowed until this instant, else null. */
  declineWindowExpiresAt: string | null;
  /** Dispute window (set once paid), else null. */
  disputeWindowExpiresAt: string | null;
  paymentProofUrl: string | null;
  /** Extra INR the payer sent beyond the announced amount (null = no overpay). */
  overpaidBy: number | null;
  /** Amount OCR read from the payer's screenshot when overpaid (what they sent). */
  screenshotAmountInr: number | null;
  createdAt: string;
  processedAt: string | null;
}

export class WithdrawalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WithdrawalError";
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  let message = `Request failed (HTTP ${res.status})`;
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) message = m.filter((x) => typeof x === "string").join(", ");
    else if (typeof m === "string") message = m;
  }
  throw new WithdrawalError(message, res.status);
}

function pickNullableStr(r: Record<string, unknown>, key: string): string | null {
  const v = r[key];
  return typeof v === "string" ? v : null;
}

function pickNullableNum(r: Record<string, unknown>, key: string): number | null {
  const v = Number(r[key]);
  return Number.isFinite(v) && r[key] != null ? v : null;
}

function normalizeSmart(raw: unknown): SmartWithdrawal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  if (!id) return null;
  const status: SmartWithdrawalStatus =
    r.status === "paid" || r.status === "failed" ? r.status : "awaiting_payment";
  return {
    id,
    method: typeof r.method === "string" ? r.method : "upi",
    isSmart: Boolean(r.isSmart),
    amount: pickNullableNum(r, "amount"),
    netInr: pickNullableNum(r, "netInr"),
    upiId: pickNullableStr(r, "upiId"),
    status,
    declineWindowExpiresAt: pickNullableStr(r, "declineWindowExpiresAt"),
    disputeWindowExpiresAt: pickNullableStr(r, "disputeWindowExpiresAt"),
    paymentProofUrl: pickNullableStr(r, "paymentProofUrl"),
    overpaidBy: pickNullableNum(r, "overpaidBy"),
    screenshotAmountInr: pickNullableNum(r, "screenshotAmountInr"),
    createdAt: pickNullableStr(r, "createdAt") ?? "",
    processedAt: pickNullableStr(r, "processedAt"),
  };
}

/** The user's smart UPI auto-liquidation payouts (isSmart: true), newest first. */
export async function listSmartWithdrawals(
  limit = 200,
  signal?: AbortSignal,
): Promise<SmartWithdrawal[]> {
  const url = new URL(`${API_BASE}/user/withdrawals/smart`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { headers: authHeaders(), signal });
  if (!res.ok) await throwError(res);
  const body = await res.json();
  const items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
  return items.map(normalizeSmart).filter((w: SmartWithdrawal | null): w is SmartWithdrawal => w !== null);
}

/** Decline a payout while its decline window is still open. */
export async function declineWithdrawal(id: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/user/withdrawals/${encodeURIComponent(id)}/decline`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) await throwError(res);
}

/** Confirm receipt of a paid UPI withdrawal during the dispute window. */
export async function confirmWithdrawalReceived(id: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/user/withdrawals/${encodeURIComponent(id)}/confirm-received`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) await throwError(res);
}
