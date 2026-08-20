import { AsyncLocalStorage } from "node:async_hooks";
import v8 from "node:v8";
import vm from "node:vm";
import { describe, it, expect, vi } from "vitest";
import { createContext, executeAsync } from "../src/index.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Obtain a `gc()` function without requiring the `--expose-gc` node flag so the
// memory-leak regression test runs in any environment (including CI).
const gc: () => void = (() => {
  if (typeof globalThis.gc === "function") return globalThis.gc;
  try {
    v8.setFlagsFromString("--expose-gc");
    return vm.runInNewContext("gc");
  } catch {
    return undefined as unknown as () => void;
  }
})();

describe("Async context", () => {
  it("AsyncLocalStorage works", async () => {
    const asl = new AsyncLocalStorage<string>();
    let _ctxInstance: string | undefined;
    await new Promise<void>((resolve) => {
      asl.run("A", () => {
        setTimeout(() => {
          _ctxInstance = asl.getStore();
          resolve();
        }, 1);
      });
    });
    expect(_ctxInstance).toBe("A");
    expect(asl.getStore()).toBe(undefined);
  });

  it("uses the built-in AsyncLocalStorage by default", async () => {
    const context = createContext({ asyncContext: true });

    await new Promise<void>((resolve) => {
      context.call("A", () => {
        setTimeout(() => {
          expect(context.use()).toBe("A");
          resolve();
        }, 1);
      });
    });

    expect(context.tryUse()).toBe(null);
  });

  it("call and use", async () => {
    const context = createContext({
      asyncContext: true,
      AsyncLocalStorage,
    });

    expect(context.tryUse()).toBe(null);

    // Rename to avoid async transform
    const _callAsync = context.callAsync;
    const _call = context.callAsync;

    const result = await Promise.all([
      _callAsync("A", async () => {
        expect(context.use()).toBe("A");
        await sleep(1);
        expect(context.use()).toBe("A");
        return context.use();
      }),
      _call("B", async () => {
        expect(context.use()).toBe("B");
        await sleep(2);
        expect(context.use()).toBe("B");
        return context.use();
      }),
      _callAsync("C", async () => {
        await sleep(5);
        expect(context.use()).toBe("C");
        return context.use();
      }),
    ]);

    expect(result).toEqual(["A", "B", "C"]);
  });

  it.runIf(typeof gc === "function")(
    "does not leak instances pinned by long-lived async resources",
    async () => {
      const context = createContext<{ id: number; payload: Uint8Array }>({
        asyncContext: true,
        AsyncLocalStorage,
      });

      // A long-lived timer created *inside* the call pins the ALS store for its
      // whole lifetime. Without a WeakRef wrapper this keeps the whole instance
      // alive. The timer callback intentionally does not reference the instance.
      const liveTimers: NodeJS.Timeout[] = [];

      let collected = 0;
      const total = 20;
      const registry = new FinalizationRegistry(() => collected++);

      for (let i = 0; i < total; i++) {
        let instance: { id: number; payload: Uint8Array } | undefined = {
          id: i,
          payload: new Uint8Array(1024 * 1024),
        };
        registry.register(instance, i);

        context.call(instance, () => {
          // context is still readable inside the call
          expect(context.use().id).toBe(i);
          liveTimers.push(setInterval(() => {}, 1_000_000));
        });

        instance = undefined; // drop the only strong reference
      }

      for (let i = 0; i < 12; i++) {
        gc();
        await sleep(5);
      }

      for (const timer of liveTimers) {
        clearInterval(timer);
      }

      // All instances must be collectable even though their timers are alive.
      expect(collected).toBe(total);
    },
  );

  it("Context from use match correct context", async () => {
    const context = createContext({
      asyncContext: true,
      AsyncLocalStorage,
    });

    for (let i = 0; i < 10; i++) {
      context.callAsync({ i }, async () => {
        const contexts = new Set();

        const runAsyncOpAndPushContext = async () => {
          contexts.add(context.use());
          // Use then to avoid code transformation
          await sleep(1).then(() => {
            contexts.add(context.use());
          });
        };

        const [__temp, __restore] = executeAsync(() =>
          runAsyncOpAndPushContext(),
        );
        await __temp;
        __restore();

        expect(contexts.size).toEqual(1);
      });
    }
  });
});

describe("WeakRef fallback", () => {
  it("works in runtimes without a global WeakRef (e.g. workerd)", async () => {
    const original = globalThis.WeakRef;
    // The shim is resolved at module load, so the module must be re-imported
    // with `WeakRef` absent from the global scope.
    delete (globalThis as any).WeakRef;
    vi.resetModules();
    try {
      const { createContext: create } = await import("../src/index.ts");
      const context = create<{ id: number }>({
        asyncContext: true,
        AsyncLocalStorage,
      });
      const instance = { id: 1 };
      await context.callAsync(instance, async () => {
        expect(context.use()).toBe(instance);
        await sleep(1);
      });
      expect(context.tryUse()).toBe(null);
    } finally {
      globalThis.WeakRef = original;
      vi.resetModules();
    }
  });
});
