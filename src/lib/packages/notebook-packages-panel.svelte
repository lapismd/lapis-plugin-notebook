<script lang="ts">
  import { tick } from "svelte";
  import Package from "@lucide/svelte/icons/package";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@lapismd/design-core/shadcn/card";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import { Search } from "@lapis-notes/ui/search";
  import { Separator } from "@lapismd/design-core/shadcn/separator";
  import type { NotebookUserDependencyDescriptor } from "@lapis-notes/notebook-stdlib";
  import type { NotebookPackageSearchResult } from "./notebook-package-registry";
  import type {
    NotebookPackageEntry,
    NotebookPackagesSnapshot,
  } from "./notebook-packages-data";

  let {
    snapshot = null,
    loading = false,
    onInstallPackage = undefined,
    onUpdatePackage = undefined,
    onSearchPackages = undefined,
    onUninstallPackage = undefined,
  }: {
    snapshot?: NotebookPackagesSnapshot | null;
    loading?: boolean;
    onInstallPackage?:
      | ((
          dependency: NotebookUserDependencyDescriptor,
          onProgress?: (message: string) => void,
        ) => Promise<void>)
      | undefined;
    onUpdatePackage?:
      | ((
          entryIndex: number,
          dependency: NotebookUserDependencyDescriptor,
          onProgress?: (message: string) => void,
        ) => Promise<void>)
      | undefined;
    onSearchPackages?:
      | ((query: string) => Promise<NotebookPackageSearchResult[]>)
      | undefined;
    onUninstallPackage?: ((entryIndex: number) => Promise<void>) | undefined;
  } = $props();

  let selectedId = $state<string | null>(null);
  let query = $state("");
  let packageSearchQuery = $state("");
  let selectedSuggestionPackageName = $state<string | null>(null);
  let packageName = $state("");
  let version = $state("");
  let globalName = $state("");
  let installError = $state<string | null>(null);
  let installPending = $state(false);
  let installMode = $state<"search" | "custom" | null>(null);
  let installProgressMessage = $state<string | null>(null);
  let uninstalling = $state<Record<number, boolean>>({});
  let updating = $state<Record<number, boolean>>({});
  let packageSuggestions = $state<NotebookPackageSearchResult[]>([]);
  let packageSearchPending = $state(false);
  let packageSearchError = $state<string | null>(null);
  let packageSearchToken = 0;
  let customInstallSectionEl = $state<HTMLDetailsElement | null>(null);
  let customInstallFormEl = $state<HTMLFormElement | null>(null);
  let initializedSectionStateSourcePath = $state<string | null>(null);
  let previousDirectImportsCount = $state<number | null>(null);
  let previousIndirectImportsCount = $state<number | null>(null);
  let previousAvailableImportsCount = $state<number | null>(null);
  let directImportsOpen = $state(true);
  let indirectImportsOpen = $state(true);
  let availableImportsOpen = $state(true);

  type NotebookPackageSuggestionEntry = {
    result: NotebookPackageSearchResult;
    installedEntry: NotebookPackageEntry | null;
    hasUpdate: boolean;
  };

  const filteredSnapshot = $derived.by(() => {
    if (!snapshot) {
      return null;
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return snapshot;
    }

    const filterEntries = (entries: readonly NotebookPackageEntry[]) =>
      entries.filter((entry) => {
        return (
          entry.packageName.toLowerCase().includes(normalizedQuery) ||
          entry.version.toLowerCase().includes(normalizedQuery) ||
          (entry.globalName ?? "").toLowerCase().includes(normalizedQuery) ||
          (entry.resolver?.kind ?? "")
            .toLowerCase()
            .includes(normalizedQuery) ||
          entry.issueMessages.some((message) =>
            message.toLowerCase().includes(normalizedQuery),
          )
        );
      });

    return {
      ...snapshot,
      directImports: filterEntries(snapshot.directImports),
      indirectImports: filterEntries(snapshot.indirectImports),
      availableImports: filterEntries(snapshot.availableImports),
    } satisfies NotebookPackagesSnapshot;
  });

  const entriesInDisplayOrder = $derived.by(() => {
    if (!filteredSnapshot) {
      return [] as NotebookPackageEntry[];
    }

    return [
      ...filteredSnapshot.directImports,
      ...filteredSnapshot.indirectImports,
      ...filteredSnapshot.availableImports,
    ];
  });

  const installedEntriesByPackageName = $derived.by(() => {
    const installedEntries = snapshot?.availableImports ?? [];
    return new Map(
      installedEntries.map((entry) => [entry.packageName.toLowerCase(), entry]),
    );
  });

  const selectedEntry = $derived.by(() => {
    if (!selectedId) {
      return null;
    }

    return (
      entriesInDisplayOrder.find((entry) => entry.id === selectedId) ?? null
    );
  });

  const hasActiveNotebook = $derived(
    filteredSnapshot?.hasActiveNotebook ?? false,
  );

  const suggestionEntries = $derived.by(() => {
    return packageSuggestions.map((result) => {
      const installedEntry =
        installedEntriesByPackageName.get(result.packageName.toLowerCase()) ??
        null;
      return {
        result,
        installedEntry,
        hasUpdate: installedEntry
          ? installedEntry.version !== result.latestVersion
          : false,
      } satisfies NotebookPackageSuggestionEntry;
    });
  });

  $effect(() => {
    if (!selectedId) {
      return;
    }

    if (!entriesInDisplayOrder.some((entry) => entry.id === selectedId)) {
      selectedId = null;
    }
  });

  $effect(() => {
    const query = packageSearchQuery.trim();
    packageSearchError = null;

    if (!onSearchPackages || query.length < 2) {
      packageSuggestions = [];
      packageSearchPending = false;
      selectedSuggestionPackageName = null;
      return;
    }

    const currentToken = ++packageSearchToken;
    packageSearchPending = true;
    const timeout = setTimeout(() => {
      void onSearchPackages(query)
        .then((results) => {
          if (currentToken !== packageSearchToken) {
            return;
          }
          packageSuggestions = results;
          packageSearchPending = false;
        })
        .catch((error) => {
          if (currentToken !== packageSearchToken) {
            return;
          }
          packageSuggestions = [];
          packageSearchPending = false;
          packageSearchError =
            error instanceof Error ? error.message : "Package search failed.";
        });
    }, 180);

    return () => {
      clearTimeout(timeout);
    };
  });

  $effect(() => {
    if (!selectedSuggestionPackageName) {
      return;
    }

    if (
      !packageSuggestions.some(
        (result) => result.packageName === selectedSuggestionPackageName,
      )
    ) {
      selectedSuggestionPackageName = null;
    }
  });

  $effect(() => {
    if (!snapshot) {
      initializedSectionStateSourcePath = null;
      previousDirectImportsCount = null;
      previousIndirectImportsCount = null;
      previousAvailableImportsCount = null;
      return;
    }

    const nextDirectImportsCount = snapshot.directImports.length;
    const nextIndirectImportsCount = snapshot.indirectImports.length;
    const nextAvailableImportsCount = snapshot.availableImports.length;

    if (initializedSectionStateSourcePath === snapshot.sourcePath) {
      if (
        (previousDirectImportsCount ?? 0) === 0 &&
        nextDirectImportsCount > 0
      ) {
        directImportsOpen = true;
      }
      if (
        (previousIndirectImportsCount ?? 0) === 0 &&
        nextIndirectImportsCount > 0
      ) {
        indirectImportsOpen = true;
      }
      if (
        (previousAvailableImportsCount ?? 0) === 0 &&
        nextAvailableImportsCount > 0
      ) {
        availableImportsOpen = true;
      }

      previousDirectImportsCount = nextDirectImportsCount;
      previousIndirectImportsCount = nextIndirectImportsCount;
      previousAvailableImportsCount = nextAvailableImportsCount;
      return;
    }

    initializedSectionStateSourcePath = snapshot.sourcePath;
    directImportsOpen = nextDirectImportsCount > 0;
    indirectImportsOpen = nextIndirectImportsCount > 0;
    availableImportsOpen = nextAvailableImportsCount > 0;
    previousDirectImportsCount = nextDirectImportsCount;
    previousIndirectImportsCount = nextIndirectImportsCount;
    previousAvailableImportsCount = nextAvailableImportsCount;
  });

  async function installDependency(
    dependency: NotebookUserDependencyDescriptor,
    mode: "search" | "custom",
    options: { clearCustomForm?: boolean } = {},
  ): Promise<void> {
    installError = null;
    installProgressMessage = null;
    installMode = mode;
    installPending = true;
    try {
      await onInstallPackage?.(dependency, (message) => {
        installProgressMessage = message;
      });
      if (options.clearCustomForm) {
        clearCustomInstallForm();
      }
      selectedSuggestionPackageName = dependency.packageName;
      packageSearchError = null;
      installProgressMessage = null;
    } catch (error) {
      installError =
        error instanceof Error ? error.message : "Failed to add package.";
    } finally {
      installPending = false;
      installMode = null;
    }
  }

  async function installPackage(): Promise<void> {
    const nextPackageName = packageName.trim();
    const nextVersion = version.trim();
    const nextGlobalName = globalName.trim();

    if (!nextPackageName || !nextVersion) {
      installError = "Package name and pinned version are required.";
      return;
    }

    await installDependency(
      {
        packageName: nextPackageName,
        version: nextVersion,
        ...(nextGlobalName ? { globalName: nextGlobalName } : {}),
      },
      "custom",
      { clearCustomForm: true },
    );
  }

  async function installSuggestedPackage(
    result: NotebookPackageSearchResult,
  ): Promise<void> {
    await installDependency(
      {
        packageName: result.packageName,
        version: result.latestVersion,
      },
      "search",
    );
  }

  async function updatePackage(
    entry: NotebookPackageEntry,
    dependency: NotebookUserDependencyDescriptor,
  ): Promise<void> {
    if (entry.entryIndex == null) {
      return;
    }

    installError = null;
    installProgressMessage = null;
    updating = { ...updating, [entry.entryIndex]: true };
    try {
      await onUpdatePackage?.(entry.entryIndex, dependency, (message) => {
        installProgressMessage = message;
      });
      packageName = dependency.packageName;
      version = dependency.version;
      globalName = dependency.globalName ?? "";
      packageSearchError = null;
      installProgressMessage = null;
    } catch (error) {
      installError =
        error instanceof Error ? error.message : "Failed to update package.";
    } finally {
      updating = { ...updating, [entry.entryIndex]: false };
    }
  }

  async function uninstallPackage(entry: NotebookPackageEntry): Promise<void> {
    if (entry.entryIndex == null) {
      return;
    }

    uninstalling = { ...uninstalling, [entry.entryIndex]: true };
    try {
      await onUninstallPackage?.(entry.entryIndex);
    } finally {
      uninstalling = { ...uninstalling, [entry.entryIndex]: false };
    }
  }

  function selectEntry(entry: NotebookPackageEntry): void {
    selectedId = entry.id;
  }

  function toggleEntrySelection(entry: NotebookPackageEntry): void {
    selectedId = selectedId === entry.id ? null : entry.id;
  }

  function clearCustomInstallForm(): void {
    packageName = "";
    version = "";
    globalName = "";
  }

  function selectSuggestion(
    result: NotebookPackageSearchResult,
    installedEntry: NotebookPackageEntry | null = null,
  ): void {
    selectedSuggestionPackageName = result.packageName;
    if (installedEntry) {
      selectEntry(installedEntry);
    }
    packageSearchError = null;
  }

  async function populateCustomInstallForm(
    result: NotebookPackageSearchResult,
  ): Promise<void> {
    packageName = result.packageName;
    version = result.latestVersion;
    globalName = "";
    customInstallSectionEl?.setAttribute("open", "");
    await tick();
    customInstallSectionEl?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
    customInstallFormEl?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }

  function sectionCount(entries: readonly NotebookPackageEntry[]): string {
    return entries.length.toString();
  }

  function entryMeta(entry: NotebookPackageEntry): string {
    if (entry.kind === "indirect") {
      return `${entry.version} • via ${entry.requiredByPackageNames.join(", ")}`;
    }
    return `${entry.globalName ?? "(no global)"} • ${entry.version}`;
  }

  function suggestionMeta(suggestion: NotebookPackageSuggestionEntry): string {
    if (!suggestion.installedEntry) {
      return `Latest ${suggestion.result.latestVersion}`;
    }

    const globalDescriptor = suggestion.installedEntry.globalName
      ? `as ${suggestion.installedEntry.globalName}`
      : "without a global override";

    return `Installed ${globalDescriptor} • current ${suggestion.installedEntry.version} • latest ${suggestion.result.latestVersion}`;
  }

  function isSelectedSuggestion(
    suggestion: NotebookPackageSuggestionEntry,
  ): boolean {
    return selectedSuggestionPackageName === suggestion.result.packageName;
  }

  function statusBadgeVariant(
    status: NotebookPackageEntry["status"],
  ): "secondary" | "destructive" | "outline" {
    if (status === "invalid") {
      return "destructive";
    }

    if (status === "configured") {
      return "secondary";
    }

    return "outline";
  }
