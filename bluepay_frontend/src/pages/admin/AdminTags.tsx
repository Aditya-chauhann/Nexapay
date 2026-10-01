import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
  Crown,
  Star,
  Gem,
  Users,
  ArrowUp,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TAG_COLOR_OPTIONS, isValidHex } from "@/lib/tag-colors";
import { API_BASE_URL as API_BASE } from "@/lib/api-base";

type ThresholdPeriod = "day" | "week" | "month";

interface UserTag {
  id: string;
  name: string;
  rank: number;
  thresholdAmount: number;
  thresholdPeriod: ThresholdPeriod;
  isActive: boolean;
  color: string | null;
  benefitInr: number;
  createdAt?: string;
  updatedAt?: string;
}

function authHeaders(): Record<string, string> | null {
  const token = localStorage.getItem("TrustO_api_token_v1");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function normalizeTag(raw: unknown): UserTag | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id as string | undefined) ?? (r._id as string | undefined);
  const name = (r.name as string | undefined)?.trim();
  if (!id || !name) return null;
  const period = (r.thresholdPeriod as string | undefined) ?? "month";
  return {
    id,
    name,
    rank: Number.isFinite(Number(r.rank)) ? Number(r.rank) : 1,
    thresholdAmount: Number.isFinite(Number(r.thresholdAmount)) ? Number(r.thresholdAmount) : 0,
    thresholdPeriod: (["day", "week", "month"] as const).includes(period as ThresholdPeriod)
      ? (period as ThresholdPeriod)
      : "month",
    isActive: r.isActive === undefined ? true : Boolean(r.isActive),
    color: (r.color as string | null | undefined) ?? null,
    benefitInr: Number.isFinite(Number(r.benefitInr)) ? Number(r.benefitInr) : 0,
    createdAt: (r.createdAt as string | undefined) ?? undefined,
    updatedAt: (r.updatedAt as string | undefined) ?? undefined,
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

const PROTECTED_TAG_NAMES = new Set(["silver", "gold", "diamond"]);

function isProtectedTag(name: string): boolean {
  return PROTECTED_TAG_NAMES.has(name.trim().toLowerCase());
}

interface TagFormState {
  id: string | null;
  name: string;
  rank: string;
  color: string;
  isActive: boolean;
  thresholdAmount: string;
  thresholdPeriod: ThresholdPeriod;
  benefitInr: string;
}

const EMPTY_FORM: TagFormState = {
  id: null,
  name: "",
  rank: "",
  color: TAG_COLOR_OPTIONS[0]?.value ?? "#C0C0C0",
  isActive: true,
  thresholdAmount: "",
  thresholdPeriod: "month",
  benefitInr: "",
};

// Top-right 3D floating cards and crowns illustration
const TagsHeaderIllustration = () => {
  return (
    <div className="absolute right-0 -top-8 w-[380px] h-[220px] pointer-events-none select-none hidden lg:block overflow-visible">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-44 bg-gradient-to-r from-blue-400/20 via-sky-300/30 to-indigo-400/10 rounded-full blur-2xl pointer-events-none" />

      {/* SVG composition replicating the 3D claymorphic crown tiles & floating spheres */}
      <svg
        viewBox="0 0 380 220"
        className="w-full h-full overflow-visible drop-shadow-xl"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main blue card gradient */}
          <linearGradient id="blueCardGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          {/* White front card gradient */}
          <linearGradient id="whiteCardGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          {/* Sphere gradient */}
          <radialGradient id="sphereGrad1" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#60a5fa" />
          </radialGradient>

          <radialGradient id="sphereGrad2" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#93c5fd" />
          </radialGradient>

          <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="6" dy="12" stdDeviation="10" floodColor="#1e40af" floodOpacity="0.25" />
          </filter>

          <filter id="whiteCardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="4" dy="8" stdDeviation="8" floodColor="#64748b" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Floating small background sphere */}
        <circle cx="80" cy="50" r="14" fill="url(#sphereGrad1)" opacity="0.8" />
        <circle cx="340" cy="40" r="10" fill="url(#sphereGrad2)" opacity="0.7" />

        {/* Back Card: Floating tilted Blue Card with White Crown */}
        <g transform="translate(195, 30) rotate(12)" filter="url(#cardShadow)">
          <rect
            width="115"
            height="120"
            rx="24"
            fill="url(#blueCardGrad)"
            stroke="#93c5fd"
            strokeWidth="2.5"
            strokeOpacity="0.6"
          />
          {/* Inner embossed white crown */}
          <path
            d="M32 82 L32 50 L46 62 L57.5 42 L69 62 L83 50 L83 82 Z"
            fill="#ffffff"
            opacity="0.95"
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
          />
          <circle cx="32" cy="48" r="3" fill="#ffffff" />
          <circle cx="57.5" cy="40" r="3.5" fill="#ffffff" />
          <circle cx="83" cy="48" r="3" fill="#ffffff" />
        </g>

        {/* Front Card: Floating tilted White/Glass Card with Blue Crown */}
        <g transform="translate(150, 65) rotate(-8)" filter="url(#whiteCardShadow)">
          <rect
            width="105"
            height="110"
            rx="22"
            fill="url(#whiteCardGrad)"
            stroke="#ffffff"
            strokeWidth="3"
          />
          {/* Embossed blue crown */}
          <path
            d="M30 76 L30 46 L42 57 L52.5 38 L63 57 L75 46 L75 76 Z"
            fill="#3b82f6"
            opacity="0.85"
            filter="drop-shadow(0 3px 4px rgba(37,99,235,0.2))"
          />
          <circle cx="30" cy="44" r="2.8" fill="#3b82f6" />
          <circle cx="52.5" cy="36" r="3.2" fill="#3b82f6" />
          <circle cx="75" cy="44" r="2.8" fill="#3b82f6" />
        </g>

        {/* Floating smooth foreground spheres */}
        <circle cx="280" cy="160" r="20" fill="url(#sphereGrad1)" filter="drop-shadow(2px 6px 8px rgba(37,99,235,0.25))" />
        <circle cx="325" cy="115" r="12" fill="url(#sphereGrad2)" opacity="0.85" />
        <circle cx="120" cy="150" r="10" fill="url(#sphereGrad1)" opacity="0.6" />
      </svg>
    </div>
  );
};

