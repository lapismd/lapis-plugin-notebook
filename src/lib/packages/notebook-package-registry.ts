import type { NotebookUserDependencyDescriptor } from "@lapis-notes/notebook-stdlib";

export interface NotebookPackageManifest {
  packageName: string;
  version: string;
  description?: string;
  homepage?: string;
  dependencies: Record<string, string>;
}

export interface NotebookPackageSearchResult {
  packageName: string;
  latestVersion: string;
  description?: string;
}

export interface NotebookIndirectImportMetadata {
  packageName: string;
  version: string;
  requiredByPackageNames: string[];
}

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const packageManifestCache = new Map<
  string,
  Promise<NotebookPackageManifest>
>();
const packageSearchCache = new Map<
  string,
  Promise<NotebookPackageSearchResult[]>
>();

export async function fetchNotebookPackageManifest(
  packageName: string,
  version: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<NotebookPackageManifest> {
  const trimmedPackageName = packageName.trim();
  const trimmedVersion = version.trim();
  const cacheKey = `${trimmedPackageName}@${trimmedVersion}`;
  let pending = packageManifestCache.get(cacheKey);
  if (!pending) {
    pending = fetchNotebookPackageManifestUncached(
      trimmedPackageName,
      trimmedVersion,
      fetchImpl,
    );
    packageManifestCache.set(cacheKey, pending);
  }
  return pending;
}

export async function searchNotebookPackages(
  query: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<NotebookPackageSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const cacheKey = trimmedQuery.toLowerCase();
  let pending = packageSearchCache.get(cacheKey);
  if (!pending) {
    pending = searchNotebookPackagesUncached(trimmedQuery, fetchImpl);
    packageSearchCache.set(cacheKey, pending);
  }

  return pending;
}

export async function resolveNotebookIndirectImports(
  directImports: readonly NotebookUserDependencyDescriptor[],
  loadManifest: (
    packageName: string,
    version: string,
  ) => Promise<NotebookPackageManifest> = fetchNotebookPackageManifest,
): Promise<{
  imports: NotebookIndirectImportMetadata[];
  errors: string[];
}> {
  const manifests = await Promise.allSettled(
    directImports.map(async (dependency) => ({
      dependency,
      manifest: await loadManifest(dependency.packageName, dependency.version),
    })),
  );

  const byPackage = new Map<string, NotebookIndirectImportMetadata>();
  const errors: string[] = [];

  for (const result of manifests) {
    if (result.status === "rejected") {
      errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
      continue;
    }

    const { dependency, manifest } = result.value;
    for (const [name, version] of Object.entries(manifest.dependencies)) {
      const existing = byPackage.get(name);
      if (existing) {
        if (!existing.requiredByPackageNames.includes(dependency.packageName)) {
          existing.requiredByPackageNames.push(dependency.packageName);
          existing.requiredByPackageNames.sort((left, right) =>
            left.localeCompare(right),
          );
        }
        continue;
      }

      byPackage.set(name, {
        packageName: name,
        version,
        requiredByPackageNames: [dependency.packageName],
      });
    }
  }

  return {
    imports: Array.from(byPackage.values()).sort((left, right) =>
      left.packageName.localeCompare(right.packageName),
    ),
    errors,
  };
}

async function fetchNotebookPackageManifestUncached(
  packageName: string,
  version: string,
  fetchImpl: FetchLike,
): Promise<NotebookPackageManifest> {
  if (!packageName || !version) {
    throw new Error("Package name and version are required.");
  }

  const response = await fetchImpl(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`,
  );
  if (!response.ok) {
    throw new Error(
      `Package ${packageName}@${version} was not found in the npm registry.`,
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return {
    packageName: typeof payload.name === "string" ? payload.name : packageName,
    version: typeof payload.version === "string" ? payload.version : version,
    ...(typeof payload.description === "string"
      ? { description: payload.description }
      : {}),
    ...(typeof payload.homepage === "string"
      ? { homepage: payload.homepage }
      : {}),
    dependencies: normalizeDependencyMap(payload.dependencies),
  };
}

async function searchNotebookPackagesUncached(
  query: string,
  fetchImpl: FetchLike,
): Promise<NotebookPackageSearchResult[]> {
  const response = await fetchImpl(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=8`,
  );
  if (!response.ok) {
    throw new Error(`Package search failed for ${query}.`);
  }

  const payload = (await response.json()) as {
    objects?: Array<{ package?: Record<string, unknown> }>;
  };
  return (payload.objects ?? [])
    .map((entry) => {
      const pkg = entry.package ?? {};
      const packageName = typeof pkg.name === "string" ? pkg.name : "";
      const latestVersion = typeof pkg.version === "string" ? pkg.version : "";
      if (!packageName || !latestVersion) {
        return null;
      }

      return {
        packageName,
        latestVersion,
        ...(typeof pkg.description === "string"
          ? { description: pkg.description }
          : {}),
      } satisfies NotebookPackageSearchResult;
    })
    .filter((entry): entry is NotebookPackageSearchResult => entry !== null);
}

function normalizeDependencyMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

async function defaultFetch(input: string, init?: RequestInit) {
  if (typeof fetch !== "function") {
    throw new Error("Package metadata is not available in this runtime.");
  }
  return fetch(input, init);
}
