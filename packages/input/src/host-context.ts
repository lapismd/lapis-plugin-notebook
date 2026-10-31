export interface NotebookVaultFile {
  path: string;
  name: string;
  size: number;
  lastModified: number;
  type?: string;
}

/** Runtime-local capabilities; never serialized into worker options. */
export interface NotebookInputHostContext {
  files?: {
    list(): Promise<NotebookVaultFile[]>;
    read(path: string): Promise<ArrayBuffer>;
  };
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
  isActive?: () => boolean;
}
