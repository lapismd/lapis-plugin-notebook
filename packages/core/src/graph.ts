export interface NotebookGraphCellLike {
  id: string;
}

export interface NotebookCellAnalysisLike {
  defs: string[];
  refs: string[];
}

export interface NotebookGraphNode<
  TCell extends NotebookGraphCellLike = NotebookGraphCellLike,
> {
  cell: TCell;
  defs: string[];
  refs: string[];
  dependencies: string[];
  dependents: string[];
}

export interface NotebookGraph<
  TCell extends NotebookGraphCellLike = NotebookGraphCellLike,
> {
  nodes: Map<string, NotebookGraphNode<TCell>>;
  order: string[];
  duplicateDefinitions: Map<string, string[]>;
  cycles: string[][];
}

export function buildNotebookGraphFromCells<
  TCell extends NotebookGraphCellLike,
>(
  cells: Iterable<TCell>,
  analyzeCell: (cell: TCell) => NotebookCellAnalysisLike,
): NotebookGraph<TCell> {
  const nodes = new Map<string, NotebookGraphNode<TCell>>();
  const definitionMap = new Map<string, string[]>();

  for (const cell of cells) {
    const analysis = analyzeCell(cell);
    const defs = Array.from(new Set([cell.id, ...analysis.defs]));
    const refs = Array.from(new Set(analysis.refs));
    const node: NotebookGraphNode<TCell> = {
      cell,
      defs,
      refs,
      dependencies: [],
      dependents: [],
    };
    nodes.set(cell.id, node);
    for (const def of defs) {
      const producers = definitionMap.get(def) ?? [];
      producers.push(cell.id);
      definitionMap.set(def, producers);
    }
  }

  for (const node of nodes.values()) {
    const dependencies = new Set<string>();
    for (const ref of node.refs) {
      const producers = definitionMap.get(ref) ?? [];
      if (producers.length === 1 && producers[0] !== node.cell.id) {
        dependencies.add(producers[0]);
      }
    }
    node.dependencies = Array.from(dependencies);
    for (const dependency of node.dependencies) {
      nodes.get(dependency)?.dependents.push(node.cell.id);
    }
  }

  const duplicateDefinitions = new Map(
    Array.from(definitionMap.entries()).filter(
      ([, producers]) => producers.length > 1,
    ),
  );

  const order = topologicalOrder(nodes);
  const cycles = order.length === nodes.size ? [] : detectCycles(nodes);

  return {
    nodes,
    order,
    duplicateDefinitions,
    cycles,
  };
}

export function collectStaleDescendants(
  graph: NotebookGraph,
  changedCellIds: Iterable<string>,
): string[] {
  const stale = new Set<string>();
  const queue = Array.from(changedCellIds);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph.nodes.get(current);
    if (!node) {
      continue;
    }
    for (const dependent of node.dependents) {
      if (stale.has(dependent)) {
        continue;
      }
      stale.add(dependent);
      queue.push(dependent);
    }
  }

  return Array.from(stale);
}

export function collectDependencyClosure(
  graph: NotebookGraph,
  targetCellIds: Iterable<string>,
): string[] {
  const required = new Set<string>();
  const queue = Array.from(targetCellIds);

  while (queue.length > 0) {
    const cellId = queue.shift()!;
    if (required.has(cellId)) {
      continue;
    }

    required.add(cellId);
    const node = graph.nodes.get(cellId);
    node?.dependencies.forEach((dependency) => {
      if (!required.has(dependency)) {
        queue.push(dependency);
      }
    });
  }

  return Array.from(required);
}

function topologicalOrder<TCell extends NotebookGraphCellLike>(
  nodes: Map<string, NotebookGraphNode<TCell>>,
): string[] {
  const sourceOrder = new Map(
    Array.from(nodes.keys(), (id, index) => [id, index] as const),
  );
  const indegree = new Map<string, number>();
  nodes.forEach((node, id) => {
    indegree.set(id, node.dependencies.length);
  });

  const queue = Array.from(indegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const dependent of nodes.get(current)?.dependents ?? []) {
      const nextDegree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, nextDegree);
      if (nextDegree === 0) {
        const position = sourceOrder.get(dependent)!;
        const next = queue.findIndex((id) => sourceOrder.get(id)! > position);
        if (next < 0) queue.push(dependent);
        else queue.splice(next, 0, dependent);
      }
    }
  }

  return order;
}

function detectCycles<TCell extends NotebookGraphCellLike>(
  nodes: Map<string, NotebookGraphNode<TCell>>,
): string[][] {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (cellId: string) => {
    if (active.has(cellId)) {
      const start = stack.indexOf(cellId);
      if (start !== -1) {
        cycles.push(stack.slice(start));
      }
      return;
    }
    if (visited.has(cellId)) {
      return;
    }

    visited.add(cellId);
    active.add(cellId);
    stack.push(cellId);
    for (const dependent of nodes.get(cellId)?.dependents ?? []) {
      visit(dependent);
    }
    stack.pop();
    active.delete(cellId);
  };

  nodes.forEach((_, cellId) => visit(cellId));
  return cycles;
}
