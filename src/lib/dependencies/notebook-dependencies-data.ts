import type { TFile } from "@lapis-notes/api";
import type { NotebookDocument } from "../model/notebook-document";
import type {
  NotebookCellExecutionState,
  NotebookCellRuntimeState,
} from "../runtime/notebook-session";
import type { NotebookGraph } from "../runtime/notebook-graph";

export interface NotebookDependencyDuplicateDefinition {
  name: string;
  cellIds: string[];
}

export interface NotebookDependencyCycle {
  cellIds: string[];
}

export interface NotebookDependencyEdge {
  id: string;
  source: string;
  target: string;
  variables: string[];
}

export interface NotebookDependencyCell {
  id: string;
  lang: NotebookDocument["cells"][number]["lang"];
  state: NotebookCellExecutionState;
  error?: string;
  source: string;
  sourcePreview: string;
  declaredVariables: string[];
  referencedVariables: string[];
  parents: string[];
  children: string[];
  ancestors: string[];
  descendants: string[];
  hasUpstream: boolean;
  hasDownstream: boolean;
  isReferenceable: boolean;
  isIsolatedDefinition: boolean;
  isCycleMember: boolean;
  hasDuplicateDefinitions: boolean;
}

export interface NotebookDependencySnapshot {
  sourcePath: string;
  title: string;
  cells: NotebookDependencyCell[];
  edges: NotebookDependencyEdge[];
  duplicateDefinitions: NotebookDependencyDuplicateDefinition[];
  cycles: NotebookDependencyCycle[];
}

export function buildNotebookDependencySnapshot(args: {
  file: Pick<TFile, "path" | "basename">;
  document: NotebookDocument;
  graph: NotebookGraph;
  getCellState?: (cellId: string) => NotebookCellRuntimeState;
}): NotebookDependencySnapshot {
  const { file, document, graph, getCellState } = args;
  const cellOrder = new Map(
    document.cells.map((cell, index) => [cell.id, index]),
  );
  const definitionMap = buildDefinitionMap(graph);
  const edgeMap = buildEdgeMap(graph, definitionMap);
  const duplicateDefinitionNames = new Set(graph.duplicateDefinitions.keys());
  const cycleMembers = new Set(graph.cycles.flat());

  const cells = document.cells.map((cell) => {
    const node = graph.nodes.get(cell.id);
    const declaredVariables = (node?.defs ?? []).filter(
      (name) => name !== cell.id,
    );
    const referencedVariables = (node?.refs ?? []).filter((name) =>
      definitionMap.has(name),
    );
    const parents = sortCellIds(node?.dependencies ?? [], cellOrder);
    const children = sortCellIds(node?.dependents ?? [], cellOrder);
    const ancestors = collectTransitive(
      cell.id,
      graph,
      "dependencies",
      cellOrder,
    );
    const descendants = collectTransitive(
      cell.id,
      graph,
      "dependents",
      cellOrder,
    );
    const state = getCellState?.(cell.id) ?? { state: "idle" as const };
    const hasDuplicateDefinitions = declaredVariables.some((name) =>
      duplicateDefinitionNames.has(name),
    );
    const isReferenceable =
      declaredVariables.length > 0 ||
      ancestors.length > 0 ||
      descendants.length > 0;

    return {
      id: cell.id,
      lang: cell.lang,
      state: state.state,
      error: state.error,
      source: cell.source,
      sourcePreview: summarizeCellSource(cell.source),
      declaredVariables,
      referencedVariables,
      parents,
      children,
      ancestors,
      descendants,
      hasUpstream: ancestors.length > 0,
      hasDownstream: descendants.length > 0,
      isReferenceable,
      isIsolatedDefinition:
        declaredVariables.length > 0 &&
        ancestors.length === 0 &&
        descendants.length === 0,
      isCycleMember: cycleMembers.has(cell.id),
      hasDuplicateDefinitions,
    } satisfies NotebookDependencyCell;
  });

  const edges = Array.from(edgeMap.values()).sort((left, right) => {
    const sourceOrder = compareCellIds(left.source, right.source, cellOrder);
    if (sourceOrder !== 0) {
      return sourceOrder;
    }
    return compareCellIds(left.target, right.target, cellOrder);
  });

  const duplicateDefinitions = Array.from(graph.duplicateDefinitions.entries())
    .map(([name, cellIds]) => ({
      name,
      cellIds: sortCellIds(cellIds, cellOrder),
    }))
    .sort((left, right) => {
      const leftFirst = left.cellIds[0] ?? "";
      const rightFirst = right.cellIds[0] ?? "";
      const order = compareCellIds(leftFirst, rightFirst, cellOrder);
      if (order !== 0) {
        return order;
      }
      return left.name.localeCompare(right.name);
    });

  const cycles = graph.cycles
    .map((cycle) => ({ cellIds: sortCellIds(cycle, cellOrder) }))
    .sort((left, right) =>
      compareCellIds(left.cellIds[0] ?? "", right.cellIds[0] ?? "", cellOrder),
    );

  return {
    sourcePath: file.path,
    title: file.basename,
    cells,
    edges,
    duplicateDefinitions,
    cycles,
  };
}

