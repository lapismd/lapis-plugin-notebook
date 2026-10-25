import { expectTypeOf, test } from "vitest";
import type {
  NotebookCell,
  NotebookCellLanguage,
  NotebookDocument,
  NotebookDocumentBlock,
  NotebookFrontmatter,
} from "..";

test("model contracts describe notebook documents and cells", () => {
  expectTypeOf<NotebookCellLanguage>().toEqualTypeOf<
    "ts" | "js" | "sql" | "md" | "html"
  >();
  expectTypeOf<NotebookDocument["cells"]>().toEqualTypeOf<NotebookCell[]>();
  expectTypeOf<NotebookDocument["blocks"]>().toEqualTypeOf<
    NotebookDocumentBlock[]
  >();
  expectTypeOf<
    NotebookDocument["frontmatter"]
  >().toEqualTypeOf<NotebookFrontmatter | null>();
});
