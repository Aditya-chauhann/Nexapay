/**
 * Client for the super-admin XLSX report endpoints.
 *
 * Every endpoint lives under `/admin/reports/*`, returns an .xlsx blob, and
 * requires a super-admin Bearer token. The response carries a
 * Content-Disposition filename — we honor it when present and fall back to a
 * sensible default if not.
 */

import { API_BASE_URL as API_BASE } from "@/lib/api-base";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === "object") {
      const m = (json as { message?: unknown }).message;
      if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
      if (typeof m === "string") return m;
    }
  } catch {
    // Body wasn't JSON — fall through to the HTTP-status message.
  }
  return `Request failed (HTTP ${res.status})`;
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const starMatch = /filename\*\s*=\s*UTF-8''([^;\s]+)/i.exec(header);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1]);
    } catch {
      // Fall through to the plain filename match.
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  if (plain) return plain[1].trim();
  return fallback;
}

export type ReportPath =
  | "customers"
  | "deposits"
  | "withdrawals"
  | "pending-withdrawals"
  | "customer-ledger"
  | "customer-balances"
  | "tier-users"
  | "active-customers"
  | "inactive-customers"
  | "tickets";

export interface ReportFilters {
  [key: string]: string | number | undefined | null;
}

/**
 * Fetch and trigger download of an XLSX report. Skips empty / null filter
 * values so the URL stays clean. Throws with the server's message on failure.
 */
export async function downloadReport(
  path: ReportPath,
  filters: ReportFilters,
  fallbackFilename: string,
  signal?: AbortSignal,
): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str === "") continue;
    params.set(key, str);
  }
  const qs = params.toString();
  const url = `${API_BASE}/admin/reports/${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get("content-disposition"),
    fallbackFilename,
  );
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(objectUrl);
}

export interface ReportPreviewData {
  filename: string;
  sheetName: string;
  columns: { header: string; key: string }[];
  rows: Record<string, any>[];
}

export async function fetchReportPreview(
  path: ReportPath,
  filters: ReportFilters,
  signal?: AbortSignal,
): Promise<ReportPreviewData> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str === "") continue;
    params.set(key, str);
  }
  params.set("preview", "true");
  const qs = params.toString();
  const url = `${API_BASE}/admin/reports/${path}?${qs}`;
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json();
}
