<script lang="ts">
  import { untrack } from "svelte";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import LocateFixed from "@lucide/svelte/icons/locate-fixed";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import NotebookDependencyCodeSnippet from "./notebook-dependency-code-snippet.svelte";
  import type {
    NotebookDependencyCell,
    NotebookDependencyEdge,
    NotebookDependencySnapshot,
  } from "./notebook-dependencies-data";
  import {
    buildNotebookDependencyGraphLayout,
    type NotebookDependencyGraphEdgeLayout,
    type NotebookDependencyGraphOrientation,
    type NotebookDependencyGraphNodeLayout,
  } from "./notebook-dependencies-graph";
  import type {
    NotebookPluginSettings,
    NotebookPluginSettingsPatch,
  } from "../notebook-settings";

  type DependencyTab = "minimap" | "graph";
  type GraphSelection =
    | { type: "node"; id: string }
    | { type: "edge"; id: string }
    | null;

  const MIN_GRAPH_SCALE = 0.2;
  const MAX_GRAPH_SCALE = 1.5;
  const BASE_WHEEL_ZOOM_SENSITIVITY = 0.0008;
  const WHEEL_ZOOM_DELTA_CAP = 240;

  let {
    snapshot = null,
    settings,
    loading = false,
    onNavigateToCell = undefined,
    onUpdateSettings = undefined,
  }: {
    snapshot?: NotebookDependencySnapshot | null;
    settings: NotebookPluginSettings;
    loading?: boolean;
    onNavigateToCell?: ((cellId: string) => void | Promise<void>) | undefined;
    onUpdateSettings?:
      | ((patch: NotebookPluginSettingsPatch) => Promise<void>)
      | void;
  } = $props();

  let activeTab = $state<DependencyTab>(
    untrack(() => settings.dependencyView.defaultTab),
  );
  let query = $state("");
  let selectedCellId = $state<string | null>(null);
  let graphSelection = $state<GraphSelection>(null);
  let graphOrientation = $state<NotebookDependencyGraphOrientation>(
    untrack(() => settings.dependencyView.graphOrientation),
  );
  let graphZoom = $state(1);
  let graphPanX = $state(0);
  let graphPanY = $state(0);
  let graphViewportWidth = $state(0);
  let graphViewportHeight = $state(0);
  let graphDrag = $state<{
    pointerId: number;
    startX: number;
    startY: number;
    panStartX: number;
    panStartY: number;
    active: boolean;
    dragged: boolean;
  } | null>(null);
  let suppressGraphSurfaceClick = $state(false);

  const filteredCells = $derived.by(() => {
    if (!snapshot) {
      return [] as NotebookDependencyCell[];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return snapshot.cells;
    }

    return snapshot.cells.filter((cell) => {
      return (
        cell.id.toLowerCase().includes(normalizedQuery) ||
        cell.lang.toLowerCase().includes(normalizedQuery) ||
        cell.sourcePreview.toLowerCase().includes(normalizedQuery) ||
        cell.declaredVariables.some((name) =>
          name.toLowerCase().includes(normalizedQuery),
        ) ||
        cell.referencedVariables.some((name) =>
          name.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  });

  const selectedCell = $derived.by(() => {
    if (!selectedCellId) {
      return null;
    }

    return snapshot?.cells.find((cell) => cell.id === selectedCellId) ?? null;
  });

  const visibleSnapshot = $derived.by(() => {
    if (!snapshot) {
      return null;
    }

    const visibleCellIds = new Set(filteredCells.map((cell) => cell.id));
    return {
      cells: filteredCells,
      edges: snapshot.edges.filter(
        (edge) =>
          visibleCellIds.has(edge.source) && visibleCellIds.has(edge.target),
      ),
    };
  });

  const graphLayout = $derived.by(() => {
    if (!visibleSnapshot) {
      return null;
    }

    return buildNotebookDependencyGraphLayout(
      visibleSnapshot,
      graphOrientation,
    );
  });

  const selectedGraphNode = $derived.by(() => {
    const selection = graphSelection;
    if (!graphLayout || selection?.type !== "node") {
      return null;
    }

    return graphLayout.nodes.find((node) => node.id === selection.id) ?? null;
  });

  const selectedGraphEdge = $derived.by(() => {
    const selection = graphSelection;
    if (!graphLayout || selection?.type !== "edge") {
      return null;
    }

    return graphLayout.edges.find((edge) => edge.id === selection.id) ?? null;
  });

  const graphViewportTransform = $derived.by(() => {
    if (!graphLayout || graphViewportWidth <= 0 || graphViewportHeight <= 0) {
      return null;
    }

    const padding = 36;
    const fitScale = Math.min(
      Math.max(
        (graphViewportWidth - padding * 2) / Math.max(graphLayout.width, 1),
        0.2,
      ),
      Math.max(
        (graphViewportHeight - padding * 2) / Math.max(graphLayout.height, 1),
        0.2,
      ),
      1,
    );
    const scale = clamp(fitScale * graphZoom, MIN_GRAPH_SCALE, MAX_GRAPH_SCALE);
    const baseOffsetX = (graphViewportWidth - graphLayout.width * scale) / 2;
    const baseOffsetY = (graphViewportHeight - graphLayout.height * scale) / 2;
    const offsetX = baseOffsetX + graphPanX;
    const offsetY = baseOffsetY + graphPanY;

    return {
      fitScale,
      scale,
      baseOffsetX,
      baseOffsetY,
      offsetX,
      offsetY,
    };
  });

  const selectedGraphPopup = $derived.by(() => {
    if (!graphViewportTransform || (!selectedGraphNode && !selectedGraphEdge)) {
      return null;
    }

    const width = selectedGraphNode ? 360 : 320;
    const estimatedHeight = selectedGraphNode ? 332 : 188;
    const anchorX = selectedGraphNode
      ? graphViewportTransform.offsetX +
        (selectedGraphNode.x + selectedGraphNode.width / 2) *
          graphViewportTransform.scale
      : graphViewportTransform.offsetX +
        graphEdgeLabelX(selectedGraphEdge!) * graphViewportTransform.scale;
    const preferredAnchorY = selectedGraphNode
      ? graphViewportTransform.offsetY +
        selectedGraphNode.y * graphViewportTransform.scale -
        18
      : graphViewportTransform.offsetY +
        graphEdgeLabelY(selectedGraphEdge!) * graphViewportTransform.scale -
        14;
    const fallbackAnchorY = selectedGraphNode
      ? graphViewportTransform.offsetY +
        (selectedGraphNode.y + selectedGraphNode.height) *
          graphViewportTransform.scale +
        18
      : graphViewportTransform.offsetY +
        graphEdgeLabelY(selectedGraphEdge!) * graphViewportTransform.scale +
        20;

    const left = clamp(
      anchorX - width / 2,
      12,
      Math.max(12, graphViewportWidth - width - 12),
    );
    const top =
      preferredAnchorY - estimatedHeight >= 12
        ? preferredAnchorY - estimatedHeight
        : clamp(
            fallbackAnchorY,
            12,
            Math.max(12, graphViewportHeight - estimatedHeight - 12),
          );

    return {
      left,
      top,
      width,
    };
  });

  const cellPositions = $derived.by(() => {
    return Object.fromEntries(
      filteredCells.map((cell, index) => [cell.id, index]),
    );
  });

  $effect(() => {
    activeTab = settings.dependencyView.defaultTab;
  });

  $effect(() => {
    graphOrientation = settings.dependencyView.graphOrientation;
  });

  $effect(() => {
    if (!snapshot) {
      selectedCellId = null;
      return;
    }

    if (
      selectedCellId &&
      snapshot.cells.some((cell) => cell.id === selectedCellId)
    ) {
      return;
    }

    selectedCellId = snapshot.cells[0]?.id ?? null;
  });

  $effect(() => {
    if (!graphLayout) {
      graphSelection = null;
      return;
    }

    const selection = graphSelection;
    if (!selection) {
      return;
    }

    const stillVisible =
      selection.type === "node"
        ? graphLayout.nodes.some((node) => node.id === selection.id)
        : graphLayout.edges.some((edge) => edge.id === selection.id);

    if (!stillVisible) {
      graphSelection = null;
    }
  });

  function selectCell(cellId: string): void {
    selectedCellId = selectedCellId === cellId ? null : cellId;
    void onNavigateToCell?.(cellId);
  }

  function selectGraphNode(cellId: string): void {
    selectedCellId = cellId;
    graphSelection =
      graphSelection?.type === "node" && graphSelection.id === cellId
        ? null
        : { type: "node", id: cellId };
  }

  function selectGraphEdge(edgeId: string): void {
    graphSelection =
      graphSelection?.type === "edge" && graphSelection.id === edgeId
        ? null
        : { type: "edge", id: edgeId };
  }

  async function updateDependencyViewSettings(
    patch: NotebookPluginSettingsPatch,
  ): Promise<void> {
    await onUpdateSettings?.(patch);
  }

  function clearGraphSelection(): void {
    graphSelection = null;
  }

  function isInsideSelectedGraph(cell: NotebookDependencyCell): boolean {
    if (!selectedCell) {
      return false;
    }

    return (
      selectedCell.id === cell.id ||
      selectedCell.parents.includes(cell.id) ||
      selectedCell.children.includes(cell.id) ||
      selectedCell.ancestors.includes(cell.id) ||
      selectedCell.descendants.includes(cell.id)
    );
  }

  function cellColor(cell: NotebookDependencyCell): string {
    if (cell.state === "error") {
      return "var(--color-red)";
    }

    if (!selectedCell) {
      return cell.isReferenceable
        ? "var(--interactive-accent)"
        : "var(--text-faint)";
    }

    if (
      selectedCell.id === cell.id ||
      selectedCell.parents.includes(cell.id) ||
      selectedCell.children.includes(cell.id)
    ) {
      return "var(--interactive-accent)";
    }

    return isInsideSelectedGraph(cell)
      ? "var(--text-muted)"
      : "var(--text-faint)";
  }

  function glyphShift(cell: NotebookDependencyCell): number {
    if (!selectedCell) {
      return 0;
    }

    const isAncestor = selectedCell.ancestors.includes(cell.id);
    const isDescendant = selectedCell.descendants.includes(cell.id);
    if (isAncestor && !isDescendant) {
      return -14;
    }
    if (isDescendant && !isAncestor) {
      return 14;
    }
    return 0;
  }

  function showLeftWhisker(cell: NotebookDependencyCell): boolean {
    if (!selectedCell) {
      return cell.hasUpstream;
    }

    if (!isInsideSelectedGraph(cell)) {
      return false;
    }

    return cell.hasUpstream;
  }

  function showRightWhisker(cell: NotebookDependencyCell): boolean {
    if (!selectedCell) {
      return cell.hasDownstream;
    }

    if (!isInsideSelectedGraph(cell)) {
      return false;
    }

    return cell.hasDownstream;
  }

  function selectedPaths(cell: NotebookDependencyCell): string[] {
    if (!selectedCell || selectedCell.id !== cell.id) {
      return [];
    }

    const currentY = cellPositions[cell.id] ?? 0;
    const paths: string[] = [];
    const cycleTargets = cell.parents.filter((parent) =>
      cell.children.includes(parent),
    );

    for (const cycleTarget of cycleTargets) {
      const targetY = cellPositions[cycleTarget];
      if (targetY === undefined) {
        continue;
      }
      const yDiff = (targetY - currentY) * 21;
      paths.push(`M -3 0 H -7 v ${yDiff} h 14 v ${-yDiff} H 3`);
    }

    for (const parent of cell.parents) {
      if (cycleTargets.includes(parent)) {
        continue;
      }
      const targetY = cellPositions[parent];
      if (targetY === undefined) {
        continue;
      }
      const yDiff = (targetY - currentY) * 21;
      paths.push(`M -3 0 H -7 v ${yDiff} h -4`);
    }

    for (const child of cell.children) {
      if (cycleTargets.includes(child)) {
        continue;
      }
      const targetY = cellPositions[child];
      if (targetY === undefined) {
        continue;
      }
      const yDiff = (targetY - currentY) * 21;
      paths.push(`M 3 0 H 7 v ${yDiff} h 4`);
    }

    return paths;
  }

  function rowLabel(cell: NotebookDependencyCell): string {
    if (cell.declaredVariables.length > 0) {
      return cell.declaredVariables.join(", ");
    }

    return cell.sourcePreview;
  }

  function rowDetail(cell: NotebookDependencyCell): string {
    const tags: string[] = [cell.lang.toUpperCase()];
    if (cell.parents.length > 0) {
      tags.push(`${cell.parents.length} in`);
    }
    if (cell.children.length > 0) {
      tags.push(`${cell.children.length} out`);
    }
    if (cell.hasDuplicateDefinitions) {
      tags.push("duplicate");
    }
    if (cell.isCycleMember) {
      tags.push("cycle");
    }
    if (cell.state === "stale") {
      tags.push("stale");
    }
    if (cell.state === "error") {
      tags.push("error");
    }
    return tags.join(" · ");
  }

  function graphNodeTone(cell: NotebookDependencyCell): string {
    if (cell.state === "error") {
      return "notebook-dependencies__graph-node--error";
    }
    if (cell.state === "stale") {
      return "notebook-dependencies__graph-node--warning";
    }
    if (cell.state === "completed") {
      return "notebook-dependencies__graph-node--success";
    }
    return "notebook-dependencies__graph-node--idle";
  }

  function graphNodeRing(node: NotebookDependencyGraphNodeLayout): string {
    return graphSelection?.type === "node" && graphSelection.id === node.id
      ? "notebook-dependencies__graph-node--ring"
      : "";
  }

  function graphEdgeColor(edge: NotebookDependencyGraphEdgeLayout): string {
    if (graphSelection?.type === "edge" && graphSelection.id === edge.id) {
      return "var(--interactive-accent)";
    }
    if (edge.edge.variables.length > 1) {
      return "color-mix(in srgb, var(--interactive-accent) 65%, var(--text-muted) 35%)";
    }
    return edge.isBackEdge ? "var(--color-red)" : "var(--text-muted)";
  }

  function graphEdgeLabelX(edge: NotebookDependencyGraphEdgeLayout): number {
    return (edge.sourceX + edge.targetX) / 2;
  }

  function graphEdgeLabelY(edge: NotebookDependencyGraphEdgeLayout): number {
    return (edge.sourceY + edge.targetY) / 2 - 10;
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function observeGraphViewport(node: HTMLDivElement) {
    const update = () => {
      graphViewportWidth = node.clientWidth;
      graphViewportHeight = node.clientHeight;
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return {
      destroy() {
        observer.disconnect();
      },
    };
  }

  function adjustGraphZoom(multiplier: number): void {
    zoomGraphAt(graphViewportWidth / 2, graphViewportHeight / 2, multiplier);
  }

  function resetGraphViewport(): void {
    graphZoom = 1;
    graphPanX = 0;
    graphPanY = 0;
  }

  function normalizeWheelDelta(event: WheelEvent, pageHeight: number): number {
    const deltaModeScale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? Math.max(pageHeight, 1)
          : 1;

    return clamp(
      event.deltaY * deltaModeScale,
      -WHEEL_ZOOM_DELTA_CAP,
      WHEEL_ZOOM_DELTA_CAP,
    );
  }

  function zoomGraphAt(
    screenX: number,
    screenY: number,
    zoomFactor: number,
  ): void {
    if (!graphLayout || !graphViewportTransform) {
      return;
    }

    const currentScale = graphViewportTransform.scale;
    const worldX = (screenX - graphViewportTransform.offsetX) / currentScale;
    const worldY = (screenY - graphViewportTransform.offsetY) / currentScale;
    const nextScale = clamp(
      currentScale * zoomFactor,
      MIN_GRAPH_SCALE,
      MAX_GRAPH_SCALE,
    );
    const nextBaseOffsetX =
      (graphViewportWidth - graphLayout.width * nextScale) / 2;
    const nextBaseOffsetY =
      (graphViewportHeight - graphLayout.height * nextScale) / 2;

    graphZoom =
      graphViewportTransform.fitScale > 0
        ? nextScale / graphViewportTransform.fitScale
        : 1;
    graphPanX = screenX - worldX * nextScale - nextBaseOffsetX;
    graphPanY = screenY - worldY * nextScale - nextBaseOffsetY;
  }

  function handleGraphWheel(event: WheelEvent): void {
    if (!graphLayout || !graphViewportTransform) {
      return;
    }

    event.preventDefault();
    const viewport = event.currentTarget;
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const wheelDelta = normalizeWheelDelta(event, viewport.clientHeight);
    const zoomFactor = Math.exp(
      -wheelDelta *
        BASE_WHEEL_ZOOM_SENSITIVITY *
        settings.dependencyView.wheelZoomSensitivity,
    );
    zoomGraphAt(offsetX, offsetY, zoomFactor);
  }

  function shouldStartGraphPan(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return true;
    }

    return !target.closest(
      "input, textarea, [data-graph-popup], [data-graph-controls]",
    );
  }

  function handleGraphPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !shouldStartGraphPan(event.target)) {
      return;
    }

    suppressGraphSurfaceClick = false;
    graphDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panStartX: graphPanX,
      panStartY: graphPanY,
      active: false,
      dragged: false,
    };
  }

  function handleGraphPointerMove(event: PointerEvent): void {
    if (!graphDrag || graphDrag.pointerId !== event.pointerId) {
      return;
    }

    const viewport = event.currentTarget;
    if (!(viewport instanceof HTMLDivElement)) {
      return;
    }

    const deltaX = event.clientX - graphDrag.startX;
    const deltaY = event.clientY - graphDrag.startY;
    const exceededDragThreshold = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

    if (!graphDrag.active && !exceededDragThreshold) {
      return;
    }

    if (!graphDrag.active) {
      viewport.setPointerCapture(event.pointerId);
    }

    graphPanX = graphDrag.panStartX + deltaX;
    graphPanY = graphDrag.panStartY + deltaY;
    graphDrag = {
      ...graphDrag,
      active: true,
      dragged: true,
    };

    event.preventDefault();
  }

  function finishGraphPointerInteraction(event: PointerEvent): void {
    if (!graphDrag || graphDrag.pointerId !== event.pointerId) {
      return;
    }

    const viewport = event.currentTarget;
    const didDrag = graphDrag.dragged;
    const hadPointerCapture = graphDrag.active;
    graphDrag = null;
    suppressGraphSurfaceClick = didDrag;

    if (
      hadPointerCapture &&
      viewport instanceof HTMLDivElement &&
      viewport.hasPointerCapture(event.pointerId)
    ) {
      viewport.releasePointerCapture(event.pointerId);
    }
  }

  function handleGraphSurfaceClick(): void {
    if (suppressGraphSurfaceClick) {
      suppressGraphSurfaceClick = false;
      return;
    }

    clearGraphSelection();
  }

  function handleGraphSurfaceKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    clearGraphSelection();
  }

  function handleGraphEdgeClick(event: MouseEvent, edgeId: string): void {
    if (suppressGraphSurfaceClick) {
      suppressGraphSurfaceClick = false;
      event.stopPropagation();
      return;
    }

    event.stopPropagation();
    selectGraphEdge(edgeId);
  }

  function handleGraphEdgeKeyDown(event: KeyboardEvent, edgeId: string): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectGraphEdge(edgeId);
  }
