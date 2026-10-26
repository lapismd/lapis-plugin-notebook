import type {
  NotebookDependencyCell,
  NotebookDependencyEdge,
  NotebookDependencySnapshot,
} from "./notebook-dependencies-data";

export type NotebookDependencyGraphOrientation = "horizontal" | "vertical";

export interface NotebookDependencyGraphNodeLayout {
  id: string;
  cell: NotebookDependencyCell;
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  row: number;
  componentSize: number;
}

export interface NotebookDependencyGraphEdgeLayout {
  id: string;
  edge: NotebookDependencyEdge;
  path: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isBackEdge: boolean;
  sourceColumn: number;
  targetColumn: number;
}

export interface NotebookDependencyGraphLayout {
  nodes: NotebookDependencyGraphNodeLayout[];
  edges: NotebookDependencyGraphEdgeLayout[];
  width: number;
  height: number;
  columns: number;
  orientation: NotebookDependencyGraphOrientation;
}

const NODE_WIDTH = 272;
const NODE_HEIGHT = 148;
const COLUMN_GAP = 88;
const ROW_GAP = 44;
const PADDING_X = 36;
const PADDING_Y = 36;
const EDGE_BEND_X = 42;
const EDGE_BEND_Y = 34;

export function buildNotebookDependencyGraphLayout(
  snapshot: Pick<NotebookDependencySnapshot, "cells" | "edges">,
  orientation: NotebookDependencyGraphOrientation = "horizontal",
): NotebookDependencyGraphLayout {
  if (snapshot.cells.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: PADDING_X * 2,
      height: PADDING_Y * 2,
      columns: 0,
      orientation,
    };
  }

  const cellOrder = new Map(
    snapshot.cells.map((cell, index) => [cell.id, index]),
  );
  const componentIndexByCellId = buildStronglyConnectedComponents(
    snapshot,
    cellOrder,
  );
  const components = collectComponents(
    snapshot.cells,
    componentIndexByCellId,
    cellOrder,
  );
  const componentEdges = buildComponentEdges(
    snapshot.edges,
    componentIndexByCellId,
  );
  const componentColumns = assignComponentColumns(
    components.length,
    componentEdges,
  );

  const nodesByColumn = new Map<number, NotebookDependencyCell[]>();
  for (const cell of snapshot.cells) {
    const componentIndex = componentIndexByCellId.get(cell.id) ?? 0;
    const componentColumn = componentColumns[componentIndex] ?? 0;
    const cells = nodesByColumn.get(componentColumn) ?? [];
    cells.push(cell);
    nodesByColumn.set(componentColumn, cells);
  }

  const nodeLayoutById = new Map<string, NotebookDependencyGraphNodeLayout>();
  const columnIndexes = Array.from(nodesByColumn.keys()).sort(
    (left, right) => left - right,
  );

  for (const column of columnIndexes) {
    const cells = nodesByColumn.get(column) ?? [];
    cells.sort((left, right) => compareCell(left.id, right.id, cellOrder));
    cells.forEach((cell, row) => {
      const componentIndex = componentIndexByCellId.get(cell.id) ?? 0;
      const primaryOffset =
        orientation === "horizontal"
          ? PADDING_X + column * (NODE_WIDTH + COLUMN_GAP)
          : PADDING_Y + column * (NODE_HEIGHT + COLUMN_GAP);
      const secondaryOffset =
        orientation === "horizontal"
          ? PADDING_Y + row * (NODE_HEIGHT + ROW_GAP)
          : PADDING_X + row * (NODE_WIDTH + ROW_GAP);
      const layout: NotebookDependencyGraphNodeLayout = {
        id: cell.id,
        cell,
        x: orientation === "horizontal" ? primaryOffset : secondaryOffset,
        y: orientation === "horizontal" ? secondaryOffset : primaryOffset,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        column,
        row,
        componentSize: components[componentIndex]?.length ?? 1,
      };
      nodeLayoutById.set(cell.id, layout);
    });
  }

  const nodes = snapshot.cells
    .map((cell) => nodeLayoutById.get(cell.id))
    .filter((node): node is NotebookDependencyGraphNodeLayout => Boolean(node));

  const edges = snapshot.edges
    .map((edge) => {
      const source = nodeLayoutById.get(edge.source);
      const target = nodeLayoutById.get(edge.target);
      if (!source || !target) {
        return null;
      }

      return buildEdgeLayout(edge, source, target, orientation);
    })
    .filter((edge): edge is NotebookDependencyGraphEdgeLayout => Boolean(edge));

  const width = Math.max(
    PADDING_X * 2 + NODE_WIDTH,
    ...nodes.map((node) => node.x + node.width + PADDING_X),
  );
  const height = Math.max(
    PADDING_Y * 2 + NODE_HEIGHT,
    ...nodes.map((node) => node.y + node.height + PADDING_Y),
  );

  return {
    nodes,
    edges,
    width,
    height,
    columns: columnIndexes.length,
    orientation,
  };
}