function buildDefinitionMap(graph: NotebookGraph): Map<string, string[]> {
  const definitionMap = new Map<string, string[]>();

  for (const node of graph.nodes.values()) {
    for (const definition of node.defs) {
      const producers = definitionMap.get(definition) ?? [];
      producers.push(node.cell.id);
      definitionMap.set(definition, producers);
    }
  }

  return definitionMap;
}

function buildEdgeMap(
  graph: NotebookGraph,
  definitionMap: Map<string, string[]>,
): Map<string, NotebookDependencyEdge> {
  const edges = new Map<string, NotebookDependencyEdge>();

  for (const targetNode of graph.nodes.values()) {
    for (const ref of targetNode.refs) {
      const producers = definitionMap.get(ref) ?? [];
      if (producers.length !== 1) {
        continue;
      }

      const source = producers[0];
      if (source === targetNode.cell.id) {
        continue;
      }

      const edgeId = `${source}->${targetNode.cell.id}`;
      const edge = edges.get(edgeId);
      if (edge) {
        if (!edge.variables.includes(ref)) {
          edge.variables.push(ref);
        }
        continue;
      }

      edges.set(edgeId, {
        id: edgeId,
        source,
        target: targetNode.cell.id,
        variables: [ref],
      });
    }
  }

  return edges;
}

function collectTransitive(
  startCellId: string,
  graph: NotebookGraph,
  direction: "dependencies" | "dependents",
  cellOrder: Map<string, number>,
): string[] {
  const visited = new Set<string>();
  const queue = [...(graph.nodes.get(startCellId)?.[direction] ?? [])];

  while (queue.length > 0) {
    const cellId = queue.shift();
    if (!cellId || visited.has(cellId)) {
      continue;
    }

    visited.add(cellId);
    for (const nextCellId of graph.nodes.get(cellId)?.[direction] ?? []) {
      if (!visited.has(nextCellId)) {
        queue.push(nextCellId);
      }
    }
  }

  return sortCellIds(Array.from(visited), cellOrder);
}

function sortCellIds(
  cellIds: Iterable<string>,
  cellOrder: Map<string, number>,
): string[] {
  return Array.from(new Set(cellIds)).sort((left, right) =>
    compareCellIds(left, right, cellOrder),
  );
}

function compareCellIds(
  left: string,
  right: string,
  cellOrder: Map<string, number>,
): number {
  const leftOrder = cellOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = cellOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.localeCompare(right);
}

function summarizeCellSource(source: string): string {
  const normalized = source
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized.length) {
    return "empty";
  }

  return normalized.length > 120
    ? `${normalized.slice(0, 117)}...`
    : normalized;
}
