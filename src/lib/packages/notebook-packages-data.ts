import type { TFile } from "@lapis-notes/api";
import {
  normalizeNotebookUserDependency,
  sourceReferencesIdentifier,
  validateNotebookDependencyRegistry,
  type NotebookDependencyResolverDescriptor,
  type NotebookUserDependencyDescriptor,
} from "@lapis-notes/notebook-stdlib";
import type { NotebookDocument } from "../model/notebook-document";
import type { NotebookIndirectImportMetadata } from "./notebook-package-registry";

export interface NotebookPackageEntry {
  id: string;
  kind: "configured" | "indirect";
  entryIndex: number | null;
  packageName: string;
  version: string;
  globalName?: string;
  requestedGlobalName?: string;
  resolver?: NotebookDependencyResolverDescriptor;
  usedInNotebook: boolean;
  referencedCellIds: string[];
  issueMessages: string[];
  status: "configured" | "invalid";
  requiredByPackageNames: string[];
}

export interface NotebookPackagesSnapshot {
  sourcePath: string;
  title: string;
  hasActiveNotebook: boolean;
  directImports: NotebookPackageEntry[];
  indirectImports: NotebookPackageEntry[];
  availableImports: NotebookPackageEntry[];
  indirectImportsStatus: {
    kind: "ready" | "unavailable" | "error";
    message: string;
  };
}

export function buildNotebookPackagesSnapshot(args: {
  file: Pick<TFile, "path" | "basename">;
  document: NotebookDocument;
  runtimeDependencies: readonly NotebookUserDependencyDescriptor[];
  hasActiveNotebook?: boolean;
  indirectImports?: readonly NotebookIndirectImportMetadata[];
  indirectImportsStatus?: NotebookPackagesSnapshot["indirectImportsStatus"];
}): NotebookPackagesSnapshot {
  const { file, document, runtimeDependencies } = args;
  const validation = validateNotebookDependencyRegistry(runtimeDependencies);
  const issuesByIndex = new Map<number, string[]>();
  for (const issue of validation.issues) {
    const messages = issuesByIndex.get(issue.index) ?? [];
    messages.push(issue.message);
    issuesByIndex.set(issue.index, messages);
  }

  const dependencyCells = document.cells.filter(
    (cell) => cell.lang === "js" || cell.lang === "ts",
  );
  const availableImports = runtimeDependencies.map((dependency, entryIndex) => {
    const normalized = normalizeNotebookUserDependency(dependency);
    const referencedCellIds = dependencyCells
      .filter((cell) =>
        sourceUsesRuntimeDependency(
          cell.source,
          normalized.packageName,
          normalized.globalName,
        ),
      )
      .map((cell) => cell.id);
    const issueMessages = issuesByIndex.get(entryIndex) ?? [];

    return {
      id: `package:${entryIndex}:${normalized.globalName || normalized.packageName || "entry"}`,
      kind: "configured",
      entryIndex,
      packageName: normalized.packageName,
      version: normalized.version,
      globalName: normalized.globalName,
      requestedGlobalName: normalized.requestedGlobalName,
      resolver: normalized.resolver,
      usedInNotebook: referencedCellIds.length > 0,
      referencedCellIds,
      issueMessages,
      status: issueMessages.length > 0 ? "invalid" : "configured",
      requiredByPackageNames: [],
    } satisfies NotebookPackageEntry;
  });

  const indirectImports = (args.indirectImports ?? []).map(
    (entry) =>
      ({
        id: `indirect:${entry.packageName}`,
        kind: "indirect",
        entryIndex: null,
        packageName: entry.packageName,
        version: entry.version,
        usedInNotebook: true,
        referencedCellIds: [],
        issueMessages: [],
        status: "configured",
        requiredByPackageNames: [...entry.requiredByPackageNames],
      }) satisfies NotebookPackageEntry,
  );

  return {
    sourcePath: file.path,
    title: file.basename,
    hasActiveNotebook: args.hasActiveNotebook ?? true,
    directImports: availableImports.filter((entry) => entry.usedInNotebook),
    indirectImports,
    availableImports,
    indirectImportsStatus: args.indirectImportsStatus ?? {
      kind: "unavailable",
      message: "Transitive package metadata is not available yet.",
    },
  };
}

function sourceUsesRuntimeDependency(
  source: string,
  packageName: string,
  globalName?: string,
): boolean {
  if (globalName && sourceReferencesIdentifier(source, globalName)) {
    return true;
  }

  return sourceImportsPackageSpecifier(source, packageName);
}

function sourceImportsPackageSpecifier(
  source: string,
  packageName: string,
): boolean {
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const staticImportPattern = new RegExp(
    String.raw`(?:^|[\r\n;])\s*import(?!\s+type\b)(?:[\s\S]*?\s+from\s+)?["']${escapedPackageName}["']`,
    "m",
  );

  if (staticImportPattern.test(source)) {
    return true;
  }

  const dynamicImportPattern = new RegExp(
    String.raw`\bimport\s*\(\s*["']${escapedPackageName}["']\s*\)`,
    "m",
  );

  return dynamicImportPattern.test(source);
}
