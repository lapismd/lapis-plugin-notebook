/** Notebook values stay typed; strings here are presentation or exact literals. */
export function tableText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "Invalid Date";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, (_key, item) =>
        typeof item === "bigint" ? String(item) : item,
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}
function decimal(value: unknown) {
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const text =
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string"
      ? String(value).trim()
      : "";
  const match = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const exponent = Number(match[3] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 10000) return null;
  const [whole = "", fraction = ""] = match[2].split(".");
  return {
    coefficient: BigInt((match[1] === "-" ? "-" : "") + (whole + fraction)),
    scale: fraction.length - exponent,
  };
}
export function isTableNumber(value: unknown) {
  return decimal(value) !== null;
}
export function compareTableNumbers(
  left: unknown,
  right: unknown,
): number | null {
  const a = decimal(left),
    b = decimal(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const x = a.coefficient * 10n ** BigInt(scale - a.scale);
  const y = b.coefficient * 10n ** BigInt(scale - b.scale);
  return x < y ? -1 : x > y ? 1 : 0;
}
export function tableDate(value: unknown, datetime: boolean): number | null {
  if (value instanceof Date && !Number.isFinite(value.getTime())) return null;
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : "";
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(text)) return null;
  if (datetime && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) return null;
  const day = text.slice(0, 10),
    date = Date.parse(day + "T00:00:00Z");
  if (
    !Number.isFinite(date) ||
    new Date(date).toISOString().slice(0, 10) !== day
  )
    return null;
  const result = datetime ? Date.parse(text) : date;
  return Number.isFinite(result) ? result : null;
}
