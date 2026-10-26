import type { TFile } from "@lapis-notes/api";
import { cellUsesDuckDbRuntime } from "@lapis-notes/notebook-stdlib";
import type { NotebookDocument } from "../model/notebook-document";
import type { NotebookGraph } from "../runtime/notebook-graph";
import type { NotebookDuckDbCatalog } from "@lapis-notes/notebook-duckdb";

export interface NotebookInspectorVariable {
  name: string;
  declaredBy: string[];
  usedBy: string[];
  duplicate: boolean;
}

export interface NotebookInspectorColumn {
  name: string;
  dataType: string;
  nullable: boolean;
}

export interface NotebookInspectorTable {
  schema: string;
  name: string;
  type: "table" | "view";
  rowCount: number | null;
  columns: NotebookInspectorColumn[];
}

export interface NotebookInspectorTablePreview {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

export interface NotebookInspectorSchema {
  name: string;
  tables: NotebookInspectorTable[];
}

export interface NotebookInspectorSnapshot {
  sourcePath: string;
  title: string;
  usesDuckDb: boolean;
  variables: NotebookInspectorVariable[];
  dataSources: NotebookInspectorSchema[];
}

export function buildNotebookInspectorSnapshot(args: {
  file: TFile;
  document: NotebookDocument;
  graph: NotebookGraph;
  duckDbCatalog: NotebookDuckDbCatalog | null;
}): NotebookInspectorSnapshot {
  const { file, document, graph, duckDbCatalog } = args;
  return {
    sourcePath: file.path,
    title: file.basename,
    usesDuckDb: document.cells.some(cellUsesDuckDbRuntime),
    variables: buildNotebookInspectorVariables(graph),
    dataSources: buildNotebookInspectorSchemas(duckDbCatalog),
  };
}

export function buildNotebookInspectorVariables(
  graph: NotebookGraph,
): NotebookInspectorVariable[] {
  const definitionMap = new Map<string, Set<string>>();
  const usageMap = new Map<string, Set<string>>();
  const cellOrder = new Map(
    graph.order.map((cellId, index) => [cellId, index]),
  );

  for (const node of graph.nodes.values()) {
    for (const def of node.defs) {
      if (def === node.cell.id) {
        continue;
      }
      const declaredBy = definitionMap.get(def) ?? new Set<string>();
      declaredBy.add(node.cell.id);
      definitionMap.set(def, declaredBy);
    }
  }

  for (const node of graph.nodes.values()) {
    for (const ref of node.refs) {
      if (!definitionMap.has(ref)) {
        continue;
      }
      const usedBy = usageMap.get(ref) ?? new Set<string>();
      usedBy.add(node.cell.id);
      usageMap.set(ref, usedBy);
    }
  }

  return Array.from(definitionMap.entries())
    .map(([name, declaredBy]) => ({
      name,
      declaredBy: Array.from(declaredBy).sort(byCellOrder(cellOrder)),
      usedBy: Array.from(usageMap.get(name) ?? []).sort(byCellOrder(cellOrder)),
      duplicate: declaredBy.size > 1,
    }))
    .sort((left, right) => {
      const leftIndex = Math.min(
        ...left.declaredBy.map(
          (cellId) => cellOrder.get(cellId) ?? Number.MAX_SAFE_INTEGER,
        ),
      );
      const rightIndex = Math.min(
        ...right.declaredBy.map(
          (cellId) => cellOrder.get(cellId) ?? Number.MAX_SAFE_INTEGER,
        ),
      );
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.name.localeCompare(right.name);
    });
}

export function buildNotebookInspectorSchemas(
  catalog: NotebookDuckDbCatalog | null,
): NotebookInspectorSchema[] {
  if (!catalog) {
    return [];
  }

  return catalog.schemas
    .map((schema) => ({
      name: schema.name,
      tables: schema.tables
        .map((table) => ({
          schema: schema.name,
          name: table.name,
          type: table.type,
          rowCount: table.rowCount,
          columns: table.columns.map((column) => ({
            name: column.name,
            dataType: column.dataType,
            nullable: column.nullable,
          })),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function byCellOrder(cellOrder: Map<string, number>) {
  return (left: string, right: string) => {
    const leftIndex = cellOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = cellOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  };
}
