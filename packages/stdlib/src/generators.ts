export interface NotebookGenerator<T> extends Iterator<Promise<T> | T> {
  [Symbol.iterator](): NotebookGenerator<T>;
}

export function observe<T>(
  initialize: (change: (value: T) => T) => void | (() => void),
): NotebookGenerator<T> {
  let stale = false;
  let value: T;
  let resolve: ((value: T) => void) | null = null;
  const dispose = initialize(change);

  if (dispose != null && typeof dispose !== "function") {
    throw new Error(
      typeof (dispose as { then?: unknown }).then === "function"
        ? "async initializers are not supported"
        : "initializer returned something, but not a dispose function",
    );
  }

  function change(nextValue: T): T {
    if (resolve) {
      resolve(nextValue);
      resolve = null;
    } else {
      stale = true;
    }
    value = nextValue;
    return nextValue;
  }

  return {
    [Symbol.iterator]() {
      return this;
    },
    throw() {
      return { done: true, value: undefined };
    },
    return() {
      dispose?.();
      return { done: true, value: undefined };
    },
    next() {
      return {
        done: false,
        value: stale
          ? ((stale = false), Promise.resolve(value))
          : new Promise<T>((next) => {
              resolve = next;
            }),
      };
    },
  };
}

export function queue<T>(
  initialize: (push: (value: T) => T) => void | (() => void),
): NotebookGenerator<T> {
  let resolve: ((value: T) => void) | null = null;
  const values: T[] = [];
  const dispose = initialize(push);

  if (dispose != null && typeof dispose !== "function") {
    throw new Error(
      typeof (dispose as { then?: unknown }).then === "function"
        ? "async initializers are not supported"
        : "initializer returned something, but not a dispose function",
    );
  }

  function push(nextValue: T): T {
    values.push(nextValue);
    if (resolve) {
      resolve(values.shift() as T);
      resolve = null;
    }
    return nextValue;
  }

  return {
    [Symbol.iterator]() {
      return this;
    },
    throw() {
      return { done: true, value: undefined };
    },
    return() {
      dispose?.();
      return { done: true, value: undefined };
    },
    next() {
      return {
        done: false,
        value: values.length
          ? Promise.resolve(values.shift() as T)
          : new Promise<T>((next) => {
              resolve = next;
            }),
      };
    },
  };
}

export function* map<T, U>(
  iterator: Iterator<T>,
  transform: (value: T, index: number) => U,
): Generator<U> {
  let result: IteratorResult<T>;
  let index = -1;
  while (!(result = iterator.next()).done) {
    yield transform(result.value, ++index);
  }
}

export function* filter<T>(
  iterator: Iterator<T>,
  test: (value: T, index: number) => boolean,
): Generator<T> {
  let result: IteratorResult<T>;
  let index = -1;
  while (!(result = iterator.next()).done) {
    if (test(result.value, ++index)) {
      yield result.value;
    }
  }
}

export function* range(
  start: number,
  stop?: number,
  step?: number,
): Generator<number> {
  let rangeStart = +start;
  let rangeStop = +stop!;
  let rangeStep = step;

  if (arguments.length < 2) {
    rangeStop = rangeStart;
    rangeStart = 0;
    rangeStep = 1;
  } else if (arguments.length < 3) {
    rangeStep = 1;
  }

  const length =
    Math.max(0, Math.ceil((rangeStop - rangeStart) / (rangeStep as number))) |
    0;
  for (let index = 0; index < length; index += 1) {
    yield rangeStart + index * (rangeStep as number);
  }
}

type NotebookInputLike = EventTarget & {
  type?: string;
  value?: string;
  valueAsNumber?: number;
  valueAsDate?: Date | null;
  checked?: boolean;
  files?: FileList | File[] | null;
  multiple?: boolean;
  selectedOptions?: ArrayLike<{ value: string }>;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
};

export function input(
  inputNode: NotebookInputLike,
): NotebookGenerator<unknown> {
  return observe((change) => {
    const event = eventOf(inputNode);
    const value = valueOf(inputNode);
    function inputted() {
      change(valueOf(inputNode));
    }

    inputNode.addEventListener(event, inputted);
    if (value !== undefined) {
      change(value);
    }
    return () => {
      inputNode.removeEventListener(event, inputted);
    };
  });
}

export const Generators = Object.freeze({
  filter,
  input,
  map,
  observe,
  queue,
  range,
});

function valueOf(inputNode: NotebookInputLike): unknown {
  switch (inputNode.type) {
    case "range":
    case "number":
      return inputNode.valueAsNumber;
    case "date":
      return inputNode.valueAsDate;
    case "checkbox":
      return inputNode.checked;
    case "file":
      if (!inputNode.files) {
        return undefined;
      }
      if (Array.isArray(inputNode.files)) {
        return inputNode.multiple ? inputNode.files : inputNode.files[0];
      }
      return inputNode.multiple ? inputNode.files : inputNode.files[0];
    case "select-multiple":
      return inputNode.selectedOptions
        ? Array.from(inputNode.selectedOptions, (option) => option.value)
        : [];
    default:
      return inputNode.value;
  }
}

function eventOf(inputNode: NotebookInputLike): string {
  switch (inputNode.type) {
    case "button":
    case "submit":
    case "checkbox":
      return "click";
    case "file":
      return "change";
    default:
      return "input";
  }
}
