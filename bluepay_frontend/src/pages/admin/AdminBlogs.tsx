import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBlog,
  deleteBlog,
  listAdminBlogs,
  slugifyTitle,
  updateBlog,
  type BlogPostAdmin,
  type BlogStatus,
} from "@/lib/api-blogs";
import { formatIst } from "@/lib/format-date";

interface BlogFormState {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  status: BlogStatus;
  metaTitle: string;
  metaDescription: string;
  slugTouched: boolean;
}

const EMPTY_FORM: BlogFormState = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  status: "draft",
  metaTitle: "",
  metaDescription: "",
  slugTouched: false,
};

const AdminBlogs = () => {
  const [posts, setPosts] = useState<BlogPostAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BlogFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BlogPostAdmin | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPosts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const items = await listAdminBlogs();
      if (!signal?.aborted) setPosts(items);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Failed to load blog posts");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPosts(controller.signal);
    return () => controller.abort();
  }, [loadPosts]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (post: BlogPostAdmin) => {
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImageUrl: post.coverImageUrl ?? "",
      status: post.status,
      metaTitle: post.metaTitle ?? "",
      metaDescription: post.metaDescription ?? "",
      slugTouched: true,
    });
    setFormOpen(true);
  };

  const buildPayload = () => {
    const title = form.title.trim();
    const excerpt = form.excerpt.trim();
    const content = form.content.trim();
    if (!title) throw new Error("Title is required");
    if (!excerpt) throw new Error("Excerpt is required");
    if (!content) throw new Error("Content is required");

    const payload = {
      title,
      excerpt,
      content,
      status: form.status,
      slug: form.slug.trim() || slugifyTitle(title),
      coverImageUrl: form.coverImageUrl.trim() || undefined,
      metaTitle: form.metaTitle.trim() || undefined,
      metaDescription: form.metaDescription.trim() || undefined,
    };
    if (!payload.slug) throw new Error("Slug is required");
    return payload;
  };

  const savePost = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (form.id) {
        await updateBlog(form.id, payload);
        toast.success("Blog post updated");
      } else {
        await createBlog(payload);
        toast.success("Blog post created");
      }
      setFormOpen(false);
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save blog post");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (post: BlogPostAdmin, status: BlogStatus) => {
    try {
      await updateBlog(post.id, { status });
      toast.success(status === "published" ? "Post published" : "Post unpublished");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const confirmDeletePost = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await deleteBlog(confirmDelete.id);
      toast.success("Blog post deleted");
      setConfirmDelete(null);
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete blog post");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Blog</h1>
          <p className="mt-1 text-muted-foreground">
            Manage public blog posts shown at /blog
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:self-auto"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No blog posts yet. Create your first post.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{post.title}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        post.status === "published" ? "badge-success" : "badge-pending"
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{post.excerpt}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    /blog/{post.slug}
                    {post.publishedAt ? ` · Published ${formatIst(post.publishedAt)}` : ""}
                    {post.updatedAt ? ` · Updated ${formatIst(post.updatedAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {post.status === "draft" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(post, "published")}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void setStatus(post, "draft")}
                      className="rounded-lg bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className="rounded-lg p-2 transition-colors hover:bg-secondary"
                    aria-label="Edit post"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(post)}
                    className="rounded-lg p-2 transition-colors hover:bg-destructive/10"
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit blog post" : "Create blog post"}</DialogTitle>
            <DialogDescription>
              Write Markdown content. Only published posts appear on the public blog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title</label>
              <input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    title,
                    slug: prev.slugTouched ? prev.slug : slugifyTitle(title),
                  }));
                }}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Slug</label>
              <input
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase(),
                    slugTouched: true,
                  }))
                }
                placeholder="my-blog-post"
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Content (Markdown)</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                rows={12}
                className="w-full resize-y rounded-lg border border-border bg-secondary px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Cover image URL</label>
              <input
                value={form.coverImageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as BlogStatus,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Meta title</label>
                <input
                  value={form.metaTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaTitle: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Meta description</label>
              <textarea
                value={form.metaDescription}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, metaDescription: e.target.value }))
                }
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl bg-secondary px-5 py-2.5 text-sm hover:bg-secondary/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void savePost()}
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : form.id ? "Save changes" : "Create post"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete blog post?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{confirmDelete?.title}&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="rounded-xl bg-secondary px-5 py-2.5 text-sm hover:bg-secondary/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDeletePost()}
              disabled={deletingId !== null}
              className="rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {deletingId ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlogs;
