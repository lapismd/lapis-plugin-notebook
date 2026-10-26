<script lang="ts">
  import NotebookIcon from "../render/notebook-icon.svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Database from "@lucide/svelte/icons/database";
  import FunctionSquare from "@lucide/svelte/icons/function-square";
  import Search from "@lucide/svelte/icons/search";
  import type { MetadataType } from "@lapis-notes/api";
  import type {
    NotebookInspectorSchema,
    NotebookInspectorSnapshot,
    NotebookInspectorTable,
    NotebookInspectorTablePreview,
    NotebookInspectorVariable,
  } from "./notebook-inspector-data";

  let {
    snapshot = null,
    loading = false,
    onNavigateToCell = undefined,
    onLoadTablePreview = undefined,
  }: {
    snapshot?: NotebookInspectorSnapshot | null;
    loading?: boolean;
    onNavigateToCell?: ((cellId: string) => void | Promise<void>) | undefined;
    onLoadTablePreview?:
      | ((
          table: NotebookInspectorTable,
        ) => Promise<NotebookInspectorTablePreview | null>)
      | undefined;
  } = $props();

  let dataSourceSearch = $state("");
  let variableSearch = $state("");
  let previewVisibility = $state<Record<string, boolean>>({});
  let previewLoading = $state<Record<string, boolean>>({});
  let tablePreviews = $state<
    Record<string, NotebookInspectorTablePreview | null | undefined>
  >({});

  const dataSourceCount = $derived(
    snapshot?.dataSources.reduce(
      (count, schema) => count + schema.tables.length,
      0,
    ) ?? 0,
  );

  const filteredSchemas = $derived.by(() => {
    if (!snapshot) {
      return [] as NotebookInspectorSchema[];
    }

    const query = dataSourceSearch.trim().toLowerCase();
    if (!query) {
      return snapshot.dataSources;
    }

    return snapshot.dataSources
      .map((schema) => ({
        ...schema,
        tables: schema.tables.filter((table) => {
          if (schema.name.toLowerCase().includes(query)) {
            return true;
          }
          if (table.name.toLowerCase().includes(query)) {
            return true;
          }
          return table.columns.some(
            (column) =>
              column.name.toLowerCase().includes(query) ||
              column.dataType.toLowerCase().includes(query),
          );
        }),
      }))
      .filter((schema) => schema.tables.length > 0);
  });

  const filteredVariables = $derived.by(() => {
    if (!snapshot) {
      return [] as NotebookInspectorVariable[];
    }

    const query = variableSearch.trim().toLowerCase();
    if (!query) {
      return snapshot.variables;
    }

    return snapshot.variables.filter(
      (variable) =>
        variable.name.toLowerCase().includes(query) ||
        variable.declaredBy.some((cellId) =>
          cellId.toLowerCase().includes(query),
        ) ||
        variable.usedBy.some((cellId) => cellId.toLowerCase().includes(query)),
    );
  });

  function tableKey(table: NotebookInspectorTable): string {
    return `${table.schema}.${table.name}`;
  }

  async function toggleTablePreview(
    table: NotebookInspectorTable,
  ): Promise<void> {
    const key = tableKey(table);
    const nextVisible = !previewVisibility[key];
    previewVisibility = { ...previewVisibility, [key]: nextVisible };
    if (
      !nextVisible ||
      tablePreviews[key] !== undefined ||
      !onLoadTablePreview
    ) {
      return;
    }

    previewLoading = { ...previewLoading, [key]: true };
    try {
      tablePreviews = {
        ...tablePreviews,
        [key]: await onLoadTablePreview(table),
      };
    } finally {
      previewLoading = { ...previewLoading, [key]: false };
    }
  }

  function navigateToCell(cellId: string): void {
    void onNavigateToCell?.(cellId);
  }

  function formatRowCount(rowCount: number | null): string {
    return rowCount === null
      ? "rows unknown"
      : `${rowCount.toLocaleString()} rows`;
  }

  function tableTypeIconName(type: NotebookInspectorTable["type"]): string[] {
    return type === "view"
      ? ["lucide-eye", "lucide-database"]
      : ["lucide-table", "lucide-database"];
  }

  function normalizeColumnMetadataType(dataType: string): MetadataType {
    const normalizedType = dataType.trim().toUpperCase();

    if (normalizedType.includes("BOOL") || normalizedType === "BOOLEAN") {
      return "checkbox";
    }

    if (
      normalizedType.includes("TIMESTAMP") ||
      normalizedType.includes("DATETIME")
    ) {
      return "datetime";
    }

    if (normalizedType.includes("DATE") || normalizedType.includes("TIME")) {
      return "date";
    }

    if (
      /(INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC|SERIAL|HUGEINT|BIGINT|SMALLINT|TINYINT)/.test(
        normalizedType,
      )
    ) {
      return "number";
    }

    if (/(ARRAY|LIST)/.test(normalizedType)) {
      return "multitext";
    }

    if (/(JSON|STRUCT|MAP|UNION|OBJECT)/.test(normalizedType)) {
      return "unknown";
    }

    return "text";
  }

  function metadataTypeIconName(type: MetadataType): string {
    const app = (
      globalThis as {
        app?: {
          metadataTypeManager?: {
            registeredTypeWidgets?: Record<string, { icon?: string }>;
          };
        };
      }
    ).app;

    return (
      app?.metadataTypeManager?.registeredTypeWidgets?.[type]?.icon ??
      "lucide-file"
    );
  }

  function columnTypeIconName(dataType: string): string[] {
    return [
      metadataTypeIconName(normalizeColumnMetadataType(dataType)),
      "lucide-file",
    ];
  }
