import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, LogIn, UserPlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getPublishedBlog, type BlogPostDetail } from "@/lib/api-blogs";
import { formatIst } from "@/lib/format-date";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getPublishedBlog(slug);
        if (!cancelled) {
          setPost(data);
          document.title = data.metaTitle?.trim() || `${data.title} | TrustO Blog`;
          const meta = document.querySelector('meta[name="description"]');
          const description = data.metaDescription?.trim() || data.excerpt;
          if (meta) {
            meta.setAttribute("content", description);
          } else {
            const el = document.createElement("meta");
            el.name = "description";
            el.content = description;
            document.head.appendChild(el);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load post";
          if (message.toLowerCase().includes("not found")) {
            setNotFound(true);
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      document.title = "TrustO";
    };
  }, [slug]);

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to blog
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notFound ? (
          <div className="rounded-xl border border-border bg-secondary/30 p-10 text-center">
            <h1 className="text-xl font-semibold">Post not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This blog post does not exist or is no longer published.
            </p>
            <Link to="/blog" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
              View all posts
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : post ? (
          <article>
            {post.coverImageUrl ? (
              <img
                src={post.coverImageUrl}
                alt=""
                className="mb-8 h-56 w-full rounded-xl object-cover sm:h-72"
              />
            ) : null}
            {post.publishedAt ? (
              <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatIst(post.publishedAt)}
              </p>
            ) : null}
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
            <div className="prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground mt-8 max-w-none">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
};

export default BlogPost;
