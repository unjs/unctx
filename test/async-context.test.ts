import { AsyncLocalStorage } from "node:async_hooks";
import { describe, it, expect } from "vitest";
import { createContext, executeAsync } from "../src/index.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  it("call and use", async () => {
    const context = createContext({
      asyncContext: true,
      AsyncLocalStorage,
    });

    expect(context.tryUse()).toBe(undefined);

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
