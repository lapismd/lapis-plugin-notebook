export interface NotebookWorkerRuntimePolicyInput {
  workerAvailable: boolean;
  usesDuckDb: boolean;
  requiresDom: boolean;
  requiresLiveDom?: boolean;
  hasRuntimeDependencyLoader?: boolean;
  hasUnsupportedRuntimeDependency?: boolean;
  hasHostOnlyProvider?: boolean;
}

export function shouldUseNotebookWorkerRuntime(
  input: NotebookWorkerRuntimePolicyInput,
): boolean {
  return (
    input.workerAvailable &&
    !input.usesDuckDb &&
    !(input.requiresLiveDom ?? input.requiresDom) &&
    !input.hasRuntimeDependencyLoader &&
    !input.hasUnsupportedRuntimeDependency &&
    !input.hasHostOnlyProvider
  );
}

export function hasUnsupportedNotebookWorkerRuntimeDependency(
  dependencies: readonly { resolver: { kind: string } }[] | undefined,
): boolean {
  return (
    dependencies?.some(
      (dependency) => dependency.resolver.kind !== "remote-esm",
    ) ?? false
  );
}
