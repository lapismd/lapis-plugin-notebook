type ClosestLike = {
  closest: (selector: string) => unknown;
};

const NOTEBOOK_INTERACTIVE_SELECTOR = [
  "input",
  "select",
  "textarea",
  "button",
  "a[href]",
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="slider"]',
  '[role="textbox"]',
  '[role="spinbutton"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  ".cm-editor",
  ".cm-content",
  ".cm-scroller",
].join(", ");

function hasClosest(
  value: EventTarget | null,
): value is EventTarget & ClosestLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "closest" in value &&
    typeof value.closest === "function"
  );
}

export function shouldIgnoreNotebookSectionClick(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  if (!hasClosest(target) || currentTarget === null) {
    return false;
  }

  const interactiveAncestor = target.closest(NOTEBOOK_INTERACTIVE_SELECTOR);
  return interactiveAncestor !== null && interactiveAncestor !== currentTarget;
}

export function shouldHandleNotebookSectionKeydown(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  return target === currentTarget;
}
