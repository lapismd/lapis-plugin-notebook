import type { NotebookOutput } from "./outputs";

export interface NotebookExecutionResult {
  outputs: Record<string, NotebookOutput[]>;
  values: Record<string, unknown>;
}

export type NotebookRuntimeDependencyLoader<TDependency = unknown> = (
  dependency: TDependency,
) => Promise<unknown>;

export type NotebookFileReaderProvider = (
  path: string,
  sourcePath?: string,
) => Promise<ArrayBuffer>;

export type NotebookJavaScriptLikeCompileLanguage = "js" | "ts";

export interface NotebookJavaScriptLikeCompileRequest {
  source: string;
  language: NotebookJavaScriptLikeCompileLanguage;
  sourcePath?: string;
  cellId?: string;
}

export interface NotebookJavaScriptLikeCompileResult {
  code: string;
  importedBindings?: readonly string[];
}

export type NotebookJavaScriptLikeCompileProvider = (
  request: NotebookJavaScriptLikeCompileRequest,
) => Promise<NotebookJavaScriptLikeCompileResult>;

export interface NotebookExecutionOptions<TDependency = unknown> {
  cellIds?: string[];
  skipDependencyClosure?: boolean;
  runtimeDependencies?: readonly TDependency[];
  runtimeDependencyLoader?: NotebookRuntimeDependencyLoader<TDependency>;
  fileReaderProvider?: NotebookFileReaderProvider;
  compileProvider?: NotebookJavaScriptLikeCompileProvider;
}
