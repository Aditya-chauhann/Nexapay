import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
  Landmark,
  Search,
  SlidersHorizontal,
  Radio,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Send,
  Mail,
  LifeBuoy,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldAlert,
  Check,
  Rocket,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { CustomDateTimePicker, formatLocalISO } from "@/components/ui/CustomDateTimePicker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAnnouncement,
  deleteAnnouncement,
  getNotificationSettings,
  listAdminAnnouncements,
  updateAnnouncement,
  updateNotificationSettings,
  type AnnouncementItem,
  type AnnouncementTarget,
  type AnnouncementType,
  type NotificationSettings,
} from "@/lib/api-announcements";

/* ─────────────────────────────────────────────────────────────
   HELPERS & METADATA
───────────────────────────────────────────────────────────── */
interface CategoryMeta {
  name: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function getCategoryMeta(title: string, content: string): CategoryMeta {
  const text = (title + " " + content).toLowerCase();
  if (text.includes("deposit")) {
    return {
      name: "Deposit",
      badgeBg: "bg-amber-50 dark:bg-amber-950/60",
      badgeText: "text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
      iconBg: "bg-amber-50 dark:bg-amber-950/60",
      iconColor: "text-amber-600 dark:text-amber-400",
      Icon: AlertTriangle,
    };
  }
  if (text.includes("withdraw")) {
    return {
      name: "Withdrawal",
      badgeBg: "bg-purple-50 dark:bg-purple-950/60",
      badgeText: "text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50",
      iconBg: "bg-purple-50 dark:bg-purple-950/60",
      iconColor: "text-purple-600 dark:text-purple-400",
      Icon: Clock,
    };
  }
  if (text.includes("dispute")) {
    return {
      name: "Dispute",
      badgeBg: "bg-rose-50 dark:bg-rose-950/60",
      badgeText: "text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50",
      iconBg: "bg-rose-50 dark:bg-rose-950/60",
      iconColor: "text-rose-600 dark:text-rose-400",
      Icon: AlertTriangle,
    };
  }
  if (text.includes("upi") || text.includes("feature")) {
    return {
      name: "Feature",
      badgeBg: "bg-emerald-50 dark:bg-emerald-950/60",
      badgeText: "text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/60",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      Icon: CheckCircle2,
    };
  }
  return {
    name: "System",
    badgeBg: "bg-blue-50 dark:bg-blue-950/60",
    badgeText: "text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50",
    iconBg: "bg-blue-50 dark:bg-blue-950/60",
    iconColor: "text-blue-600 dark:text-blue-400",
    Icon: Megaphone,
  };
}

function getSeverityBadge(type: AnnouncementType) {
  if (type === "warning") {
    return {
      label: "Warning",
      icon: "⚠",
      className: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50",
    };
  }
  if (type === "success") {
    return {
      label: "Success",
      icon: "✓",
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50",
    };
  }
  if (type === "urgent") {
    return {
      label: "Urgent",
      icon: "✕",
      className: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50",
    };
  }
  return {
    label: "Info",
    icon: "ℹ",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50",
  };
}

function getAudienceLabel(target: AnnouncementTarget): string {
  if (target === "users") return "Users";
  if (target === "staff") return "Staff Only";
  return "All Users & Staff";
}

function getAnnouncementStatus(item: { startDate: string; endDate: string; isActive: boolean }): "active" | "scheduled" | "expired" {
  if (!item.isActive) return "expired";
  const now = new Date();
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  if (!isNaN(start.getTime()) && now < start) return "scheduled";
  if (!isNaN(end.getTime()) && now > end) return "expired";
  return "active";
}

function formatScheduleDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hourStr = String(hours).padStart(2, "0");
    return `${day}/${month}/${year}, ${hourStr}:${minutes} ${ampm}`;
  } catch {
    return isoStr;
  }
}

