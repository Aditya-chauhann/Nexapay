import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRICING_FIELD_LABEL,
  formatPricingValue,
  getPricingHistory,
  type PricingHistoryEntry,
} from "@/lib/api-pricing";

interface PricingHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "global" | "user";
  userId?: string;
  /** Optional title override (e.g. "Pricing history for Jane Doe") */
  title?: string;
}

const PAGE_LIMIT = 20;

export function PricingHistoryDialog({
  open,
  onOpenChange,
  scope,
  userId,
  title,
}: PricingHistoryDialogProps) {
  const [items, setItems] = useState<PricingHistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal, p = 1) => {
      setLoading(true);
      try {
        const res = await getPricingHistory(
          { scope, userId, page: p, limit: PAGE_LIMIT },
          signal,
        );
        setItems(res.items);
        setPage(res.page);
        setTotal(res.total);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    },
    [scope, userId],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal, 1);
    return () => controller.abort();
  }, [open, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {title ?? (scope === "user" ? "Per-user pricing history" : "Pricing history")}
          </DialogTitle>
          <DialogDescription>
            Audit trail of pricing changes, newest first. Each row lists the fields that
            changed and their before/after values.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            items.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-border bg-secondary/30 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {entry.changedByType === "staff" ? "Staff" : "User"}
                    {entry.changedBy ? (
                      <span className="ml-1 font-mono">{entry.changedBy.slice(-8)}</span>
                    ) : null}
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {entry.changes.map((c, i) => (
                    <li
                      key={`${entry.id}-${i}`}
                      className="flex flex-wrap items-baseline gap-2 text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {PRICING_FIELD_LABEL[c.field] ?? c.field}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatPricingValue(c.field, c.oldValue)}
                      </span>
                      <span aria-hidden className="text-muted-foreground">
                        →
                      </span>
                      <span className="font-mono text-primary">
                        {formatPricingValue(c.field, c.newValue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        {total > PAGE_LIMIT && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} entries
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => load(undefined, page - 1)}
                disabled={loading || page <= 1}
                className="rounded-md border border-border bg-secondary px-2.5 py-1 hover:bg-secondary/70 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => load(undefined, page + 1)}
                disabled={loading || page >= totalPages}
                className="rounded-md border border-border bg-secondary px-2.5 py-1 hover:bg-secondary/70 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
