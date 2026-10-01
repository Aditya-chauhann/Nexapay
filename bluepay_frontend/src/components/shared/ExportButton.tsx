import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv, type CsvColumn } from "@/lib/export-csv";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, isAdminConsoleUser } from "@/lib/admin-access";
import { ReportPreviewModal } from "@/components/shared/ReportPreviewModal";
import type { AdminPermissionKey } from "@/lib/auth-types";

interface ExportButtonProps<T> {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  disabled?: boolean;
  label?: string;
  className?: string;
  title?: string;
  dateRange?: { from?: string; to?: string };
}

const ExportButton = <T,>({
  filename,
  rows,
  columns,
  disabled,
  label = "Export CSV",
  className,
  title,
  dateRange,
}: ExportButtonProps<T>) => {
  const { user } = useAuth();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  let requiredPermission: AdminPermissionKey = "export";
  if (filename === "users") {
    requiredPermission = "export_users";
  } else if (filename === "deposits") {
    requiredPermission = "export_deposits";
  } else if (filename === "withdrawals" || filename === "bank-withdrawals") {
    requiredPermission = "export_withdrawals";
  }

  if (user && isAdminConsoleUser(user) && !hasPermission(user, requiredPermission)) {
    return null;
  }

  const safeRows = rows ?? [];
  const isEmpty = safeRows.length === 0;

  const handleOpenPreview = () => {
    if (isEmpty) {
      toast.info("Nothing to export");
      return;
    }
    setIsPreviewOpen(true);
  };

  const handleConfirmDownload = (selectedRows?: typeof rows, selectedColumns?: CsvColumn<T>[]) => {
    const rowsToExport = selectedRows || rows;
    const colsToExport = selectedColumns && selectedColumns.length > 0 ? selectedColumns : columns;
    downloadCsv(filename, rowsToExport, colsToExport);
    toast.success(
      `Exported ${rowsToExport.length.toLocaleString()} row${rowsToExport.length === 1 ? "" : "s"} (${colsToExport.length} column${colsToExport.length === 1 ? "" : "s"})`
    );
    setIsPreviewOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPreview}
        disabled={disabled || isEmpty}
        className={
          className ??
          "flex min-h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed sm:self-auto"
        }
      >
        <Download className="h-4 w-4" /> {label}
      </button>

      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirmDownload={handleConfirmDownload}
        title={title || label || "Report Export"}
        filename={filename}
        dateRange={dateRange}
        rows={rows}
        columns={columns}
        fileType="csv"
      />
    </>
  );
};

export default ExportButton;
