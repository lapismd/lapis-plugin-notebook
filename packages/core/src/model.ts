export type NotebookCellLanguage = "ts" | "js" | "sql" | "md" | "html";

export type NotebookCellRunMode = "autorun" | "lazy" | "manual";

export interface NotebookCellRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
}

export interface NotebookCellAttributes {
  id: string;
  lang: NotebookCellLanguage;
  run?: NotebookCellRunMode;
  hide?: boolean;
  folded?: boolean;
  outputFolded?: boolean;
  [key: string]: string | boolean | undefined;
}

export interface NotebookCell {
  id: string;
  lang: NotebookCellLanguage;
  source: string;
  range: NotebookCellRange;
  sourceRange: NotebookCellRange;
  attributes: NotebookCellAttributes;
}

export interface NotebookMarkdownBlock {
  kind: "markdown";
  source: string;
  range: NotebookCellRange;
}

export interface NotebookCellBlock {
  kind: "cell";
  cell: NotebookCell;
}

export type NotebookDocumentBlock = NotebookMarkdownBlock | NotebookCellBlock;

export type NotebookMode = "autorun" | "lazy";

export interface NotebookFrontmatter {
  version: number;
  mode: NotebookMode;
  autorun?: boolean;
  mounts: Record<string, string>;
}

export interface NotebookDocument {
  enabled: boolean;
  sourcePath?: string;
  frontmatter: NotebookFrontmatter | null;
  source: string;
  blocks: NotebookDocumentBlock[];
  cells: NotebookCell[];
}
