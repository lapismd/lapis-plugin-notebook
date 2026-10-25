const STORY_FILE = /^src\/(?:lib|stories)\/.*\.stories\.(?:svelte|[cm]?[jt]sx?)$/;
const TITLE_PATTERN = /\btitle\s*:\s*["']([^"']+)["']/;

function finding(file, source, message) {
  const titleMatch = source.match(TITLE_PATTERN);
  const offset = titleMatch?.index ?? 0;
  return {
    code: "NOTEBOOK-STORY-TAXONOMY",
    file,
    line: source.slice(0, offset).split("\n").length,
    message,
  };
}

export function auditStorySource(
  source,
  file = "src/lib/fixture.stories.svelte",
) {
  const title = source.match(TITLE_PATTERN)?.[1];
  if (!title) {
    return [
      finding(file, source, "Notebook stories must declare an explicit Storybook title"),
    ];
  }
  if (!title.startsWith("Plugins/Notebook/")) {
    return [
      finding(
        file,
        source,
        `story title '${title}' must be nested under Plugins/Notebook`,
      ),
    ];
  }
  return [];
}

function rule(context) {
  const mapped = context.config.diagnostics["NOTEBOOK-STORY-TAXONOMY"];
  if (!mapped) {
    throw new Error("missing diagnostic mapping for NOTEBOOK-STORY-TAXONOMY");
  }
  return mapped;
}

export const name = "storybookTaxonomyAudit";

export function validate(context) {
  const findings = [];
  for (const file of context.trackedFiles
    .filter((entry) => STORY_FILE.test(entry))
    .sort()) {
    const source = context.readOptional(`${context.model.repoRoot}/${file}`);
    if (source === null) continue;
    for (const entry of auditStorySource(source, file)) {
      findings.push({ ...entry, rule: rule(context) });
    }
  }
  return findings;
}
