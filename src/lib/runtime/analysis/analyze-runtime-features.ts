import {
  cellUsesDuckDbRuntime,
  hasDomRuntimeReference,
  hasLiveDomRuntimeReference,
} from "@lapis-notes/notebook-stdlib";
import { transformObservableViewof } from "@lapis-notes/notebook-input";
import type { NotebookRuntimeFeatures } from "@lapis-notes/notebook-core";
import type { NotebookDocument } from "../../model/notebook-document";

export { hasDomRuntimeReference } from "@lapis-notes/notebook-stdlib";
export type { NotebookRuntimeFeatures } from "@lapis-notes/notebook-core";

export function analyzeNotebookRuntimeFeatures(
  document: NotebookDocument,
): NotebookRuntimeFeatures {
  return document.cells.reduce<NotebookRuntimeFeatures>(
    (features, cell) => {
      const source = cell.source;
      const viewof =
        cell.lang === "ts" || cell.lang === "js"
          ? transformObservableViewof(source).requiresDom
          : false;

      return {
        requiresDom:
          features.requiresDom || viewof || hasDomRuntimeReference(source),
        requiresLiveDom:
          features.requiresLiveDom ||
          viewof ||
          hasLiveDomRuntimeReference(source),
        usesDuckDb: features.usesDuckDb || cellUsesDuckDbRuntime(cell),
      };
    },
    { requiresDom: false, requiresLiveDom: false, usesDuckDb: false },
  );
}
