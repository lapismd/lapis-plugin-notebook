import { describe, expect, test, vi } from "vitest";
import { Generators, Promises } from "..";

describe("notebook stdlib promises and generators", () => {
  test("resolves promise helpers", async () => {
    vi.useFakeTimers();
    const delayed = Promises.delay(10, "ready");
    const whenReady = Promises.when(Date.now() + 10, "when");
    const nextTick = Promises.tick(5, "tick");

    await vi.advanceTimersByTimeAsync(10);

    await expect(delayed).resolves.toBe("ready");
    await expect(whenReady).resolves.toBe("when");
    await expect(nextTick).resolves.toBe("tick");
    vi.useRealTimers();
  });

  test("maps, filters, and ranges generator values", () => {
    const values = Array.from(
      Generators.filter(
        Generators.map(Generators.range(0, 6), (value) => value + 1),
        (value) => value % 2 === 0,
      ),
    );

    expect(values).toEqual([2, 4, 6]);
  });

  test("observes, queues, and reads input events", async () => {
    let change!: (value: number) => number;
    const observed = Generators.observe<number>((next) => {
      change = next;
      next(1);
    });
    await expect(observed.next().value).resolves.toBe(1);
    const observedNext = observed.next().value as Promise<number>;
    change(2);
    await expect(observedNext).resolves.toBe(2);

    let push!: (value: string) => string;
    const queued = Generators.queue<string>((next) => {
      push = next;
    });
    const queuedNext = queued.next().value as Promise<string>;
    push("ready");
    await expect(queuedNext).resolves.toBe("ready");

    class FakeInput extends EventTarget {
      type = "range";
      valueAsNumber = 3;
    }

    const inputNode = new FakeInput();
    const inputValues = Generators.input(
      inputNode as unknown as EventTarget & {
        type: string;
        valueAsNumber: number;
      },
    );
    await expect(inputValues.next().value).resolves.toBe(3);
    const nextInput = inputValues.next().value as Promise<unknown>;
    inputNode.valueAsNumber = 7;
    inputNode.dispatchEvent(new Event("input"));
    await expect(nextInput).resolves.toBe(7);
  });
});
