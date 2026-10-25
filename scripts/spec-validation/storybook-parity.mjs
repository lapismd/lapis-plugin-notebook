import { posix } from "node:path";
import {
  attribute,
  createSourceModel,
  literal,
  meaningful,
  visit,
} from "./story-parity-source.mjs";

const storyPattern = /\.stories\.(?:[cm]?[jt]sx?|svelte)$/;
export function auditStoryParity({
  files,
  contracts,
  readOptional,
  rule = "LPN-SPEC-012",
}) {
  const findings = [];
  const { model, reference, styles } = createSourceModel(readOptional);
  const add = (file, message, offset = 0) =>
    findings.push({
      code: "STORYBOOK-PARITY",
      rule,
      file,
      line:
        (readOptional(file)?.slice(0, offset).match(/\n/g)?.length ?? 0) + 1,
      message,
    });
  function inspect(file, fragment, selected, stack = []) {
    let roots = 0;
    visit(fragment, (node) => {
      if (
        [
          "SvelteComponent",
          "SvelteElement",
          "RenderTag",
          "HtmlTag",
          "AwaitBlock",
        ].includes(node.type)
      )
        throw Error("Unresolved dynamic component or render branch");
      if (
        node.type === "RegularElement" &&
        ["button", "input", "select", "textarea", "form"].includes(node.name)
      )
        throw Error("Fixture contains unisolated synthetic controls");
      if (node.type !== "Component") return;
      const ref = reference(file, node.name);
      const identity = `${ref.file ?? ref.package}#${ref.name}`;
      if (
        ref.file === "src/stories/FixtureControls.svelte" &&
        ref.name === "default"
      ) {
        const controls = model(ref.file),
          css = controls.ast.css?.content.styles ?? "";
        const frame = controls.ast.fragment.nodes.find(
          (value) =>
            value.type === "RegularElement" &&
            value.name === "aside" &&
            literal(attribute(value, "data-story-fixture-controls")?.value) ===
              "true",
        );
        if (
          !frame ||
          literal(attribute(frame, "aria-label")?.value) !== "Story setup" ||
          !frame.fragment.nodes.some(
            (value) =>
              value.type === "RegularElement" &&
              value.fragment.nodes.some(
                (child) =>
                  child.type === "Text" && child.data.trim() === "Story setup",
              ),
          ) ||
          !/border\s*:\s*2px\s+dotted/.test(css) ||
          !/padding\s*:/.test(css) ||
          !/position\s*:\s*absolute/.test(css)
        )
          throw Error(
            "FixtureControls must retain its labelled padded dotted-border overlay boundary",
          );
        const placement = attribute(node, "placement");
        if (
          node.attributes.some((value) => value.type === "SpreadAttribute") ||
          (selected.kind === "application" &&
            placement &&
            literal(placement.value) !== "overlay")
        )
          throw Error(
            "Application setup controls must remain an overlay outside production geometry",
          );
        visit(node.fragment, (child) => {
          if (
            ["Component", "SvelteComponent", "RenderTag"].includes(child.type)
          )
            throw Error(
              "Setup controls may contain native controls, not hidden production components or dynamic renders",
            );
        });
        return false;
      }
      const matches =
        selected.kind === "application"
          ? identity === "@lapis-notes/workspace#WorkspaceShell"
          : identity === selected.subject;
      if (matches) {
        roots += 1;
        if (
          selected.kind === "application" &&
          (meaningful(node.fragment?.nodes) ||
            node.attributes.some(
              (value) =>
                value.type === "SpreadAttribute" ||
                ["children", "content", "template"].includes(value.name),
            ))
        )
          throw Error(
            "Production shell replacement children or unresolved props are forbidden",
          );
        return false;
      }
      if (ref.file) {
        if (stack.includes(ref.file))
          throw Error("Recursive fixture composition cannot be proved");
        const current = model(ref.file);
        if (selected.kind === "application") styles(ref.file, current);
        const reached = inspect(ref.file, current.ast.fragment, selected, [
          ...stack,
          ref.file,
        ]);
        if (selected.kind === "application" && !reached)
          throw Error(
            `${ref.file}: alternate rendered component does not reach the production shell`,
          );
        roots += reached;
      } else if (selected.kind === "application")
        throw Error(`Unproved application component ${identity}`);
      return false;
    });
    return roots;
  }
  const stories = files.filter((file) => storyPattern.test(file));
  for (const file of Object.keys(contracts))
    if (!stories.includes(file))
      add(file, "Stale story classification: source is absent");
  for (const file of stories) {
    const contract = contracts[file];
    if (
      !contract ||
      !["application", "component", "prototype", "integration"].includes(
        contract.kind,
      )
    ) {
      add(file, "Every executable family must declare its coverage kind");
      continue;
    }
    if (["prototype", "integration"].includes(contract.kind)) {
      if (
        !/^(?:LN-NB|LPN-SPEC)-\d{3}$/.test(contract.requirement ?? "") ||
        typeof contract.reason !== "string" ||
        contract.reason.length < 30
      )
        add(
          file,
          "Prototype/integration coverage needs a governing requirement and specific purpose",
        );
      continue;
    }
    try {
      const current = model(file),
        entries = [];
      visit(current.ast.fragment, (node) => {
        if (node.type === "Component" && node.name === "Story") {
          entries.push(node);
          return false;
        }
      });
      if (!entries.length)
        throw Error("Classified family exports no executable Svelte stories");
      const names = entries.map((node) =>
        literal(attribute(node, "name")?.value),
      );
      if (names.some((name) => !name) || new Set(names).size !== names.length)
        throw Error("Story names must be unique static literals");
      for (const name of Object.keys(contract.stories ?? {}))
        if (!names.includes(name)) add(file, `Stale story override: ${name}`);
      for (const [index, entry] of entries.entries()) {
        const selected = contract.stories?.[names[index]] ?? contract;
        if (
          !["application", "component"].includes(selected.kind) ||
          (selected.kind === "component" &&
            !/^(?:@(?:lapis-notes|lapismd)\/[\w./-]+#[\w.]+|src\/(?!.*\.\.)[\w./-]+\.svelte#default)$/.test(
              selected.subject ?? "",
            ))
        ) {
          add(file, `${names[index]}: invalid coverage subject`, entry.start);
          continue;
        }
        try {
          if (selected.kind === "application") styles(file, current);
          const snippets =
            entry.fragment?.nodes?.filter(
              (node) =>
                node.type === "SnippetBlock" &&
                node.expression?.name === "template",
            ) ?? [];
          let rendered;
          if (snippets.length === 1) rendered = snippets[0].body;
          else if (meaningful(entry.fragment?.nodes))
            throw Error("Cannot prove the selected story template");
          else {
            if (current.component?.type !== "Identifier")
              throw Error("Cannot resolve the default metadata component");
            rendered = {
              nodes: [
                {
                  type: "Component",
                  name: current.component.name,
                  attributes: [],
                  fragment: { nodes: [] },
                },
              ],
            };
          }
          const roots = inspect(file, rendered, selected, [file]);
          if (selected.kind === "application" ? roots !== 1 : roots < 1)
            throw Error(
              `Rendered path reaches ${roots} ${selected.kind === "application" ? "production WorkspaceShell roots; exactly one is required" : "declared subjects"}`,
            );
        } catch (error) {
          add(file, `${names[index]}: ${error.message}`, entry.start);
        }
      }
    } catch (error) {
      add(file, error.message);
    }
  }
  return findings;
}

export function validate(context) {
  const readOptional = (file) =>
    context.readOptional(posix.join(context.model.repoRoot, file));
  const inventory = readOptional("stories/catalog/story-parity.json");
  if (!inventory)
    return [
      {
        code: "STORYBOOK-PARITY",
        rule: "LPN-SPEC-012",
        file: "stories/catalog/story-parity.json",
        line: 1,
        message: "Story coverage inventory is missing",
      },
    ];
  return auditStoryParity({
    files: context.trackedFiles,
    contracts: JSON.parse(inventory),
    readOptional,
  });
}
export default { name: "notebookStoryCompositionParity", validate };