</script>

<div
  class="notebook-packages notebook-packages__ge62249fa"
  data-testid="notebook-packages-panel"
>
  <header class="notebook-packages__header notebook-packages__g50b7a829">
    <Search
      bind:value={query}
      placeholder="Filter packages"
      className="w-full"
    />
  </header>

  {#if loading}
    <div
      class="notebook-packages__gddc7d27e"
    >
      Loading packages...
    </div>
  {:else}
    <div
      class={`notebook-packages__layout${selectedEntry ? " notebook-packages__layout--with-detail" : ""}`}
    >
      <div class="notebook-packages__master notebook-packages__gfb7302e5">
        <ScrollArea class="notebook-packages__g52e5207a">
          {#if filteredSnapshot}
            {#if hasActiveNotebook}
              <details
                bind:open={directImportsOpen}
                class="notebook-packages__section notebook-packages__g65fdbade"
              >
                <summary
                  class="notebook-packages__gbf4b43ce"
                >
                  <span class="notebook-packages__gacadca05">Direct Imports</span>
                  <span class="notebook-packages__g455c6595"
                    >{sectionCount(filteredSnapshot.directImports)}</span
                  >
                </summary>
                <div class="notebook-packages__g04d0c9f1">
                  {#if filteredSnapshot.directImports.length === 0}
                    <div
                      class="notebook-packages__gba40a405"
                    >
                      No configured package globals are referenced by this
                      notebook.
                    </div>
                  {:else}
                    <div class="notebook-packages__g6f7e013d">
                      {#each filteredSnapshot.directImports as entry (entry.id)}
                        <button
                          type="button"
                          class={`notebook-packages__entry notebook-packages__entry--button${selectedEntry?.id === entry.id ? " notebook-packages__entry--selected" : ""}`}
                          onclick={() => toggleEntrySelection(entry)}
                        >
                          <span class="notebook-packages__gf99b3858"
                            >{entry.packageName}</span
                          >
                          <span
                            class="notebook-packages__ge5c6c71d"
                            >{entryMeta(entry)}</span
                          >
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </details>

              <details
                bind:open={indirectImportsOpen}
                class="notebook-packages__section notebook-packages__g65fdbade"
              >
                <summary
                  class="notebook-packages__gbf4b43ce"
                >
                  <span class="notebook-packages__gacadca05">Indirect Imports</span>
                  <span class="notebook-packages__g455c6595"
                    >{sectionCount(filteredSnapshot.indirectImports)}</span
                  >
                </summary>
                <div class="notebook-packages__g04d0c9f1">
                  {#if filteredSnapshot.indirectImports.length === 0}
                    <div
                      class="notebook-packages__gba40a405"
                    >
                      {filteredSnapshot.indirectImportsStatus.message}
                    </div>
                  {:else}
                    <div class="notebook-packages__g6f7e013d">
                      {#each filteredSnapshot.indirectImports as entry (entry.id)}
                        <button
                          type="button"
                          class={`notebook-packages__entry notebook-packages__entry--button${selectedEntry?.id === entry.id ? " notebook-packages__entry--selected" : ""}`}
                          onclick={() => toggleEntrySelection(entry)}
                        >
                          <span class="notebook-packages__gf99b3858"
                            >{entry.packageName}</span
                          >
                          <span
                            class="notebook-packages__ge5c6c71d"
                            >{entryMeta(entry)}</span
                          >
                        </button>
                      {/each}
                    </div>

                    {#if filteredSnapshot.indirectImportsStatus.kind === "error"}
                      <p class="notebook-packages__g6006dca1">
                        {filteredSnapshot.indirectImportsStatus.message}
                      </p>
                    {/if}
                  {/if}
                </div>
              </details>
            {/if}

            <details
              bind:open={availableImportsOpen}
              class="notebook-packages__section notebook-packages__g65fdbade"
            >
              <summary
                class="notebook-packages__gbf4b43ce"
              >
                <span class="notebook-packages__gacadca05">Available Imports</span>
                <span class="notebook-packages__g455c6595"
                  >{sectionCount(filteredSnapshot.availableImports)}</span
                >
              </summary>
              <div class="notebook-packages__g7f645481">
                {#if filteredSnapshot.availableImports.length === 0}
                  <div
                    class="notebook-packages__gba40a405"
                  >
                    No packages have been configured yet.
                  </div>
                {:else}
                  <div class="notebook-packages__g6f7e013d">
                    {#each filteredSnapshot.availableImports as entry (entry.id)}
                      <div
                        class={`notebook-packages__entry notebook-packages__available-entry${selectedEntry?.id === entry.id ? " notebook-packages__available-entry--selected" : ""}`}
                      >
                        <button
                          type="button"
                          class="notebook-packages__gf08a5fa8"
                          onclick={() => toggleEntrySelection(entry)}
                        >
                          <div class="notebook-packages__item-content notebook-packages__g44ee8ba0">
                            <div class="notebook-packages__item-title notebook-packages__gf40fe239">{entry.packageName}</div
                            >
                            <div class="notebook-packages__item-desc notebook-packages__gec4c0f04">{entryMeta(entry)}</div
                            >
                          </div>
                        </button>
                        <div class="notebook-packages__item-actions notebook-packages__g269c109b">
                          <Button
                            variant="ghost"
                            size="icon"
                            class="notebook-packages__gd8f5213f"
                            aria-label={`Uninstall ${entry.packageName}`}
                            title={`Uninstall ${entry.packageName}`}
                            disabled={entry.entryIndex == null
                              ? true
                              : uninstalling[entry.entryIndex]}
                            onclick={() => uninstallPackage(entry)}
                          >
                            <Trash2 class="notebook-packages__g783b0d9d" />
                          </Button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </details>
          {/if}

          <details open class="notebook-packages__section notebook-packages__g65fdbade">
            <summary
              class="notebook-packages__gbf4b43ce"
            >
              <span class="notebook-packages__gacadca05">Search Packages</span>
              <span class="notebook-packages__g455c6595">npm registry</span>
            </summary>
            <div class="notebook-packages__g7f645481">
              <div class="notebook-packages__gc7bd35e7">
                <label
                  class="notebook-packages__ge178638b"
                  for="packages-search-query">Package name</label
                >
                <Input
                  bind:value={packageSearchQuery}
                  id="packages-search-query"
                  placeholder="Search packages"
                  type="text"
                />
              </div>

              {#if packageSearchPending}
                <div class="notebook-packages__ge70d644a">
                  Searching packages...
                </div>
              {:else if packageSearchError}
                <div class="notebook-packages__gd3c65736">{packageSearchError}</div>
              {:else if suggestionEntries.length > 0}
                <div
                  class="notebook-packages__suggestions notebook-packages__g27243798"
                  role="listbox"
                  aria-label="Package suggestions"
                >
                  {#each suggestionEntries as suggestion, index (suggestion.result.packageName)}
                    <div
                      class={`notebook-packages__suggestion${index === suggestionEntries.length - 1 ? " notebook-packages__suggestion--last" : ""}${isSelectedSuggestion(suggestion) ? " notebook-packages__suggestion--selected" : ""}`}
                    >
                      <button
                        type="button"
                        class="notebook-packages__g3d976322"
                        onclick={() =>
                          selectSuggestion(
                            suggestion.result,
                            suggestion.installedEntry,
                          )}
                      >
                        <div class="notebook-packages__item-content notebook-packages__g44ee8ba0">
                          <div class="notebook-packages__gc7ffdf05">
                            <div class="notebook-packages__item-title notebook-packages__gf40fe239">{suggestion.result.packageName}</div
                            >
                            {#if suggestion.installedEntry}
                              <Badge variant="outline" class="notebook-packages__g012fbd12"
                                >Installed</Badge
                              >
                            {/if}
                          </div>
                          <div class="notebook-packages__item-desc notebook-packages__gec4c0f04">{suggestionMeta(suggestion)}</div
                          >
                          {#if suggestion.result.description}
                            <div class="notebook-packages__item-desc notebook-packages__gec4c0f04">{suggestion.result.description}</div
                            >
                          {/if}

                          {#if !suggestion.installedEntry && isSelectedSuggestion(suggestion)}
                            <div class="notebook-packages__g74258449">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={installPending}
                                onclick={() =>
                                  installSuggestedPackage(suggestion.result)}
                              >
                                {#if installMode === "search" && installPending}Installing...{:else}Install{/if}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={installPending}
                                onclick={() =>
                                  void populateCustomInstallForm(
                                    suggestion.result,
                                  )}
                              >
                                Customize
                              </Button>
                            </div>
                          {/if}
                        </div>
                      </button>

                      {#if suggestion.installedEntry}
                        {@const installedEntry = suggestion.installedEntry}
                        <div class="notebook-packages__item-actions notebook-packages__g3a285b5a">
                          {#if suggestion.hasUpdate}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={installedEntry.entryIndex == null
                                ? true
                                : updating[installedEntry.entryIndex]}
                              onclick={() =>
                                updatePackage(installedEntry, {
                                  packageName: suggestion.result.packageName,
                                  version: suggestion.result.latestVersion,
                                  ...(installedEntry.globalName
                                    ? { globalName: installedEntry.globalName }
                                    : {}),
                                })}
                            >
                              <RefreshCw class="notebook-packages__g783b0d9d" />
                              {#if installedEntry.entryIndex != null && updating[installedEntry.entryIndex]}Updating...{:else}Update{/if}
                            </Button>
                          {:else}
                            <Badge variant="secondary">Up to date</Badge>
                          {/if}

                          <Button
                            variant="ghost"
                            size="icon"
                            class="notebook-packages__gd8f5213f"
                            aria-label={`Uninstall ${suggestion.result.packageName}`}
                            title={`Uninstall ${suggestion.result.packageName}`}
                            disabled={installedEntry.entryIndex == null
                              ? true
                              : uninstalling[installedEntry.entryIndex]}
                            onclick={() => uninstallPackage(installedEntry)}
                          >
                            <Trash2 class="notebook-packages__g783b0d9d" />
                          </Button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else if packageSearchQuery.trim().length >= 2}
                <div
                  class="notebook-packages__gba40a405"
                >
                  No packages matched that search.
                </div>
              {/if}

              {#if installMode === "search" && installProgressMessage}
                <div class="notebook-packages__ge70d644a">
                  {installProgressMessage}
                </div>
              {/if}

              {#if installMode === "search" && installError}
                <div class="notebook-packages__gd3c65736">{installError}</div>
              {/if}
            </div>
          </details>

          <details
            bind:this={customInstallSectionEl}
            class="notebook-packages__section notebook-packages__g65fdbade"
          >
            <summary
              class="notebook-packages__gbf4b43ce"
            >
              <span class="notebook-packages__gacadca05">Install Custom Package</span>
            </summary>
            <div class="notebook-packages__g7f645481">
              <form
                bind:this={customInstallFormEl}
                class="notebook-packages__g935086ad"
                onsubmit={(event) => {
                  event.preventDefault();
                  void installPackage();
                }}
              >
                <div class="notebook-packages__gc7bd35e7">
                  <label
                    class="notebook-packages__ge178638b"
                    for="packages-package-name">Package name</label
                  >
                  <Input
                    bind:value={packageName}
                    id="packages-package-name"
                    placeholder="Package name"
                    type="text"
                  />
                </div>

                <div class="notebook-packages__g186f1e3e">
                  <div class="notebook-packages__gc7bd35e7">
                    <label
                      class="notebook-packages__ge178638b"
                      for="packages-version">Pinned version</label
                    >
                    <Input
                      bind:value={version}
                      id="packages-version"
                      placeholder="Pinned version"
                      type="text"
                    />
                  </div>

                  <div class="notebook-packages__gc7bd35e7">
                    <label
                      class="notebook-packages__ge178638b"
                      for="packages-global-name">Global name</label
                    >
                    <Input
                      bind:value={globalName}
                      id="packages-global-name"
                      placeholder="Optional override"
                      type="text"
                    />
                  </div>
                </div>

                {#if installMode === "custom" && installProgressMessage}
                  <div class="notebook-packages__ge70d644a">
                    {installProgressMessage}
                  </div>
                {/if}

                {#if installMode === "custom" && installError}
                  <div class="notebook-packages__gd3c65736">{installError}</div>
                {/if}

                <Button
                  type="submit"
                  disabled={installPending}
                  class="notebook-packages__g86843cf1"
                >
                  {#if installPending}Saving...{:else}Install package{/if}
                </Button>
              </form>
            </div>
          </details>
        </ScrollArea>
      </div>

      {#if filteredSnapshot && selectedEntry}
        <div class="notebook-packages__detail-pane notebook-packages__gfb7302e5">
          <ScrollArea class="notebook-packages__g52e5207a">
            <div class="notebook-packages__g8e63407b">
              <Card class="notebook-packages__detail notebook-packages__gf4d805cb">
                <CardHeader class="notebook-packages__gd31398ed">
                  <div class="notebook-packages__g03df711a">
                    <div
                      class="notebook-packages__icon notebook-packages__g15be57a1"
                    >
                      <Package class="notebook-packages__gf7b5fa97" />
                    </div>

                    <div class="notebook-packages__g0c9c02e5">
                      <div
                        class="notebook-packages__g2a315940"
                      >
                        Package details
                      </div>
                      <CardTitle class="notebook-packages__ga8486886"
                        >{selectedEntry.packageName}</CardTitle
                      >
                      <div class="notebook-packages__gfcceb93b">
                        {entryMeta(selectedEntry)}
                      </div>
                    </div>

                    <Badge
                      variant={statusBadgeVariant(selectedEntry.status)}
                      class="notebook-packages__gd01a3417">{selectedEntry.status}</Badge
                    >
                  </div>
                </CardHeader>

                <CardContent class="notebook-packages__g23a63520">
                  <div class="notebook-packages__g186f1e3e">
                    <div
                      class="notebook-packages__metric notebook-packages__g21260fa0"
                    >
                      <div
                        class="notebook-packages__gdeffdd63"
                      >
                        Resolver
                      </div>
                      <div class="notebook-packages__g34ca123d">
                        {selectedEntry.resolver?.kind ?? "transitive"}
                      </div>
                    </div>
                    <div
                      class="notebook-packages__metric notebook-packages__g21260fa0"
                    >
                      <div
                        class="notebook-packages__gdeffdd63"
                      >
                        Used in notebook
                      </div>
                      <div class="notebook-packages__g34ca123d">
                        {selectedEntry.usedInNotebook ? "Yes" : "No"}
                      </div>
                    </div>
                    <div
                      class="notebook-packages__metric notebook-packages__g21260fa0"
                    >
                      <div
                        class="notebook-packages__gdeffdd63"
                      >
                        Referenced cells
                      </div>
                      <div class="notebook-packages__g34ca123d">
                        {selectedEntry.referencedCellIds.length}
                      </div>
                    </div>
                    <div
                      class="notebook-packages__metric notebook-packages__g21260fa0"
                    >
                      <div
                        class="notebook-packages__gdeffdd63"
                      >
                        Status
                      </div>
                      <div class="notebook-packages__gac40343b">
                        {selectedEntry.status}
                      </div>
                    </div>
                  </div>

                  {#if selectedEntry.issueMessages.length > 0}
                    <Separator />
                    <div class="notebook-packages__g6f7e013d">
                      <h4 class="notebook-packages__g64d8e366">Validation issues</h4>
                      <ul
                        class="notebook-packages__g19e64eb3"
                      >
                        {#each selectedEntry.issueMessages as issue}
                          <li>{issue}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  {#if selectedEntry.referencedCellIds.length > 0}
                    <Separator />
                    <div class="notebook-packages__g6f7e013d">
                      <h4 class="notebook-packages__g64d8e366">Referenced by cells</h4>
                      <div class="notebook-packages__g8a292509">
                        {#each selectedEntry.referencedCellIds as cellId}
                          <Badge variant="outline">{cellId}</Badge>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if selectedEntry.requiredByPackageNames.length > 0}
                    <Separator />
                    <div class="notebook-packages__g6f7e013d">
                      <h4 class="notebook-packages__g64d8e366">
                        Required by packages
                      </h4>
                      <div class="notebook-packages__g8a292509">
                        {#each selectedEntry.requiredByPackageNames as packageName}
                          <Badge variant="outline">{packageName}</Badge>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      {/if}
    </div>
  {/if}
</div>