</script>

<div
  class="notebook-inspector notebook-inspector__ge62249fa"
  data-testid="notebook-inspector-panel"
>
  {#if !snapshot}
    <div class="notebook-inspector__g47990fce">
      {#if loading}
        Loading notebook session...
      {:else}
        Open a notebook note in the active leaf to populate this panel.
      {/if}
    </div>
  {:else}
    <div class="notebook-inspector__gcda219e0">
      <section class="notebook-inspector__section notebook-inspector__g50b7a829">
        <details open>
          <summary
            class="notebook-inspector__gd430d0d4"
          >
            <span class="notebook-inspector__g557bb361">
              <Database class="notebook-inspector__g93809e27" />
              Data Sources
            </span>
            <span class="notebook-inspector__g455c6595"
              >{dataSourceCount}</span
            >
          </summary>

          <div class="notebook-inspector__gd827a466">
            <label
              class="notebook-inspector__ge27ba36c"
            >
              <Search class="notebook-inspector__g1a559052" />
              <input
                bind:value={dataSourceSearch}
                class="notebook-inspector__ge3adcd04"
                placeholder="Search tables or columns..."
              />
            </label>

            {#if filteredSchemas.length === 0}
              <div
                class="notebook-inspector__gba40a405"
              >
                {#if snapshot?.usesDuckDb}
                  Run a DuckDB-backed cell to populate live tables and schemas.
                {:else}
                  No DuckDB-backed cells are defined in this notebook.
                {/if}
              </div>
            {:else}
              <div class="notebook-inspector__g6f7e013d">
                {#each filteredSchemas as schema}
                  <details
                    open
                    class="notebook-inspector__g77f19bae"
                  >
                    <summary
                      class="notebook-inspector__g0e24483d"
                    >
                      <span class="notebook-inspector__gacadca05">{schema.name}</span>
                      <span class="notebook-inspector__g455c6595"
                        >{schema.tables.length} tables</span
                      >
                    </summary>
                    <div class="notebook-inspector__gf43ebe62">
                      {#each schema.tables as table}
                        <details
                          class="inspector-table-row notebook-inspector__g22dc590a"
                        >
                          <summary
                            class="notebook-inspector__g30127975"
                          >
                            <div class="notebook-inspector__gc7ffdf05">
                              <span
                                class="table-row-toggle notebook-inspector__g41a8ac32"
                              >
                                <ChevronDown class="notebook-inspector__g783b0d9d" />
                              </span>
                              <span class="notebook-inspector__g39a618a7">
                                <NotebookIcon
                                  name={tableTypeIconName(table.type)}
                                  class="notebook-inspector__g783b0d9d"
                                />
                              </span>
                              <div class="notebook-inspector__g4740b55e">
                                {table.name}
                              </div>
                            </div>
                            <span
                              class="notebook-inspector__gfef55325"
                            >
                              {table.columns.length} columns · {formatRowCount(
                                table.rowCount,
                              )}
                            </span>
                          </summary>
                          <div
                            class="notebook-inspector__ge15e93f6"
                          >
                            <div class="notebook-inspector__g1fe9d0e9">
                              <span
                                class="notebook-inspector__gcfae30a0"
                              >
                                {formatRowCount(table.rowCount)}
                              </span>
                              <button
                                type="button"
                                class="notebook-inspector__g70d69d8d"
                                onclick={() => toggleTablePreview(table)}
                              >
                                {previewVisibility[tableKey(table)]
                                  ? "Hide preview"
                                  : "Show preview"}
                              </button>
                            </div>

                            {#if previewVisibility[tableKey(table)]}
                              <div
                                class="notebook-inspector__gd138d1da"
                              >
                                {#if previewLoading[tableKey(table)]}
                                  <div class="notebook-inspector__g455c6595">
                                    Loading preview...
                                  </div>
                                {:else if tablePreviews[tableKey(table)] === null}
                                  <div class="notebook-inspector__g455c6595">
                                    Preview unavailable for this table.
                                  </div>
                                {:else if tablePreviews[tableKey(table)]?.rows.length === 0}
                                  <div class="notebook-inspector__g455c6595">
                                    No rows available.
                                  </div>
                                {:else if tablePreviews[tableKey(table)]}
                                  <div class="notebook-inspector__gdbc4b4af">
                                    <table
                                      class="notebook-inspector__g85df5054"
                                    >
                                      <thead>
                                        <tr>
                                          {#each tablePreviews[tableKey(table)]?.columns ?? [] as columnName}
                                            <th
                                              class="notebook-inspector__gec9b93f0"
                                              >{columnName}</th
                                            >
                                          {/each}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {#each tablePreviews[tableKey(table)]?.rows ?? [] as row}
                                          <tr>
                                            {#each row as value}
                                              <td
                                                class="notebook-inspector__ge2ba2d4f"
                                                >{value === null
                                                  ? "null"
                                                  : String(value)}</td
                                              >
                                            {/each}
                                          </tr>
                                        {/each}
                                      </tbody>
                                    </table>
                                    {#if tablePreviews[tableKey(table)]?.truncated}
                                      <div
                                        class="notebook-inspector__g4ef2daec"
                                      >
                                        Preview limited to the first 5 rows.
                                      </div>
                                    {/if}
                                  </div>
                                {/if}
                              </div>
                            {/if}

                            <div class="notebook-inspector__g73fc3fb1">
                              <table
                                class="notebook-inspector__gb856e76c"
                              >
                                <thead>
                                  <tr>
                                    <th
                                      class="notebook-inspector__g65721338"
                                      >Column</th
                                    >
                                    <th
                                      class="notebook-inspector__g65721338"
                                      >Type</th
                                    >
                                    <th
                                      class="notebook-inspector__gcc2fb45b"
                                      >Null</th
                                    >
                                  </tr>
                                </thead>
                                <tbody>
                                  {#each table.columns as column}
                                    <tr>
                                      <td
                                        class="notebook-inspector__g0411ba99"
                                      >
                                        <div
                                          class="notebook-inspector__g8e84a8ec"
                                        >
                                          <span
                                            class="notebook-inspector__g39a618a7"
                                          >
                                            <NotebookIcon
                                              name={columnTypeIconName(
                                                column.dataType,
                                              )}
                                              class="notebook-inspector__g783b0d9d"
                                            />
                                          </span>
                                          <span>{column.name}</span>
                                        </div>
                                      </td>
                                      <td
                                        class="notebook-inspector__g4c8db350"
                                        >{column.dataType}</td
                                      >
                                      <td
                                        class="notebook-inspector__g7cdd39dc"
                                        >{column.nullable ? "yes" : "no"}</td
                                      >
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </details>
                      {/each}
                    </div>
                  </details>
                {/each}
              </div>
            {/if}
          </div>
        </details>
      </section>

      <section class="notebook-inspector__g0e9cd2e4">
        <details open>
          <summary
            class="notebook-inspector__gd430d0d4"
          >
            <span class="notebook-inspector__g557bb361">
              <FunctionSquare class="notebook-inspector__g93809e27" />
              Variables
            </span>
            <span class="notebook-inspector__g455c6595"
              >{snapshot?.variables.length ?? 0}</span
            >
          </summary>

          <div class="notebook-inspector__gd827a466">
            <label
              class="notebook-inspector__ge27ba36c"
            >
              <Search class="notebook-inspector__g1a559052" />
              <input
                bind:value={variableSearch}
                class="notebook-inspector__ge3adcd04"
                placeholder="Search variables or cell ids..."
              />
            </label>

            {#if filteredVariables.length === 0}
              <div
                class="notebook-inspector__gba40a405"
              >
                No notebook variables were found in this note.
              </div>
            {:else}
              <div
                class="notebook-inspector__gcbdc8e1b"
              >
                <table class="notebook-inspector__gb856e76c">
                  <thead>
                    <tr>
                      <th
                        class="notebook-inspector__g90db77c2"
                        >Name</th
                      >
                      <th
                        class="notebook-inspector__g90db77c2"
                        >Declared By</th
                      >
                      <th
                        class="notebook-inspector__g90db77c2"
                        >Used By</th
                      >
                    </tr>
                  </thead>
                  <tbody>
                    {#each filteredVariables as variable}
                      <tr class:duplicate-row={variable.duplicate}>
                        <td
                          class="notebook-inspector__gc8683f9f"
                        >
                          <div class="notebook-inspector__ge3039363">
                            {variable.name}
                          </div>
                          {#if variable.duplicate}
                            <div class="notebook-inspector__g31a6e6e8">
                              multiple declarations
                            </div>
                          {/if}
                        </td>
                        <td
                          class="notebook-inspector__gc8683f9f"
                        >
                          <div class="notebook-inspector__g52aaeda0">
                            {#each variable.declaredBy as cellId}
                              <button
                                type="button"
                                class="notebook-inspector__gc79bfc65"
                                onclick={() => navigateToCell(cellId)}
                              >
                                {cellId}
                              </button>
                            {/each}
                          </div>
                        </td>
                        <td
                          class="notebook-inspector__gc8683f9f"
                        >
                          {#if variable.usedBy.length === 0}
                            <span class="notebook-inspector__g455c6595"
                              >unused</span
                            >
                          {:else}
                            <div class="notebook-inspector__g52aaeda0">
                              {#each variable.usedBy as cellId}
                                <button
                                  type="button"
                                  class="notebook-inspector__gc79bfc65"
                                  onclick={() => navigateToCell(cellId)}
                                >
                                  {cellId}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        </details>
      </section>
    </div>
  {/if}
</div>

<style>
  summary::-webkit-details-marker {
    display: none;
  }

  .inspector-table-row:not([open]) .table-row-toggle {
    transform: rotate(-90deg);
  }

  .duplicate-row {
    background: color-mix(
      in srgb,
      var(--background-primary-alt) 82%,
      var(--color-red) 18%
    );
  }
</style>
