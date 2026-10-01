import { API_BASE_URL } from "@/lib/api-base";

export interface TotpStatus {
  totpEnabled: boolean;
  totpEnabledAt: string | null;
}

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function extractMessage(json: unknown): string {
  if (json && typeof json === "object") {
    const m = (json as { message?: unknown }).message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
    if (typeof m === "string") return m;
  }
  return "Request failed";
}

export async function getTotpStatus(): Promise<TotpStatus> {
  const res = await fetch(`${API_BASE_URL}/auth/totp/status`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractMessage(body));
  return body as TotpStatus;
}

export async function setupTotp(): Promise<TotpSetupResult> {
  const res = await fetch(`${API_BASE_URL}/auth/totp/setup`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractMessage(body));
  return body as TotpSetupResult;
}

export async function enableTotp(secret: string, code: string): Promise<TotpStatus> {
  const res = await fetch(`${API_BASE_URL}/auth/totp/enable`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ secret, code }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractMessage(body));
  return body as TotpStatus;
}

export async function disableTotp(password: string, code: string): Promise<TotpStatus> {
  const res = await fetch(`${API_BASE_URL}/auth/totp/disable`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ password, code }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractMessage(body));
  return body as TotpStatus;
}

export async function completeLoginWithTotp(
  loginChallenge: string,
  code: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE_URL}/auth/login/totp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginChallenge, code }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(extractMessage(body));
  return (body ?? {}) as Record<string, unknown>;
}
