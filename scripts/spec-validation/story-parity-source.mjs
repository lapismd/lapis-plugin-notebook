import { parse } from "svelte/compiler";
import { posix } from "node:path";

const bodyKeys = [
  "nodes",
  "fragment",
  "consequent",
  "alternate",
  "body",
  "fallback",
];
export const meaningful = (nodes = []) =>
  nodes.some(
    (node) =>
      node.type !== "Comment" && (node.type !== "Text" || node.data.trim()),
  );
export const attribute = (node, name) =>
  node.attributes?.find(
    (value) => value.type === "Attribute" && value.name === name,
  );
export const literal = (value) =>
  value?.length === 1 && value[0].type === "Text" ? value[0].data : null;
export function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node))
    return node.forEach((value) => visit(value, callback));
  if (callback(node) === false) return;
  for (const key of bodyKeys) visit(node[key], callback);
}

export function createSourceModel(readOptional) {
  const modules = new Map();
  const target = (file, source) =>
    posix.normalize(posix.join(posix.dirname(file), source));
  function model(file) {
    if (modules.has(file)) return modules.get(file);
    const source = readOptional(file);
    if (source === null) throw Error(`Missing rendered source ${file}`);
    if (!file.endsWith(".svelte"))
      throw Error(`Unsupported rendered source ${file}`);
    const ast = parse(source, { modern: true }),
      imports = new Map(),
      cssImports = [];
    let component;
    for (const script of [ast.module, ast.instance])
      for (const node of script?.content.body ?? []) {
        if (
          node.type === "ImportDeclaration" &&
          node.source.value.endsWith(".css")
        )
          cssImports.push(node.source.value);
        if (node.type === "ImportDeclaration")
          for (const specifier of node.specifiers) {
            imports.set(specifier.local.name, {
              source: node.source.value,
              name:
                specifier.type === "ImportDefaultSpecifier"
                  ? "default"
                  : specifier.type === "ImportNamespaceSpecifier"
                    ? "*"
                    : specifier.imported.name,
            });
          }
        if (node.type === "VariableDeclaration")
          for (const declaration of node.declarations) {
            const call = declaration.init;
            if (
              call?.type === "CallExpression" &&
              imports.get(call.callee.name)?.source ===
                "@storybook/addon-svelte-csf"
            ) {
              component = call.arguments[0]?.properties?.find(
                (property) => property.key?.name === "component",
              )?.value;
            }
          }
      }
    const result = { ast, imports, component, cssImports };
    modules.set(file, result);
    return result;
  }
  function reference(file, name) {
    const [base, ...members] = name.split("."),
      imported = model(file).imports.get(base);
    if (!imported)
      throw Error(`Unresolved rendered component ${name} in ${file}`);
    const exported = [
      ...(imported.name === "*" ? [] : [imported.name]),
      ...members,
    ].join(".");
    return imported.source.startsWith(".")
      ? { file: target(file, imported.source), name: exported }
      : { package: imported.source, name: exported };
  }
  function styles(file, current) {
    const entries = [[file, current.ast.css?.content.styles ?? ""]],
      seen = new Set();
    const stylesheet = (owner, source) => {
      const path = target(owner, source);
      if (seen.has(path)) return;
      seen.add(path);
      const content = readOptional(path);
      if (content === null) throw Error(`Missing fixture stylesheet ${path}`);
      entries.push([path, content]);
      for (const match of content.matchAll(/@import\s+["']([^"']+)["']/g))
        if (match[1].startsWith(".")) stylesheet(path, match[1]);
    };
    for (const source of current.cssImports)
      if (source.startsWith(".")) stylesheet(file, source);
    // Fixture/root geometry may adapt the public host; private production paint may not.
    const override =
      /(?:\.(?:cm-|mira(?:-|__)?|markdown-|ui-)[\w-]*|data-ui-part\s*=)[^{]*\{[^}]*\b(?:padding|margin|width|height|display|background|color|transform|font|border)(?:-[a-z-]+)?\s*:/s;
    for (const [path, content] of entries)
      if (override.test(content))
        throw Error(`${path}: fixture styles override production presentation`);
  }
  return { model, reference, styles };
}
