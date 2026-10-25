type KeyNavOptions = {
  focusSearch?: () => void;
  toggleFilters?: () => void;
  clearOverlay?: () => void;
};

export function keyNav(node: HTMLElement, options: KeyNavOptions = {}) {
  function handleKeydown(event: KeyboardEvent) {
    const isMeta = event.metaKey || event.ctrlKey;

    if (isMeta && event.key.toLowerCase() === "f" && !event.shiftKey) {
      event.preventDefault();
      options.focusSearch?.();
      return;
    }

    if (isMeta && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      options.toggleFilters?.();
      return;
    }

    if (event.key === "Escape") {
      options.clearOverlay?.();
    }
  }

  node.addEventListener("keydown", handleKeydown);

  return {
    update(nextOptions: KeyNavOptions) {
      options = nextOptions;
    },
    destroy() {
      node.removeEventListener("keydown", handleKeydown);
    },
  };
}
