import { formatDistanceToNowStrict } from "date-fns";
import type { ColumnType } from "../dataframe-types";

export type FormattedValue = {
  text: string;
  title?: string;
  align?: "left" | "right";
  isNull?: boolean;
};

function stringifyObject(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatDateValue(value: unknown): { text: string; title?: string } {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return { text: String(value) };
  }

  return {
    text: date.toISOString(),
    title: formatDistanceToNowStrict(date, { addSuffix: true }),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function formatCellValue(
  value: unknown,
  type: ColumnType,
): FormattedValue {
  if (value == null) {
    return {
      text: "null",
      isNull: true,
    };
  }

  if (
    ["integer", "bigint", "float", "double", "decimal", "number"].includes(type)
  ) {
    return {
      text: Number(value).toLocaleString(undefined, {
        maximumFractionDigits: ["float", "double", "decimal"].includes(type)
          ? 4
          : 0,
      }),
      align: "right",
      title: String(value),
    };
  }

  if (type === "date" || type === "timestamp") {
    return formatDateValue(value);
  }

  if (type === "list" && Array.isArray(value)) {
    return {
      text: `[${value.length} items]`,
      title: stringifyObject(value),
    };
  }

  if (type === "blob") {
    if (value instanceof Uint8Array) {
      return {
        text: `<binary ${value.byteLength} bytes>`,
        title: bytesToHex(value),
      };
    }

    return {
      text: "<binary>",
      title: String(value),
    };
  }

  if (type === "json" || type === "struct" || typeof value === "object") {
    return {
      text: stringifyObject(value),
      title: stringifyObject(value),
    };
  }

  return {
    text: String(value),
    title: String(value),
    align: "left",
  };
}
