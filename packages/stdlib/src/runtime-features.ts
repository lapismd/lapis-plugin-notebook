export interface NotebookRuntimeFeatureSource {
  lang: string;
  source: string;
}

export function cellUsesDuckDbRuntime(
  cell: NotebookRuntimeFeatureSource,
): boolean {
  return cell.lang === "sql" || hasDuckDbRuntimeReference(cell.source);
}

export function hasDuckDbRuntimeReference(source: string): boolean {
  return /\blapis\.duckdb\b/.test(source);
}

export function hasDomRuntimeReference(source: string): boolean {
  return (
    /(^|[^A-Za-z0-9_$])DOM\s*\./.test(source) ||
    /\blapis\.DOM\s*\./.test(source) ||
    /\bInputs\s*\./.test(source) ||
    /\bhtml\s*`/.test(source) ||
    /\bsvg\s*`/.test(source) ||
    /\blapis\.Inputs\s*\./.test(source) ||
    /\blapis\.html\s*`/.test(source) ||
    /\blapis\.svg\s*`/.test(source) ||
    /\blapis\.view\s*\(/.test(source) ||
    hasPlotRuntimeReference(source)
  );
}

export function hasLiveDomRuntimeReference(source: string): boolean {
  return (
    /(^|[^A-Za-z0-9_$])DOM\s*\.(?!uid\b)/.test(source) ||
    /\blapis\.DOM\s*\.(?!uid\b)/.test(source) ||
    /\bInputs\s*\./.test(source) ||
    /\bhtml\s*`/.test(source) ||
    /\bsvg\s*`/.test(source) ||
    /\blapis\.Inputs\s*\./.test(source) ||
    /\blapis\.html\s*`/.test(source) ||
    /\blapis\.svg\s*`/.test(source) ||
    /\blapis\.view\s*\(/.test(source) ||
    hasPlotRuntimeReference(source)
  );
}

export function hasD3RuntimeReference(source: string): boolean {
  return (
    /(^|[^A-Za-z0-9_$])d3(?=$|[^A-Za-z0-9_$])/.test(source) ||
    /\blapis\.d3\b/.test(source)
  );
}

export function hasPlotRuntimeReference(source: string): boolean {
  return (
    /(^|[^A-Za-z0-9_$])Plot(?=$|[^A-Za-z0-9_$])/.test(source) ||
    /\blapis\.Plot\b/.test(source)
  );
}
