import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Download,
  X,
  FileSpreadsheet,
  Calendar,
  Layers,
  Search,
  CheckSquare,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type CsvColumn } from "@/lib/export-csv";
import { toast } from "sonner";
import {
  fetchCsvPresets,
  getCachedCsvPreset,
  saveCsvPreset,
  resetCsvPreset,
} from "@/lib/api-csv-presets";

export interface ReportPreviewModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDownload: (selectedRows: T[], selectedColumns?: CsvColumn<T>[]) => void;
  title: string;
  filename: string;
  dateRange?: { from?: string; to?: string };
  rows?: T[];
  columns?: CsvColumn<T>[];
  downloading?: boolean;
  fileType?: "csv" | "xlsx";
}

const ITEMS_PER_PAGE = 8;

export const ReportPreviewModal = <T,>({
  isOpen,
  onClose,
  onConfirmDownload,
  title,
  filename,
  dateRange,
  rows = [],
  columns = [],
  downloading = false,
  fileType = "csv",
}: ReportPreviewModalProps<T>) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [selectedColHeaders, setSelectedColHeaders] = useState<Set<string>>(new Set());
  const [colSearch, setColSearch] = useState("");
  const [isColPopoverOpen, setIsColPopoverOpen] = useState(false);

  const hasDataRows = rows.length > 0 && columns.length > 0;

  const rowsRef = useRef(rows);
  const columnsRef = useRef(columns);
  rowsRef.current = rows;
  columnsRef.current = columns;

  // Initialize row and column selections ONLY when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndices(new Set(rowsRef.current.map((_, i) => i)));
      setSearch("");
      setPage(1);
      setColSearch("");
      setIsColPopoverOpen(false);

      let appliedPreset = false;

      // 1. Check synchronous in-memory cached preset from backend
      const cached = getCachedCsvPreset(filename);
      if (cached && cached.length > 0) {
        const savedHeaderSet = new Set(cached);
        const matchedHeaders = columnsRef.current
          .map((c) => c.header)
          .filter((h) => savedHeaderSet.has(h));
        if (matchedHeaders.length > 0) {
          setSelectedColHeaders(new Set(matchedHeaders));
          appliedPreset = true;
        }
      }

      // 2. Fallback to localStorage preset if not found in memory
      if (!appliedPreset) {
        try {
          const saved = localStorage.getItem(`tp_csv_cols_${filename}`);
          if (saved) {
            const parsed: string[] = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const savedHeaderSet = new Set(parsed);
              const matchedHeaders = columnsRef.current
                .map((c) => c.header)
                .filter((h) => savedHeaderSet.has(h));
              if (matchedHeaders.length > 0) {
                setSelectedColHeaders(new Set(matchedHeaders));
                appliedPreset = true;
              }
            }
          }
        } catch {
          // ignore parse error
        }
      }

      // 3. Default fallback: select all columns
      if (!appliedPreset) {
        setSelectedColHeaders(new Set(columnsRef.current.map((c) => c.header)));
      }

      // 4. Asynchronously fetch latest shared preset from backend and sync
      let isMounted = true;
      fetchCsvPresets().then((presets) => {
        if (!isMounted) return;
        const key = filename.trim().toLowerCase();
        const remoteCols = presets[key];
        if (Array.isArray(remoteCols) && remoteCols.length > 0) {
          const remoteSet = new Set(remoteCols);
          const matched = columnsRef.current
            .map((c) => c.header)
            .filter((h) => remoteSet.has(h));
          if (matched.length > 0) {
            setSelectedColHeaders(new Set(matched));
            try {
              localStorage.setItem(`tp_csv_cols_${filename}`, JSON.stringify(matched));
            } catch {
              // ignore
            }
          }
        }
      });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, filename]);

  // Derived active columns to display and download
  const activeColumns = useMemo(() => {
    if (!columns || columns.length === 0) return [];
    if (fileType !== "csv") return columns;
    return columns.filter((c) => selectedColHeaders.has(c.header));
  }, [columns, selectedColHeaders, fileType]);

  // Filtered column list for the popover search
  const filteredColumnList = useMemo(() => {
    if (!colSearch.trim()) return columns;
    const q = colSearch.toLowerCase();
    return columns.filter((col) => col.header.toLowerCase().includes(q));
  }, [columns, colSearch]);

  const toggleColumn = (header: string) => {
    const next = new Set(selectedColHeaders);
    if (next.has(header)) {
      next.delete(header);
    } else {
      next.add(header);
    }
    setSelectedColHeaders(next);
  };

  const handleSelectAllColumns = () => {
    setSelectedColHeaders(new Set(columns.map((c) => c.header)));
  };

  const handleDeselectAllColumns = () => {
    setSelectedColHeaders(new Set());
  };

  const handleInvertColumns = () => {
    const next = new Set<string>();
    columns.forEach((c) => {
      if (!selectedColHeaders.has(c.header)) next.add(c.header);
    });
    setSelectedColHeaders(next);
  };

  const handleResetColumns = async () => {
    try {
      localStorage.removeItem(`tp_csv_cols_${filename}`);
    } catch {
      // ignore
    }
    void resetCsvPreset(filename);
    setSelectedColHeaders(new Set(columns.map((c) => c.header)));
    toast.info("Columns reset to default");
  };

  const handleSaveColumnsAsDefault = async () => {
    const colList = Array.from(selectedColHeaders);
    try {
      localStorage.setItem(`tp_csv_cols_${filename}`, JSON.stringify(colList));
    } catch {
      // ignore
    }
    try {
      await saveCsvPreset(filename, colList);
      toast.success("Saved column selection as default for all super admins");
    } catch {
      toast.success("Saved column selection as default for this export");
    }
  };

  const getCellValue = (col: any, row: any, idx?: number) => {
    if (!col) return "—";
    try {
      if (typeof col.value === "function") {
        const res = col.value(row, idx);
        return res !== null && res !== undefined ? String(res) : "—";
      }
      if (typeof col.accessor === "function") {
        const res = col.accessor(row);
        return res !== null && res !== undefined ? String(res) : "—";
      }
    } catch {
      return "—";
    }
    return "—";
  };

  // Filtered rows for preview search across active columns
  const filteredRows = useMemo(() => {
    if (!search.trim() || !hasDataRows) return rows;
    const query = search.toLowerCase();
    const colsToSearch = activeColumns.length > 0 ? activeColumns : columns;
    return rows.filter((row, idx) =>
      colsToSearch.some((col) => {
        const val = getCellValue(col, row, idx);
        return val !== "—" && val.toLowerCase().includes(query);
      })
    );
  }, [rows, columns, activeColumns, search, hasDataRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredRows, page]);

  // Selection helpers
  const isAllSelected = useMemo(() => {
    if (filteredRows.length === 0) return false;
    return filteredRows.every((row) => selectedIndices.has(rows.indexOf(row)));
  }, [filteredRows, selectedIndices, rows]);

  const isSomeSelected = useMemo(() => {
    if (filteredRows.length === 0) return false;
    const selectedFilteredCount = filteredRows.filter((row) =>
      selectedIndices.has(rows.indexOf(row))
    ).length;
    return selectedFilteredCount > 0 && selectedFilteredCount < filteredRows.length;
  }, [filteredRows, selectedIndices, rows]);

  const toggleSelectAll = () => {
    const next = new Set(selectedIndices);
    if (isAllSelected) {
      filteredRows.forEach((row) => next.delete(rows.indexOf(row)));
    } else {
      filteredRows.forEach((row) => next.add(rows.indexOf(row)));
    }
    setSelectedIndices(next);
  };

  const toggleSelectRow = (globalIdx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(globalIdx)) {
      next.delete(globalIdx);
    } else {
      next.add(globalIdx);
    }
    setSelectedIndices(next);
  };

  if (!isOpen) return null;

  const dateRangeText =
    dateRange?.from || dateRange?.to
      ? `${dateRange.from || "Start"} → ${dateRange.to || "Today"}`
      : "All Time";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight flex items-center gap-2">
                {title}
                <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-semibold border-primary/40 text-primary">
                  Preview
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Review data preview and choose columns before downloading
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Report Metadata Summary Bar */}
        <div className="px-6 py-3 bg-secondary/20 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Date Range:</span>
              <strong className="text-foreground font-semibold">{dateRangeText}</strong>
            </div>

            {hasDataRows && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total:</span>
                <strong className="text-foreground font-semibold">{rows.length.toLocaleString()} rows</strong>
              </div>
            )}

            {hasDataRows && fileType === "csv" && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                <span>Rows:</span>
                <strong className="text-foreground font-semibold">{selectedIndices.size.toLocaleString()}</strong>
              </div>
            )}

            {/* Column Selector Popover in Toolbar */}
            {hasDataRows && fileType === "csv" && (
              <Popover open={isColPopoverOpen} onOpenChange={setIsColPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selectedColHeaders.size === columns.length
                        ? "bg-secondary/70 hover:bg-secondary border-border/70 text-foreground"
                        : "bg-primary/15 hover:bg-primary/25 border-primary/40 text-primary shadow-sm ring-1 ring-primary/30"
                    }`}
                    title="Click to select columns to download"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    <span>Columns:</span>
                    <span className="font-bold">
                      {selectedColHeaders.size}/{columns.length}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-3 bg-background border-border shadow-2xl space-y-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                        Select Columns
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedColHeaders.size} of {columns.length} columns included
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllColumns}
                        className="h-6 px-1.5 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                      >
                        All
                      </Button>
                      <span className="text-muted-foreground/40 text-[10px]">|</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeselectAllColumns}
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        None
                      </Button>
                      <span className="text-muted-foreground/40 text-[10px]">|</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleInvertColumns}
                        title="Invert selection"
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Invert
                      </Button>
                      <span className="text-muted-foreground/40 text-[10px]">|</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetColumns}
                        title="Reset to default (all columns)"
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {columns.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        placeholder="Search columns..."
                        value={colSearch}
                        onChange={(e) => setColSearch(e.target.value)}
                        className="pl-7 h-7 text-xs bg-secondary/30"
                      />
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {filteredColumnList.map((col, idx) => {
                      const isChecked = selectedColHeaders.has(col.header);
                      return (
                        <div
                          key={col.header || idx}
                          onClick={() => toggleColumn(col.header)}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors select-none ${
                            isChecked
                              ? "bg-primary/10 text-foreground border border-primary/20"
                              : "hover:bg-secondary/40 text-muted-foreground border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleColumn(col.header)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="truncate">{col.header}</span>
                          </div>
                          {isChecked && <Check className="w-3 h-3 text-primary shrink-0" />}
                        </div>
                      );
                    })}
                    {filteredColumnList.length === 0 && (
                      <p className="text-center py-4 text-xs text-muted-foreground">
                        No columns match "{colSearch}"
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={handleSaveColumnsAsDefault}
                      className="text-primary hover:underline font-medium text-[11px]"
                      title="Remember this column selection as default for all super admins"
                    >
                      Save as default
                    </button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsColPopoverOpen(false)}
                      className="h-6 px-3 text-xs font-semibold"
                    >
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>File:</span>
              <code className="text-xs font-mono font-bold bg-secondary px-2 py-0.5 rounded text-foreground">
                {filename}
              </code>
            </div>
          </div>

          {hasDataRows && (
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search preview..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 h-7 text-xs bg-background/80 border-border/60"
              />
            </div>
          )}
        </div>

        {/* Content Body / Live Table Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {/* Active Custom Column Banner */}
          {hasDataRows && fileType === "csv" && activeColumns.length < columns.length && (
            <div className="flex items-center justify-between px-3.5 py-2 bg-primary/10 border border-primary/25 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>
                  Custom column selection: <strong className="text-primary font-bold">{activeColumns.length}</strong> of {columns.length} columns will be downloaded in the CSV.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsColPopoverOpen(true)}
                  className="text-primary font-semibold hover:underline text-xs"
                >
                  Edit columns
                </button>
                <span className="text-muted-foreground/50">•</span>
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Reset to all
                </button>
              </div>
            </div>
          )}

          {hasDataRows ? (
            <div className="border border-border/60 rounded-xl overflow-x-auto bg-background/50">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                    {fileType === "csv" && (
                      <TableHead className="w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={(input) => {
                            if (input) {
                              input.indeterminate = isSomeSelected;
                            }
                          }}
                          onChange={toggleSelectAll}
                          className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50 cursor-pointer"
                        />
                      </TableHead>
                    )}
                    {activeColumns.map((col, idx) => (
                      <TableHead key={idx} className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        {col.header}
                      </TableHead>
                    ))}
                    {fileType === "csv" && (
                      <TableHead className="w-10 text-right pr-2">
                        <button
                          type="button"
                          onClick={() => setIsColPopoverOpen(true)}
                          title="Configure columns"
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                        </button>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeColumns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={fileType === "csv" ? 2 : 1}
                        className="text-center py-12"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <SlidersHorizontal className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm font-semibold text-foreground">No columns selected</p>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            Please select at least one column from the column selector to view data and download your CSV.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSelectAllColumns}
                            className="text-xs mt-2"
                          >
                            Select All Columns
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={fileType === "csv" ? activeColumns.length + 2 : activeColumns.length}
                        className="text-center py-8 text-muted-foreground text-xs"
                      >
                        No matching preview records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map((row, rowIdx) => {
                      const globalIdx = rows.indexOf(row);
                      const isSelected = selectedIndices.has(globalIdx);
                      return (
                        <TableRow
                          key={rowIdx}
                          className={`hover:bg-secondary/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          {fileType === "csv" && (
                            <TableCell className="w-12 text-center py-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(globalIdx)}
                                className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary/50 cursor-pointer"
                              />
                            </TableCell>
                          )}
                          {activeColumns.map((col, colIdx) => (
                            <TableCell key={colIdx} className="text-xs font-medium py-2.5 whitespace-nowrap">
                              {getCellValue(col, row, globalIdx)}
                            </TableCell>
                          ))}
                          {fileType === "csv" && <TableCell className="w-10" />}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border/80 rounded-2xl bg-secondary/10 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Report Ready for Generation</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  Clicking confirm will generate and download the full report file (<strong>{filename}</strong>) with your selected date filters.
                </p>
              </div>
            </div>
          )}

          {/* Table Pagination if many rows */}
          {hasDataRows && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} entries
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs px-2"
                >
                  Prev
                </Button>
                <span className="text-xs px-2 font-semibold">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 text-xs px-2"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60 bg-secondary/30">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={downloading}
            className="h-9 px-4 text-xs border-border/80 hover:bg-secondary"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (fileType === "csv") {
                const selectedRows = rows.filter((_, idx) => selectedIndices.has(idx));
                onConfirmDownload(selectedRows, activeColumns);
              } else {
                onConfirmDownload(rows);
              }
            }}
            disabled={
              downloading ||
              (fileType === "csv" && (selectedIndices.size === 0 || activeColumns.length === 0))
            }
            className="h-9 px-5 text-xs font-semibold gap-2 shadow-lg"
          >
            {downloading ? (
              <span>Generating...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Confirm & Download</span>
                {fileType === "csv" && activeColumns.length > 0 && (
                  <span className="text-[10px] opacity-80 font-normal">
                    ({selectedIndices.size} rows, {activeColumns.length} cols)
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
