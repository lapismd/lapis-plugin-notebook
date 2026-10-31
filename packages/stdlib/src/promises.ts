const timeouts = new Map<number, Promise<void>>();

export function delay<T = unknown>(
  duration: number,
  value?: T,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, duration);
  });
}

export function when<T = unknown>(
  time: number | Date,
  value?: T,
): Promise<T | undefined> {
  const target = +time;
  const scheduled = timeouts.get(target);
  if (scheduled) {
    return scheduled.then(() => value);
  }

  const now = Date.now();
  if (now >= target) {
    return Promise.resolve(value);
  }

  return createTimeout(now, target).then(() => value);
}

export function tick<T = unknown>(
  duration: number,
  value?: T,
): Promise<T | undefined> {
  return when(Math.ceil((Date.now() + 1) / duration) * duration, value);
}

export const Promises = Object.freeze({
  delay,
  tick,
  when,
});

function createTimeout(now: number, time: number): Promise<void> {
  const timeoutPromise = new Promise<void>((resolve) => {
    timeouts.delete(time);
    const remaining = time - now;
    if (!(remaining > 0)) {
      throw new Error("invalid time");
    }
    if (remaining > 0x7fffffff) {
      throw new Error("too long to wait");
    }
    setTimeout(resolve, remaining);
  });
  timeouts.set(time, timeoutPromise);
  return timeoutPromise;
}

/** Promise helpers owned by one cell, disposed through its invalidation lease. */
export function createNotebookPromises(
  invalidation: Promise<void>,
): typeof Promises {
  const pending = new Set<() => void>();
  let invalidated = false;
  void invalidation.then(() => {
    invalidated = true;
    for (const cancel of pending) cancel();
    pending.clear();
  });
  const scopedDelay = <T = unknown>(
    duration: number,
    value?: T,
  ): Promise<T | undefined> =>
    new Promise((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer);
        pending.delete(cancel);
        const error = new Error("Notebook execution cancelled");
        error.name = "AbortError";
        reject(error);
      };
      const timer = setTimeout(
        () => {
          pending.delete(cancel);
          resolve(value);
        },
        Math.max(0, duration),
      );
      pending.add(cancel);
      if (invalidated) cancel();
    });
  const scopedWhen = <T = unknown>(time: number | Date, value?: T) =>
    scopedDelay(Math.max(0, +time - Date.now()), value);
  return Object.freeze({
    delay: scopedDelay,
    when: scopedWhen,
    tick: <T = unknown>(duration: number, value?: T) =>
      scopedWhen(Math.ceil((Date.now() + 1) / duration) * duration, value),
  });
}