/* ─────────────────────────────────────────────────────────────
   INITIAL SAMPLE ITEMS (Fallback matching user screenshots)
───────────────────────────────────────────────────────────── */
const INITIAL_MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-1",
    title: "System Maintenance",
    content: "Platform will be under maintenance on 28th Sept from 6 PM to 8 PM IST.",
    link: null,
    targetAudience: "all",
    type: "info",
    startDate: "2026-09-29T10:36:00.000Z",
    endDate: "2026-10-06T10:36:00.000Z",
    isActive: true,
    createdBy: "admin",
    createdAt: "2026-09-28T17:52:00.000Z",
    updatedAt: "2026-09-28T17:52:00.000Z",
  },
  {
    id: "ann-2",
    title: "Deposit Delay Notice",
    content: "Deposits may take longer than usual due to bank maintenance.",
    link: null,
    targetAudience: "all",
    type: "warning",
    startDate: "2026-10-01T09:00:00.000Z",
    endDate: "2026-10-02T09:00:00.000Z",
    isActive: true,
    createdBy: "admin",
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:00:00.000Z",
  },
  {
    id: "ann-3",
    title: "New UPI Support",
    content: "UPI deposits are now live on NexaPay. Enjoy fast transactions and zero fees.",
    link: null,
    targetAudience: "all",
    type: "success",
    startDate: "2026-09-28T11:00:00.000Z",
    endDate: "2026-09-30T11:00:00.000Z",
    isActive: true,
    createdBy: "admin",
    createdAt: "2026-08-25T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  },
  {
    id: "ann-4",
    title: "Withdrawal Update",
    content: "Withdrawals will be processed within 24 hours.",
    link: null,
    targetAudience: "users",
    type: "info",
    startDate: "2026-09-24T14:00:00.000Z",
    endDate: "2026-09-27T23:59:00.000Z",
    isActive: false,
    createdBy: "admin",
    createdAt: "2026-09-24T14:00:00.000Z",
    updatedAt: "2026-09-24T14:00:00.000Z",
  },
  {
    id: "ann-5",
    title: "Dispute Resolution Time",
    content: "Dispute resolution may take longer than usual.",
    link: null,
    targetAudience: "all",
    type: "warning",
    startDate: "2026-09-20T10:00:00.000Z",
    endDate: "2026-09-23T10:00:00.000Z",
    isActive: true,
    createdBy: "admin",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  },
];

interface AnnouncementFormState {
  id: string | null;
  title: string;
  content: string;
  link: string;
  targetAudience: AnnouncementTarget;
  type: AnnouncementType;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const defaultStart = () => formatLocalISO(new Date());
const defaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return formatLocalISO(d);
};

