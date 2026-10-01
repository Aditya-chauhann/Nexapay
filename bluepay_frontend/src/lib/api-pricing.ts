/**
 * Typed client for the pricing endpoints (backend in src/modules/pricing).
 * All calls are gated by PERMISSIONS.Settings on the server; SuperAdmin bypasses.
 *
 * feePercent is a decimal (0.015 = 1.5%) in the API. UI converts to/from %.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

export interface GlobalPricing {
  usdtPrice: number;
  inrPrice: number;
  upiInrPrice: number;
  feePercent: number;
  bankFee: number;
  cryptoFee: number;
  smartToggleMinUsdt: number;
  enableBankWithdrawal?: boolean;
  enableUpiWithdrawal?: boolean;
  enableSmartUpiWithdrawal?: boolean;
  enableCryptoWithdrawal?: boolean;
  enableSweep?: boolean;
  sweepDelayMinutes?: number;
  updatedAt: string;
  updatedBy: string | null;
  updatedByType: "user" | "staff" | null;
}

/** Each field in an override is either a number (set) or null (use global). */
export interface PricingOverride {
  usdtPrice: number | null;
  inrPrice: number | null;
  upiInrPrice: number | null;
  feePercent: number | null;
}

export interface UserPricingResponse {
  override: PricingOverride | null;
  effective: {
    usdtPrice: number;
    inrPrice: number;
    upiInrPrice: number;
    feePercent: number;
    bankFee?: number;
    cryptoFee?: number;
  };
}

/**
 * Effective pricing for the authenticated user (per-user override if present,
 * otherwise global). Returned by GET /pricing/me — used by user-facing pages
 * like Withdraw/Dashboard so they don't have to hardcode rates.
 */
export interface MyPricing {
  usdtPrice: number;
  inrPrice: number;
  upiInrPrice: number;
  feePercent: number;
  bankFee?: number;
  cryptoFee?: number;
  smartToggleMinUsdt?: number;
  enableBankWithdrawal?: boolean;
  enableUpiWithdrawal?: boolean;
  enableSmartUpiWithdrawal?: boolean;
  enableCryptoWithdrawal?: boolean;
  enableSweep?: boolean;
  hasOverride: boolean;
}

export interface SystemControlSettings {
  enableDeposits: boolean;
  enableWithdrawals: boolean;
  enableBankWithdrawal: boolean;
  enableUpiWithdrawal: boolean;
  enableSmartUpiWithdrawal: boolean;
  enableCryptoWithdrawal: boolean;
  enableSweep: boolean;
}

export function getSystemControlSettings(): SystemControlSettings {
  try {
    const raw = localStorage.getItem("TrustO_system_controls_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enableDeposits: parsed.enableDeposits ?? true,
        enableWithdrawals: parsed.enableWithdrawals ?? true,
        enableBankWithdrawal: parsed.enableBankWithdrawal ?? true,
        enableUpiWithdrawal: parsed.enableUpiWithdrawal ?? true,
        enableSmartUpiWithdrawal: parsed.enableSmartUpiWithdrawal ?? true,
        enableCryptoWithdrawal: parsed.enableCryptoWithdrawal ?? true,
        enableSweep: parsed.enableSweep ?? false,
      };
    }
  } catch {}
  return {
    enableDeposits: true,
    enableWithdrawals: true,
    enableBankWithdrawal: true,
    enableUpiWithdrawal: true,
    enableSmartUpiWithdrawal: true,
    enableCryptoWithdrawal: true,
    enableSweep: false,
  };
}

export function saveSystemControlSettings(settings: SystemControlSettings) {
  localStorage.setItem("TrustO_system_controls_v1", JSON.stringify(settings));
}

export interface GasMaintenanceInfo {
  gasFeeWalletAddress: string;
  usdtDestinationAddress: string;
  trxBalance: number;
  usdtBalance: number;
  destinationTrxBalance?: number;
  destinationUsdtBalance?: number;
  isAlert: boolean;
  alertLevel: "CRITICAL" | "URGENT" | "WARNING" | "HEALTHY";
  triggeredThreshold: number | null;
  lastCheckedAt: string;
  sweepEnabled: boolean;
  sweepDelayMinutes?: number;
  thresholds: {
    warning: number;
    urgent: number;
    critical: number;
  };
}

export interface PricingHistoryEntry {
  id: string;
  scope: "global" | "user";
  userId?: string;
  changes: Array<{ field: string; oldValue: number | null; newValue: number | null }>;
  changedAt: string;
  changedBy: string | null;
  changedByType: "user" | "staff" | null;
}

