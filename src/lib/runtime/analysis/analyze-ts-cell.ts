import { transformObservableViewof } from "@lapis-notes/notebook-input";
import { RESERVED_NOTEBOOK_GLOBAL_NAMES } from "@lapis-notes/notebook-stdlib";
import { typescriptLanguage } from "@codemirror/lang-javascript";

const DECLARATION_RE =
  /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
const IDENTIFIER_RE = /\b[A-Za-z_$][\w$]*\b/g;
const RESERVED = new Set([
  ...RESERVED_NOTEBOOK_GLOBAL_NAMES,
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export interface NotebookCellAnalysis {
  defs: string[];
  refs: string[];
}

export function analyzeTsCell(source: string): NotebookCellAnalysis {
  const transformed = transformObservableViewof(source);
  const code = transformed.code;
  // Only identifiers represented by syntax tokens can contribute. Strings,
  // comments and template text have no identifier leaves; ${...} expressions
  // inside a template retain their ordinary syntax tokens.
  const identifierOffsets = new Set<number>();
  typescriptLanguage.parser.parse(code).iterate({
    enter(node) {
      if (
        !node.node.firstChild &&
        /^[A-Za-z_$][\w$]*$/.test(code.slice(node.from, node.to))
      ) {
        identifierOffsets.add(node.from);
      }
    },
  });
  const defs = Array.from(code.matchAll(DECLARATION_RE))
    .filter((match) =>
      identifierOffsets.has(match.index + match[0].lastIndexOf(match[1]!)),
    )
    .map((match) => match[1]!);
  const defSet = new Set(defs);
  const names = Array.from(code.matchAll(IDENTIFIER_RE))
    .filter((match) => {
      if (!identifierOffsets.has(match.index)) return false;
      let preceding = match.index - 1;
      while (preceding >= 0 && /\s/.test(code[preceding]!)) preceding--;
      return code[preceding] !== ".";
    })
    .map((match) => match[0]);
  const refs = names.filter(
    (name, index, names) =>
      !RESERVED.has(name) && !defSet.has(name) && names.indexOf(name) === index,
  );

  return {
    defs,
    refs,
  };
}
