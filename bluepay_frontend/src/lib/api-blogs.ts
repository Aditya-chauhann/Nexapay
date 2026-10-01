import { API_BASE_URL } from "./api-base";

export type BlogStatus = "draft" | "published";

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  content: string;
}

export interface BlogPostAdmin extends BlogPostDetail {
  status: BlogStatus;
  authorId: string;
}

export interface PaginatedBlogPosts {
  items: BlogPostSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBlogPayload {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  status?: BlogStatus;
  metaTitle?: string;
  metaDescription?: string;
}

export type UpdateBlogPayload = Partial<CreateBlogPayload>;

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
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

export async function listPublishedBlogs(
  page = 1,
  limit = 10,
): Promise<PaginatedBlogPosts> {
  const res = await fetch(
    `${API_BASE_URL}/blogs?page=${page}&limit=${limit}`,
  );
  return parseJson<PaginatedBlogPosts>(res);
}

export async function getPublishedBlog(slug: string): Promise<BlogPostDetail> {
  const res = await fetch(`${API_BASE_URL}/blogs/${encodeURIComponent(slug)}`);
  return parseJson<BlogPostDetail>(res);
}

export async function listAdminBlogs(): Promise<BlogPostAdmin[]> {
  const headers = authHeaders();
  if (!headers) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/admin/blogs`, { headers });
  return parseJson<BlogPostAdmin[]>(res);
}

export async function createBlog(
  payload: CreateBlogPayload,
): Promise<BlogPostAdmin> {
  const headers = authHeaders();
  if (!headers) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/admin/blogs`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson<BlogPostAdmin>(res);
}

export async function updateBlog(
  id: string,
  payload: UpdateBlogPayload,
): Promise<BlogPostAdmin> {
  const headers = authHeaders();
  if (!headers) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/admin/blogs/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson<BlogPostAdmin>(res);
}

export async function deleteBlog(id: string): Promise<void> {
  const headers = authHeaders();
  if (!headers) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/admin/blogs/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(body, res.status));
  }
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
