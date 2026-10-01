import { API_BASE_URL } from "./api-base";
import type { AnnouncementItem } from "./api-announcements";

export type NotificationChannel = "sms" | "email";

export interface UserNotificationItem {
  id: string;
  _id?: string;
  userId: string;
  title: string;
  message: string;
  type: "deposit" | "withdrawal" | "dispute" | "ticket" | "system";
  link: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("TrustO_api_token_v1");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string") return m;
  }
  return `Request failed (HTTP ${status})`;
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractErrorMessage(body, res.status));
  }
  return body as T;
}

export async function getNotificationPreference(): Promise<{ channel: NotificationChannel }> {
  const res = await fetch(`${API_BASE_URL}/user/notification-preference`, {
    headers: authHeaders(),
  });
  return parseJson<{ channel: NotificationChannel }>(res);
}

export async function patchNotificationPreference(
  channel: NotificationChannel,
): Promise<{ channel: NotificationChannel }> {
  const res = await fetch(`${API_BASE_URL}/user/notification-preference`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ channel }),
  });
  return parseJson<{ channel: NotificationChannel }>(res);
}

export async function listUserNotifications(): Promise<UserNotificationItem[]> {
  const res = await fetch(`${API_BASE_URL}/notifications`, {
    headers: authHeaders(),
  });
  const data = await parseJson<any[]>(res);
  return (data || []).map((item) => ({
    ...item,
    id: item._id || item.id,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    headers: authHeaders(),
  });
  const data = await parseJson<{ count: number }>(res);
  return data.count || 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  await parseJson<any>(res);
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    headers: authHeaders(),
  });
  await parseJson<any>(res);
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await parseJson<any>(res);
}

export async function deleteAllNotifications(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/notifications`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await parseJson<any>(res);
}

export async function fetchActiveAnnouncements(): Promise<AnnouncementItem[]> {
  const res = await fetch(`${API_BASE_URL}/announcements/active`, {
    headers: authHeaders(),
  });
  const data = await parseJson<any[]>(res);
  return (data || []).map((item) => ({
    ...item,
    id: item._id || item.id,
  }));
}
