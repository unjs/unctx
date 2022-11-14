import { describe, it, expect, vi } from "vitest";
import { createContext, createNamespace } from "../src";

describe("createContext", () => {
  it("call and use", () => {
    const context = createContext();
    expect(() => context.use()).toThrowError();
    expect(context.tryUse()).toBe(undefined);

    const result = context.call("A", () => {
      expect(context.use()).toBe("A");
      expect(context.use()).toBe("A");
      return "OK";
    });
    expect(result).toBe("OK");
  });

  it("context conflict", () => {
    const context = createContext();
    expect(context.tryUse()).toBe(undefined);
    context.call("A", () => {
      expect(() => context.call("B", vi.fn())).toThrow("Context conflict");
    });
  });

  it("unset on error", () => {
    const context = createContext();
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const throwError = () => { throw new Error("Foo"); };
    expect(() => context.call("A", throwError)).toThrow("Foo");
    expect(() => context.call("B", throwError)).toThrow("Foo");
  });

  it("use async", async () => {
    const context = createContext();
    expect(context.tryUse()).toBe(undefined);
    const result = await context.call("A", async () => {
      expect(context.use()).toBe("A");
      await Promise.resolve();
      expect(context.tryUse()).toBe(undefined);
      return "OK";
    });
    expect(result).toBe("OK");
  });
});

describe("namespace", () => {
  it("createNamespace", () => {
    const ns = createNamespace();
    expect(ns.get("A")).toBe(ns.get("A"));
  });
});

describe("singleton", () => {
  it("set/unset", () => {
    const context = createContext();
    expect(context.tryUse()).toBe(undefined);
    context.set("A");
    context.set("A");
    expect(context.use()).toBe("A");
    expect(context.use()).toBe("A");
    context.unset();
    expect(context.tryUse()).toBe(undefined);
  });

  it("call compatibility", () => {
    const context = createContext();
    context.set("A");
    context.call("A", () => {});
    expect(context.use()).toBe("A");
  });

  it("conflict", () => {
    const context = createContext();
    context.set("A");
    expect(() => context.set("B")).toThrow("Context conflict");
  });

  it("replace", () => {
    const context = createContext();
    context.set("A");
    context.set("B", true);
    expect(context.use()).toBe("B");
  });
});
