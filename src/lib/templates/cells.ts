export type NotebookCellLanguage = "ts" | "sql" | "md" | "html" | "input";

const CELL_SOURCE_BY_LANGUAGE: Record<NotebookCellLanguage, string> = {
  ts: [
    'const greeting = "Hello from Lapis notebooks";',
    "",
    "lapis.markdown(`# ${greeting}`);",
  ].join("\n"),
  sql: [
    "SELECT path, mtime",
    "FROM lapis.notes",
    "ORDER BY mtime DESC",
    "LIMIT 10;",
  ].join("\n"),
  md: [
    "# Notebook summary",
    "",
    "Use `{value}` placeholders here once notebook expressions are wired.",
  ].join("\n"),
  html: [
    '<section class="notebook-html-cell">',
    "  <strong>${value}</strong>",
    "</section>",
  ].join("\n"),
  input: [
    "const gain = view(Inputs.range([0, 10], {",
    "  value: 5,",
    "  step: 1,",
    '  label: "Gain",',
    "}));",
  ].join("\n"),
};

const CELL_LABEL_BY_LANGUAGE: Record<NotebookCellLanguage, string> = {
  ts: "code",
  sql: "SQL",
  md: "markdown",
  html: "HTML",
  input: "input",
};

export function buildCellTemplate(
  language: NotebookCellLanguage,
  cellId: string = createCellId(language),
): string {
  const source = CELL_SOURCE_BY_LANGUAGE[language];
  const cellLanguage = language === "input" ? "ts" : language;
  return `:::cell{#${cellId} lang="${cellLanguage}"}\n\`\`\`${cellLanguage}\n${source}\n\`\`\`\n:::`;
}

export function labelForCellLanguage(language: NotebookCellLanguage): string {
  return CELL_LABEL_BY_LANGUAGE[language];
}

function createCellId(language: NotebookCellLanguage): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${language}-${unique}`;
}
