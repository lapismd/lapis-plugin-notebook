import { describe, expect, it } from "vitest";
import { auditStoryParity } from "./storybook-parity.mjs";

const story = (template = "", component = "Harness") => `<script module>
import { defineMeta } from '@storybook/addon-svelte-csf';
import Harness from './Harness.svelte';
const { Story } = defineMeta({ component: ${component} });
</script><Story name="Example">${template}</Story>`;
const shell = `<script>import { WorkspaceShell as Shell } from '@lapis-notes/workspace';</script><Shell {app} />`;
const audit = (source, contract = { kind: "application" }, extra = {}) => {
  const contents = {
    "src/Example.stories.svelte": source,
    "src/Harness.svelte": shell,
    ...extra,
  };
  return auditStoryParity({
    files: Object.keys(contents),
    contracts: { "src/Example.stories.svelte": contract },
    readOptional: (path) => contents[path] ?? null,
  });
};

describe("Notebook CSF-Svelte story composition", () => {
  it("follows the rendered default component to the public shell", () => {
    expect(audit(story())).toEqual([]);
  });
  it("does not count an unused shell import", () => {
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": shell.replace(
          "<Shell {app} />",
          "<div>Replacement</div>",
        ),
      }),
    ).not.toEqual([]);
  });
  it("follows the template rather than the metadata component", () => {
    expect(
      audit(story("{#snippet template()}<div>Fake</div>{/snippet}")),
    ).not.toEqual([]);
  });
  it("rejects duplicate production roots", () => {
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": shell + "<Shell {app} />",
      }),
    ).not.toEqual([]);
  });
  it("fails closed on asynchronous and raw HTML fixture branches", () => {
    for (const branch of [
      "{#await request}<button>Debug</button>{/await}",
      "{@html replacement}",
    ]) {
      expect(
        audit(story(), undefined, { "src/Harness.svelte": shell + branch }),
      ).not.toEqual([]);
    }
  });
  it("checks the actual component subject", () => {
    expect(
      audit(story(), {
        kind: "component",
        subject: "src/Harness.svelte#default",
      }),
    ).toEqual([]);
    expect(
      audit(story(), {
        kind: "component",
        subject: "src/Other.svelte#default",
      }),
    ).not.toEqual([]);
  });
  it("rejects production presentation overrides in application fixtures", () => {
    for (const selector of [".cm-editor", ".mira__pane", ".ui-menu-content"]) {
      expect(
        audit(story(), undefined, {
          "src/Harness.svelte":
            shell +
            `<style>:global(${selector}) { background: white; }</style>`,
        }),
      ).not.toEqual([]);
    }
  });
  it("rejects unisolated synthetic application controls", () => {
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": shell + "<button>Debug</button>",
      }),
    ).not.toEqual([]);
  });
  it("allows setup controls only through the visible fixture boundary", () => {
    const harness =
      shell.replace(
        "</script>",
        "import FixtureControls from './stories/FixtureControls.svelte';</script>",
      ) + "<FixtureControls><button>Reset</button></FixtureControls>";
    const controls =
      '<aside data-story-fixture-controls="true" aria-label="Story setup"><span>Story setup</span></aside><style>aside { position: absolute; border: 2px dotted gray; padding: 8px; }</style>';
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": harness,
        "src/stories/FixtureControls.svelte": controls,
      }),
    ).toEqual([]);
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": harness,
        "src/stories/FixtureControls.svelte": controls.replace(
          "dotted",
          "solid",
        ),
      }),
    ).not.toEqual([]);
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": harness.replace(
          "<FixtureControls>",
          '<FixtureControls placement="inline">',
        ),
        "src/stories/FixtureControls.svelte": controls,
      }),
    ).not.toEqual([]);
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": harness.replace(
          "<button>Reset</button>",
          "<Harness />",
        ),
        "src/stories/FixtureControls.svelte": controls,
      }),
    ).not.toEqual([]);
  });
  it("checks imported fixture stylesheets", () => {
    const harness = shell.replace(
      "</script>",
      "import './fixture.css';</script>",
    );
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": harness,
        "src/fixture.css": ".cm-editor { background: white; }",
      }),
    ).not.toEqual([]);
  });
  it("rejects replacement children of the production shell", () => {
    expect(
      audit(story(), undefined, {
        "src/Harness.svelte": shell.replace("/>", ">replacement</Shell>"),
      }),
    ).not.toEqual([]);
  });
  it("requires a specific declared prototype purpose", () => {
    expect(audit(story(), { kind: "prototype" })).not.toEqual([]);
    expect(
      audit(story(), {
        kind: "prototype",
        requirement: "LN-NB-001",
        reason: "Documents the intentionally non-runtime catalog boundary.",
      }),
    ).toEqual([]);
  });
  it("rejects missing and stale inventory entries", () => {
    expect(
      auditStoryParity({
        files: ["src/New.stories.svelte"],
        contracts: {},
        readOptional: () => story(),
      }),
    ).not.toEqual([]);
    expect(
      auditStoryParity({
        files: [],
        contracts: { "src/Old.stories.svelte": { kind: "application" } },
        readOptional: () => null,
      }),
    ).not.toEqual([]);
  });
  it("rejects stale named overrides", () => {
    expect(
      audit(story(), {
        kind: "application",
        stories: { Removed: { kind: "application" } },
      }),
    ).not.toEqual([]);
  });
  it("fails closed on unsupported future CSF formats", () => {
    expect(
      auditStoryParity({
        files: ["src/New.stories.ts"],
        contracts: { "src/New.stories.ts": { kind: "application" } },
        readOptional: () => "export default {}",
      }),
    ).not.toEqual([]);
  });
});
