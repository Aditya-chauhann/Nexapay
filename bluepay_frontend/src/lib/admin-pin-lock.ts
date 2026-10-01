/**
 * Cross-module signalling for the super-admin PIN gate.
 *
 * Every admin API client builds its own `fetch` call, so rather than threading
 * a handler through all of them we patch `fetch` once and broadcast whenever
 * the backend answers `PIN_REQUIRED` / `PIN_SETUP_REQUIRED`. The gate listens
 * and re-locks the console — this is what makes a server-side idle timeout (or
 * a lock triggered from another tab) surface immediately in the UI.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const PIN_LOCK_EVENT = "trusto:superadmin-pin-required";
const SESSION_EXPIRED_EVENT = "trusto:session-expired";

export type PinLockReason = "PIN_REQUIRED" | "PIN_SETUP_REQUIRED";

export function emitPinRequired(reason: PinLockReason): void {
  window.dispatchEvent(new CustomEvent<PinLockReason>(PIN_LOCK_EVENT, { detail: reason }));
}

export function onPinRequired(handler: (reason: PinLockReason) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<PinLockReason>).detail;
    handler(detail === "PIN_SETUP_REQUIRED" ? "PIN_SETUP_REQUIRED" : "PIN_REQUIRED");
  };
  window.addEventListener(PIN_LOCK_EVENT, listener);
  return () => window.removeEventListener(PIN_LOCK_EVENT, listener);
}

export function emitSessionExpired(): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}

let installed = false;

/** Patches `window.fetch` once so any 403 PIN error re-locks the console & 401 expires session. */
export function installPinLockInterceptor(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith(API_BASE) && response.status === 401) {
      // Exclude login endpoints from auto-logout
      if (!url.includes("/auth/login") && !url.includes("/admin/auth/login") && !url.includes("/captcha/")) {
        emitSessionExpired();
      }
      return response;
    }

    if (response.status !== 403) return response;
    if (!url.startsWith(API_BASE)) return response;
    // The PIN endpoints answer 403 themselves while locked; the gate is
    // already showing at that point, so ignore them to avoid a feedback loop.
    if (url.includes("/admin/auth/pin")) return response;

    try {
      const body = (await response.clone().json()) as { errorCode?: unknown };
      if (body?.errorCode === "PIN_REQUIRED" || body?.errorCode === "PIN_SETUP_REQUIRED") {
        emitPinRequired(body.errorCode);
      }
    } catch {
      // Non-JSON 403 — nothing to do.
    }
    return response;
  };
}
