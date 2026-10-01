export type CsvColumn<T> = {
  header: string;
  value: (row: T, index?: number) => string | number | null | undefined;
};

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  const str = String(value).trim();
  if (!str) return "";

  // Prevent Excel / spreadsheet software from:
  // 1. Converting long numbers (like phone numbers, bank account numbers, TIDs, IFSC codes with leading zeros) into scientific notation (e.g. 9.17E+11) or stripping leading zeros.
  // 2. Converting date/time strings (e.g. "2026-09-15 00:51:34", "2026-09-15", "12:00:00 AM") into narrow date serial values that display as "#####" in Excel.
  // We format them as exact text literal formulas `="value"`.
  const isLongNumberOrLeadingZero = /^0\d+$|^\+?\d{10,}$/.test(str);
  const isDateTime = /^\d{4}[-/]\d{2}[-/]\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?: [APap][Mm])?)?$|^\d{1,2}:\d{2}(?::\d{2})?(?: [APap][Mm])?$/.test(str);

  if (isLongNumberOrLeadingZero || isDateTime) {
    return `="${str.replace(/"/g, '""')}"`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns
    .map((c) => {
      const h = String(c.header ?? "").trim();
      return /[",\n\r]/.test(h) ? `"${h.replace(/"/g, '""')}"` : h;
    })
    .join(",");
  const body = rows
    .map((row, idx) => columns.map((c) => escapeCsvCell(c.value(row, idx))).join(","))
    .join("\n");
  return body ? `${header}\n${body}` : header;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = rowsToCsv(rows, columns);
  // Pass real UTF-8 Byte Order Mark character \uFEFF (not literal string "\\uFEFF")
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export const exportToCsv = downloadCsv;

