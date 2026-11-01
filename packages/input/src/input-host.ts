export function createNotebookInputHost<TValue>({
  inputType,
  initialValue,
  onMount,
}: {
  inputType: string;
  initialValue: TValue;
  onMount: (
    host: HTMLElement,
    mountTarget: HTMLElement,
    currentValue: TValue,
    setCurrentValue: (value: TValue) => void,
    dispatchInput: () => void,
  ) =>
    | (() => void)
    | {
        dispose: () => void;
        updateValue: (value: TValue) => void;
      };
}): HTMLElement {
  const host = document.createElement("div");
  host.className = `lapis-notebook-input lapis-notebook-input--${inputType}`;
  host.dataset.notebookInputType = inputType;

  let currentValue = initialValue;
  let disposeMountedControl = () => {};
  let updateMountedValue: ((value: TValue) => void) | undefined;

  const mountControl = () => {
    disposeMountedControl();
    const mountTarget = document.createElement("div");
    mountTarget.className = "lapis-notebook-input__mount";
    const control = onMount(
      host,
      mountTarget,
      currentValue,
      (nextValue) => {
        currentValue = nextValue;
      },
      () => {
        host.dispatchEvent(new Event("input", { bubbles: true }));
      },
    );
    disposeMountedControl =
      typeof control === "function" ? control : control.dispose;
    updateMountedValue =
      typeof control === "function" ? undefined : control.updateValue;
    if (!host.contains(mountTarget)) {
      host.replaceChildren(mountTarget);
    }
  };

  Object.defineProperty(host, "value", {
    configurable: true,
    get() {
      return currentValue;
    },
    set(nextValue: TValue) {
      currentValue = nextValue;
      if (updateMountedValue) updateMountedValue(nextValue);
      else mountControl();
    },
  });

  mountControl();

  Object.defineProperty(host, "__lapisNotebookInputDispose", {
    configurable: true,
    enumerable: false,
    value: () => {
      disposeMountedControl();
      host.replaceChildren();
    },
  });

  return host;
}
