/** JavaScript value notation for display(), without evaluating getters or toJSON. */
export function formatNotebookDisplayValue(value: unknown): string {
  const ancestors = new WeakSet<object>();

  function format(value: unknown, depth: number): string {
    if (value === null) return "null";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "number")
      return Object.is(value, -0) ? "-0" : String(value);
    if (typeof value === "symbol")
      return value.description === undefined
        ? "Symbol()"
        : `Symbol(${JSON.stringify(value.description)})`;
    if (typeof value === "function") {
      const candidate = Object.getOwnPropertyDescriptor(value, "name")?.value;
      const name =
        typeof candidate === "string" && /^[A-Za-z_$][\w$]*$/.test(candidate)
          ? candidate
          : "";
      return `function ${name}() { /* … */ }`;
    }
    if (typeof value !== "object") return String(value);
    if (ancestors.has(value)) return '"[Circular]"';
    if (depth >= 50) return '"[Max depth]"';

    const block = (open: string, close: string, entries: string[]) =>
      entries.length
        ? `${open}\n${entries.map((entry) => `${"  ".repeat(depth + 1)}${entry}`).join(",\n")}\n${"  ".repeat(depth)}${close}`
        : open + close;

    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return block(
          "[",
          "]",
          Array.from(
            {
              length:
                Object.getOwnPropertyDescriptor(value, "length")?.value ?? 0,
            },
            (_, index) => {
              const property = Object.getOwnPropertyDescriptor(value, index);
              return property && "value" in property
                ? format(property.value, depth + 1)
                : property?.get
                  ? '"[Getter]"'
                  : "undefined";
            },
          ),
        );
      }
      if (value instanceof Date) {
        return Number.isNaN(Date.prototype.getTime.call(value))
          ? "new Date(NaN)"
          : `new Date(${JSON.stringify(Date.prototype.toISOString.call(value))})`;
      }
      if (value instanceof RegExp) {
        const source = Object.getOwnPropertyDescriptor(
          RegExp.prototype,
          "source",
        )!.get!.call(value);
        const flags = (
          [
            ["hasIndices", "d"],
            ["global", "g"],
            ["ignoreCase", "i"],
            ["multiline", "m"],
            ["dotAll", "s"],
            ["unicode", "u"],
            ["unicodeSets", "v"],
            ["sticky", "y"],
          ] as const
        )
          .filter(([name]) =>
            Object.getOwnPropertyDescriptor(RegExp.prototype, name)?.get?.call(
              value,
            ),
          )
          .map(([, flag]) => flag)
          .join("");
        return `/${source}/${flags}`;
      }
      if (value instanceof Map)
        return `new Map(${format([...Map.prototype.entries.call(value)], depth)})`;
      if (value instanceof Set)
        return `new Set(${format([...Set.prototype.values.call(value)], depth)})`;
      if (value instanceof Error) {
        const property = Object.getOwnPropertyDescriptor(value, "message");
        const message = property?.get
          ? "[Getter]"
          : typeof property?.value === "string"
            ? property.value
            : "";
        return `new Error(${JSON.stringify(message)})`;
      }
      if (ArrayBuffer.isView(value)) {
        if (value instanceof DataView) {
          const read = (key: string) =>
            Object.getOwnPropertyDescriptor(DataView.prototype, key)!.get!.call(
              value,
            );
          const bytes = new Uint8Array(
            read("buffer"),
            read("byteOffset"),
            read("byteLength"),
          );
          return `new DataView(new Uint8Array(${format([...bytes], depth)}).buffer)`;
        }
        const name = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(Uint8Array.prototype),
          Symbol.toStringTag,
        )!.get!.call(value);
        return `new ${name}(${format([...Uint8Array.prototype.values.call(value as Uint8Array)], depth)})`;
      }
      if (value instanceof ArrayBuffer) {
        return `new Uint8Array(${format([...new Uint8Array(value)], depth)}).buffer`;
      }
      const entries = Reflect.ownKeys(value).flatMap((key) => {
        const property = Object.getOwnPropertyDescriptor(value, key);
        if (!property?.enumerable) return [];
        const label =
          typeof key === "symbol"
            ? `[${format(key, depth + 1)}]`
            : JSON.stringify(key);
        const rendered =
          "value" in property
            ? format(property.value, depth + 1)
            : JSON.stringify(property.get ? "[Getter]" : "[Setter]");
        return [`${label}: ${rendered}`];
      });
      return block("{", "}", entries);
    } catch {
      return '"[Uninspectable]"';
    } finally {
      ancestors.delete(value);
    }
  }

  return format(value, 0);
}