</script>

<div
  class="notebook-dependencies notebook-dependencies__ge62249fa"
  data-testid="notebook-dependencies-panel"
>
  {#if !snapshot}
    <div class="notebook-dependencies__g47990fce">
      {#if loading}
        Loading notebook dependencies...
      {:else}
        Open a notebook note in the active leaf to populate this panel.
      {/if}
    </div>
  {:else}
    <div class="notebook-dependencies__header notebook-dependencies__g50b7a829">
      <div
        class="notebook-dependencies__tabs notebook-dependencies__ge29e0cfa"
      >
        <button
          type="button"
          class={`notebook-dependencies__tab${activeTab === "minimap" ? " notebook-dependencies__tab--active" : ""}`}
          onclick={() => {
            activeTab = "minimap";
            void updateDependencyViewSettings({
              dependencyView: { defaultTab: "minimap" },
            });
          }}
        >
          Minimap
        </button>
        <button
          type="button"
          class={`notebook-dependencies__tab${activeTab === "graph" ? " notebook-dependencies__tab--active" : ""}`}
          onclick={() => {
            activeTab = "graph";
            void updateDependencyViewSettings({
              dependencyView: { defaultTab: "graph" },
            });
          }}
        >
          Graph
        </button>
      </div>

      <label
        class="notebook-dependencies__g3b24334d"
      >
        <Search class="notebook-dependencies__g1a559052" />
        <input
          bind:value={query}
          class="notebook-dependencies__ge3adcd04"
          placeholder="Filter cells or variables..."
        />
      </label>
    </div>

    {#if activeTab === "minimap"}
      <div class="notebook-dependencies__g4f5287c1">
        {#if filteredCells.length === 0}
          <div
            class="notebook-dependencies__ge614b2e1"
          >
            No cells matched the current filter.
          </div>
        {:else}
          <div class="notebook-dependencies__gda7c36cd">
            {#each filteredCells as cell}
              <button
                type="button"
                class={`notebook-dependencies__minimap-row${selectedCell?.id === cell.id ? " notebook-dependencies__minimap-row--selected" : ""}`}
                onclick={() => selectCell(cell.id)}
                onmousedown={(event) => event.preventDefault()}
              >
                <svg
                  class="left-5 notebook-dependencies__gfdc1e364"
                  width="1"
                  height="1"
                  style={`color: ${cellColor(cell)}`}
                >
                  {#if selectedCell?.id === cell.id}
                    <circle
                      r={cell.isReferenceable ? 3 : 1.5}
                      fill="currentColor"
                    />
                    {#each selectedPaths(cell) as path}
                      <path
                        d={path}
                        fill="none"
                        stroke-width="2"
                        stroke="currentColor"
                      />
                    {/each}
                  {:else}
                    <g transform={`translate(${glyphShift(cell)}, 0)`}>
                      {#if showLeftWhisker(cell)}
                        <path
                          d="M 0 0 h -8"
                          fill="none"
                          stroke-width="2"
                          stroke="currentColor"
                        />
                      {/if}
                      {#if showRightWhisker(cell)}
                        <path
                          d="M 0 0 h 8"
                          fill="none"
                          stroke-width="2"
                          stroke="currentColor"
                        />
                      {/if}
                      <circle
                        r={cell.isReferenceable ? 3 : 1.5}
                        fill="currentColor"
                      />
                    </g>
                  {/if}
                </svg>

                <div
                  class="notebook-dependencies__g045bcef5"
                >
                  <div class="notebook-dependencies__g385e0580">
                    {rowLabel(cell)}
                  </div>
                  <div
                    class="notebook-dependencies__g00b9bd05"
                  >
                    {cell.id}
                  </div>
                </div>
              </button>
              <div
                class="notebook-dependencies__ga7821bf8"
              >
                {rowDetail(cell)}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="notebook-dependencies__g15cdfabf">
        <div class="notebook-dependencies__g0338365a">
          <div
            class="notebook-dependencies__g3ec50bb4"
          >
            <span
              class="notebook-dependencies__ga6d78c1e"
            >
              {graphLayout?.nodes.length ?? 0} cells
            </span>
            <span
              class="notebook-dependencies__ga6d78c1e"
            >
              {graphLayout?.edges.length ?? 0} edges
            </span>
            {#if (snapshot?.duplicateDefinitions ?? []).length > 0}
              <button
                type="button"
                class="notebook-dependencies__g40b8c850"
                onclick={(event) => {
                  event.stopPropagation();
                  selectGraphNode(
                    snapshot?.duplicateDefinitions[0]?.cellIds[0] ?? "",
                  );
                }}
              >
                {(snapshot?.duplicateDefinitions ?? []).length} duplicate {(
                  snapshot?.duplicateDefinitions ?? []
                ).length === 1
                  ? "definition"
                  : "definitions"}
              </button>
            {/if}
            {#if (snapshot?.cycles ?? []).length > 0}
              <button
                type="button"
                class="notebook-dependencies__gcb9fb92c"
                onclick={(event) => {
                  event.stopPropagation();
                  selectGraphNode(snapshot?.cycles[0]?.cellIds[0] ?? "");
                }}
              >
                {(snapshot?.cycles ?? []).length}
                {(snapshot?.cycles ?? []).length === 1 ? "cycle" : "cycles"}
              </button>
            {/if}
          </div>

          <div
            class="notebook-dependencies__g752e342d"
          >
            <button
              type="button"
              class={`notebook-dependencies__orientation${graphOrientation === "horizontal" ? " notebook-dependencies__orientation--active" : ""}`}
              onclick={() => {
                graphOrientation = "horizontal";
                void updateDependencyViewSettings({
                  dependencyView: { graphOrientation: "horizontal" },
                });
              }}
            >
              Vertical Tree
            </button>
            <button
              type="button"
              class={`notebook-dependencies__orientation${graphOrientation === "vertical" ? " notebook-dependencies__orientation--active" : ""}`}
              onclick={() => {
                graphOrientation = "vertical";
                void updateDependencyViewSettings({
                  dependencyView: { graphOrientation: "vertical" },
                });
              }}
            >
              Horizontal Tree
            </button>
          </div>
        </div>

        <!--
          Diagram-editor surface: role=application with a labelled focusable
          container holding the individually focusable node/edge buttons.
          Svelte's heuristic treats `application` as noninteractive; axe passes
          this structure under the story's strict a11y gating.
        -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          use:observeGraphViewport
          class={`notebook-dependencies__graph${graphDrag ? " notebook-dependencies__graph--dragging" : ""}`}
          onclick={handleGraphSurfaceClick}
          onkeydown={handleGraphSurfaceKeyDown}
          onwheel={handleGraphWheel}
          onpointerdown={handleGraphPointerDown}
          onpointermove={handleGraphPointerMove}
          onpointerup={finishGraphPointerInteraction}
          onpointercancel={finishGraphPointerInteraction}
          onlostpointercapture={finishGraphPointerInteraction}
          role="application"
          tabindex="0"
          aria-label="Notebook dependency graph"
        >
          {#if !graphLayout || graphLayout.nodes.length === 0}
            <div class="notebook-dependencies__g47990fce">
              No visible graph nodes matched the current filter.
            </div>
          {:else}
            <div
              class="notebook-dependencies__g82165df4"
              style={`width:${graphLayout.width}px;height:${graphLayout.height}px;transform: translate(${graphViewportTransform?.offsetX ?? 0}px, ${graphViewportTransform?.offsetY ?? 0}px) scale(${graphViewportTransform?.scale ?? 1});`}
            >
              <svg
                class="notebook-dependencies__g5f81ac85"
                width={graphLayout.width}
                height={graphLayout.height}
                viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
                aria-label="Notebook dependency graph"
              >
                {#each graphLayout.edges as edge}
                  <g
                    role="button"
                    tabindex="0"
                    aria-label={`Select dependency from ${edge.edge.source} to ${edge.edge.target}, ${edge.edge.variables.length} variable${edge.edge.variables.length === 1 ? "" : "s"}: ${edge.edge.variables.join(", ")}`}
                    onclick={(event) => handleGraphEdgeClick(event, edge.id)}
                    onkeydown={(event) =>
                      handleGraphEdgeKeyDown(event, edge.id)}
                  >
                    <path
                      d={edge.path}
                      fill="none"
                      stroke={graphEdgeColor(edge)}
                      stroke-width={graphSelection?.type === "edge" &&
                      graphSelection.id === edge.id
                        ? 3
                        : 2}
                      stroke-linecap="round"
                      stroke-dasharray={edge.isBackEdge ? "5 4" : undefined}
                      opacity={graphSelection &&
                      !(
                        graphSelection.type === "edge" &&
                        graphSelection.id === edge.id
                      )
                        ? 0.5
                        : 0.85}
                    />
                    <path
                      d={edge.path}
                      fill="none"
                      stroke="transparent"
                      stroke-width="14"
                      stroke-linecap="round"
                    />
                    <g
                      transform={`translate(${graphEdgeLabelX(edge)}, ${graphEdgeLabelY(edge)})`}
                    >
                      <rect
                        x="-14"
                        y="-10"
                        width="28"
                        height="20"
                        rx="10"
                        fill="var(--background-primary)"
                        stroke={graphEdgeColor(edge)}
                        stroke-width="1"
                      />
                      <text
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill={graphEdgeColor(edge)}
                        font-size="10"
                        font-weight="600"
                      >
                        {edge.edge.variables.length}
                      </text>
                    </g>
                  </g>
                {/each}
              </svg>

              {#each graphLayout.nodes as node}
                <button
                  type="button"
                  class={`notebook-dependencies__graph-node ${graphNodeTone(node.cell)} ${graphNodeRing(node)}`.trim()}
                  style={`left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;`}
                  onclick={(event) => {
                    if (suppressGraphSurfaceClick) {
                      suppressGraphSurfaceClick = false;
                      event.stopPropagation();
                      return;
                    }
                    event.stopPropagation();
                    selectGraphNode(node.id);
                  }}
                  ondblclick={() => onNavigateToCell?.(node.id)}
                >
                  <div class="notebook-dependencies__g7ce14341">
                    <div class="notebook-dependencies__g7e0b7cdf">
                      <div
                        class="notebook-dependencies__g72d23165"
                      >
                        {node.id}
                      </div>
                      <div
                        class="notebook-dependencies__g4df1b8ce"
                      >
                        {rowLabel(node.cell)}
                      </div>
                    </div>
                    <span
                      class="notebook-dependencies__gf7a0c78d"
                    >
                      {node.cell.lang}
                    </span>
                  </div>

                  <div
                    class="notebook-dependencies__g05004bba notebook-dependencies__snippet-body"
                  >
                    <NotebookDependencyCodeSnippet
                      source={node.cell.source}
                      lang={node.cell.lang}
                      class="notebook-dependencies__gd1ae9cb8"
                    />
                  </div>

                  <div
                    class="notebook-dependencies__g5aec2d5c"
                  >
                    <span
                      class="notebook-dependencies__ga7ae9802"
                    >
                      {node.cell.state}
                    </span>
                    {#if node.cell.parents.length > 0}
                      <span
                        class="notebook-dependencies__ga7ae9802"
                      >
                        {node.cell.parents.length} in
                      </span>
                    {/if}
                    {#if node.cell.children.length > 0}
                      <span
                        class="notebook-dependencies__ga7ae9802"
                      >
                        {node.cell.children.length} out
                      </span>
                    {/if}
                    {#if node.cell.hasDuplicateDefinitions}
                      <span
                        class="notebook-dependencies__gf70ed40b"
                        >duplicate</span
                      >
                    {/if}
                    {#if node.cell.isCycleMember}
                      <span
                        class="notebook-dependencies__g4ef807a6"
                        >cycle</span
                      >
                    {/if}
                  </div>
                </button>
              {/each}
            </div>

            <div
              data-graph-controls
              class="right-4 bottom-4 notebook-dependencies__g3b69acb6"
            >
              <button
                type="button"
                class="notebook-dependencies__g2647dc48"
                aria-label="Zoom in"
                title="Zoom in"
                onclick={(event) => {
                  event.stopPropagation();
                  adjustGraphZoom(1.15);
                }}
              >
                <Plus class="notebook-dependencies__gf7b5fa97" />
              </button>
              <button
                type="button"
                class="notebook-dependencies__g2647dc48"
                aria-label="Fit graph"
                title="Fit graph"
                onclick={(event) => {
                  event.stopPropagation();
                  resetGraphViewport();
                }}
              >
                <LocateFixed class="notebook-dependencies__gf7b5fa97" />
              </button>
              <button
                type="button"
                class="notebook-dependencies__gff71015c"
                aria-label="Zoom out"
                title="Zoom out"
                onclick={(event) => {
                  event.stopPropagation();
                  adjustGraphZoom(0.87);
                }}
              >
                <Minus class="notebook-dependencies__gf7b5fa97" />
              </button>
            </div>

            {#if selectedGraphPopup}
              <div class="notebook-dependencies__gaf8c3070">
                <div
                  role="presentation"
                  data-graph-popup
                  class="notebook-dependencies__g065f1143"
                  style={`left:${selectedGraphPopup.left}px;top:${selectedGraphPopup.top}px;`}
                  onpointerdown={(event) => event.stopPropagation()}
                  onwheel={(event) => event.stopPropagation()}
                >
                  <div class="notebook-dependencies__g660ba172">
                    <div>
                      {#if selectedGraphNode}
                        <div class="notebook-dependencies__g64d8e366">
                          {selectedGraphNode.id}
                        </div>
                        <div
                          class="notebook-dependencies__g26cd6b19"
                        >
                          {selectedGraphNode.cell.lang} · {selectedGraphNode
                            .cell.state}
                        </div>
                      {:else if selectedGraphEdge}
                        <div
                          class="notebook-dependencies__g557bb361"
                        >
                          <span>{selectedGraphEdge.edge.source}</span>
                          <ArrowRight
                            class="notebook-dependencies__g1a559052"
                          />
                          <span>{selectedGraphEdge.edge.target}</span>
                        </div>
                        <div class="notebook-dependencies__g231e4318">
                          {selectedGraphEdge.isBackEdge
                            ? "Back-edge or cycle relationship"
                            : "Forward dependency"}
                        </div>
                      {/if}
                    </div>

                    <button
                      type="button"
                      class="notebook-dependencies__g86783ec4"
                      onclick={clearGraphSelection}
                    >
                      Close
                    </button>
                  </div>

                  {#if selectedGraphNode}
                    <div
                      class="notebook-dependencies__g4eb74f2f notebook-dependencies__snippet-body"
                    >
                      <NotebookDependencyCodeSnippet
                        source={selectedGraphNode.cell.source}
                        lang={selectedGraphNode.cell.lang}
                        class="notebook-dependencies__g97ad53c4"
                      />
                    </div>

                    <div class="notebook-dependencies__g6e44a04a">
                      <div
                        class="notebook-dependencies__g106c9a78"
                      >
                        <div
                          class="notebook-dependencies__ge394f4fa"
                        >
                          Inputs
                        </div>
                        <div class="notebook-dependencies__g51e2c485">
                          {selectedGraphNode.cell.parents.length}
                        </div>
                      </div>
                      <div
                        class="notebook-dependencies__g106c9a78"
                      >
                        <div
                          class="notebook-dependencies__ge394f4fa"
                        >
                          Outputs
                        </div>
                        <div class="notebook-dependencies__g51e2c485">
                          {selectedGraphNode.cell.children.length}
                        </div>
                      </div>
                    </div>

                    <div class="notebook-dependencies__geccd13ef">
                      <div
                        class="notebook-dependencies__g1e858e4e"
                      >
                        Declared variables
                      </div>
                      <div class="notebook-dependencies__g22d9bd60">
                        {#if selectedGraphNode.cell.declaredVariables.length > 0}
                          {#each selectedGraphNode.cell.declaredVariables as variable}
                            <span
                              class="notebook-dependencies__g6ba209c2"
                              >{variable}</span
                            >
                          {/each}
                        {:else}
                          <span class="notebook-dependencies__g455c6595"
                            >No exported variables</span
                          >
                        {/if}
                      </div>
                    </div>

                    <div class="notebook-dependencies__geccd13ef">
                      <div
                        class="notebook-dependencies__g1e858e4e"
                      >
                        Referenced variables
                      </div>
                      <div class="notebook-dependencies__g22d9bd60">
                        {#if selectedGraphNode.cell.referencedVariables.length > 0}
                          {#each selectedGraphNode.cell.referencedVariables as variable}
                            <span
                              class="notebook-dependencies__g6ba209c2"
                              >{variable}</span
                            >
                          {/each}
                        {:else}
                          <span class="notebook-dependencies__g455c6595"
                            >No referenced variables</span
                          >
                        {/if}
                      </div>
                    </div>

                    <div class="notebook-dependencies__g2e98b4a2">
                      <button
                        type="button"
                        class="notebook-dependencies__g4d631760"
                        onclick={() => onNavigateToCell?.(selectedGraphNode.id)}
                      >
                        <ExternalLink class="notebook-dependencies__g783b0d9d" />
                        Jump to cell
                      </button>
                    </div>
                  {:else if selectedGraphEdge}
                    <div class="notebook-dependencies__g0ab86672">
                      <div
                        class="notebook-dependencies__g1e858e4e"
                      >
                        Variables
                      </div>
                      <div class="notebook-dependencies__g22d9bd60">
                        {#each selectedGraphEdge.edge.variables as variable}
                          <span
                            class="notebook-dependencies__g6ba209c2"
                            >{variable}</span
                          >
                        {/each}
                      </div>
                    </div>

                    <div class="notebook-dependencies__g9e0fd27d">
                      <button
                        type="button"
                        class="notebook-dependencies__g4d631760"
                        onclick={() =>
                          onNavigateToCell?.(selectedGraphEdge.edge.source)}
                      >
                        <ExternalLink class="notebook-dependencies__g783b0d9d" />
                        Open source
                      </button>
                      <button
                        type="button"
                        class="notebook-dependencies__g4d631760"
                        onclick={() =>
                          onNavigateToCell?.(selectedGraphEdge.edge.target)}
                      >
                        <ExternalLink class="notebook-dependencies__g783b0d9d" />
                        Open target
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .notebook-dependencies__graph-node {
    box-shadow: 0 12px 30px -22px var(--background-modifier-box-shadow);
  }

  .notebook-dependencies__graph-node:hover {
    box-shadow: 0 16px 34px -22px var(--background-modifier-box-shadow);
  }
</style>
