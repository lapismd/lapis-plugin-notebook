/** Reactive public props keep imperative notebook controls mounted on updates. */
export function createNotebookControlProps<T extends Record<string, unknown>>(
  initial: T,
): T {
  const props = $state(initial);
  return props;
}

/** Model methods own mutable state; only the revision is Svelte state. */
export function createNotebookModelProps<T>(model: T) {
  let revision = $state(0);
  return {
    get model() {
      return model;
    },
    get revision() {
      return revision;
    },
    update() {
      revision++;
    },
  };
}
