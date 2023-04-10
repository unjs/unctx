import { describe, it, expect, vi } from "vitest";
import { createContext, withAsyncContext } from "../src";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

describe("callAsync", () => {
  it("call and use", async () => {
    const context = createContext();
    expect(context.tryUse()).toBe(undefined);

    const result = await Promise.all([
      context.callAsync("A", async () => {
        expect(context.use()).toBe("A");
        await sleep(1);
        expect(context.use()).toBe("A");
        return context.use();
      }),
      context.callAsync("B", async () => {
        expect(context.use()).toBe("B");
        await sleep(1);
        expect(context.use()).toBe("B");
        return context.use();
      }),
      context.callAsync("C", async () => {
        await sleep(5);
        expect(context.use()).toBe("C");
        return context.use();
      }),
    ]);

    expect(result).toEqual(["A", "B", "C"]);
  });

  it("non transformed should unset context", async () => {
    const context = createContext();
    const _callAsync = context.callAsync; // Skip transform
    await _callAsync("A", async () => {
      expect(context.tryUse()).toBe("A");
      await sleep(1);
      expect(context.tryUse()).toBe(undefined);
    });
  });

  it("withAsyncContext", async () => {
    const context = createContext();
    const _callAsync = context.callAsync; // Skip transform
    await _callAsync(
      "A",
      withAsyncContext(async () => {
        expect(context.use()).toBe("A");
        await sleep(1);
        expect(context.use()).toBe("A");
      })
    );
  });

  it("withAsyncContext + try/catch", async () => {
    const context = createContext();
    const _callAsync = context.callAsync; // Skip transform
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const promise = async () => {
      await sleep(1);
      throw new Error("error");
    };
    await _callAsync(
      "A",
      withAsyncContext(async () => {
        expect(context.use()).toBe("A");
        try {
          await promise();
        } catch {}
        expect(context.use()).toBe("A");
      })
    );
  });

  it("withAsyncContext (not transformed)", async () => {
    const context = createContext();
    const _callAsync = context.callAsync; // Skip transform
    const _withAsyncContext = withAsyncContext;
    // eslint-disable-next-line no-console
    const _warn = console.warn;
    // eslint-disable-next-line no-console
    console.warn = vi.fn();
    await _callAsync(
      "A",
      _withAsyncContext(async () => {
        expect(context.use()).toBe("A");
        await sleep(1);
        expect(context.tryUse()).toBe(undefined);
      })
    );
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalledOnce();
    // eslint-disable-next-line no-console
    console.warn = _warn;
  });

  it("await but no async fn", async () => {
    const context = createContext();
    await context.callAsync("A", async () => {
      expect(context.use()).toBe("A");
      await noop();
      expect(context.use()).toBe("A");
      await "A";
      expect(context.use()).toBe("A");
      return context.use();
    });
  });
});
