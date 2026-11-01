// Existing full-shell accessibility policy, shared by functional and media stories.
export const workspaceA11y = {
  test: "error",
  // Mira's numbered code-block highlight palette fails color-contrast
  // upstream (flagged to the Mira owner and recorded); exclude that
  // upstream chrome while everything else in the shell stays scanned.
  context: { exclude: [".mira-code-block"] },
  config: {
    rules: [
      // Full-shell rows intentionally compose nested workspace controls.
      { id: "nested-interactive", enabled: false },
      // CodeMirror owns its aria-hidden gutter focus behavior upstream.
      { id: "aria-hidden-focus", enabled: false },
    ],
  },
} as const;
