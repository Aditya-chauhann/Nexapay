import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { listPublishedBlogs, type BlogPostSummary } from "@/lib/api-blogs";
import { formatIst } from "@/lib/format-date";

const BlogList = () => {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Blog | TrustO";
    let cancelled = false;
    (async () => {
      try {
        const res = await listPublishedBlogs(1, 50);
        if (!cancelled) setPosts(res.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load blog posts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col">
      <nav className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-transparent">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Nexa<span className="text-primary">Pay</span></span>
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <Link
            to="/blog"
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-foreground sm:py-2"
          >
            Blog
          </Link>
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:py-2"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
          <Link
            to="/auth/register"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary sm:py-2"
          >
            <UserPlus className="h-4 w-4" /> Register
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold sm:text-4xl">Blog</h1>
          <p className="mt-2 text-muted-foreground">
            Updates, guides, and news from TrustO.
          </p>
        </motion.div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="mt-10 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-secondary/30 p-10 text-center">
            <p className="text-muted-foreground">No blog posts published yet. Check back soon.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {posts.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card overflow-hidden"
              >
                {post.coverImageUrl ? (
                  <Link to={`/blog/${post.slug}`}>
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      className="h-44 w-full object-cover"
                    />
                  </Link>
                ) : null}
                <div className="p-5 sm:p-6">
                  {post.publishedAt ? (
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatIst(post.publishedAt)}
                    </p>
                  ) : null}
                  <Link to={`/blog/${post.slug}`}>
                    <h2 className="text-lg font-semibold transition-colors hover:text-primary">
                      {post.title}
                    </h2>
                  </Link>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Read more
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BlogList;
