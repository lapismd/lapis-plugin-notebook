/** Temporary worker-only graph; committed registry workspace is restored later. */
export function projectArchiveWorkspace(source, entries) {
  let result = source;
  for (const entry of entries) {
    const key = JSON.stringify(entry.name);
    const line = `  ${key}: ${JSON.stringify(`file:/input/${entry.path}`)}`;
    const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^  ["']?${escaped}["']?:.*$`, "m");
    if (pattern.test(result)) result = result.replace(pattern, () => line);
    else if (/^overrides:\s*$/m.test(result))
      result = result.replace(
        /^overrides:\s*$/m,
        (match) => match + "\n" + line,
      );
    else result += "\noverrides:\n" + line + "\n";
  }
  return result;
}
