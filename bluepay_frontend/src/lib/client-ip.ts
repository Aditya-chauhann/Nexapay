import { API_BASE_URL } from "./api-base";

let clientPublicIp: string | null = null;
try {
  clientPublicIp = sessionStorage.getItem("trusto_client_network_ip");
} catch {
  // Ignore sessionStorage access errors
}

let ipFetchPromise: Promise<string | null> | null = null;

/**
 * Fetches the user's public internet IP address from reliable IP lookup APIs.
 * Results are cached in memory and sessionStorage.
 */
export async function fetchClientPublicIp(): Promise<string | null> {
  if (clientPublicIp) return clientPublicIp;
  if (ipFetchPromise) return ipFetchPromise;

  ipFetchPromise = (async () => {
    // Attempt 1: ipify.org
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as { ip?: string };
        if (data?.ip && typeof data.ip === "string") {
          clientPublicIp = data.ip.trim();
          try {
            sessionStorage.setItem("trusto_client_network_ip", clientPublicIp);
          } catch {}
          return clientPublicIp;
        }
      }
    } catch {
      // Fallback
    }

    // Attempt 2: api64.ipify.org (supports IPv4 and IPv6)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch("https://api64.ipify.org?format=json", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as { ip?: string };
        if (data?.ip && typeof data.ip === "string") {
          clientPublicIp = data.ip.trim();
          try {
            sessionStorage.setItem("trusto_client_network_ip", clientPublicIp);
          } catch {}
          return clientPublicIp;
        }
      }
    } catch {
      // Fallback
    }

    return null;
  })();

  return ipFetchPromise;
}

// Automatically initiate fetch on client startup
if (typeof window !== "undefined") {
  void fetchClientPublicIp();
}

/**
 * Intercept window.fetch to automatically append X-Client-Network-IP header for backend API calls.
 */
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const originalFetch = window.fetch;
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    // Check if this request is targeted at our backend
    const isBackendCall =
      Boolean(API_BASE_URL && urlStr.startsWith(API_BASE_URL)) ||
      urlStr.startsWith("/api") ||
      urlStr.includes(":1005") ||
      urlStr.includes(":3000");

    if (isBackendCall) {
      let ip = clientPublicIp;
      if (!ip) {
        try {
          ip = sessionStorage.getItem("trusto_client_network_ip");
        } catch {}
      }

      // If not yet available in cache, try quick resolution or proceed
      if (!ip && ipFetchPromise) {
        // Only wait up to 1000ms on the very first critical call if needed
        const quick = await Promise.race([
          ipFetchPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 800)),
        ]);
        if (quick) ip = quick;
      }

      if (ip) {
        const headers = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );
        if (!headers.has("X-Client-Network-IP")) {
          headers.set("X-Client-Network-IP", ip);
        }
        if (!headers.has("X-Client-IP")) {
          headers.set("X-Client-IP", ip);
        }
        init = { ...init, headers };
      }
    }

    return originalFetch.call(this, input, init);
  };
}
