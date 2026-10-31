const fatalStorybookDiagnostic =
  /(?:\[svelte\]|svelte\.dev\/e\/[a-z_]+|Error in mounting stories)/u;

function diagnosticMessage(args) {
  return args
    .map((value) =>
      value instanceof Error ? (value.stack ?? value.message) : String(value),
    )
    .join(" ")
    .replaceAll("%c", "");
}

function diagnosticStack(message) {
  const previousLimit = Error.stackTraceLimit;
  try {
    Error.stackTraceLimit = Math.max(previousLimit ?? 10, 50);
    return new Error(message).stack ?? message;
  } finally {
    if (previousLimit === undefined) delete Error.stackTraceLimit;
    else Error.stackTraceLimit = previousLimit;
  }
}

export function assertNoFatalStorybookRuntimeWarning(args) {
  const message = diagnosticMessage(args);
  if (!fatalStorybookDiagnostic.test(message)) return;
  throw new Error(`Storybook emitted a fatal runtime diagnostic: ${message}`);
}

/** Retain diagnostic stacks without interrupting framework cleanup. */
export function installFatalStorybookRuntimeWarningGuard(target = console) {
  const diagnostics = [];
  const originalWarn = target.warn,
    originalError = target.error;
  const wrap =
    (original) =>
    (...args) => {
      original.apply(target, args);
      const message = diagnosticMessage(args);
      if (!fatalStorybookDiagnostic.test(message)) return;
      diagnostics.push(diagnosticStack(message));
    };
  const warn = wrap(originalWarn),
    error = wrap(originalError);
  target.warn = warn;
  target.error = error;
  return {
    assertClean() {
      if (!diagnostics.length) return;
      const messages = diagnostics.splice(0);
      throw new Error(
        `Storybook emitted fatal runtime diagnostics:\n${messages.join("\n")}`,
      );
    },
    dispose() {
      if (target.warn === warn) target.warn = originalWarn;
      if (target.error === error) target.error = originalError;
    },
  };
}
