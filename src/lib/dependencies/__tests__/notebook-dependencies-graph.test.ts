import { describe, expect, test } from "vitest";
import { buildNotebookDependencyGraphLayout } from "../notebook-dependencies-graph";
import type { NotebookDependencySnapshot } from "../notebook-dependencies-data";

function createSnapshot(): NotebookDependencySnapshot {
  return {
    sourcePath: "Notebook.notebook.md",
    title: "Notebook",
    duplicateDefinitions: [],
    cycles: [],
    cells: [
      {
        id: "load",
        lang: "ts",
        state: "idle",
        source: "const selectedFolder = 'Projects';",
        sourcePreview: "const selectedFolder = 'Projects';",
        declaredVariables: ["selectedFolder"],
        referencedVariables: [],
        parents: [],
        children: ["query", "summary"],
        ancestors: [],
        descendants: ["query", "summary", "report"],
        hasUpstream: false,
        hasDownstream: true,
        isReferenceable: true,
        isIsolatedDefinition: false,
        isCycleMember: false,
        hasDuplicateDefinitions: false,
      },
      {
        id: "query",
        lang: "sql",
        state: "completed",
        source:
          "SELECT * FROM lapis.notes WHERE path LIKE {{selectedFolder}} || '/%'",
        sourcePreview:
          "SELECT * FROM lapis.notes WHERE path LIKE {{selectedFolder}} || '/%'",
        declaredVariables: [],
        referencedVariables: ["selectedFolder"],
        parents: ["load"],
        children: ["report"],
        ancestors: ["load"],
        descendants: ["report"],
        hasUpstream: true,
        hasDownstream: true,
        isReferenceable: true,
        isIsolatedDefinition: false,
        isCycleMember: false,
        hasDuplicateDefinitions: false,
      },
      {
        id: "summary",
        lang: "md",
        state: "idle",
        source: "Folder: {{selectedFolder}}",
        sourcePreview: "Folder: {{selectedFolder}}",
        declaredVariables: [],
        referencedVariables: ["selectedFolder"],
        parents: ["load"],
        children: [],
        ancestors: ["load"],
        descendants: [],
        hasUpstream: true,
        hasDownstream: false,
        isReferenceable: true,
        isIsolatedDefinition: false,
        isCycleMember: false,
        hasDuplicateDefinitions: false,
      },
      {
        id: "report",
        lang: "ts",
        state: "stale",
        source: "const rowCount = query.length;",
        sourcePreview: "const rowCount = query.length;",
        declaredVariables: ["rowCount"],
        referencedVariables: ["query"],
        parents: ["query"],
        children: [],
        ancestors: ["load", "query"],
        descendants: [],
        hasUpstream: true,
        hasDownstream: false,
        isReferenceable: true,
        isIsolatedDefinition: false,
        isCycleMember: false,
        hasDuplicateDefinitions: false,
      },
    ],
    edges: [
      {
        id: "load->query",
        source: "load",
        target: "query",
        variables: ["selectedFolder"],
      },
      {
        id: "load->summary",
        source: "load",
        target: "summary",
        variables: ["selectedFolder"],
      },
      {
        id: "query->report",
        source: "query",
        target: "report",
        variables: ["query"],
      },
    ],
  };
}

describe("notebook dependency graph layout", () => {
  test("assigns columns by dependency depth", () => {
    const layout = buildNotebookDependencyGraphLayout(createSnapshot());
    const nodes = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodes.get("load")?.column).toBe(0);
    expect(nodes.get("query")?.column).toBe(1);
    expect(nodes.get("summary")?.column).toBe(1);
    expect(nodes.get("report")?.column).toBe(2);
    expect(layout.columns).toBe(3);
  });

  test("keeps sibling nodes stacked in notebook order", () => {
    const layout = buildNotebookDependencyGraphLayout(createSnapshot());
    const nodes = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodes.get("query")?.y).toBeLessThan(nodes.get("summary")?.y ?? 0);
  });

  test("supports a vertical tree layout by swapping depth and sibling axes", () => {
    const layout = buildNotebookDependencyGraphLayout(
      createSnapshot(),
      "vertical",
    );
    const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
    const query = nodes.get("query");
    const summary = nodes.get("summary");

    expect(layout.orientation).toBe("vertical");
    expect(nodes.get("load")?.y).toBeLessThan(nodes.get("query")?.y ?? 0);
    expect(nodes.get("query")?.x).toBeLessThan(nodes.get("summary")?.x ?? 0);
    expect((query?.x ?? 0) + (query?.width ?? 0)).toBeLessThan(summary?.x ?? 0);
  });

  test("treats cycle members as one component and produces back-edge paths", () => {
    const snapshot = createSnapshot();
    snapshot.cells = [
      {
        id: "a",
        lang: "md",
        state: "idle",
        source: "{{b}}",
        sourcePreview: "{{b}}",
        declaredVariables: [],
        referencedVariables: ["b"],
        parents: ["b"],
        children: ["b"],
        ancestors: ["b"],
        descendants: ["b"],
        hasUpstream: true,
        hasDownstream: true,
        isReferenceable: true,
        isIsolatedDefinition: false,
        isCycleMember: true,
        hasDuplicateDefinitions: false,
      },
      {
        id: "b",
        lang: "md",
        state: "error",
        error: "cycle",
        source: "{{a}}",
        sourcePreview: "{{a}}",
        declaredVariables: [],
        referencedVariables: ["a"],
        parents: ["a"],
        children: ["a"],
        ancestors: ["a"],
        descendants: ["a"],
        hasUpstream: true,
        hasDownstream: true,
        isReferenceable: true,
        isIsolatedDefinition: false,
        isCycleMember: true,
        hasDuplicateDefinitions: false,
      },
    ];
    snapshot.edges = [
      { id: "a->b", source: "a", target: "b", variables: ["a"] },
      { id: "b->a", source: "b", target: "a", variables: ["b"] },
    ];

    const layout = buildNotebookDependencyGraphLayout(snapshot);
    const nodes = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodes.get("a")?.column).toBe(0);
    expect(nodes.get("b")?.column).toBe(0);
    expect(layout.edges.some((edge) => edge.isBackEdge)).toBe(true);
  });
});