const EMPTY_FORM: AnnouncementFormState = {
  id: null,
  title: "",
  content: "",
  link: "",
  targetAudience: "all",
  type: "info",
  startDate: defaultStart(),
  endDate: defaultEnd(),
  isActive: true,
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT: AdminAnnouncements
───────────────────────────────────────────────────────────── */
export default function AdminAnnouncements() {
  // Tabs: announcements vs settings
  const [activeTab, setActiveTab] = useState<"announcements" | "settings">("announcements");

  // Announcements State
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Modal State
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AnnouncementFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  // Notification Settings State
  const [settings, setSettings] = useState<NotificationSettings>({
    depositNotificationsEnabled: true,
    withdrawalNotificationsEnabled: true,
    disputeNotificationsEnabled: true,
    ticketNotificationsEnabled: true,
    telegramNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    systemAlertsEnabled: true,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);

  // Load announcements from server
  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminAnnouncements();
      if (data && data.length > 0) {
        setAnnouncements(data);
      } else {
        setAnnouncements(INITIAL_MOCK_ANNOUNCEMENTS);
      }
    } catch {
      setAnnouncements(INITIAL_MOCK_ANNOUNCEMENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load notification settings
  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const data = await getNotificationSettings();
      if (data) {
        setSettings(data);
      }
    } catch {
      // Keep defaults
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Notification Centre | TrustO Admin";
    void loadAnnouncements();
    void loadSettings();
  }, [loadAnnouncements, loadSettings]);

  // Handle single setting toggle
  const handleToggleSetting = async (key: keyof NotificationSettings, val: boolean) => {
    setSavingSettingKey(key);
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    try {
      await updateNotificationSettings({ [key]: val });
      toast.success("Notification control updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update notification setting");
      // Revert on error
      setSettings(settings);
    } finally {
      setSavingSettingKey(null);
    }
  };

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      startDate: defaultStart(),
      endDate: defaultEnd(),
    });
    setActiveStep(1);
    setFormOpen(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    setForm({
      id: item.id,
      title: item.title,
      content: item.content,
      link: item.link || "",
      targetAudience: item.targetAudience,
      type: item.type,
      startDate: formatLocalISO(new Date(item.startDate)),
      endDate: formatLocalISO(new Date(item.endDate)),
      isActive: item.isActive,
    });
    setActiveStep(1);
    setFormOpen(true);
  };

  const handleDuplicate = (item: AnnouncementItem) => {
    setForm({
      id: null,
      title: `${item.title} (Copy)`,
      content: item.content,
      link: item.link || "",
      targetAudience: item.targetAudience,
      type: item.type,
      startDate: defaultStart(),
      endDate: defaultEnd(),
      isActive: true,
    });
    setActiveStep(1);
    setFormOpen(true);
    toast.info("Copied announcement to draft");
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Please enter message content");
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        const updated = await updateAnnouncement(form.id, {
          title: form.title.trim(),
          content: form.content.trim(),
          link: form.link.trim() || undefined,
          targetAudience: form.targetAudience,
          type: form.type,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          isActive: form.isActive,
        });
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === form.id ? updated : a))
        );
        toast.success("Announcement updated successfully");
      } else {
        const created = await createAnnouncement({
          title: form.title.trim(),
          content: form.content.trim(),
          link: form.link.trim() || undefined,
          targetAudience: form.targetAudience,
          type: form.type,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          isActive: form.isActive,
        });
        setAnnouncements((prev) => [created, ...prev]);
        toast.success("Announcement created successfully");
      }
      setFormOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, newActive: boolean) => {
    try {
      await updateAnnouncement(id, { isActive: newActive });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: newActive } : a))
      );
      toast.success(newActive ? "Announcement activated" : "Announcement deactivated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Announcement deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    for (const a of announcements) {
      const st = getAnnouncementStatus(a);
      if (st === "active") active++;
      else if (st === "scheduled") scheduled++;
      else expired++;
    }
    return {
      total: announcements.length,
      active,
      scheduled,
      expired,
    };
  }, [announcements]);

  // Filtered announcements
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements.filter((item) => {
      if (q) {
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (audienceFilter !== "all" && item.targetAudience !== audienceFilter) {
        return false;
      }
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all") {
        const st = getAnnouncementStatus(item);
        if (st !== statusFilter) return false;
      }
      return true;
    });
  }, [announcements, search, audienceFilter, typeFilter, statusFilter]);

  // Paginated list
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Select all helper
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedList.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER: Title, Subtitle, & "+ New Announcement"
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <Megaphone className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Notification Centre
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage broadcast announcements, audience scheduling, and dynamic notification controls.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP TABS: "Announcements & Scheduler" vs "Notification Controls"
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-8 border-b border-border/60">
        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === "announcements"
              ? "text-blue-600 dark:text-blue-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Announcements & Scheduler</span>
          {activeTab === "announcements" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === "settings"
              ? "text-blue-600 dark:text-blue-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Notification Controls</span>
          {activeTab === "settings" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          TAB 1: ANNOUNCEMENTS & SCHEDULER
      ═════════════════════════════════════════════════════════════ */}
      {activeTab === "announcements" && (
        <div className="space-y-6">
          {/* ─────────────────────────────────────────────────────────────
              4 METRIC / STAT CARDS WITH MINI GRAPHICS
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Announcements */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">
                    Total Announcements
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {metrics.total}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> 20%
                    </span>
                  </div>
                </div>
              </div>
              {/* Mini Bar Chart Graphic */}
              <div className="flex items-end gap-1 h-8 opacity-70">
                <div className="w-1.5 bg-blue-300 dark:bg-blue-700/60 rounded-t h-3" />
                <div className="w-1.5 bg-blue-400 dark:bg-blue-600/70 rounded-t h-5" />
                <div className="w-1.5 bg-blue-300 dark:bg-blue-700/60 rounded-t h-4" />
                <div className="w-1.5 bg-blue-500 dark:bg-blue-500 rounded-t h-7" />
                <div className="w-1.5 bg-blue-300 dark:bg-blue-700/60 rounded-t h-3" />
                <div className="w-1.5 bg-blue-400 dark:bg-blue-600/70 rounded-t h-6" />
                <div className="w-1.5 bg-blue-600 dark:bg-blue-400 rounded-t h-8" />
              </div>
            </div>

            {/* Card 2: Active Now */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">
                    Active Now
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {metrics.active}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> 12%
                    </span>
                  </div>
                </div>
              </div>
              {/* Mini Bar Chart Graphic */}
              <div className="flex items-end gap-1 h-8 opacity-70">
                <div className="w-1.5 bg-emerald-300 dark:bg-emerald-700/60 rounded-t h-2" />
                <div className="w-1.5 bg-emerald-400 dark:bg-emerald-600/70 rounded-t h-4" />
                <div className="w-1.5 bg-emerald-500 dark:bg-emerald-500 rounded-t h-6" />
                <div className="w-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-t h-8" />
                <div className="w-1.5 bg-emerald-400 dark:bg-emerald-600/70 rounded-t h-5" />
                <div className="w-1.5 bg-emerald-300 dark:bg-emerald-700/60 rounded-t h-3" />
                <div className="w-1.5 bg-emerald-500 dark:bg-emerald-500 rounded-t h-7" />
              </div>
            </div>

            {/* Card 3: Scheduled */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">
                    Scheduled
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {metrics.scheduled}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> 0%
                    </span>
                  </div>
                </div>
              </div>
              {/* Mini Bar Chart Graphic */}
              <div className="flex items-end gap-1 h-8 opacity-70">
                <div className="w-1.5 bg-indigo-300 dark:bg-indigo-700/60 rounded-t h-3" />
                <div className="w-1.5 bg-indigo-400 dark:bg-indigo-600/70 rounded-t h-6" />
                <div className="w-1.5 bg-indigo-300 dark:bg-indigo-700/60 rounded-t h-4" />
                <div className="w-1.5 bg-indigo-500 dark:bg-indigo-500 rounded-t h-7" />
                <div className="w-1.5 bg-indigo-400 dark:bg-indigo-600/70 rounded-t h-5" />
                <div className="w-1.5 bg-indigo-300 dark:bg-indigo-700/60 rounded-t h-2" />
                <div className="w-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-t h-8" />
              </div>
            </div>

            {/* Card 4: Expired */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">
                    Expired
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {metrics.expired}
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" /> 10%
                    </span>
                  </div>
                </div>
              </div>
              {/* Mini Bar Chart Graphic */}
              <div className="flex items-end gap-1 h-8 opacity-70">
                <div className="w-1.5 bg-rose-300 dark:bg-rose-700/60 rounded-t h-4" />
                <div className="w-1.5 bg-rose-500 dark:bg-rose-500 rounded-t h-7" />
                <div className="w-1.5 bg-rose-400 dark:bg-rose-600/70 rounded-t h-5" />
                <div className="w-1.5 bg-rose-300 dark:bg-rose-700/60 rounded-t h-3" />
                <div className="w-1.5 bg-rose-600 dark:bg-rose-400 rounded-t h-8" />
                <div className="w-1.5 bg-rose-400 dark:bg-rose-600/70 rounded-t h-4" />
                <div className="w-1.5 bg-rose-300 dark:bg-rose-700/60 rounded-t h-2" />
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SEARCH & FILTERS BAR
          ───────────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-2.5 rounded-2xl bg-card border border-border/60 shadow-xs">
            {/* Left Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Search Input */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search announcements..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-secondary/30 border border-border/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* All Audience Dropdown */}
              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="w-[145px] h-9 text-xs rounded-xl bg-secondary/30 border-border/70">
                  <div className="flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{audienceFilter === "all" ? "All Audience" : getAudienceLabel(audienceFilter as any)}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Audience</SelectItem>
                  <SelectItem value="users" className="text-xs">Users Only</SelectItem>
                  <SelectItem value="staff" className="text-xs">Staff Only</SelectItem>
                </SelectContent>
              </Select>

              {/* All Types Dropdown */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-secondary/30 border-border/70">
                  <div className="flex items-center gap-1.5 truncate">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="capitalize">{typeFilter === "all" ? "All Types" : typeFilter}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Types</SelectItem>
                  <SelectItem value="info" className="text-xs">Info</SelectItem>
                  <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                  <SelectItem value="success" className="text-xs">Success</SelectItem>
                  <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
                </SelectContent>
              </Select>

              {/* All Status Dropdown */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-secondary/30 border-border/70">
                  <div className="flex items-center gap-1.5 truncate">
                    <Radio className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="capitalize">{statusFilter === "all" ? "All Status" : statusFilter}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Status</SelectItem>
                  <SelectItem value="active" className="text-xs">Active</SelectItem>
                  <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
                  <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Right: Date Range Selector */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl bg-secondary/30 border border-border/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Select date range</span>
                <Calendar className="w-3.5 h-3.5 ml-3 opacity-60" />
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              ANNOUNCEMENTS DATA TABLE
          ───────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-semibold">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          paginatedList.length > 0 &&
                          paginatedList.every((item) => selectedIds.has(item.id))
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-border text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-2 w-12 font-medium">#</th>
                    <th className="py-3 px-4 font-medium">Title</th>
                    <th className="py-3 px-4 font-medium">Message Preview</th>
                    <th className="py-3 px-4 font-medium">Audience</th>
                    <th className="py-3 px-4 font-medium">Type / Severity</th>
                    <th className="py-3 px-4 font-medium">Schedule</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 text-center font-medium w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        Loading announcements...
                      </td>
                    </tr>
                  ) : paginatedList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        No announcements found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((item, index) => {
                      const status = getAnnouncementStatus(item);
                      const severity = getSeverityBadge(item.type);
                      const cat = getCategoryMeta(item.title, item.content);
                      const isSelected = selectedIds.has(item.id);
                      const itemIndex = (currentPage - 1) * pageSize + index + 1;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(item.id)}
                              className="rounded border-border text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>

                          {/* Index # */}
                          <td className="py-3 px-2 text-muted-foreground font-mono">
                            {itemIndex}
                          </td>

                          {/* Title with Category Icon */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 min-w-[180px]">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cat.iconBg} ${cat.iconColor}`}
                              >
                                <cat.Icon className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-foreground text-xs">
                                {item.title}
                              </span>
                            </div>
                          </td>

                          {/* Message Preview */}
                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-muted-foreground text-xs line-clamp-1 truncate">
                              {item.content}
                            </p>
                          </td>

                          {/* Audience Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                              <Users className="w-3 h-3 shrink-0" />
                              <span>{getAudienceLabel(item.targetAudience)}</span>
                            </span>
                          </td>

                          {/* Type / Severity Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${severity.className}`}
                            >
                              <span>{severity.icon}</span>
                              <span>{severity.label}</span>
                            </span>
                          </td>

                          {/* Schedule (Start & End with icons) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="space-y-0.5 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1.5 font-mono">
                                <Calendar className="w-3 h-3 text-muted-foreground/80 shrink-0" />
                                <span>{formatScheduleDateTime(item.startDate)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono">
                                <Calendar className="w-3 h-3 text-muted-foreground/80 shrink-0" />
                                <span>{formatScheduleDateTime(item.endDate)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge & Toggle Switch */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {status === "active" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </span>
                              )}
                              {status === "scheduled" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  Scheduled
                                </span>
                              )}
                              {status === "expired" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Expired
                                </span>
                              )}
                              <Switch
                                checked={item.isActive}
                                onCheckedChange={(val) => handleToggleActive(item.id, val)}
                              />
                            </div>
                          </td>

                          {/* Actions: Edit, Duplicate, Delete */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                title="Edit announcement"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicate / Clone */}
                              <button
                                type="button"
                                onClick={() => handleDuplicate(item)}
                                title="Duplicate announcement"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                title="Delete announcement"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer: Showing X to Y and Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-muted/10 text-xs text-muted-foreground">
              <div>
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {filteredList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(currentPage * pageSize, filteredList.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">
                  {filteredList.length}
                </span>{" "}
                announcements
              </div>

              <div className="flex items-center gap-2">
                {/* Pagination Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-border/60 bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors ${
                        currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-border/60 bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-border/60 bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Page Size Select */}
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-24 h-7 text-xs rounded-lg bg-card border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5" className="text-xs">5 / page</SelectItem>
                    <SelectItem value="10" className="text-xs">10 / page</SelectItem>
                    <SelectItem value="25" className="text-xs">25 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          TAB 2: NOTIFICATION CONTROL CENTRE
      ═════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Notification Control Centre</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable or silence real-time platform notification triggers across channels and admin dispatchers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Notification Engine Online
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Deposit Notifications */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ArrowDownToLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Deposit Notifications</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      New deposit requests & transaction confirmations
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.depositNotificationsEnabled}
                  disabled={savingSettingKey === "depositNotificationsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("depositNotificationsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Triggers: Deposits / Approvals</span>
                <span className={settings.depositNotificationsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.depositNotificationsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>

            {/* 2. Withdrawal Notifications */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <ArrowUpFromLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Withdrawal Notifications</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      New payout requests, queued bank releases
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.withdrawalNotificationsEnabled}
                  disabled={savingSettingKey === "withdrawalNotificationsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("withdrawalNotificationsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Triggers: Payouts / Processing</span>
                <span className={settings.withdrawalNotificationsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.withdrawalNotificationsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>

            {/* 3. Dispute Notifications */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Dispute Notifications</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      User transaction disputes & arbitration tickets
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.disputeNotificationsEnabled}
                  disabled={savingSettingKey === "disputeNotificationsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("disputeNotificationsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Triggers: Chargebacks / Disputes</span>
                <span className={settings.disputeNotificationsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.disputeNotificationsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>

            {/* 4. Ticket Notifications */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Support Tickets</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Incoming support tickets, chat replies, and staff assignments
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.ticketNotificationsEnabled}
                  disabled={savingSettingKey === "ticketNotificationsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("ticketNotificationsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Triggers: Support Desk</span>
                <span className={settings.ticketNotificationsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.ticketNotificationsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>

            {/* 5. Telegram Notifications */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Telegram Dispatcher</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Broadcast system notifications to configured Telegram admin channel
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.telegramNotificationsEnabled}
                  disabled={savingSettingKey === "telegramNotificationsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("telegramNotificationsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Channel: Telegram Bot API</span>
                <span className={settings.telegramNotificationsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.telegramNotificationsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>

            {/* 6. Email Notifications */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Email Notifications</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Daily email summaries and critical security notices to administrators
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.emailNotificationsEnabled}
                  disabled={savingSettingKey === "emailNotificationsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("emailNotificationsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Channel: SMTP Mailer</span>
                <span className={settings.emailNotificationsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.emailNotificationsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>

            {/* 7. System Alerts */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between space-y-4 md:col-span-2 lg:col-span-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">System Alerts & Security Warnings</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Server heartbeat failures, database latency, unauthorized access attempts, and brute-force lockouts
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.systemAlertsEnabled}
                  disabled={savingSettingKey === "systemAlertsEnabled"}
                  onCheckedChange={(val) => handleToggleSetting("systemAlertsEnabled", val)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 flex items-center justify-between">
                <span>Security Engine: Real-time Sentinel</span>
                <span className={settings.systemAlertsEnabled ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                  {settings.systemAlertsEnabled ? "Active" : "Silenced"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CREATE / EDIT ANNOUNCEMENT MODAL (Matches user's Screenshot 1)
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          overlayClassName="bg-black/50 backdrop-blur-xs"
          className="max-w-3xl p-0 gap-0 overflow-hidden sm:rounded-3xl border border-border/70 shadow-2xl bg-card"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
            {/* Left Stepper Sidebar */}
            <div className="md:col-span-4 bg-muted/20 border-r border-border/60 p-5 flex flex-col justify-between">
              <div className="space-y-2">
                {/* Step 1: Basic Details */}
                <div
                  onClick={() => setActiveStep(1)}
                  className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    activeStep === 1
                      ? "bg-indigo-50/90 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs"
                      : "hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground">Basic Details</h4>
                    <p className="text-[10px] text-muted-foreground truncate">Title and message</p>
                  </div>
                </div>

                {/* Step 2: Audience & Type */}
                <div
                  onClick={() => setActiveStep(2)}
                  className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    activeStep === 2
                      ? "bg-indigo-50/90 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs"
                      : "hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground">Audience & Type</h4>
                    <p className="text-[10px] text-muted-foreground truncate">Target users and severity</p>
                  </div>
                </div>

                {/* Step 3: Schedule */}
                <div
                  onClick={() => setActiveStep(3)}
                  className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    activeStep === 3
                      ? "bg-indigo-50/90 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs"
                      : "hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground">Schedule</h4>
                    <p className="text-[10px] text-muted-foreground truncate">Start and end date/time</p>
                  </div>
                </div>

                {/* Step 4: Additional Settings */}
                <div
                  onClick={() => setActiveStep(4)}
                  className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    activeStep === 4
                      ? "bg-indigo-50/90 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs"
                      : "hover:bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground">Additional Settings</h4>
                    <p className="text-[10px] text-muted-foreground truncate">Link and status</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Form Fields */}
            <div className="md:col-span-8 p-6 flex flex-col justify-between">
              {/* Header */}
              <div className="pb-3 pr-8">
                <h2 className="text-base font-bold text-foreground">
                  {form.id ? "Edit Announcement" : "Create Announcement"}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Schedule broadcast announcements for users, staff, or all users.
                </p>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="space-y-4 my-2">
                {/* Title */}
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Scheduled System Maintenance"
                    className="w-full h-9 px-3 text-xs rounded-xl bg-secondary/30 border border-border/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {form.title.length}/100
                    </span>
                  </div>
                </div>

                {/* Message / Content */}
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Message / Content
                  </label>
                  <textarea
                    required
                    maxLength={500}
                    rows={3}
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    placeholder="Enter detailed announcement message..."
                    className="w-full p-2.5 text-xs rounded-xl bg-secondary/30 border border-border/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {form.content.length}/500
                    </span>
                  </div>
                </div>

                {/* Row: Target Audience + Type / Severity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">
                      Target Audience
                    </label>
                    <Select
                      value={form.targetAudience}
                      onValueChange={(val: any) => setForm((f) => ({ ...f, targetAudience: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/30 border-border/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Users & Staff</SelectItem>
                        <SelectItem value="users" className="text-xs">Users</SelectItem>
                        <SelectItem value="staff" className="text-xs">Staff Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">
                      Type / Severity
                    </label>
                    <Select
                      value={form.type}
                      onValueChange={(val: any) => setForm((f) => ({ ...f, type: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/30 border-border/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info" className="text-xs">ℹ Info</SelectItem>
                        <SelectItem value="warning" className="text-xs">⚠ Warning</SelectItem>
                        <SelectItem value="success" className="text-xs">✓ Success</SelectItem>
                        <SelectItem value="urgent" className="text-xs">✕ Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row: Start Date & Time + End Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CustomDateTimePicker
                    label="Start Date & Time"
                    value={form.startDate}
                    onChange={(val) => setForm((f) => ({ ...f, startDate: val }))}
                  />
                  <CustomDateTimePicker
                    label="End Date & Time"
                    value={form.endDate}
                    onChange={(val) => setForm((f) => ({ ...f, endDate: val }))}
                    isEndDate
                  />
                </div>

                {/* Action Link (Optional) */}
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Action Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="e.g. /user/deposit or https://example.com"
                    className="w-full h-9 px-3 text-xs rounded-xl bg-secondary/30 border border-border/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                {/* Active Status Card */}
                <div className="p-3 rounded-xl border border-border/60 bg-secondary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-foreground">Active Status</h5>
                      <p className="text-[10px] text-muted-foreground">
                        Active announcements broadcast during scheduled dates
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(val) => setForm((f) => ({ ...f, isActive: val }))}
                  />
                </div>
              </form>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border/70 text-xs font-semibold text-foreground hover:bg-secondary/70 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : form.id ? "Save Changes" : "Create Announcement"}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
