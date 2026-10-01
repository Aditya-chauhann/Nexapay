/**
 * Typed client for the withdrawal-PIN endpoints under `/user/withdrawal-pin/*`.
 *
 * Backend never returns the PIN itself — only status, success, or a structured
 * error code. Callers that need to react to `WITHDRAWAL_PIN_INVALID` or
 * `WITHDRAWAL_PIN_LOCKED` should catch the thrown `PinError` and inspect `code`.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Error thrown by any PIN endpoint on a non-2xx response. */
export class PinError extends Error {
  code: string | null;
  attemptsRemaining: number | null;
  status: number;
  constructor(
    message: string,
    code: string | null,
    attemptsRemaining: number | null,
    status: number,
  ) {
    super(message);
    this.name = "PinError";
    this.code = code;
    this.attemptsRemaining = attemptsRemaining;
    this.status = status;
  }
}

async function throwFromResponse(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  let message = `Request failed (HTTP ${res.status})`;
  let code: string | null = null;
  let attemptsRemaining: number | null = null;
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) {
      const joined = m.filter((x): x is string => typeof x === "string").join(", ");
      if (joined) message = joined;
    } else if (typeof m === "string" && m.trim() !== "") {
      message = m;
    }
    const c = (body as { code?: unknown }).code;
    if (typeof c === "string") code = c;
    const a = (body as { attemptsRemaining?: unknown }).attemptsRemaining;
    if (typeof a === "number" && Number.isFinite(a)) attemptsRemaining = a;
  }
  throw new PinError(message, code, attemptsRemaining, res.status);
}

export interface PinStatus {
  pinSet: boolean;
  locked: boolean;
  lockedUntil: string | null;
}

export async function getPinStatus(signal?: AbortSignal): Promise<PinStatus> {
  const res = await fetch(`${API_BASE}/user/withdrawal-pin/status`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) await throwFromResponse(res);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    pinSet: Boolean(body?.pinSet ?? body?.isSet ?? body?.exists),
    locked: Boolean(body?.locked ?? body?.isLocked),
    lockedUntil: typeof body?.lockedUntil === "string" ? body.lockedUntil : null,
  };
}

export async function setupPin(pin: string, confirmPin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/user/withdrawal-pin/set`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ pin, confirmPin }),
  });
  if (!res.ok) await throwFromResponse(res);
}

export async function changePin(
  currentPin: string,
  newPin: string,
  confirmNewPin: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/user/withdrawal-pin/change`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ currentPin, newPin, confirmNewPin }),
  });
  if (!res.ok) await throwFromResponse(res);
}

export async function requestPinResetOtp(): Promise<void> {
  const res = await fetch(`${API_BASE}/user/withdrawal-pin/reset/request`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await throwFromResponse(res);
}

export async function confirmPinReset(
  otp: string,
  newPin: string,
  confirmNewPin: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/user/withdrawal-pin/reset/confirm`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ otp, newPin, confirmNewPin }),
  });
  if (!res.ok) await throwFromResponse(res);
}
