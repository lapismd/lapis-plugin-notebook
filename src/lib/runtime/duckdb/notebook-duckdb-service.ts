import * as duckdb from "@duckdb/duckdb-wasm";
import type {
  DuckDbQueryResult,
  DuckDbQueryRow,
  NotebookDuckDbCatalog,
  NotebookDuckDbColumnDefinition,
  NotebookDuckDbTablePreview,
} from "@lapis-notes/notebook-duckdb";
import {
  createDuckDbCatalogColumnsSql,
  createDuckDbCatalogTablesSql,
  createDuckDbJsonTableSql,
  createDuckDbSchemaSql,
  createDuckDbTablePreviewSql,
  createDuckDbTableRowCountSql,
  createNotebookDuckDbCatalog,
  createNotebookDuckDbTablePreview,
  normalizeDuckDbQueryResult,
  normalizeDuckDbRows,
  normalizeDuckDbRowCount,
} from "@lapis-notes/notebook-duckdb";
import {
  getNotebookDuckDbBundles,
  type NotebookDuckDbAssetUrlResolver,
} from "@lapis-notes/notebook-duckdb-assets";

export interface NotebookDuckDbServiceOptions {
  resolveAssetUrl?: NotebookDuckDbAssetUrlResolver;
}

export class NotebookDuckDbService {
  private db: duckdb.AsyncDuckDB | null = null;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private appTablesRegistered = false;

  constructor(private readonly options: NotebookDuckDbServiceOptions = {}) {}

  async ensureReady(): Promise<void> {
    if (this.ready) {
      return this.ready;
    }

    this.ready = (async () => {
      const bundle = await duckdb.selectBundle(
        await getNotebookDuckDbBundles(this.options.resolveAssetUrl),
      );
      this.worker = new Worker(bundle.mainWorker!);
      this.db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), this.worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    })();

    return this.ready;
  }

  async ensureAppTables(register: () => Promise<void>): Promise<void> {
    await this.ensureReady();
    if (this.appTablesRegistered) {
      return;
    }

    await register();
    this.appTablesRegistered = true;
  }

  async registerFileBuffer(
    alias: string,
    data: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    await this.ensureReady();
    await this.db!.registerFileBuffer(
      alias,
      data instanceof Uint8Array ? data : new Uint8Array(data),
    );
  }

  async registerJsonTable(
    fileName: string,
    schema: string,
    table: string,
    rows: unknown[],
    columns?: NotebookDuckDbColumnDefinition[],
  ): Promise<void> {
    await this.ensureReady();
    await this.registerFileBuffer(
      fileName,
      new TextEncoder().encode(JSON.stringify(rows)),
    );
    const conn = await this.db!.connect();
    try {
      await conn.query(createDuckDbSchemaSql(schema));
      await conn.query(
        createDuckDbJsonTableSql({
          fileName,
          schema,
          table,
          hasRows: rows.length > 0,
          columns,
        }),
      );
    } finally {
      await conn.close();
    }
  }

  async query(sql: string): Promise<DuckDbQueryRow[]> {
    await this.ensureReady();
    const conn = await this.db!.connect();
    try {
      const result = await conn.query(sql);
      return normalizeDuckDbRows(result.toArray());
    } finally {
      await conn.close();
    }
  }

  async queryWithMeta(sql: string): Promise<DuckDbQueryResult> {
    await this.ensureReady();
    const conn = await this.db!.connect();
    const startedAt = performance.now();
    try {
      const result = await conn.query(sql);
      return normalizeDuckDbQueryResult(result, sql, startedAt);
    } finally {
      await conn.close();
    }
  }

  async inspectCatalog(): Promise<NotebookDuckDbCatalog> {
    await this.ensureReady();
    const [tables, columns] = await Promise.all([
      this.query(createDuckDbCatalogTablesSql()),
      this.query(createDuckDbCatalogColumnsSql()),
    ]);

    return createNotebookDuckDbCatalog({
      tables,
      columns,
      getRowCount: (schemaName, tableName) =>
        this.queryTableRowCount(schemaName, tableName),
    });
  }

  async inspectTablePreview(
    schemaName: string,
    tableName: string,
    limit: number = 5,
  ): Promise<NotebookDuckDbTablePreview> {
    await this.ensureReady();
    const conn = await this.db!.connect();
    try {
      const result = await conn.query(
        createDuckDbTablePreviewSql(schemaName, tableName, limit),
      );
      const rows = normalizeDuckDbRows(result.toArray());
      const columns = (result.schema?.fields ?? []).map(
        (field) => field.name ?? "value",
      );
      return createNotebookDuckDbTablePreview({ rows, columns });
    } finally {
      await conn.close();
    }
  }

  private async queryTableRowCount(
    schemaName: string,
    tableName: string,
  ): Promise<number | null> {
    try {
      const rows = await this.query(
        createDuckDbTableRowCountSql(schemaName, tableName),
      );
      return normalizeDuckDbRowCount(rows);
    } catch {
      return null;
    }
  }

  async terminate(): Promise<void> {
    if (!this.db) {
      return;
    }
    await this.db.terminate();
    this.worker?.terminate();
    this.db = null;
    this.worker = null;
    this.ready = null;
    this.appTablesRegistered = false;
  }
}