function buildStronglyConnectedComponents(
  snapshot: Pick<NotebookDependencySnapshot, "cells" | "edges">,
  cellOrder: Map<string, number>,
): Map<string, number> {
  const outgoing = new Map<string, string[]>();
  for (const cell of snapshot.cells) {
    outgoing.set(cell.id, []);
  }
  for (const edge of snapshot.edges) {
    outgoing.get(edge.source)?.push(edge.target);
  }

  let index = 0;
  const indexById = new Map<string, number>();
  const lowlinkById = new Map<string, number>();
  const stack: string[] = [];
  const active = new Set<string>();
  const componentIndexByCellId = new Map<string, number>();
  let componentIndex = 0;

  const visit = (cellId: string) => {
    indexById.set(cellId, index);
    lowlinkById.set(cellId, index);
    index += 1;
    stack.push(cellId);
    active.add(cellId);

    for (const nextCellId of outgoing.get(cellId) ?? []) {
      if (!indexById.has(nextCellId)) {
        visit(nextCellId);
        lowlinkById.set(
          cellId,
          Math.min(
            lowlinkById.get(cellId) ?? 0,
            lowlinkById.get(nextCellId) ?? 0,
          ),
        );
      } else if (active.has(nextCellId)) {
        lowlinkById.set(
          cellId,
          Math.min(
            lowlinkById.get(cellId) ?? 0,
            indexById.get(nextCellId) ?? 0,
          ),
        );
      }
    }

    if (lowlinkById.get(cellId) !== indexById.get(cellId)) {
      return;
    }

    const component: string[] = [];
    while (stack.length > 0) {
      const candidate = stack.pop();
      if (!candidate) {
        break;
      }
      active.delete(candidate);
      component.push(candidate);
      if (candidate === cellId) {
        break;
      }
    }

    component
      .sort((left, right) => compareCell(left, right, cellOrder))
      .forEach((member) => {
        componentIndexByCellId.set(member, componentIndex);
      });
    componentIndex += 1;
  };

  for (const cell of snapshot.cells) {
    if (!indexById.has(cell.id)) {
      visit(cell.id);
    }
  }

  return componentIndexByCellId;
}

function collectComponents(
  cells: NotebookDependencyCell[],
  componentIndexByCellId: Map<string, number>,
  cellOrder: Map<string, number>,
): string[][] {
  const components = new Map<number, string[]>();

  for (const cell of cells) {
    const componentIndex = componentIndexByCellId.get(cell.id) ?? 0;
    const component = components.get(componentIndex) ?? [];
    component.push(cell.id);
    components.set(componentIndex, component);
  }

  return Array.from(components.entries())
    .sort(([left], [right]) => left - right)
    .map(([, component]) =>
      component.sort((left, right) => compareCell(left, right, cellOrder)),
    );
}

function buildComponentEdges(
  edges: NotebookDependencyEdge[],
  componentIndexByCellId: Map<string, number>,
): Array<[number, number]> {
  const componentEdges = new Set<string>();

  for (const edge of edges) {
    const sourceComponent = componentIndexByCellId.get(edge.source);
    const targetComponent = componentIndexByCellId.get(edge.target);
    if (
      sourceComponent === undefined ||
      targetComponent === undefined ||
      sourceComponent === targetComponent
    ) {
      continue;
    }
    componentEdges.add(`${sourceComponent}:${targetComponent}`);
  }

  return Array.from(componentEdges, (value) => {
    const [source, target] = value.split(":").map((part) => Number(part));
    return [source, target];
  });
}

