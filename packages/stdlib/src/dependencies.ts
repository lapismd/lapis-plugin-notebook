import { validateNotebookGlobalName } from "./builtins";

export type NotebookDependencyResolverKind = "remote-esm" | "host";

export interface NotebookDependencyResolverDescriptor {
  kind: NotebookDependencyResolverKind;
  id?: string;
  baseUrl?: string;
}

export interface NotebookUserDependencyDescriptor {
  packageName: string;
  version: string;
  globalName?: string;
  resolver?: NotebookDependencyResolverDescriptor;
}

export interface NormalizedNotebookUserDependencyDescriptor {
  packageName: string;
  version: string;
  globalName: string;
  requestedGlobalName?: string;
  resolver: NotebookDependencyResolverDescriptor;
}

export type NotebookDependencyRegistryValidationReason =
  | "missing-package"
  | "missing-version"
  | "invalid-global"
  | "reserved-global"
  | "duplicate-global";

export interface NotebookDependencyRegistryValidationIssue {
  index: number;
  packageName?: string;
  globalName?: string;
  reason: NotebookDependencyRegistryValidationReason;
  message: string;
}

export interface NotebookDependencyRegistryValidationResult {
  ok: boolean;
  dependencies: NormalizedNotebookUserDependencyDescriptor[];
  issues: NotebookDependencyRegistryValidationIssue[];
}

export type NotebookRuntimeModuleLoader = (
  specifier: string,
) => Promise<unknown>;

const DEFAULT_DEPENDENCY_RESOLVER: NotebookDependencyResolverDescriptor = {
  kind: "remote-esm",
};
const runtimeDependencyCache = new Map<string, Promise<unknown>>();

export function deriveNotebookDependencyGlobalName(
  packageName: string,
): string {
  const name = packageName.trim();
  const unscoped = name.startsWith("@")
    ? name.split("/").slice(1).join("/")
    : name;
  const parts = unscoped
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .split(/[^A-Za-z0-9_$]+/)
    .filter(Boolean);

  const candidate = parts
    .map((part, index) =>
      index === 0 ? part : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
    )
    .join("")
    .replace(/^[^A-Za-z_$]+/, "");

  return candidate || name;
}

export function normalizeNotebookUserDependency(
  dependency: NotebookUserDependencyDescriptor,
): NormalizedNotebookUserDependencyDescriptor {
  const packageName = dependency.packageName.trim();
  const requestedGlobalName = dependency.globalName?.trim() || undefined;
  return {
    packageName,
    version: dependency.version.trim(),
    globalName:
      requestedGlobalName ?? deriveNotebookDependencyGlobalName(packageName),
    requestedGlobalName,
    resolver: dependency.resolver ?? DEFAULT_DEPENDENCY_RESOLVER,
  };
}

export function validateNotebookDependencyRegistry(
  dependencies: readonly NotebookUserDependencyDescriptor[],
): NotebookDependencyRegistryValidationResult {
  const normalized = dependencies.map(normalizeNotebookUserDependency);
  const issues: NotebookDependencyRegistryValidationIssue[] = [];
  const seenGlobals = new Set<string>();

  normalized.forEach((dependency, index) => {
    if (!dependency.packageName) {
      issues.push({
        index,
        reason: "missing-package",
        message: "Package name is required.",
      });
    }
    if (!dependency.version) {
      issues.push({
        index,
        packageName: dependency.packageName,
        reason: "missing-version",
        message: "Package version is required.",
      });
    }

    const globalValidation = validateNotebookGlobalName(
      dependency.globalName,
      seenGlobals,
    );
    if (!globalValidation.ok) {
      issues.push({
        index,
        packageName: dependency.packageName,
        globalName: dependency.globalName,
        reason: mapGlobalValidationReason(globalValidation.reason),
        message:
          globalValidation.message ?? "Dependency global name is invalid.",
      });
    }

    seenGlobals.add(dependency.globalName);
  });

  return {
    ok: issues.length === 0,
    dependencies: normalized,
    issues,
  };
}

export async function loadReferencedNotebookDependencyGlobals(
  source: string,
  dependencies: readonly NormalizedNotebookUserDependencyDescriptor[],
  loader: (
    dependency: NormalizedNotebookUserDependencyDescriptor,
  ) => Promise<unknown> = loadNotebookRuntimeDependency,
): Promise<Array<[string, unknown]>> {
  const referencedDependencies = dependencies.filter((dependency) =>
    sourceReferencesIdentifier(source, dependency.globalName),
  );

  return Promise.all(
    referencedDependencies.map(
      async (dependency) =>
        [dependency.globalName, await loader(dependency)] satisfies [
          string,
          unknown,
        ],
    ),
  );
}

export async function loadNotebookRuntimeDependency(
  dependency: NormalizedNotebookUserDependencyDescriptor,
  loadModule: NotebookRuntimeModuleLoader = loadNotebookRuntimeModule,
): Promise<unknown> {
  const specifier = resolveRuntimeDependencySpecifier(dependency);
  const cacheKey = `${dependency.resolver.kind}:${specifier}:${dependency.globalName}`;
  let pending = runtimeDependencyCache.get(cacheKey);
  if (!pending) {
    pending = loadModule(specifier).then((module) => {
      const namespace = module as Record<string, unknown>;
      return namespace.default ?? namespace;
    });
    runtimeDependencyCache.set(cacheKey, pending);
  }
  return pending;
}

export function resolveRuntimeDependencySpecifier(
  dependency: NormalizedNotebookUserDependencyDescriptor,
): string {
  if (dependency.resolver.kind !== "remote-esm") {
    throw new Error(
      `Notebook dependency resolver ${dependency.resolver.kind} is not available in this runtime.`,
    );
  }

  const baseUrl = (dependency.resolver.baseUrl ?? "https://esm.sh").replace(
    /\/+$/,
    "",
  );
  return `${baseUrl}/${dependency.packageName}@${dependency.version}`;
}

export function sourceReferencesIdentifier(
  source: string,
  identifier: string,
): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}(?=$|[^A-Za-z0-9_$])`).test(
    source,
  );
}

async function loadNotebookRuntimeModule(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ specifier);
}

function mapGlobalValidationReason(
  reason: ReturnType<typeof validateNotebookGlobalName>["reason"],
): NotebookDependencyRegistryValidationReason {
  switch (reason) {
    case "reserved":
      return "reserved-global";
    case "duplicate":
      return "duplicate-global";
    case "empty":
    case "invalid-identifier":
    default:
      return "invalid-global";
  }
}