export const AdminTags = () => {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TagFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserTag | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadTags = useCallback(async (signal?: AbortSignal) => {
    const headers = authHeaders();
    if (!headers) {
      setTagsLoading(false);
      return;
    }
    setTagsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/user-tags`, { headers, signal });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const list: unknown[] = Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body)
        ? body
        : [];
      const tags = list
        .map(normalizeTag)
        .filter((t): t is UserTag => t !== null)
        .sort((a, b) => a.rank - b.rank);
      setTags(tags);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTags(controller.signal);
    return () => controller.abort();
  }, [loadTags]);

  const nextRank = useMemo(() => {
    if (tags.length === 0) return 1;
    return Math.max(...tags.map((t) => t.rank)) + 1;
  }, [tags]);

  const activeCount = useMemo(() => tags.filter((t) => t.isActive).length, [tags]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, rank: String(nextRank) });
    setFormOpen(true);
  };

  const openEdit = (t: UserTag) => {
    setForm({
      id: t.id,
      name: t.name,
      rank: String(t.rank),
      color: t.color && isValidHex(t.color) ? t.color : TAG_COLOR_OPTIONS[0].value,
      isActive: t.isActive,
      thresholdAmount: t.thresholdAmount > 0 ? String(t.thresholdAmount) : "",
      thresholdPeriod: t.thresholdPeriod,
      benefitInr: t.benefitInr > 0 ? String(t.benefitInr) : "",
    });
    setFormOpen(true);
  };

  const saveTag = async () => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    const name = form.name.trim();
    if (!name) {
      toast.error("Tag name is required");
      return;
    }
    const rankNum = Number(form.rank);
    if (!Number.isInteger(rankNum) || rankNum < 1) {
      toast.error("Rank must be an integer ≥ 1");
      return;
    }
    const thresholdNum = form.thresholdAmount.trim() === "" ? 0 : Number(form.thresholdAmount);
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) {
      toast.error("Threshold amount must be a non-negative number");
      return;
    }
    if (!isValidHex(form.color)) {
      toast.error("Color must be a valid hex value (e.g. #00BFFF)");
      return;
    }
    const benefitNum = form.benefitInr.trim() === "" ? 0 : Number(form.benefitInr);
    if (!Number.isFinite(benefitNum) || benefitNum < 0) {
      toast.error("Benefit must be a non-negative number");
      return;
    }
    const payload = {
      name,
      rank: rankNum,
      thresholdAmount: thresholdNum,
      thresholdPeriod: form.thresholdPeriod,
      isActive: form.isActive,
      color: form.color,
      benefitInr: benefitNum,
    };
    setSaving(true);
    try {
      const url = form.id
        ? `${API_BASE}/admin/user-tags/${encodeURIComponent(form.id)}`
        : `${API_BASE}/admin/user-tags`;
      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const saved = normalizeTag(body);
      if (saved) {
        setTags((prev) => {
          const exists = prev.some((t) => t.id === saved.id);
          const next = exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
          return next.sort((a, b) => a.rank - b.rank);
        });
      } else {
        await loadTags();
      }
      toast.success(form.id ? "Tag updated" : "Tag created");
      setFormOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: UserTag) => {
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    const action = t.isActive ? "disable" : "enable";
    setTogglingId(t.id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/user-tags/${encodeURIComponent(t.id)}/${action}`,
        { method: "POST", headers },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      const saved = normalizeTag(body);
      setTags((prev) =>
        prev
          .map((x) => {
            if (x.id !== t.id) return x;
            return saved ?? { ...x, isActive: !x.isActive };
          })
          .sort((a, b) => a.rank - b.rank),
      );
      toast.success(t.isActive ? `Disabled "${t.name}"` : `Enabled "${t.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteTag = async () => {
    if (!confirmDelete) return;
    const headers = authHeaders();
    if (!headers) {
      toast.error("Not authenticated");
      return;
    }
    setDeletingId(confirmDelete.id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/user-tags/${encodeURIComponent(confirmDelete.id)}`,
        { method: "DELETE", headers },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        toast.error(extractErrorMessage(body, res.status));
        return;
      }
      setTags((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      toast.success("Tag deleted");
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to determine styling based on tier name
  const getTierTheme = (t: UserTag) => {
    const lower = t.name.toLowerCase();
    if (lower.includes("silver")) {
      return {
        cardBg:
          "bg-gradient-to-r from-slate-50/90 via-white to-blue-50/30 dark:from-slate-900/40 dark:via-[#111726] dark:to-slate-900/20",
        border: "border-slate-200/80 dark:border-slate-800/80",
        textColor: "text-slate-900 dark:text-white",
        badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        timelineNodeBorder: "border-blue-500",
        timelineNodeDot: "bg-blue-500",
        emblemBg:
          "bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border-2 border-white/90 dark:border-slate-600/60 shadow-md shadow-slate-400/20 dark:shadow-black/30",
        emblemIcon: (
          <Star className="w-8 h-8 fill-slate-300 stroke-slate-500 drop-shadow-sm" />
        ),
        watermark: (
          <Crown className="absolute -right-4 -bottom-6 w-36 h-36 text-blue-200/20 dark:text-blue-900/10 pointer-events-none stroke-[0.5] fill-blue-100/20 dark:fill-blue-900/5" />
        ),
      };
    }

    if (lower.includes("gold")) {
      return {
        cardBg:
          "bg-gradient-to-r from-amber-50/70 via-amber-50/30 to-amber-100/50 dark:from-amber-950/25 dark:via-[#111726] dark:to-amber-950/20",
        border: "border-amber-200/80 dark:border-amber-900/50",
        textColor: "text-amber-600 dark:text-amber-400",
        badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        timelineNodeBorder: "border-amber-500",
        timelineNodeDot: "bg-amber-500",
        emblemBg:
          "bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 border-2 border-amber-100/90 shadow-md shadow-amber-500/25",
        emblemIcon: (
          <Crown className="w-8 h-8 fill-amber-100 stroke-amber-700 drop-shadow-sm" />
        ),
        watermark: (
          <Crown className="absolute -right-4 -bottom-6 w-36 h-36 text-amber-300/25 dark:text-amber-900/10 pointer-events-none stroke-[0.5] fill-amber-200/20 dark:fill-amber-900/5" />
        ),
      };
    }

    if (lower.includes("diamond")) {
      return {
        cardBg:
          "bg-gradient-to-r from-sky-50/70 via-blue-50/30 to-sky-100/50 dark:from-blue-950/25 dark:via-[#111726] dark:to-blue-950/20",
        border: "border-blue-200/80 dark:border-blue-900/50",
        textColor: "text-blue-600 dark:text-blue-400",
        badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        timelineNodeBorder: "border-blue-600",
        timelineNodeDot: "bg-blue-600",
        emblemBg:
          "bg-gradient-to-b from-sky-300 via-blue-500 to-indigo-600 border-2 border-sky-100/90 shadow-md shadow-blue-500/30",
        emblemIcon: (
          <Gem className="w-8 h-8 fill-sky-100 stroke-blue-800 drop-shadow-sm" />
        ),
        watermark: (
          <Gem className="absolute -right-4 -bottom-6 w-36 h-36 text-blue-300/25 dark:text-blue-900/10 pointer-events-none stroke-[0.5] fill-blue-200/20 dark:fill-blue-900/5" />
        ),
      };
    }

    // Default for any other custom tags
    return {
      cardBg:
        "bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40 dark:from-slate-900/40 dark:via-[#111726] dark:to-slate-900/20",
      border: "border-slate-200/80 dark:border-slate-800/80",
      textColor: "text-slate-900 dark:text-white",
      badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      timelineNodeBorder: "border-blue-500",
      timelineNodeDot: "bg-blue-500",
      emblemBg:
        "bg-gradient-to-b from-blue-100 to-indigo-200 dark:from-blue-900 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800 shadow-sm",
      emblemIcon: <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />,
      watermark: (
        <TagIcon className="absolute -right-4 -bottom-6 w-36 h-36 text-slate-200/20 dark:text-slate-800/10 pointer-events-none stroke-[0.5]" />
      ),
    };
  };

  return (
    <div className="space-y-6 max-w-full relative">
      {/* Top Header Section with 3D Illustration */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
        <div className="max-w-xl z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            User Tags
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
            Create tier tags like Silver, Gold or Diamond. Higher rank = better tier. Each tag must
            have a strictly higher threshold than all lower-rank tags.
          </p>
        </div>

        {/* Right side: Add Tag Button + 3D Decorative Header Artwork */}
        <div className="flex items-center gap-4 z-10 shrink-0">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Tag</span>
          </button>
        </div>

        {/* Background 3D Floating Composition */}
        <TagsHeaderIllustration />
      </div>

      {/* Row 1: 2 Top Metric Cards (Total Tags & Active Tags) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: TOTAL TAGS */}
        <div className="relative overflow-hidden rounded-3xl p-6 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <TagIcon className="w-7 h-7 rotate-[-45deg]" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Total Tags
                </p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                  {tagsLoading ? "—" : tags.length.toLocaleString()}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ArrowUp className="w-3 h-3 stroke-[3]" />
              +0%
            </span>
          </div>

          {/* Smooth bottom blue sparkline wave */}
          <div className="mt-4 pt-2 relative h-6 w-full overflow-hidden">
            <svg
              className="absolute -bottom-1 left-0 right-0 w-full h-8"
              viewBox="0 0 400 40"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 32 C 80 32, 140 14, 220 18 C 300 22, 350 12, 400 12"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: ACTIVE TAGS */}
        <div className="relative overflow-hidden rounded-3xl p-6 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Active Tags
                </p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                  {tagsLoading ? "—" : activeCount.toLocaleString()}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ArrowUp className="w-3 h-3 stroke-[3]" />
              +0%
            </span>
          </div>

          {/* Smooth bottom green sparkline wave */}
          <div className="mt-4 pt-2 relative h-6 w-full overflow-hidden">
            <svg
              className="absolute -bottom-1 left-0 right-0 w-full h-8"
              viewBox="0 0 400 40"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 32 C 80 32, 140 18, 220 22 C 300 26, 350 14, 400 14"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content Card: Tier Tags */}
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-6">
        {/* Section Title */}
        <div className="flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 fill-blue-500/20" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Tier Tags</h2>
        </div>

        {tagsLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading tier tags…</p>
          </div>
        ) : tags.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
            <TagIcon className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              No tags configured
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Create your first user tier tag to get started.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tag
            </button>
          </div>
        ) : (
          <div className="relative pl-7 sm:pl-9 space-y-4">
            {/* Vertical timeline connecting line */}
            <div className="absolute left-2.5 sm:left-3.5 top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-800 -translate-x-1/2" />

            {tags.map((t) => {
              const theme = getTierTheme(t);

              return (
                <div key={t.id} className="relative group">
                  {/* Timeline node sitting on the vertical track */}
                  <div
                    className={`absolute -left-7 sm:-left-9 top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 ${theme.timelineNodeBorder} bg-white dark:bg-[#111726] flex items-center justify-center shadow-xs z-10`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${theme.timelineNodeDot}`} />
                  </div>

                  {/* Tier Card */}
                  <div
                    className={`relative overflow-hidden rounded-2xl border ${theme.border} ${theme.cardBg} p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center md:justify-between gap-5`}
                  >
                    {/* Background Watermark */}
                    {theme.watermark}

                    {/* Left: 3D Emblem + Content */}
                    <div className="flex items-center gap-5 min-w-0 z-10">
                      {/* 3D Beveled Emblem */}
                      <div
                        className={`h-16 w-16 rounded-2xl shrink-0 flex items-center justify-center select-none ${theme.emblemBg}`}
                      >
                        {theme.emblemIcon}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className={`text-lg font-bold tracking-tight ${theme.textColor}`}>
                            {t.name}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${theme.badgeBg}`}
                          >
                            Rank {t.rank}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Auto-applies when total transactions ≥{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {t.thresholdAmount.toLocaleString("en-US")} USDT
                          </span>{" "}
                          in the last {t.thresholdPeriod}.
                        </p>

                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Benefit:{" "}
                          {t.benefitInr > 0 ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              +₹{t.benefitInr.toLocaleString("en-IN")} per USDT exchanged
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">none</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Toggle Switch & Edit/Delete Action Buttons */}
                    <div className="flex items-center gap-4 shrink-0 z-10 self-end md:self-center">
                      {/* iOS-Style Toggle Switch */}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={t.isActive}
                          onCheckedChange={() => toggleActive(t)}
                          disabled={togglingId === t.id}
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161d31] hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit</span>
                      </button>

                      {/* Delete Button (if custom/non-protected) */}
                      {!isProtectedTag(t.name) && (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(t)}
                          disabled={deletingId === t.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Create Tag Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setFormOpen(false);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              {form.id ? "Edit Tier Tag" : "Create New Tier Tag"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Configure the tier threshold and benefits. Threshold must be strictly higher than all
              lower-rank tags.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="tag-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tag Name
                </label>
                <input
                  id="tag-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Platinum"
                  maxLength={32}
                  disabled={form.id !== null && isProtectedTag(form.name)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                />
                {form.id !== null && isProtectedTag(form.name) && (
                  <p className="text-[11px] text-slate-400">
                    Name is locked for default tier tags.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="tag-rank" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rank
                </label>
                <input
                  id="tag-rank"
                  inputMode="numeric"
                  value={form.rank}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d+$/.test(v)) setForm((f) => ({ ...f, rank: v }));
                  }}
                  placeholder="e.g. 4"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="tag-threshold" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Threshold (USDT)
                </label>
                <input
                  id="tag-threshold"
                  inputMode="decimal"
                  value={form.thresholdAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v))
                      setForm((f) => ({ ...f, thresholdAmount: v }));
                  }}
                  placeholder="e.g. 15000"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="tag-period" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Period Window
                </label>
                <select
                  id="tag-period"
                  value={form.thresholdPeriod}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, thresholdPeriod: e.target.value as ThresholdPeriod }))
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="day">Last Day (24 hours)</option>
                  <option value="week">Last Week (7 days)</option>
                  <option value="month">Last Month (30 days)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tag-benefit" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Benefit (₹ INR per USDT exchanged)
              </label>
              <input
                id="tag-benefit"
                inputMode="decimal"
                value={form.benefitInr}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v))
                    setForm((f) => ({ ...f, benefitInr: v }));
                }}
                placeholder="0"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <p className="text-[11px] text-slate-400">
                Bonus cash added to payouts when users hold this tag. Enter 0 for none.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Active Status
              </span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(val) => setForm((f) => ({ ...f, isActive: val }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveTag}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : form.id ? "Save Changes" : "Create Tag"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Delete Tag &quot;{confirmDelete?.name}&quot;?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Users currently assigned this tag will lose it unless they qualify for another tag.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deleteTag}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              Confirm Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTags;
