export type NotebookFileReader = (
  path: string,
  sourcePath?: string,
) => Promise<ArrayBuffer>;

export interface NotebookFileAttachment {
  readonly name: string;
  readonly path: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
  csv(options?: NotebookDsvParseOptions): Promise<NotebookDsvRow[]>;
  tsv(options?: NotebookDsvParseOptions): Promise<NotebookDsvRow[]>;
  blob(type?: string): Promise<Blob>;
}

export interface NotebookDsvParseOptions {
  typed?: boolean;
}

export type NotebookDsvRow = Record<string, unknown>;

type D3DsvModule = {
  autoType: (row: Record<string, string>) => Record<string, unknown>;
  csvParse: (
    text: string,
    row?: (row: Record<string, string>) => Record<string, unknown>,
  ) => NotebookDsvRow[] & { columns: string[] };
  tsvParse: (
    text: string,
    row?: (row: Record<string, string>) => Record<string, unknown>,
  ) => NotebookDsvRow[] & { columns: string[] };
};

let d3DsvModule: Promise<D3DsvModule> | null = null;

export interface NotebookVaultRuntime {
  readBinary(path: string): Promise<ArrayBuffer>;
  readText(path: string): Promise<string>;
}

export function createNotebookVaultRuntime(
  readVaultFile: NotebookFileReader,
  sourcePath?: string,
): NotebookVaultRuntime {
  return {
    readBinary(path: string) {
      return readVaultFile(path, sourcePath);
    },
    async readText(path: string) {
      return decodeNotebookText(await readVaultFile(path, sourcePath));
    },
  };
}

export function createNotebookFileAttachment(
  path: string,
  vaultRuntime: NotebookVaultRuntime,
): NotebookFileAttachment {
  return {
    name: path.split("/").pop() ?? path,
    path,
    arrayBuffer() {
      return vaultRuntime.readBinary(path);
    },
    text() {
      return vaultRuntime.readText(path);
    },
    async json() {
      return JSON.parse(await vaultRuntime.readText(path)) as unknown;
    },
    async csv(options?: NotebookDsvParseOptions) {
      const d3 = await loadD3DsvModule();
      return d3.csvParse(
        await vaultRuntime.readText(path),
        options?.typed ? d3.autoType : undefined,
      );
    },
    async tsv(options?: NotebookDsvParseOptions) {
      const d3 = await loadD3DsvModule();
      return d3.tsvParse(
        await vaultRuntime.readText(path),
        options?.typed ? d3.autoType : undefined,
      );
    },
    async blob(type?: string) {
      return new Blob(
        [await vaultRuntime.readBinary(path)],
        type ? { type } : undefined,
      );
    },
  };
}

async function loadD3DsvModule(): Promise<D3DsvModule> {
  d3DsvModule ??= import("d3") as Promise<D3DsvModule>;
  return d3DsvModule;
}

export function resolveNotebookFilePath(
  path: string,
  sourcePath?: string,
): string {
  if (path.startsWith("/")) {
    return path.replace(/^\/+/, "");
  }

  if (!sourcePath || !path.startsWith(".")) {
    return normalizeNotebookPath(path);
  }

  return normalizeNotebookPath(`${dirname(sourcePath)}/${path}`);
}

function decodeNotebookText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

function dirname(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1 ? "." : path.slice(0, lastSlash);
}

function normalizeNotebookPath(path: string): string {
  const segments = path.split("/");
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.join("/");
}