export interface PricingHistoryPage {
  items: PricingHistoryEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface PricingOverrideListEntry {
  userId: string;
  name?: string | null;
  email?: string | null;
  override: PricingOverride;
  updatedAt: string;
}

export interface PricingOverrideListPage {
  items: PricingOverrideListEntry[];
  total: number;
  page: number;
  limit: number;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string") return m;
  }
  return `Request failed (HTTP ${res.status})`;
}

export async function getGlobalPricing(signal?: AbortSignal): Promise<GlobalPricing> {
  const res = await fetch(`${API_BASE}/admin/pricing`, { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getPublicPricing(signal?: AbortSignal): Promise<GlobalPricing> {
  const res = await fetch(`${API_BASE}/public/pricing`, { signal });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getMyPricing(signal?: AbortSignal): Promise<MyPricing> {
  const res = await fetch(`${API_BASE}/pricing/me`, { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patchGlobalPricing(
  changes: Partial<
    Pick<
      GlobalPricing,
      | "usdtPrice"
      | "inrPrice"
      | "upiInrPrice"
      | "feePercent"
      | "bankFee"
      | "cryptoFee"
      | "smartToggleMinUsdt"
      | "enableSweep"
      | "sweepDelayMinutes"
    >
  >,
): Promise<GlobalPricing> {
  const res = await fetch(`${API_BASE}/admin/pricing`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getUserPricing(
  userId: string,
  signal?: AbortSignal,
): Promise<UserPricingResponse> {
  const res = await fetch(
    `${API_BASE}/admin/users/${encodeURIComponent(userId)}/pricing`,
    { headers: authHeaders(), signal },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function putUserPricing(
  userId: string,
  override: PricingOverride,
): Promise<UserPricingResponse> {
  const res = await fetch(
    `${API_BASE}/admin/users/${encodeURIComponent(userId)}/pricing`,
    {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(override),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteUserPricing(userId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/admin/users/${encodeURIComponent(userId)}/pricing`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
}

export async function listPricingOverrides(
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<PricingOverrideListPage> {
  const url = new URL(`${API_BASE}/admin/pricing/overrides`);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getPricingHistory(
  params: { scope: "global" | "user"; userId?: string; page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<PricingHistoryPage> {
  const path =
    params.scope === "user" && params.userId
      ? `${API_BASE}/admin/users/${encodeURIComponent(params.userId)}/pricing/history`
      : `${API_BASE}/admin/pricing/history`;
  const url = new URL(path);
  url.searchParams.set("scope", params.scope);
  if (params.scope === "user" && params.userId) url.searchParams.set("userId", params.userId);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getGasMaintenanceInfo(signal?: AbortSignal): Promise<GasMaintenanceInfo> {
  const res = await fetch(`${API_BASE}/admin/gas-maintenance`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function triggerGasBalanceCheck(): Promise<GasMaintenanceInfo> {
  const res = await fetch(`${API_BASE}/admin/gas-maintenance/check`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function sendTestGasAlert(): Promise<GasMaintenanceInfo> {
  const res = await fetch(`${API_BASE}/admin/gas-maintenance/test-alert`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function triggerManualSweep(): Promise<{
  success: boolean;
  modifiedCount: number;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/admin/gas-maintenance/sweep-now`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/* ---------------- UI helpers ---------------- */

/** Convert backend decimal (0.015) → UI percent string ("1.5") */
export function feeDecimalToPercentInput(decimal: number): string {
  if (!Number.isFinite(decimal)) return "";
  return String(+(decimal * 100).toFixed(6));
}

/** Convert UI percent string ("1.5") → backend decimal (0.015). Returns null if invalid. */
export function feePercentInputToDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0 || num >= 100) return null;
  return +(num / 100).toFixed(8);
}

/** Display labels for pricing field keys in history rows etc. */
export const PRICING_FIELD_LABEL: Record<string, string> = {
  usdtPrice: "USDT price",
  inrPrice: "Bank Transfer Rate",
  upiInrPrice: "UPI Transfer Rate",
  feePercent: "Withdrawal fee",
  bankFee: "Bank withdrawal fee",
  cryptoFee: "Crypto withdrawal fee",
  smartToggleMinUsdt: "Smart Toggle Min USDT",
};

/** Format a pricing field's value for display (fee shown as %). */
export function formatPricingValue(field: string, value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (field === "feePercent" || field === "bankFee" || field === "cryptoFee") {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (field === "inrPrice" || field === "upiInrPrice") return `₹${value.toLocaleString("en-IN")}`;
  if (field === "usdtPrice" || field === "smartToggleMinUsdt") return `$${value.toLocaleString("en-US")}`;
  return String(value);
}
