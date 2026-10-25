import type { DataFrameRow } from "./dataframe-types";

export function exportRowsAsCsv(rows: readonly DataFrameRow[]): string {
  const columns = collectColumns(rows);
  const lines = [columns.map(escapeCsvCell).join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvCell(row[column])).join(","));
  }

  return lines.join("\n");
}

export function exportRowsAsJson(rows: readonly DataFrameRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function collectColumns(rows: readonly DataFrameRow[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }

  return ordered;
}

function escapeCsvCell(value: unknown): string {
  const raw = serializeValue(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function serializeValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}
