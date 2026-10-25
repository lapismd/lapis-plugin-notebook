import { expectTypeOf, test } from "vitest";
import type { NotebookRuntimeFeatures } from "..";

test("runtime feature contract exposes host-neutral feature flags", () => {
  expectTypeOf<NotebookRuntimeFeatures>().toEqualTypeOf<{
    requiresDom: boolean;
    requiresLiveDom: boolean;
    usesDuckDb: boolean;
  }>();
});
