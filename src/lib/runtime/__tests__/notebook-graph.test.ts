import { describe, expect, test, vi } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { buildNotebookGraph, collectStaleDescendants } from "../notebook-graph";
import { NotebookSession } from "../notebook-session";

function createNotebook(source: string) {
  return parseNotebookDocument(source, {
    sourcePath: "Notebook.notebook.md",
    frontmatter: { version: 1, mode: "lazy" },
  });
}

describe("notebook graph", () => {
  test("orders cells by placeholder and variable dependencies", () => {
    const document = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
        "",
        ':::cell{#query lang="sql"}',
        "```sql",
        "SELECT * FROM notes WHERE path LIKE {{selectedFolder}} || '/%'",
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
    );

    const graph = buildNotebookGraph(document);

    expect(graph.order).toEqual(["load", "query", "summary"]);
    expect(graph.nodes.get("load")?.dependents).toEqual(
      expect.arrayContaining(["query", "summary"]),
    );
  });

  test("orders cells by expression interpolations in markdown and HTML cells", () => {
    const document = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedName = "Ada";',
        "const count = 2;",
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Hello, ${selectedName.toUpperCase()} (${count})",
        ":::",
        "",
        ':::cell{#card lang="html"}',
        "<strong>${selectedName}</strong>",
        ":::",
      ].join("\n"),
    );

    const graph = buildNotebookGraph(document);

    expect(graph.order).toEqual(["load", "summary", "card"]);
    expect(graph.nodes.get("load")?.dependents).toEqual(
      expect.arrayContaining(["summary", "card"]),
    );
  });

  test("collects duplicate definitions and cycle information", () => {
    const duplicates = createNotebook(
      [
        ':::cell{#a lang="ts"}',
        "```ts",
        "const shared = 1;",
        "```",
        ":::",
        "",
        ':::cell{#b lang="ts"}',
        "```ts",
        "const shared = 2;",
        "```",
        ":::",
      ].join("\n"),
    );

    const duplicateGraph = buildNotebookGraph(duplicates);
    expect(duplicateGraph.duplicateDefinitions.get("shared")).toEqual([
      "a",
      "b",
    ]);

    const cyclic = createNotebook(
      [
        ':::cell{#a lang="md"}',
        "{{b}}",
        ":::",
        "",
        ':::cell{#b lang="md"}',
        "{{a}}",
        ":::",
      ].join("\n"),
    );

    const cycleGraph = buildNotebookGraph(cyclic);
    expect(cycleGraph.cycles).not.toEqual([]);
  });

  test("marks changed cells and descendants stale on document updates", () => {
    const initial = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
        "",
        ':::cell{#query lang="sql"}',
        "```sql",
        "SELECT * FROM notes WHERE path LIKE {{selectedFolder}} || '/%'",
        "```",
        ":::",
      ].join("\n"),
    );
    const session = new NotebookSession(initial);

    const next = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Archive";',
        "```",
        ":::",
        "",
        ':::cell{#query lang="sql"}',
        "```sql",
        "SELECT * FROM notes WHERE path LIKE {{selectedFolder}} || '/%'",
        "```",
        ":::",
      ].join("\n"),
    );

    expect(session.updateDocument(next)).toEqual(["load"]);
    expect(session.getCellState("load").state).toBe("stale");
    expect(session.getCellState("query").state).toBe("stale");

    expect(collectStaleDescendants(session.graph, ["load"])).toEqual(["query"]);
  });

  test("marks only the changed cell and its downstream dependents stale when a dependent cell changes", () => {
    const initial = createNotebook(
      [
        ':::cell{#setup lang="ts"}',
        "```ts",
        'const selectedFolder = "Notes";',
        'const emphasis = "highs";',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Summary cell uses the current folder: **{{selectedFolder}}** with emphasis `{{emphasis}}`.",
        ":::",
        "",
        ':::cell{#tail lang="ts"}',
        "```ts",
        'lapis.markdown("Tail")',
        "```",
        ":::",
      ].join("\n"),
    );
    const session = new NotebookSession(initial);

    const next = createNotebook(
      initial.source.replace("with emphasis", "and emphasis"),
    );

    expect(session.updateDocument(next)).toEqual(["summary"]);
    // Only the changed cell (summary) becomes stale. Its upstream dependency
    // (setup) has not changed and its output remains valid — marking it stale
    // would cause an incorrect "stale" badge and was the root cause of the
    // Svelte effect_update_depth_exceeded crash when dependent cells were edited.
    expect(session.getCellState("setup").state).toBe("idle");
    expect(session.getCellState("summary").state).toBe("stale");
    // tail does not depend on summary, so it remains unchanged
    expect(session.getCellState("tail").state).toBe("idle");
  });

  test("preserves running timing metadata across unchanged document refreshes", () => {
    const initial = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
      ].join("\n"),
    );
    const session = new NotebookSession(initial);

    session.markRunning("load", "Running load");
    const before = session.getCellState("load");

    expect(session.updateDocument(createNotebook(initial.source))).toEqual([]);

    const after = session.getCellState("load");
    expect(after.state).toBe("running");
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.scheduledAt).toBe(before.scheduledAt);
    expect(after.statusMessage).toBe("Running load");
  });

  test("refreshes unchanged documents with BigInt SQL outputs", () => {
    const initial = createNotebook(
      [
        ':::cell{#query lang="sql"}',
        "```sql",
        "SELECT 1 AS value",
        "```",
        ":::",
      ].join("\n"),
    );
    const session = new NotebookSession(initial);

    session.restorePersistedState({
      query: {
        state: "completed",
        outputs: [
          {
            kind: "table",
            columns: ["value"],
            rows: [[1n]],
          },
        ],
      } as any,
    });

    expect(session.updateDocument(createNotebook(initial.source))).toEqual([]);
    expect(session.getCellState("query").state).toBe("completed");
  });

  test("restores persisted state with a single execution change notification", () => {
    const initial = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
    );
    const onChange = vi.fn();
    const session = new NotebookSession(initial, onChange);

    session.restorePersistedState({
      load: {
        state: "completed",
        outputs: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
      } as any,
      summary: {
        state: "completed",
        outputs: [{ kind: "markdown", markdown: "Summary" }],
      } as any,
    });

    expect(session.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
    });
    expect(session.getCellState("summary")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Summary" }],
    });
    expect(session.hasHydratedPersistedState()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("execution");
  });
});