function assignComponentColumns(
  componentCount: number,
  componentEdges: Array<[number, number]>,
): number[] {
  const incoming = Array.from(
    { length: componentCount },
    () => new Set<number>(),
  );
  const outgoing = Array.from(
    { length: componentCount },
    () => new Set<number>(),
  );

  for (const [source, target] of componentEdges) {
    outgoing[source]?.add(target);
    incoming[target]?.add(source);
  }

  const indegree = incoming.map((parents) => parents.size);
  const queue: number[] = [];
  indegree.forEach((value, index) => {
    if (value === 0) {
      queue.push(index);
    }
  });

  const columns = Array.from({ length: componentCount }, () => 0);
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    for (const next of outgoing[current] ?? []) {
      columns[next] = Math.max(columns[next], columns[current] + 1);
      indegree[next] -= 1;
      if (indegree[next] === 0) {
        queue.push(next);
      }
    }
  }

  return columns;
}

function buildEdgeLayout(
  edge: NotebookDependencyEdge,
  source: NotebookDependencyGraphNodeLayout,
  target: NotebookDependencyGraphNodeLayout,
  orientation: NotebookDependencyGraphOrientation,
): NotebookDependencyGraphEdgeLayout {
  const sourceX =
    orientation === "horizontal"
      ? source.x + source.width
      : source.x + source.width / 2;
  const sourceY =
    orientation === "horizontal"
      ? source.y + source.height / 2
      : source.y + source.height;
  const targetX =
    orientation === "horizontal" ? target.x : target.x + target.width / 2;
  const targetY =
    orientation === "horizontal" ? target.y + target.height / 2 : target.y;
  const isBackEdge = target.column <= source.column;

  const path = buildEdgePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    orientation,
    isBackEdge,
  });

  return {
    id: edge.id,
    edge,
    path,
    sourceX,
    sourceY,
    targetX,
    targetY,
    isBackEdge,
    sourceColumn: source.column,
    targetColumn: target.column,
  };
}

function buildEdgePath(args: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  orientation: NotebookDependencyGraphOrientation;
  isBackEdge: boolean;
}): string {
  const { sourceX, sourceY, targetX, targetY, orientation, isBackEdge } = args;
  if (orientation === "vertical") {
    return isBackEdge
      ? buildVerticalBackEdgePath(sourceX, sourceY, targetX, targetY)
      : buildVerticalForwardEdgePath(sourceX, sourceY, targetX, targetY);
  }

  return isBackEdge
    ? buildHorizontalBackEdgePath(sourceX, sourceY, targetX, targetY)
    : buildHorizontalForwardEdgePath(sourceX, sourceY, targetX, targetY);
}

function buildHorizontalForwardEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const dx = Math.max((targetX - sourceX) / 2, EDGE_BEND_X);
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + dx} ${sourceY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`,
  ].join(" ");
}

function buildHorizontalBackEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const outerX = Math.max(sourceX, targetX) + EDGE_BEND_X * 2;
  const controlY =
    sourceY < targetY ? sourceY - EDGE_BEND_Y : sourceY + EDGE_BEND_Y;

  return [
    `M ${sourceX} ${sourceY}`,
    `C ${outerX} ${sourceY}, ${outerX} ${targetY}, ${targetX} ${targetY}`,
    `M ${sourceX} ${sourceY}`,
    `Q ${outerX} ${controlY}, ${sourceX + EDGE_BEND_X} ${sourceY}`,
  ].join(" ");
}

function buildVerticalForwardEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const dy = Math.max((targetY - sourceY) / 2, EDGE_BEND_Y);
  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${sourceY + dy}, ${targetX} ${targetY - dy}, ${targetX} ${targetY}`,
  ].join(" ");
}

function buildVerticalBackEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const outerY = Math.max(sourceY, targetY) + EDGE_BEND_Y * 2;
  const controlX =
    sourceX < targetX ? sourceX - EDGE_BEND_X : sourceX + EDGE_BEND_X;

  return [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX} ${outerY}, ${targetX} ${outerY}, ${targetX} ${targetY}`,
    `M ${sourceX} ${sourceY}`,
    `Q ${controlX} ${outerY}, ${sourceX} ${sourceY + EDGE_BEND_Y}`,
  ].join(" ");
}

function compareCell(
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
