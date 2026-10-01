import { API_BASE_URL } from "./api-base";

export interface AdminDepositItem {
  id: string;
  transactionId: string;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    walletAddress?: string;
  } | null;
  walletAddress: string;
  amount: number;
  currency: string;
  timestamp: string | null;
  createdAt: string;
  remark: string | null;
  visibleToUser: boolean;
  sweepStatus?: string | null;
  sweepTxHash?: string | null;
  sweptAt?: string | null;
  sweepScheduledAt?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listAdminDeposits(signal?: AbortSignal): Promise<AdminDepositItem[]> {
  const res = await fetch(`${API_BASE_URL}/admin/deposits`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.message || `Failed to fetch deposits (HTTP ${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
  const data = await res.json();
  // The fields below are declared non-optional on AdminDepositItem, but the
  // API can still hand back rows that are missing them (legacy documents
  // predating the current schema). The admin table dereferences them without
  // guards — `amount.toFixed()`, `transactionId.toLowerCase()` — so normalise
  // here rather than letting one bad row blank out the whole Deposits page.
  return (Array.isArray(data) ? data : []).map((item: any) => {
    const amount = Number(item?.amount);
    return {
      ...item,
      id: item?._id || item?.id,
      amount: Number.isFinite(amount) ? amount : 0,
      currency: item?.currency || "USDT",
      transactionId: item?.transactionId ?? "",
      walletAddress: item?.walletAddress ?? "",
      sweepStatus: item?.sweepStatus ?? null,
      sweepTxHash: item?.sweepTxHash ?? null,
      sweptAt: item?.sweptAt ?? null,
      sweepScheduledAt: item?.sweepScheduledAt ?? null,
    };
  });
}

export async function sweepWalletNow(walletAddress: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/gas-maintenance/sweep-wallet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ walletAddress }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.message || `Failed to trigger sweep (HTTP ${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
  return body;
}

export async function sweepAllNow(): Promise<{ success: boolean; modifiedCount: number; message: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/gas-maintenance/sweep-now`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.message || `Failed to trigger sweep (HTTP ${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
  return body;
}

