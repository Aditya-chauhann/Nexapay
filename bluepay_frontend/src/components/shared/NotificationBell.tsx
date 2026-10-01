import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  CheckCheck,
  ExternalLink,
  LifeBuoy,
  Megaphone,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteAllNotifications,
  deleteNotification,
  fetchActiveAnnouncements,
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotificationItem,
} from "@/lib/api-notifications";
import type { AnnouncementItem } from "@/lib/api-announcements";
import { formatIst } from "@/lib/format-date";

type DetailTarget =
  | { kind: "notification"; item: UserNotificationItem }
  | { kind: "announcement"; item: AnnouncementItem };

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Detail Modal state
  const [selectedDetail, setSelectedDetail] = useState<DetailTarget | null>(null);

  // Pinned notification IDs state (stored in localStorage)
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("trusto_pinned_notif_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      try {
        localStorage.setItem("trusto_pinned_notif_ids", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      const [annData, notifData, count] = await Promise.all([
        fetchActiveAnnouncements().catch(() => []),
        listUserNotifications().catch(() => []),
        getUnreadNotificationCount().catch(() => 0),
      ]);
      setAnnouncements(annData);
      setNotifications(notifData);
      setUnreadCount(count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleDeleteSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const targetNotif = notifications.find((n) => n.id === id);
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (targetNotif && !targetNotif.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      if (selectedDetail?.kind === "notification" && selectedDetail.item.id === id) {
        setSelectedDetail(null);
      }
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (item: UserNotificationItem) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
    // Open in Detail Modal
    setSelectedDetail({ kind: "notification", item });
  };

  const handleAnnouncementClick = (ann: AnnouncementItem) => {
    setSelectedDetail({ kind: "announcement", item: ann });
  };

  const handleNavigateLink = (link: string) => {
    setOpen(false);
    setSelectedDetail(null);
    if (link.startsWith("http://") || link.startsWith("https://")) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      navigate(link);
    }
  };

  const getNotifIcon = (type: UserNotificationItem["type"]) => {
    switch (type) {
      case "deposit":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownToLine className="h-4 w-4" />
          </div>
        );
      case "withdrawal":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ArrowUpFromLine className="h-4 w-4" />
          </div>
        );
      case "dispute":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      case "ticket":
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <LifeBuoy className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Bell className="h-4 w-4" />
          </div>
        );
    }
  };

  // Sort notifications so pinned ones stay at top
  const sortedNotifications = [...notifications].sort((a, b) => {
    const aPin = pinnedIds.includes(a.id) ? 1 : 0;
    const bPin = pinnedIds.includes(b.id) ? 1 : 0;
    return bPin - aPin;
  });

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative inline-flex items-center justify-center rounded-xl border border-border bg-secondary/30 p-2.5 text-foreground hover:bg-secondary/60 transition-all focus:outline-none touch-manipulation"
            aria-label="Open notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-sm animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-80 sm:w-96 p-0 border border-border bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden"
        >
          {/* Popover Header with Mark All Read & Clear All */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/20">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Read all
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 hover:underline hover:text-rose-300 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
            {/* 📌 SECTION 1: PINNED ANNOUNCEMENTS */}
            {announcements.length > 0 && (
              <div className="bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 px-1">
                  <Pin className="h-3.5 w-3.5 shrink-0 rotate-45" /> Pinned Announcements
                </div>

                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => handleAnnouncementClick(ann)}
                    className="rounded-xl border border-amber-500/20 bg-background/80 p-3 shadow-xs space-y-1.5 cursor-pointer hover:border-amber-500/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-xs font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                        {ann.title}
                      </h5>
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 capitalize border border-amber-500/20">
                        {ann.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">
                      {ann.content}
                    </p>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-amber-400/80 font-medium">Click to view full detail</span>
                      {ann.link && <ExternalLink className="h-3 w-3 text-primary" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 🔔 SECTION 2: PERSONAL NOTIFICATIONS */}
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : sortedNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs text-muted-foreground">No recent notifications</p>
              </div>
            ) : (
              sortedNotifications.map((n) => {
                const isPinned = pinnedIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-secondary/40 ${
                      !n.isRead ? "bg-primary/5" : ""
                    } ${isPinned ? "bg-amber-500/5 border-l-2 border-amber-400" : ""}`}
                  >
                    {getNotifIcon(n.type)}
                    <div className="min-w-0 flex-1 space-y-0.5 pr-6">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isPinned && <Pin className="h-3 w-3 text-amber-400 shrink-0 rotate-45" />}
                          <h5 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {n.title}
                          </h5>
                        </div>
                        {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <span className="block text-[10px] text-muted-foreground/70 pt-0.5">
                        {formatIst(n.createdAt)}
                      </span>
                    </div>

                    {/* Hover Cross Button to remove single notification */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingle(e, n.id)}
                      className="absolute right-2 top-3 rounded-lg p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                      title="Remove notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* 🟢 FULL NOTIFICATION / ANNOUNCEMENT DETAIL MODAL */}
      <Dialog open={!!selectedDetail} onOpenChange={() => setSelectedDetail(null)}>
        <DialogContent className="max-w-md border border-border bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl p-6">
          {selectedDetail && (
            <>
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedDetail.kind === "notification" ? (
                      getNotifIcon(selectedDetail.item.type)
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Megaphone className="h-4 w-4" />
                      </div>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground border border-border">
                      {selectedDetail.kind === "notification"
                        ? selectedDetail.item.type
                        : selectedDetail.item.type}
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground font-mono">
                    {selectedDetail.kind === "notification"
                      ? formatIst(selectedDetail.item.createdAt)
                      : formatIst(selectedDetail.item.startDate)}
                  </span>
                </div>

                <DialogTitle className="text-lg font-bold text-foreground leading-snug">
                  {selectedDetail.item.title}
                </DialogTitle>
              </DialogHeader>

              {/* Full Content Body */}
              <div className="my-4 rounded-xl border border-border/60 bg-secondary/20 p-4 max-h-60 overflow-y-auto">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedDetail.kind === "notification"
                    ? selectedDetail.item.message
                    : selectedDetail.item.content}
                </p>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                {/* Pin Action (For personal notifications) */}
                {selectedDetail.kind === "notification" && (
                  <button
                    type="button"
                    onClick={() => togglePin(selectedDetail.item.id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      pinnedIds.includes(selectedDetail.item.id)
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {pinnedIds.includes(selectedDetail.item.id) ? (
                      <>
                        <PinOff className="h-3.5 w-3.5" /> Unpin
                      </>
                    ) : (
                      <>
                        <Pin className="h-3.5 w-3.5 rotate-45" /> Pin to Top
                      </>
                    )}
                  </button>
                )}

                {/* Delete Action (For personal notifications) */}
                {selectedDetail.kind === "notification" && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSingle(e, selectedDetail.item.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}

                {/* Link Action Button */}
                {selectedDetail.item.link && (
                  <button
                    type="button"
                    onClick={() => handleNavigateLink(selectedDetail.item.link!)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Go to Action
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-secondary transition-colors"
                >
                  Close
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
