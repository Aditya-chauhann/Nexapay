import { API_BASE_URL } from "./api-base";

export type AnnouncementTarget = "all" | "users" | "staff";
export type AnnouncementType = "info" | "warning" | "urgent" | "success";

export interface AnnouncementItem {
  id: string;
  _id?: string;
  title: string;
  content: string;
  link: string | null;
  targetAudience: AnnouncementTarget;
  type: AnnouncementType;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  depositNotificationsEnabled: boolean;
  withdrawalNotificationsEnabled: boolean;
  disputeNotificationsEnabled: boolean;
  ticketNotificationsEnabled: boolean;
  telegramNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  systemAlertsEnabled: boolean;
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

export async function listAdminAnnouncements(): Promise<AnnouncementItem[]> {
  const res = await fetch(`${API_BASE_URL}/admin/announcements`, {
    headers: authHeaders(),
  });
  const data = await parseJson<any[]>(res);
  return (data || []).map((item: any) => ({
    ...item,
    id: item._id || item.id,
  }));
}

export async function createAnnouncement(payload: {
  title: string;
  content: string;
  link?: string;
  targetAudience: AnnouncementTarget;
  type: AnnouncementType;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}): Promise<AnnouncementItem> {
  const res = await fetch(`${API_BASE_URL}/admin/announcements`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const item = await parseJson<any>(res);
  return { ...item, id: item._id || item.id };
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<{
    title: string;
    content: string;
    link?: string;
    targetAudience: AnnouncementTarget;
    type: AnnouncementType;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>,
): Promise<AnnouncementItem> {
  const res = await fetch(`${API_BASE_URL}/admin/announcements/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const item = await parseJson<any>(res);
  return { ...item, id: item._id || item.id };
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/announcements/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await parseJson<any>(res);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/admin/announcements/settings`, {
    headers: authHeaders(),
  });
  return parseJson<NotificationSettings>(res);
}

export async function updateNotificationSettings(
  payload: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/admin/announcements/settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJson<NotificationSettings>(res);
}
