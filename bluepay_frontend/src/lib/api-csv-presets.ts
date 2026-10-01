import { API_BASE_URL as API_BASE } from "@/lib/api-base";

const API_TOKEN_KEY = "TrustO_api_token_v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(API_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// In-memory cache for fast UI loading
let cachedPresets: Record<string, string[]> | null = null;
let fetchPromise: Promise<Record<string, string[]>> | null = null;

export async function fetchCsvPresets(forceFresh = false): Promise<Record<string, string[]>> {
  if (cachedPresets && !forceFresh) {
    return cachedPresets;
  }
  if (fetchPromise && !forceFresh) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/system-controls/csv-presets`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        return cachedPresets || {};
      }
      const data = (await res.json()) as Record<string, string[]>;
      if (data && typeof data === "object") {
        cachedPresets = data;
        return data;
      }
      return cachedPresets || {};
    } catch {
      return cachedPresets || {};
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function getCachedCsvPreset(filename: string): string[] | null {
  if (!cachedPresets) return null;
  const key = filename.trim().toLowerCase();
  return cachedPresets[key] || null;
}

export async function saveCsvPreset(
  filename: string,
  columns: string[],
): Promise<Record<string, string[]>> {
  const cleanFilename = filename.trim().toLowerCase();
  // Optimistically update memory cache
  if (!cachedPresets) cachedPresets = {};
  cachedPresets[cleanFilename] = columns;

  try {
    const res = await fetch(`${API_BASE}/admin/system-controls/csv-presets`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: cleanFilename, columns }),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, string[]>;
      if (data && typeof data === "object") {
        cachedPresets = data;
        return data;
      }
    }
  } catch (err) {
    console.warn("Failed to persist CSV preset to backend:", err);
  }
  return cachedPresets;
}

export async function resetCsvPreset(filename: string): Promise<Record<string, string[]>> {
  const cleanFilename = filename.trim().toLowerCase();
  if (cachedPresets) {
    delete cachedPresets[cleanFilename];
  }

  try {
    const res = await fetch(
      `${API_BASE}/admin/system-controls/csv-presets/${encodeURIComponent(cleanFilename)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, string[]>;
      if (data && typeof data === "object") {
        cachedPresets = data;
        return data;
      }
    }
  } catch (err) {
    console.warn("Failed to reset CSV preset on backend:", err);
  }
  return cachedPresets || {};
}
