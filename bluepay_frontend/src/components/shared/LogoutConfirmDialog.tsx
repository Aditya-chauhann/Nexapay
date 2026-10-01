import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  description?: string;
}

export function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  description = "You will securely sign out of your session.",
}: LogoutConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ready to log out?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/70 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors"
          >
            Log out
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
