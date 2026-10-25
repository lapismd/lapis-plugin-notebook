function normalizeNotebookValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeNotebookValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        normalizeNotebookValue(entryValue),
      ]),
    );
  }

  return value;
}

export function stringifyNotebookValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(normalizeNotebookValue(value));
  }

  try {
    return JSON.stringify(normalizeNotebookValue(value));
  } catch {
    return String(value);
  }
}
