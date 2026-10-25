type TerminableRuntime = {
  terminate: () => Promise<void>;
};

export class NotebookRuntimeRegistry<TRuntime extends TerminableRuntime> {
  private readonly runtimes = new Map<string, Promise<TRuntime>>();

  constructor(private readonly createRuntime: () => Promise<TRuntime>) {}

  get(sourcePath?: string | null): Promise<TRuntime> {
    const key = runtimeKey(sourcePath);
    const existing = this.runtimes.get(key);
    if (existing) {
      return existing;
    }

    const runtimePromise = this.createRuntime().catch((error) => {
      if (this.runtimes.get(key) === runtimePromise) {
        this.runtimes.delete(key);
      }
      throw error;
    });
    this.runtimes.set(key, runtimePromise);
    return runtimePromise;
  }

  peek(sourcePath?: string | null): Promise<TRuntime> | null {
    return this.runtimes.get(runtimeKey(sourcePath)) ?? null;
  }

  async terminate(sourcePath?: string | null): Promise<void> {
    const key = runtimeKey(sourcePath);
    const runtimePromise = this.runtimes.get(key);
    this.runtimes.delete(key);

    if (!runtimePromise) {
      return;
    }

    const runtime = await runtimePromise.catch(() => null);
    if (!runtime) {
      return;
    }

    await runtime.terminate();
  }

  async terminateAll(): Promise<void> {
    const runtimePromises = Array.from(this.runtimes.values());
    this.runtimes.clear();

    const runtimes = await Promise.all(
      runtimePromises.map((runtimePromise) => runtimePromise.catch(() => null)),
    );

    await Promise.all(runtimes.map((runtime) => runtime?.terminate()));
  }
}

function runtimeKey(sourcePath?: string | null): string {
  return sourcePath && sourcePath.length > 0 ? sourcePath : "__untitled__";
}
