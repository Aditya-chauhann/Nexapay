/**
 * Typed client for the super-admin login-PIN endpoints under `/admin/auth/pin/*`.
 *
 * The backend never returns the PIN itself — only status, a replacement token
 * on a successful unlock, or a structured error code. Callers that need to
 * react to `PIN_INVALID` / `PIN_LOCKED` / `PIN_TOO_WEAK` should catch the
 * thrown `AdminPinError` and inspect `code`.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const API_TOKEN_KEY = "TrustO_api_token_v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(API_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Error thrown by any PIN endpoint on a non-2xx response. */
export class AdminPinError extends Error {
  code: string | null;
  attemptsRemaining: number | null;
  lockedUntil: string | null;
  status: number;
  constructor(
    message: string,
    code: string | null,
    attemptsRemaining: number | null,
    lockedUntil: string | null,
    status: number,
  ) {
    super(message);
    this.name = "AdminPinError";
    this.code = code;
    this.attemptsRemaining = attemptsRemaining;
    this.lockedUntil = lockedUntil;
    this.status = status;
  }
}

async function throwFromResponse(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  let message = `Request failed (HTTP ${res.status})`;
  let code: string | null = null;
  let attemptsRemaining: number | null = null;
  let lockedUntil: string | null = null;

  if (body && typeof body === "object") {
    const m = body.message;
    if (Array.isArray(m)) {
      const joined = m.filter((x): x is string => typeof x === "string").join(", ");
      if (joined) message = joined;
    } else if (typeof m === "string" && m.trim() !== "") {
      message = m;
    }
    const c = body.errorCode ?? body.code;
    if (typeof c === "string") code = c;
    const a = body.attemptsRemaining;
    if (typeof a === "number" && Number.isFinite(a)) attemptsRemaining = a;
    if (typeof body.lockedUntil === "string") lockedUntil = body.lockedUntil;
  }
  throw new AdminPinError(message, code, attemptsRemaining, lockedUntil, res.status);
}

export interface AdminPinStatus {
  pinSet: boolean;
  verified: boolean;
  locked: boolean;
  lockedUntil: string | null;
  attemptsRemaining: number;
  idleTimeoutMinutes: number;
}

export interface AdminPinUnlock {
  accessToken: string;
  verified: true;
  idleTimeoutMinutes: number;
}

async function unlockRequest(path: string, payload: unknown): Promise<AdminPinUnlock> {
  const res = await fetch(`${API_BASE}/admin/auth/pin/${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await throwFromResponse(res);
  const body = (await res.json()) as AdminPinUnlock;
  return body;
}

export async function getAdminPinStatus(signal?: AbortSignal): Promise<AdminPinStatus> {
  const res = await fetch(`${API_BASE}/admin/auth/pin/status`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) await throwFromResponse(res);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    pinSet: Boolean(body?.pinSet),
    verified: Boolean(body?.verified),
    locked: Boolean(body?.locked),
    lockedUntil: typeof body?.lockedUntil === "string" ? body.lockedUntil : null,
    attemptsRemaining:
      typeof body?.attemptsRemaining === "number" ? body.attemptsRemaining : 5,
    idleTimeoutMinutes:
      typeof body?.idleTimeoutMinutes === "number" ? body.idleTimeoutMinutes : 15,
  };
}

/** First-time PIN generation. Unlocks the console on success. */
export function setAdminPin(pin: string, confirmPin: string): Promise<AdminPinUnlock> {
  return unlockRequest("set", { pin, confirmPin });
}

export function verifyAdminPin(pin: string): Promise<AdminPinUnlock> {
  return unlockRequest("verify", { pin });
}

export async function changeAdminPin(
  currentPin: string,
  newPin: string,
  confirmNewPin: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/auth/pin/change`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ currentPin, newPin, confirmNewPin }),
  });
  if (!res.ok) await throwFromResponse(res);
}

export interface AdminPinResetRequest {
  email: string;
  expiresAt: string;
}

/** Emails a 6-digit OTP that authorises setting a brand-new PIN. */
export async function requestAdminPinReset(): Promise<AdminPinResetRequest> {
  const res = await fetch(`${API_BASE}/admin/auth/pin/reset/request`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await throwFromResponse(res);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    email: typeof body?.email === "string" ? body.email : "your email",
    expiresAt: typeof body?.expiresAt === "string" ? body.expiresAt : "",
  };
}

export function confirmAdminPinReset(
  otp: string,
  newPin: string,
  confirmNewPin: string,
): Promise<AdminPinUnlock> {
  return unlockRequest("reset/confirm", { otp, newPin, confirmNewPin });
}

/** Re-locks the console server-side (sign-out, manual lock, idle timeout). */
export async function lockAdminPin(): Promise<void> {
  await fetch(`${API_BASE}/admin/auth/pin/lock`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => undefined);
}

/** Swaps in the replacement token returned by a successful unlock. */
export function storeUnlockedToken(unlock: AdminPinUnlock): void {
  localStorage.setItem(API_TOKEN_KEY, unlock.accessToken);
}
