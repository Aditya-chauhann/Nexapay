import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 30, 50, 100];

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  onPageSizeChange: (size: number) => void;
  /** Noun shown in the range readout, e.g. "deposits". */
  label?: string;
  id?: string;
}

/**
 * Page numbers to render: always the first and last page, plus a window around
 * the current one, with ellipses filling the gaps. Keeps the control usable
 * once a table grows past a handful of pages.
 */
function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const ordered = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const out: Array<number | "gap"> = [];
  let prev = 0;
  for (const p of ordered) {
    if (prev && p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

const TablePagination = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  setPage,
  nextPage,
  prevPage,
  onPageSizeChange,
  label = "rows",
  id = "pageSize",
}: TablePaginationProps) => {
  if (totalItems === 0) return null;

  const first = (currentPage - 1) * pageSize + 1;
  const last = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap" htmlFor={id}>
          Rows per page
        </label>
        <select
          id={id}
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            setPage(1);
          }}
          className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {first.toLocaleString()}–{last.toLocaleString()} of {totalItems.toLocaleString()} {label}
        </span>
      </div>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={prevPage}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {pageWindow(currentPage, totalPages).map((p, i) =>
              p === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={currentPage === p}
                    onClick={() => setPage(p)}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={nextPage}
                className={
                  currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default TablePagination;
