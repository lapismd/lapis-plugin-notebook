import { expectTypeOf, test } from "vitest";
import type {
  NotebookExecutionOptions,
  NotebookExecutionResult,
  NotebookFileReaderProvider,
  NotebookJavaScriptLikeCompileProvider,
  NotebookOutput,
  NotebookRuntimeDependencyLoader,
} from "..";

test("execution contracts support typed dependency descriptors", () => {
  type Descriptor = { globalName: string };

  expectTypeOf<
    NotebookExecutionOptions<Descriptor>["runtimeDependencies"]
  >().toEqualTypeOf<readonly Descriptor[] | undefined>();
  expectTypeOf<
    NotebookRuntimeDependencyLoader<Descriptor>
  >().returns.resolves.toEqualTypeOf<unknown>();
  expectTypeOf<
    NotebookExecutionOptions<Descriptor>["compileProvider"]
  >().toEqualTypeOf<NotebookJavaScriptLikeCompileProvider | undefined>();
  expectTypeOf<
    NotebookExecutionOptions<Descriptor>["fileReaderProvider"]
  >().toEqualTypeOf<NotebookFileReaderProvider | undefined>();
  expectTypeOf<NotebookFileReaderProvider>().parameters.toEqualTypeOf<
    [path: string, sourcePath?: string]
  >();
  expectTypeOf<NotebookExecutionResult["outputs"]>().toEqualTypeOf<
    Record<string, NotebookOutput[]>
  >();
});
